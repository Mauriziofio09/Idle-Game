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
import { dailySeed, normaliseSeed, stateToSeed } from '../engine/rng';
import {
  COLLECTION_IDS,
  SYSTEM_IDS,
  createInitialState,
  floorCount,
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
import {
  bankRun,
  fragmentsUnlocked,
  protocolSlotsFor,
  relocateUnlocked,
  scenarioUnlocked,
  unitsToScenario,
  totalSent as legacyTotalSent,
  unitsToNextFragment,
  unitsToNextSlot,
  type LegacyRecord,
} from '../engine/legacy';
import { PROTOCOLS, SCENARIO_IDS, type ScenarioId } from '../engine/balance';
import { describe, type LogEntry } from './log';
import { SaveService } from './save';

/** Why the archive did not come back the way it was left. */
export type StartupNotice = 'broken' | 'from-backup' | 'link-ignored' | null;

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
  readonly floorCount = computed(() => floorCount(this._state()));
  readonly scenarioId = computed(() => this._state().scenarioId);
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

  private readonly _legacy = signal<LegacyRecord>(this.saves.readLegacy());
  readonly legacy = this._legacy.asReadonly();
  readonly legacyTotal = computed(() => legacyTotalSent(this._legacy()));
  readonly legacyFragments = computed(() => fragmentsUnlocked(this._legacy()));
  readonly legacyNextFragment = computed(() => unitsToNextFragment(this._legacy()));
  readonly legacyNextSlot = computed(() => unitsToNextSlot(this._legacy()));
  readonly relocateUnlocked = computed(() => relocateUnlocked(this._legacy()));

  scenarioUnlocked(id: string): boolean {
    return scenarioUnlocked(this._legacy(), id);
  }

  unitsToScenario(id: string): number | null {
    return unitsToScenario(this._legacy(), id);
  }

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
  initialize(
    now: number,
    linkedSeed: string | null = null,
    linkedScenario: string | null = null,
  ): AwayReport | null {
    this.simulatedUntilMs = now;

    const seedFromLink = linkedSeed ? normaliseSeed(linkedSeed) : null;
    // A link names the house as well as the seed; an unknown one falls back to the
    // standard archive rather than refusing the link.
    const houseFromLink: ScenarioId = (SCENARIO_IDS as readonly string[]).includes(
      linkedScenario ?? '',
    )
      ? (linkedScenario as ScenarioId)
      : 'standard';
    const outcome = this.saves.load();

    // A shared link asks for a specific archive. It is honoured when nothing would be
    // destroyed: no save at all, a save of that same archive, or a run already over.
    if (seedFromLink) {
      const saved = outcome.kind === 'loaded' ? outcome.save.file.state : null;
      if (!saved || saved.seed === seedFromLink || saved.ended) {
        if (saved?.seed !== seedFromLink || saved.scenarioId !== houseFromLink) {
          // No banking here. At this point `_state` still holds the placeholder the
          // field initializer built; banking it would count an archive that was never
          // played and inflate the run counter the legacy panel shows.
          this.beginArchive(seedFromLink, now, houseFromLink);
          return null;
        }
      } else {
        this._startupNotice.set('link-ignored');
      }
    }

    if (outcome.kind === 'broken') {
      // Both slots are unreadable. Say so rather than handing over a new archive
      // as if nothing had happened; the unreadable data is kept aside meanwhile.
      this._startupNotice.set('broken');
      return null;
    }
    if (outcome.kind !== 'loaded') {
      // No archive to restore, so this is a first run — and it starts with the slots
      // the legacy has earned, not with the bare minimum.
      this._state.set(
        createInitialState(this._state().seed, {
          protocolSlots: protocolSlotsFor(this._legacy()),
        }),
      );
      return null;
    }
    if (outcome.save.fromBackup) {
      this._startupNotice.set('from-backup');
    }

    const restored = this.withAllowedProtocols(outcome.save.file.state);
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
    // A run can end during the catch-up just as easily as while being watched, and
    // what it transmitted counts either way.
    if (!before.ended && result.state.ended) {
      this.bank(result.state);
    }

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
    this.bankIfUnfinished();
    this._state.set(this.withAllowedProtocols(result.file.state));
    this.simulatedUntilMs = now;
    this._startupNotice.set(null);
    this._selection.set(null);
    this.openLog();
    this.note(LOG_SESSION.resumed);
    return { ok: true };
  }

  /**
   * Ends this run and starts a new archive. The legacy is untouched — and it decides how
   * many protocol slots the next archive begins with.
   */
  startNewArchive(now = Date.now(), seed = freshSeed(), scenarioId?: ScenarioId): void {
    // The run being replaced is real, so whatever it transmitted counts first.
    this.bankIfUnfinished();
    this.beginArchive(seed, now, scenarioId ?? this._state().scenarioId);
  }

  /**
   * Today's archive: the same seed for everyone, all day — and therefore always the
   * standard house. Playing the date's seed in a different building would give two
   * players different archives on the same day, which is the whole point of it.
   */
  startDailyArchive(now = Date.now()): void {
    const today = new Date(now);
    const seed = dailySeed(today.getFullYear(), today.getMonth() + 1, today.getDate());
    this.startNewArchive(now, seed, 'standard');
  }

  /** Puts a new archive in place. Banking, if any, is the caller's decision. */
  private beginArchive(seed: string, now: number, scenarioId: ScenarioId = 'standard'): void {
    this.saves.clearRun();
    this._state.set(
      createInitialState(seed, {
        protocolSlots: protocolSlotsFor(this._legacy()),
        scenarioId,
      }),
    );
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
    const wasEnded = this._state().ended;
    const result = simulateInChunks(this._state(), ticks);
    this._state.set(result.state);
    this.simulatedUntilMs += ticks * TICK_MS;
    this.record(result.events.map((event) => ({ event, tick: event.tick })));
    if (!wasEnded && result.state.ended) {
      this.bank(result.state);
    }
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
    return SYSTEM_IDS.filter((id) => systemFloor(this._state(), id) === floor);
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

  /**
   * Folds a finished run into the legacy, once. Everything transmitted counts for good;
   * prompt.md 5.12 keeps the unlocks to knowledge and options, never to multipliers.
   */
  /**
   * Drops rules the legacy has not paid for.
   *
   * prompt.md 5.9 gates relocation behind an unlock, and the engine runs whatever is in
   * the state. A save can be hand-edited or imported, so the gate has to be applied
   * where the state enters the game, not only where the editor offers the action.
   */
  private withAllowedProtocols(state: GameState): GameState {
    if (relocateUnlocked(this._legacy())) {
      return state;
    }
    const allowed = state.protocols.filter((rule) => rule.action.type !== 'relocate');
    return allowed.length === state.protocols.length ? state : { ...state, protocols: allowed };
  }

  private bank(state: GameState): void {
    const banked = bankRun(this._legacy(), state);
    this._legacy.set(banked);
    this.saves.writeLegacy(banked);
    // Write the ended run straight away. Leaving it to the next autosave would let a
    // reload re-simulate the same interval, end the run again, and bank it twice.
    this.saves.write(state, this.simulatedUntilMs);
  }

  /**
   * Folds a run that is being thrown away into the legacy first.
   *
   * prompt.md 5.12: everything transmitted counts, permanently. Resetting mid-run or
   * importing over a live archive must not quietly delete what already got out. A run
   * that has already ended was banked when it ended, so it is skipped.
   */
  private bankIfUnfinished(): void {
    const state = this._state();
    if (!state.ended) {
      this.bank(state);
    }
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
    const floors = floorCount(this._state());
    for (const { event, tick } of events) {
      const described = describe(event, floors);
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
