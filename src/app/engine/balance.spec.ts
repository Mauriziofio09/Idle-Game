import { describe, expect, it } from 'vitest';

import { applyAction, canApply, type Action } from './actions';
import { ENTROPY, TARGETS } from './balance';
import { COLLECTION_IDS, SYSTEM_IDS, createInitialState, savedShare, type GameState } from './state';
import { step } from './step';
import { stateToSeed } from './rng';
import { doNothing, patchTheWorst, playWell, type Strategy } from './strategies';

/**
 * The balancing targets from prompt.md section 6, as a test.
 *
 * `npm run sim` explores; this file nails down what was found. It plays the same three
 * players the simulator plays, over a fixed set of seeds, and checks the medians.
 *
 * TOLERANCE — there is none. Every band from section 6 is asserted exactly as written,
 * and the **ordering** — that understanding the house beats patching it, and patching it
 * beats walking away, in runtime and in saved share — is asserted on top of the bands,
 * because that is the claim the game actually makes.
 *
 * WHAT THIS FILE DOES NOT CATCH. It guards the reachable targets of section 6, not every
 * number in balance.ts. A review of milestone 8 found values that can be changed without
 * a single failure here — among them ENTROPY.decayDivisor, COLLECTIONS.floodedDecayPerSecond
 * and SYSTEM_DECAY.offMultiplier. The entropy cost of a repair was one of them until the
 * last test below was written; the others are named in PLAN.md section 16 rather than
 * papered over by a claim of complete coverage.
 *
 * The seeds are the first 60 that `npm run sim` uses, so a failure here is reproducible
 * with `SIM_SEEDS=60 npm run sim`. Sixty is enough for a stable median on the two
 * narrow strategies and keeps the suite under a second.
 */

const SEEDS = Array.from({ length: 60 }, (_, index) => stateToSeed(index * 2654435761));
const TICKS_PER_MINUTE = 60;

interface Outcome {
  readonly minutes: number;
  readonly saved: number;
}

function play(seed: string, decide: Strategy, maxTicks = TARGETS.maxRunTicks): Outcome {
  let state = createInitialState(seed);
  while (!state.ended && state.tick < maxTicks) {
    const action = decide(state);
    if (action !== null) {
      state = applyAction(state, action).state;
    }
    state = step(state).state;
  }
  return { minutes: state.tick / TICKS_PER_MINUTE, saved: savedShare(state) };
}

/** Presses send once and then watches. The smallest thing a player can actually do. */
const pressSendAndWait: Strategy = (state) => {
  if (state.transmitting !== null) {
    return null;
  }
  for (const id of COLLECTION_IDS) {
    const action: Action = { type: 'transmit-start', collectionId: id };
    if (canApply(state, action)) {
      return action;
    }
  }
  return null;
};

function playToEnd(seed: string, decide: Strategy): GameState {
  let state = createInitialState(seed);
  while (!state.ended && state.tick < TARGETS.maxRunTicks) {
    const action = decide(state);
    if (action !== null) {
      state = applyAction(state, action).state;
    }
    state = step(state).state;
  }
  return state;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function measure(decide: Strategy): { minutes: number; saved: number; allEnded: boolean } {
  const outcomes = SEEDS.map((seed) => play(seed, decide));
  return {
    minutes: median(outcomes.map((o) => o.minutes)),
    saved: median(outcomes.map((o) => o.saved)),
    allEnded: outcomes.every((o) => o.minutes * TICKS_PER_MINUTE < TARGETS.maxRunTicks),
  };
}

describe('balancing targets (prompt.md section 6)', () => {
  const idle = measure(doNothing);
  const naive = measure(patchTheWorst);
  const good = measure(playWell);

  it('lets an archive nobody tends fall within a quarter of an hour', () => {
    expect(idle.minutes).toBeGreaterThanOrEqual(TARGETS.runtimeMinutes.idle.min);
    expect(idle.minutes).toBeLessThanOrEqual(TARGETS.runtimeMinutes.idle.max);
  });

  it('saves nothing when nobody presses send, and something as soon as somebody does', () => {
    // The first half is true by construction — doNothing never transmits — so on its own
    // it proves nothing and no change to balance.ts could ever break it. The second half
    // is the real claim: the same archive, same seeds, one single button, and the mast
    // alone gets a twentieth of the collection out before the house goes quiet — while
    // still being no substitute for tending the place.
    expect(idle.saved).toBeLessThanOrEqual(TARGETS.savedShare.idle.max);

    const sendOnly = measure(pressSendAndWait);
    expect(sendOnly.saved).toBeGreaterThan(0.05);
    expect(sendOnly.saved).toBeLessThan(good.saved);
  });

  it('gets a naive player between a tenth and a fifth of the archive out', () => {
    expect(naive.saved).toBeGreaterThanOrEqual(TARGETS.savedShare.naive.min);
    expect(naive.saved).toBeLessThanOrEqual(TARGETS.savedShare.naive.max);
  });

  it('keeps a naive run inside its 20 to 35 minute band', () => {
    expect(naive.minutes).toBeLessThanOrEqual(TARGETS.runtimeMinutes.naive.max);
    expect(naive.minutes).toBeGreaterThanOrEqual(TARGETS.runtimeMinutes.naive.min);
  });

  it('gets a player who understands the house a fifth to two fifths out', () => {
    expect(good.saved).toBeGreaterThanOrEqual(TARGETS.savedShare.active.min);
    expect(good.saved).toBeLessThanOrEqual(TARGETS.savedShare.active.max);
  });

  it('keeps good play inside its 35 to 60 minute band', () => {
    expect(good.minutes).toBeLessThanOrEqual(TARGETS.runtimeMinutes.active.max);
    expect(good.minutes).toBeGreaterThanOrEqual(TARGETS.runtimeMinutes.active.min);
  });

  it('rewards understanding the house over patching it, and patching over walking away', () => {
    expect(good.saved).toBeGreaterThan(naive.saved);
    expect(naive.saved).toBeGreaterThan(idle.saved);
    expect(good.minutes).toBeGreaterThan(naive.minutes);
    expect(naive.minutes).toBeGreaterThan(idle.minutes);
  });

  it('makes repairing, not time passing, the thing that wears the archive out', () => {
    // prompt.md section 2 hangs the whole game on this: every repair buys integrity and
    // pays in entropy, which never falls. ENTROPY.perRepair could be set to zero without
    // a single failure in this file until this test existed — the one number that carries
    // the premise was the one number nothing guarded.
    const outcomes = SEEDS.map((seed) => {
      const state = playToEnd(seed, playWell);
      return { entropy: state.entropy, passive: ENTROPY.passivePerSecond * state.tick };
    });
    const entropy = median(outcomes.map((o) => o.entropy));
    const passive = median(outcomes.map((o) => o.passive));

    // With a free repair the two would be equal. They are not close.
    expect(entropy).toBeGreaterThan(passive * 2);
  });

  it('ends every run, whoever is playing', () => {
    expect(idle.allEnded).toBe(true);
    expect(naive.allEnded).toBe(true);
    expect(good.allEnded).toBe(true);
  });
});

describe('the 72 hour guarantee (prompt.md section 6, first pillar)', () => {
  /**
   * The hardest case for the guarantee: someone who repairs everything that can be
   * repaired, every single tick, and never spends a unit on transmitting. If any way of
   * playing could hold the archive open forever, this is it — it converts every last
   * scrap of material and energy straight back into integrity.
   */
  const repairEverything: Strategy = (state) => {
    for (const id of SYSTEM_IDS) {
      const action: Action = { type: 'repair', systemId: id };
      if (!state.systems[id].lost && canApply(state, action)) {
        return action;
      }
    }
    return null;
  };

  it('closes the archive within 72 hours even under constant repair', () => {
    for (const seed of SEEDS.slice(0, 5)) {
      const state = playToEnd(seed, repairEverything);
      expect(state.ended).toBe(true);
      expect(state.tick).toBeLessThan(TARGETS.maxRunTicks);
    }
  });
});
