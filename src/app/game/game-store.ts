/**
 * The bridge between the pure engine and the interface.
 *
 * Holds the current run in a signal, funnels every player action through the engine's
 * single `applyAction` path, and keeps the archive log. It owns no rules of its own —
 * anything that decides an outcome lives in src/app/engine.
 */

import { Injectable, computed, signal } from '@angular/core';

import { LOG } from '../content/de';
import type { Action } from '../engine/actions';
import { applyAction, canApply, dismantleYield, repairPreview } from '../engine/actions';
import { ENERGY, ENTROPY, METRES_PER_FLOOR, UI_THRESHOLDS } from '../engine/balance';
import { simulate } from '../engine/offline';
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
import { describe, type LogEntry } from './log';

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

  constructor() {
    this.openLog();
  }

  select(selection: Selection): void {
    this._selection.set(selection);
  }

  /** Runs `ticks` steps through the engine and folds the events into the log. */
  advance(ticks: number): void {
    if (ticks <= 0 || this._state().ended) {
      return;
    }
    const result = simulate(this._state(), ticks);
    this._state.set(result.state);
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
