/**
 * Weather and accidents.
 *
 * Everything here is drawn from the run's own generator, so the same seed brings the
 * same storms in the same order. Events grow more likely as entropy rises — the house
 * does not just decay faster, it is also unluckier.
 *
 * The two that can undo a plan are announced twenty seconds ahead, so a player who is
 * watching can act. A player who is away relies on their protocols, which is the point.
 */

import { EVENTS } from './balance';
import type { DomainEvent } from './domain-events';
import { nextFloat, nextInt, pick, type RngCursor } from './rng';
import {
  COLLECTION_IDS,
  EVENT_KINDS,
  SYSTEM_IDS,
  type CollectionId,
  type EventKind,
  type GameState,
  type SystemId,
} from './state';
import { decayMultiplier } from './step-shared';

/** Events the archive sees coming. The rest arrive unannounced. */
const ANNOUNCED: readonly EventKind[] = ['storm-surge', 'cloudburst'];

export function isAnnounced(kind: EventKind): boolean {
  return ANNOUNCED.includes(kind);
}

/**
 * Advances effects and announcements, then rolls for a new event.
 *
 * Mutates the state it is given: it is called from inside `step`, which already owns a
 * private copy. The cursor carries the generator forward.
 */
export function runEvents(state: GameState, cursor: RngCursor): DomainEvent[] {
  const events: DomainEvent[] = [];

  // Effects run down first, so a one-second effect lasts exactly one second.
  if (state.effects.inflowTicks > 0) {
    state.effects.inflowTicks -= 1;
    if (state.effects.inflowTicks === 0) {
      state.effects.inflowFactor = 1;
    }
  }
  if (state.effects.mouldTicks > 0) {
    state.effects.mouldTicks -= 1;
    if (state.effects.mouldTicks === 0) {
      state.effects.mouldId = null;
    }
  }

  // Anything announced earlier may now be due.
  if (state.pending.length > 0) {
    const due: EventKind[] = [];
    state.pending = state.pending.filter((entry) => {
      entry.ticks -= 1;
      if (entry.ticks <= 0) {
        due.push(entry.kind);
        return false;
      }
      return true;
    });
    for (const kind of due) {
      events.push(...strike(state, kind, cursor));
    }
  }

  // And the house rolls for something new.
  const chance = (EVENTS.basePerMinute * decayMultiplier(state.entropy)) / 60;
  if (nextFloat(cursor) < chance) {
    const kind = pick(cursor, EVENT_KINDS);
    if (isAnnounced(kind)) {
      state.pending.push({ kind, ticks: EVENTS.warningSeconds });
      events.push({ type: 'event-announced', tick: state.tick, kind });
    } else {
      events.push(...strike(state, kind, cursor));
    }
  }

  return events;
}

/** Applies an event the moment it arrives. */
function strike(state: GameState, kind: EventKind, cursor: RngCursor): DomainEvent[] {
  switch (kind) {
    case 'storm-surge':
      state.effects.inflowFactor = EVENTS.stormSurge.factor;
      state.effects.inflowTicks = EVENTS.stormSurge.seconds;
      return [{ type: 'event-struck', tick: state.tick, kind }];

    case 'rain-pause':
      state.effects.inflowFactor = EVENTS.rainPause.factor;
      state.effects.inflowTicks = EVENTS.rainPause.seconds;
      return [{ type: 'event-struck', tick: state.tick, kind }];

    case 'short-circuit': {
      const target = pickRunningSystem(state, cursor);
      if (!target) {
        // Nothing is running; the surge has nowhere to go.
        return [];
      }
      const system = state.systems[target];
      system.integrity = Math.max(0, system.integrity - EVENTS.shortCircuit.integrityLoss);
      return [{ type: 'event-struck', tick: state.tick, kind, systemId: target }];
    }

    case 'cloudburst': {
      const roof = state.systems.roof;
      if (roof.lost) {
        // No roof left to give way. Saying it anyway would be a line about nothing.
        return [];
      }
      roof.integrity = Math.max(0, roof.integrity - EVENTS.cloudburst.roofLoss);
      return [{ type: 'event-struck', tick: state.tick, kind, systemId: 'roof' }];
    }

    case 'driftwood': {
      const amount =
        EVENTS.driftwood.min + nextInt(cursor, EVENTS.driftwood.max - EVENTS.driftwood.min + 1);
      state.material += amount;
      return [{ type: 'event-struck', tick: state.tick, kind, amount }];
    }

    case 'mould': {
      const target = pickLivingCollection(state, cursor);
      if (!target) {
        return [];
      }
      state.effects.mouldId = target;
      state.effects.mouldTicks = EVENTS.mould.seconds;
      return [{ type: 'event-struck', tick: state.tick, kind, collectionId: target }];
    }
  }
}

/**
 * A switched-on, intact system — drawn from the generator so replays match.
 * prompt.md 5.10 says "ein eingeschaltetes System"; nothing about what it draws.
 */
function pickRunningSystem(state: GameState, cursor: RngCursor): SystemId | null {
  const candidates = SYSTEM_IDS.filter((id) => {
    const system = state.systems[id];
    return !system.lost && system.on;
  });
  return candidates.length > 0 ? pick(cursor, candidates) : null;
}

/**
 * A collection with something left to spoil.
 *
 * `lost` alone is not enough: a collection that has been transmitted in full keeps
 * `lost: false` with nothing intact — it was saved, not lost. Mould on it would spend
 * the effect on nothing and write a line about a collection that cannot rot.
 */
function pickLivingCollection(state: GameState, cursor: RngCursor): CollectionId | null {
  const candidates = COLLECTION_IDS.filter((id) => {
    const collection = state.collections[id];
    return !collection.lost && collection.intact > 0;
  });
  return candidates.length > 0 ? pick(cursor, candidates) : null;
}

/** The rot multiplier an event is imposing on a collection right now. */
export function mouldFactor(state: GameState, id: CollectionId): number {
  return state.effects.mouldId === id ? EVENTS.mould.factor : 1;
}
