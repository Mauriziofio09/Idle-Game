import { EVENTS } from './balance';
import { isAnnounced, mouldFactor, runEvents } from './events';
import { simulate } from './offline';
import { createCursor, stateToSeed } from './rng';
import {
  COLLECTION_IDS,
  createInitialState,
  EVENT_KINDS,
  type CollectionId,
  type EventKind,
  type GameState,
  type SystemId,
} from './state';
import { inflow, step } from './step';

/**
 * Samples the weather on an archive that stays healthy.
 *
 * Driving this through `step` would be a worse test, not a better one: the house dies
 * within minutes, and a short circuit or mould with nothing left to attack simply does
 * not happen. Here the question is which events the generator produces, not whether the
 * building survives them.
 */
function collectEvents(seed: string, ticks: number, entropy = 60): { kind: EventKind; announced: boolean }[] {
  const found: { kind: EventKind; announced: boolean }[] = [];
  const state: GameState = { ...createInitialState(seed), entropy };

  for (let i = 0; i < ticks; i++) {
    // A fresh, intact archive each tick, carrying only the generator forward.
    const probe: GameState = {
      ...createInitialState(seed),
      entropy,
      rngState: state.rngState,
      pending: state.pending,
      effects: state.effects,
    };
    const cursor = createCursor(probe.rngState);
    const events = runEvents(probe, cursor);
    state.rngState = cursor.state;
    state.pending = probe.pending;
    state.effects = probe.effects;

    for (const event of events) {
      if (event.type === 'event-struck') {
        found.push({ kind: event.kind, announced: false });
      }
      if (event.type === 'event-announced') {
        found.push({ kind: event.kind, announced: true });
      }
    }
  }
  return found;
}

describe('events', () => {
  it('draws the same weather for the same seed', () => {
    expect(collectEvents('4F2A', 4000)).toEqual(collectEvents('4F2A', 4000));
  });

  it('draws different weather for different seeds', () => {
    const a = collectEvents('4F2A', 4000);
    const b = collectEvents('9B01', 4000);
    expect(a).not.toEqual(b);
  });

  it('eventually produces every kind in the list', () => {
    const seen = new Set(collectEvents('4F2A', 40_000).map((entry) => entry.kind));
    for (const kind of EVENT_KINDS) {
      expect(seen.has(kind)).toBe(true);
    }
  });

  it('announces exactly the two that can undo a plan', () => {
    expect(isAnnounced('storm-surge')).toBe(true);
    expect(isAnnounced('cloudburst')).toBe(true);
    for (const kind of ['short-circuit', 'driftwood', 'rain-pause', 'mould'] as const) {
      expect(isAnnounced(kind)).toBe(false);
    }
  });

  it('lets an announced event strike after the warning, not before', () => {
    const state: GameState = {
      ...createInitialState('4F2A'),
      pending: [{ kind: 'storm-surge', ticks: EVENTS.warningSeconds }],
    };

    for (let i = 0; i < EVENTS.warningSeconds - 1; i++) {
      const cursor = createCursor(state.rngState);
      runEvents(state, cursor);
      expect(state.effects.inflowFactor).toBe(1);
    }

    const cursor = createCursor(state.rngState);
    const events = runEvents(state, cursor);
    expect(state.effects.inflowFactor).toBe(EVENTS.stormSurge.factor);
    expect(events).toContainEqual(expect.objectContaining({ type: 'event-struck' }));
  });

  it('grows more likely as entropy rises', () => {
    const calm = collectEvents('4F2A', 6000, 0).length;
    const anxious = collectEvents('4F2A', 6000, 600).length;
    expect(anxious).toBeGreaterThan(calm);
  });
});

describe('what the events do', () => {
  const base = createInitialState('4F2A');

  it('storm surge and rain pause move the rain in opposite directions', () => {
    const calm = inflow(base);
    const storm = inflow({
      ...base,
      effects: { ...base.effects, inflowFactor: EVENTS.stormSurge.factor },
    });
    const pause = inflow({
      ...base,
      effects: { ...base.effects, inflowFactor: EVENTS.rainPause.factor },
    });

    expect(storm).toBeCloseTo(calm * EVENTS.stormSurge.factor, 10);
    expect(pause).toBeCloseTo(calm * EVENTS.rainPause.factor, 10);
  });

  it('runs an effect down and then lets go of it', () => {
    const state: GameState = {
      ...base,
      effects: { inflowFactor: 3, inflowTicks: 2, mouldId: 'maps', mouldTicks: 2 },
    };

    const tickOnce = () => {
      const cursor = createCursor(state.rngState);
      runEvents(state, cursor);
      state.rngState = cursor.state;
    };

    tickOnce();
    expect(state.effects.inflowFactor).toBe(3);
    expect(state.effects.mouldId).toBe('maps');

    tickOnce();
    expect(state.effects.inflowFactor).toBe(1);
    expect(state.effects.inflowTicks).toBe(0);
    expect(state.effects.mouldId).toBeNull();
  });

  it('makes a collection rot faster while mould sits on it', () => {
    expect(mouldFactor(base, 'maps')).toBe(1);
    const mouldy = { ...base, effects: { ...base.effects, mouldId: 'maps' as const } };
    expect(mouldFactor(mouldy, 'maps')).toBe(EVENTS.mould.factor);
    expect(mouldFactor(mouldy, 'chronicle')).toBe(1);

    const withMould = simulate({ ...mouldy, effects: { ...mouldy.effects, mouldTicks: 600 } }, 200)
      .state.collections.maps.intact;
    const without = simulate(base, 200).state.collections.maps.intact;
    expect(withMould).toBeLessThan(without);
  });

  it('never leaves the archive with a negative integrity or material', () => {
    let state = createInitialState('4F2A');
    state = { ...state, entropy: 400 };
    for (let i = 0; i < 5000; i++) {
      state = step({ ...state, ended: false, endReason: null }).state;
      expect(state.material).toBeGreaterThanOrEqual(0);
      for (const system of Object.values(state.systems)) {
        expect(system.integrity).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('takes exactly the documented bite out of a system', () => {
    const state: GameState = {
      ...base,
      pending: [{ kind: 'cloudburst', ticks: 1 }],
    };
    const roofBefore = state.systems.roof.integrity;
    runEvents(state, createCursor(state.rngState));
    expect(roofBefore - state.systems.roof.integrity).toBeCloseTo(EVENTS.cloudburst.roofLoss, 10);
  });

  it('says nothing about a cloudburst once there is no roof left', () => {
    const state: GameState = {
      ...base,
      systems: { ...base.systems, roof: { integrity: 0, on: false, repairs: 0, lost: true } },
      pending: [{ kind: 'cloudburst', ticks: 1 }],
    };
    expect(runEvents(state, createCursor(state.rngState))).toEqual([]);
  });

  it('takes the documented integrity off a running system, and never below zero', () => {
    let hits = 0;
    for (let seed = 0; seed < 400 && hits < 5; seed++) {
      const state: GameState = { ...createInitialState(stateToSeed(seed)), entropy: 0 };
      // A shallow copy would share the very objects the event mutates.
      const before = JSON.parse(JSON.stringify(state.systems)) as typeof state.systems;
      const events = runEventsUntilKind(state, 'short-circuit');
      if (!events) continue;
      hits++;
      const hit = events.systemId;
      expect(hit).toBeDefined();
      if (!hit) continue;
      expect(before[hit].integrity - state.systems[hit].integrity).toBeCloseTo(
        EVENTS.shortCircuit.integrityLoss,
        10,
      );
      expect(state.systems[hit].integrity).toBeGreaterThanOrEqual(0);
    }
    expect(hits).toBeGreaterThan(0);
  });

  it('washes up between the documented bounds', () => {
    let hits = 0;
    for (let seed = 0; seed < 400 && hits < 8; seed++) {
      const state: GameState = { ...createInitialState(stateToSeed(seed)), entropy: 0 };
      const before = state.material;
      const events = runEventsUntilKind(state, 'driftwood');
      if (!events) continue;
      hits++;
      const gained = state.material - before;
      expect(gained).toBeGreaterThanOrEqual(EVENTS.driftwood.min);
      expect(gained).toBeLessThanOrEqual(EVENTS.driftwood.max);
      expect(Number.isInteger(gained)).toBe(true);
    }
    expect(hits).toBeGreaterThan(0);
  });

  it('holds each effect for exactly its documented duration', () => {
    const state: GameState = { ...base, pending: [{ kind: 'storm-surge', ticks: 1 }] };
    runEvents(state, createCursor(state.rngState));
    expect(state.effects.inflowTicks).toBe(EVENTS.stormSurge.seconds);

    for (let i = 0; i < EVENTS.stormSurge.seconds - 1; i++) {
      state.pending = [];
      const cursor = createCursor(state.rngState);
      runEvents(state, cursor);
      state.rngState = cursor.state;
      expect(state.effects.inflowFactor).toBe(EVENTS.stormSurge.factor);
    }
    state.pending = [];
    runEvents(state, createCursor(state.rngState));
    expect(state.effects.inflowFactor).toBe(1);
  });

  it('rolls at the documented rate per minute', () => {
    // 0.08 x m(S) per minute, and at zero entropy m(S) is exactly 1.
    //
    // An announced event shows up twice in the sample — once as the warning, once as
    // the strike — so only the warnings and the unannounced strikes are actual rolls.
    const minutes = 20_000;
    const sample = collectEvents('4F2A', minutes * 60, 0);
    const rolls = sample.filter((entry) => entry.announced || !isAnnounced(entry.kind)).length;

    const expected = EVENTS.basePerMinute * minutes;
    expect(rolls).toBeGreaterThan(expected * 0.9);
    expect(rolls).toBeLessThan(expected * 1.1);

    // And every announced warning is followed by its strike.
    const warnings = sample.filter((entry) => entry.announced).length;
    const announcedStrikes = sample.filter(
      (entry) => !entry.announced && isAnnounced(entry.kind),
    ).length;
    expect(Math.abs(warnings - announcedStrikes)).toBeLessThanOrEqual(1);
  });
  it('never settles on a collection that has nothing left to spoil', () => {
    // A collection transmitted in full keeps lost: false with intact: 0 — it was saved,
    // not lost. Mould on it would spend the effect on nothing and write a line about a
    // collection that cannot rot.
    const emptied: GameState = { ...createInitialState('4F2A') };
    for (const id of COLLECTION_IDS) {
      emptied.collections[id] = { ...emptied.collections[id], intact: 0, sent: 100, rotted: 0 };
    }
    expect(Object.values(emptied.collections).every((entry) => !entry.lost)).toBe(true);

    // Over many draws the mould must never land, because there is no candidate.
    let struck = 0;
    const state: GameState = { ...emptied, entropy: 5000 };
    for (let i = 0; i < 3000; i++) {
      const cursor = createCursor(state.rngState);
      const events = runEvents(state, cursor);
      state.rngState = cursor.state;
      struck += events.filter(
        (event) => event.type === 'event-struck' && event.kind === 'mould',
      ).length;
    }
    expect(struck).toBe(0);
    expect(state.effects.mouldId).toBeNull();

    // With one collection still holding paper, it does land.
    const oneLeft: GameState = { ...emptied, entropy: 5000 };
    oneLeft.collections = {
      ...emptied.collections,
      letters: { ...emptied.collections.letters, intact: 40, sent: 60, rotted: 0 },
    };
    let landed: string | null = null;
    for (let i = 0; i < 3000 && !landed; i++) {
      const cursor = createCursor(oneLeft.rngState);
      const events = runEvents(oneLeft, cursor);
      oneLeft.rngState = cursor.state;
      for (const event of events) {
        if (event.type === 'event-struck' && event.kind === 'mould') {
          landed = event.collectionId ?? null;
        }
      }
    }
    expect(landed).toBe('letters');
  });
});

/** Drives the generator forward until the given kind strikes, or gives up. */
function runEventsUntilKind(
  state: GameState,
  kind: EventKind,
): { systemId?: SystemId; collectionId?: CollectionId } | null {
  for (let i = 0; i < 4000; i++) {
    const cursor = createCursor(state.rngState);
    const events = runEvents(state, cursor);
    state.rngState = cursor.state;
    for (const event of events) {
      if (event.type === 'event-struck' && event.kind === kind) {
        return event;
      }
    }
  }
  return null;
}