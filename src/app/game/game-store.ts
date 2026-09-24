/**
 * The bridge between the pure engine and the interface.
 *
 * Holds the current run in a signal, funnels every player action through the engine's
 * single `applyAction` path, and keeps the archive log. It owns no rules of its own —
 * anything that decides an outcome lives in src/app/engine.
 */

import { Injectable, computed, inject, signal } from '@angular/core';

import { LOG, LOG_SESSION } from '../content/de';
import type { Action } from '../engine/actions';
import { applyAction, canApply, dismantleYield, repairPreview } from '../engine/actions';
import { ENERGY, ENTROPY, METRES_PER_FLOOR, UI_THRESHOLDS } from '../engine/balance';
import { OFFLINE, TICK_MS } from '../engine/balance';
import { simulateInChunks } from '../engine/offline';
import { stateToSeed } from '../engine/rng';
import {
  COLLECTION_IDS,
  SYSTEM_IDS,
  createInitialState,
  isFlooded,
  savedShare,
  systemFloor,
  type CollectionId,
  type GameState,
  type SystemId,
} from '../engine/state';
import { decayMultiplier, demand, production } from '../engine/step';
import { buildAwayReport, type AwayReport } from './away-report';
import type { ProtocolCondition, ProtocolRule } from '../engine/protocol-types';
import { cooldownSeconds, depotIsWorking } from '../engine/protocols';
import { PROTOCOLS } from '../engine/balance';
import { describe, type LogEntry } from './log';
import { SaveService } from './save';

/** Why the archive did not come back the way it was left. */
export type StartupNotice = 'broken' | 'from-backup' | null;

/** What the player has focused in the cross-section. */
export type Selection =
  | { kind: 'system'; id: SystemId }
  | { kind: 'collection'; id: CollectionId }
  | { kind: 'floor'; index: number }
  | null;

/** The log keeps this many lines; a long catch-up must not grow it without bound. */
const MAX_LOG_ENTRIES = 120;

@Injectable({ providedIn: 'root' })
export class GameStore {
  private readonly saves = inject(SaveService);

  private readonly _state = signal<GameState>(createInitialState(freshSeed()));
  private readonly _log = signal<LogEntry[]>([]);
  private readonly _selection = signal<Selection>(null);
  private nextLogId = 0;

  readonly state = this._state.asReadonly();
  /** Newest line first, as the panel renders it. */
  readonly log = this._log.asReadonly();
  readonly selection = this._selection.asReadonly();

  readonly ended = computed(() => this._state().ended);
  readonly seed = computed(() => this._state().seed);
  readonly savedShare = computed(() => savedShare(this._state()));

  /** Net energy per second: what the generator makes minus what is switched on. */
  readonly energyRate = computed(() => production(this._state()) - demand(this._state()));
  readonly decayMultiplier = computed(() => decayMultiplier(this._state().entropy));
  readonly waterMetres = computed(() => this._state().water * METRES_PER_FLOOR);
  readonly energyShare = computed(() => (this._state().energy / ENERGY.capacity) * 100);

  /** False when the browser refuses storage; the settings panel says so plainly. */
  readonly canSave = this.saves.available;

  /**
   * The wall-clock moment the current state corresponds to.
   *
   * This, not `Date.now()`, is what a save records. A hidden tab freezes the
   * simulation but not the autosave timer, so writing the current clock would
   * declare hours of frozen time as already simulated and quietly erase them.
   */
  private simulatedUntilMs = Date.now();

  /** Set when the archive could not be loaded as written. The player is told. */
  private readonly _startupNotice = signal<StartupNotice>(null);
  readonly startupNotice = this._startupNotice.asReadonly();

  constructor() {
    this.openLog();
  }

  /**
   * Called once at startup. Restores a saved archive and simulates the time away
   * through the ordinary engine path, or leaves the fresh run in place.
   *
   * prompt.md section 9: dt is clamped to [0, 24 h]; a clock that moved backwards
   * counts as zero; beyond the window the archive goes into emergency stasis and
   * simply does not decay further.
   */
  initialize(now: number): AwayReport | null {
    this.simulatedUntilMs = now;

    const outcome = this.saves.load();
    if (outcome.kind === 'broken') {
      // Both slots are unreadable. Say so rather than handing over a new archive
      // as if nothing had happened; the unreadable data is kept aside meanwhile.
      this._startupNotice.set('broken');
      return null;
    }
    if (outcome.kind !== 'loaded') {
      return null;
    }
    if (outcome.save.fromBackup) {
      this._startupNotice.set('from-backup');
    }

    const restored = outcome.save.file.state;
    this._state.set(restored);
    this.note(LOG_SESSION.resumed);

    const absentMs = Math.max(0, now - outcome.save.file.savedAt);
    const windowMs = OFFLINE.maxHours * 60 * 60 * 1000;
    const stasis = absentMs > windowMs;
    const ticks = Math.floor(Math.min(absentMs, windowMs) / 1000);

    const before = restored;
    const result = simulateInChunks(before, ticks);
    this._state.set(result.state);
    this.record(result.events.map((event) => ({ event, tick: event.tick })));

    // Beyond the window nothing decayed, so the archive is current as of now.
    // Inside it, the state is current as of the last tick actually simulated.
    this.simulatedUntilMs = stasis ? now : outcome.save.file.savedAt + ticks * TICK_MS;

    if (stasis) {
      this.note(LOG_SESSION.stasis);
    }

    return buildAwayReport({
      before,
      after: result.state,
      events: result.events,
      absentSeconds: Math.floor(absentMs / 1000),
      simulatedSeconds: result.ticks,
      stasis,
      fromBackup: outcome.save.fromBackup,
    });
  }

  /** Writes the current run. Called on a timer and whenever the page goes away. */
  persist(): void {
    this.saves.write(this._state(), this.simulatedUntilMs);
  }

  dismissStartupNotice(): void {
    this._startupNotice.set(null);
  }

  exportRun(now: number): string {
    return this.saves.exportRun(this._state(), now);
  }

  /** Replaces the running archive with an imported one, or reports why it could not. */
  importRun(text: string, now = Date.now()): { ok: true } | { ok: false; problem: string } {
    const result = this.saves.importRun(text);
    if (!result.ok) {
      return { ok: false, problem: result.problem };
    }
    this._state.set(result.file.state);
    this.simulatedUntilMs = now;
    this._startupNotice.set(null);
    this._selection.set(null);
    this.openLog();
    this.note(LOG_SESSION.resumed);
    return { ok: true };
  }

  /** Ends this run and starts a new archive. The legacy is untouched. */
  startNewArchive(now = Date.now()): void {
    this.saves.clearRun();
    this._state.set(createInitialState(freshSeed()));
    this.simulatedUntilMs = now;
    this._startupNotice.set(null);
    this._selection.set(null);
    this.openLog();
    this.note(LOG_SESSION.newArchive);
  }

  select(selection: Selection): void {
    this._selection.set(selection);
  }

  /** Runs `ticks` steps through the engine and folds the events into the log. */
  advance(ticks: number): void {
    if (ticks <= 0 || this._state().ended) {
      return;
    }
    const result = simulateInChunks(this._state(), ticks);
    this._state.set(result.state);
    this.simulatedUntilMs += ticks * TICK_MS;
    this.record(result.events.map((event) => ({ event, tick: event.tick })));
  }

  dispatch(action: Action): boolean {
    const result = applyAction(this._state(), action);
    if (!result.applied) {
      return false;
    }
    this._state.set(result.state);
    this.record(result.events.map((event) => ({ event, tick: event.tick })));
    return true;
  }

  canApply(action: Action): boolean {
    return canApply(this._state(), action);
  }

  repairPreview(id: SystemId) {
    return repairPreview(this._state(), id);
  }

  dismantleYield(id: SystemId): number {
    return dismantleYield(this._state(), id);
  }

  /** True while a system is worth warning about — never signalled by colour alone. */
  isCritical(id: SystemId): boolean {
    const system = this._state().systems[id];
    return !system.lost && system.integrity < UI_THRESHOLDS.criticalIntegrity;
  }

  systemsOnFloor(floor: number): SystemId[] {
    return SYSTEM_IDS.filter((id) => systemFloor(id) === floor);
  }

  collectionsOnFloor(floor: number): CollectionId[] {
    const state = this._state();
    return COLLECTION_IDS.filter((id) => state.collections[id].floor === floor);
  }

  floorIsFlooded(floor: number): boolean {
    return isFlooded(this._state(), floor);
  }

  /* ------------------------------------------------------------- protocols */

  readonly protocols = computed(() => this._state().protocols);
  readonly protocolSlots = computed(() => this._state().protocolSlots);
  readonly materialReserve = computed(() => this._state().materialReserve);
  readonly canAddProtocol = computed(
    () => this._state().protocols.length < this._state().protocolSlots,
  );
  /** True while the depot is able to run protocols at all. */
  readonly depotWorking = computed(() => depotIsWorking(this._state()));
  readonly depotCooldownSeconds = computed(() => cooldownSeconds(this._state()));

  /**
   * Builds and appends a rule in one step. The id is derived from the rules already in
   * the state, so creating and adding must not be separable — two rules built before
   * either is added would otherwise be handed the same id.
   */
  addProtocol(condition: ProtocolCondition, action: ProtocolRule['action']): ProtocolRule | null {
    if (!this.canAddProtocol()) {
      return null;
    }
    const rule = this.buildRule(condition, action);
    this._state.update((state) => ({ ...state, protocols: [...state.protocols, rule] }));
    return rule;
  }

  removeProtocol(id: string): void {
    this._state.update((state) => ({
      ...state,
      protocols: state.protocols.filter((rule) => rule.id !== id),
    }));
  }

  updateProtocol(id: string, change: Partial<Omit<ProtocolRule, 'id'>>): void {
    this._state.update((state) => ({
      ...state,
      protocols: state.protocols.map((rule) => (rule.id === id ? { ...rule, ...change } : rule)),
    }));
  }

  /** Moves a rule in the priority order. The first match that is affordable wins. */
  moveProtocol(id: string, direction: -1 | 1): void {
    this._state.update((state) => {
      const rules = [...state.protocols];
      const from = rules.findIndex((rule) => rule.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= rules.length) {
        return state;
      }
      [rules[from], rules[to]] = [rules[to], rules[from]];
      return { ...state, protocols: rules };
    });
  }

  setMaterialReserve(value: number): void {
    const clamped = Math.max(0, Math.min(PROTOCOLS.maxMaterialReserve, Math.round(value)));
    this._state.update((state) => ({ ...state, materialReserve: clamped }));
  }

  /**
   * An id no existing rule holds. Derived from the current rules rather than a counter,
   * so ids restored from a save can never be handed out twice.
   */
  private buildRule(condition: ProtocolCondition, action: ProtocolRule['action']): ProtocolRule {
    const used = new Set(this._state().protocols.map((rule) => rule.id));
    let index = 1;
    while (used.has(`r${index}`)) {
      index++;
    }
    return { id: `r${index}`, condition, action, enabled: true, firedCount: 0 };
  }

  entropyPerRepair(): number {
    return ENTROPY.perRepair;
  }

  entropyPerDismantle(): number {
    return ENTROPY.perDismantle;
  }

  private openLog(): void {
    this._log.set(
      LOG.opening
        .map((text) => ({ tick: 0, text, kind: 'note' as const, id: this.nextLogId++ }))
        .reverse(),
    );
  }

  /** A line that comes from the session rather than from the engine. */
  private note(text: string): void {
    this._log.update((current) =>
      [
        { tick: this._state().tick, text, kind: 'note' as const, id: this.nextLogId++ },
        ...current,
      ].slice(0, MAX_LOG_ENTRIES),
    );
  }

  private record(events: { event: Parameters<typeof describe>[0]; tick: number }[]): void {
    const lines: LogEntry[] = [];
    for (const { event, tick } of events) {
      const described = describe(event);
      if (described) {
        lines.push({ tick, text: described.text, kind: described.kind, id: this.nextLogId++ });
      }
    }
    if (lines.length === 0) {
      return;
    }
    this._log.update((current) => [...lines.reverse(), ...current].slice(0, MAX_LOG_ENTRIES));
  }
}

/** A different archive on every load. Seed links and saved runs arrive in later milestones. */
function freshSeed(): string {
  return stateToSeed(Date.now() ^ Math.floor(Math.random() * 0xffffffff));
}
