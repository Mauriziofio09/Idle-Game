/**
 * Pillar: same seed plus same actions equals the same run. Everything else in the
 * game — offline catch-up, the return summary, seed links, the headless simulator —
 * leans on this.
 */

import {
  createCursor,
  dailySeed,
  isValidSeed,
  nextFloat,
  normaliseSeed,
  seedToState,
  stateToSeed,
} from './rng';
import { START_INTEGRITY } from './balance';
import { applyAction } from './actions';
import { createInitialState, type GameState } from './state';
import { step } from './step';
import { simulate, simulateInChunks } from './offline';

const TICKS = 10_000;

function runStraight(state: GameState, ticks: number): GameState {
  let current = state;
  for (let i = 0; i < ticks && !current.ended; i++) {
    current = step(current).state;
  }
  return current;
}

/** Chunk sizes drawn from a separate seeded generator, so the split itself is reproducible. */
function runInRandomChunks(state: GameState, ticks: number, seed: number): GameState {
  const cursor = createCursor(seed);
  let current = state;
  let done = 0;
  while (done < ticks && !current.ended) {
    const size = Math.min(ticks - done, 1 + Math.floor(nextFloat(cursor) * 900));
    current = simulate(current, size).state;
    done += size;
  }
  return current;
}

/**
 * No single archive survives 10 000 ticks — that is pillar 1 working, not a gap. To
 * still cover the horizon prompt.md section 10 asks for, the comparison runs over
 * consecutive seeded archives until 10 000 stepped ticks have actually been compared.
 */
function compareOverHorizon(compare: (seed: string) => number): number {
  let covered = 0;
  let index = 0;
  while (covered < TICKS) {
    covered += compare(stateToSeed(index * 2654435761));
    index++;
    expect(index).toBeLessThan(200);
  }
  return covered;
}

describe('determinism', () => {
  it('produces identical runs over 10 000 ticks, in one go and in random chunks', () => {
    let chunkSeed = 12345;
    const covered = compareOverHorizon((seed) => {
      const start = createInitialState(seed);
      const straight = runStraight(start, TICKS);
      const chunked = runInRandomChunks(start, TICKS, chunkSeed++);
      expect(chunked).toEqual(straight);
      return straight.tick;
    });
    expect(covered).toBeGreaterThanOrEqual(TICKS);
  });

  it('matches the chunked offline path used after a hidden tab, over 10 000 ticks', () => {
    const covered = compareOverHorizon((seed) => {
      const start = createInitialState(seed);
      const straight = runStraight(start, TICKS);
      const offline = simulateInChunks(start, TICKS).state;
      expect(offline).toEqual(straight);
      return straight.tick;
    });
    expect(covered).toBeGreaterThanOrEqual(TICKS);
  });

  it('gives the same result for the same seed and the same actions', () => {
    const play = (): GameState => {
      let state = createInitialState('4F2A');
      for (let i = 0; i < 20; i++) {
        state = simulate(state, 60).state;
        state = applyAction(state, { type: 'repair', systemId: 'pumps' }).state;
        state = applyAction(state, { type: 'toggle', systemId: 'climate', on: i % 2 === 0 }).state;
      }
      return state;
    };
    expect(play()).toEqual(play());
  });

  it('holds with protocols in the state, which is where offline play lives', () => {
    // Every other case here starts from createInitialState, whose rule list is empty —
    // so the guarantee was never exercised with the depot acting.
    const base = createInitialState('4F2A');
    const start: GameState = {
      ...base,
      material: 5000,
      energy: 150,
      // A healthy generator, so the depot can actually afford to act: the binding
      // constraint at the current balance is energy, not the cooldown.
      systems: {
        ...base.systems,
        generator: { ...base.systems.generator, integrity: 100 },
        climate: { ...base.systems.climate, on: false },
      },
      protocols: [
        {
          id: 'r1',
          condition: { kind: 'system-integrity-below', systemId: 'pumps', value: 80 },
          action: { type: 'repair', systemId: 'pumps' },
          enabled: true,
          firedCount: 0,
        },
      ],
    };

    const straight = runStraight(start, 2000);
    expect(straight.protocols[0].firedCount).toBeGreaterThan(3);

    expect(runInRandomChunks(start, 2000, 4711)).toEqual(straight);
    expect(simulateInChunks(start, 2000).state).toEqual(straight);
  });

  it('gives different archives for different seeds', () => {
    const a = createInitialState('4F2A');
    const b = createInitialState('9B01');
    expect(a.systems.generator.integrity).not.toBeCloseTo(b.systems.generator.integrity, 6);
  });

  it('draws every start integrity from the documented range', () => {
    for (const seed of ['0000', '4F2A', '9B01', 'FFFF', 'A1B2']) {
      const state = createInitialState(seed);
      for (const system of Object.values(state.systems)) {
        expect(system.integrity).toBeGreaterThanOrEqual(START_INTEGRITY.min);
        expect(system.integrity).toBeLessThan(START_INTEGRITY.max);
      }
    }
  });
});

describe('the daily archive', () => {
  it('hands everyone the same archive for the same day', () => {
    expect(dailySeed(2026, 9, 24)).toBe(dailySeed(2026, 9, 24));
    expect(isValidSeed(dailySeed(2026, 9, 24))).toBe(true);
  });

  it('turns over at midnight', () => {
    expect(dailySeed(2026, 9, 24)).not.toBe(dailySeed(2026, 9, 25));
    expect(dailySeed(2026, 9, 24)).not.toBe(dailySeed(2026, 10, 24));
    expect(dailySeed(2026, 9, 24)).not.toBe(dailySeed(2027, 9, 24));
  });

  it('spreads across the year rather than repeating', () => {
    const seeds = new Set<string>();
    for (let day = 1; day <= 28; day++) {
      for (let month = 1; month <= 12; month++) {
        seeds.add(dailySeed(2026, month, day));
      }
    }
    // 336 days; a four-hex seed has 65 536 values, so collisions should be rare.
    expect(seeds.size).toBeGreaterThan(320);
  });
});

describe('seeds', () => {
  it('accepts and normalises the seeds a share link can carry', () => {
    expect(normaliseSeed(' 4f2a ')).toBe('4F2A');
    expect(normaliseSeed('4F2A')).toBe('4F2A');
    expect(normaliseSeed('nope')).toBeNull();
    expect(normaliseSeed('4F2')).toBeNull();
    expect(isValidSeed('4F2A')).toBe(true);
    expect(isValidSeed('4f2a')).toBe(false);
  });

  it('renders any number as a four-character seed', () => {
    expect(stateToSeed(0)).toBe('0000');
    expect(stateToSeed(0xffff)).toBe('FFFF');
    expect(isValidSeed(stateToSeed(1234567))).toBe(true);
  });

  it('never starts the generator from a degenerate state', () => {
    expect(seedToState('0000')).not.toBe(0);
    expect(seedToState('')).not.toBe(0);
  });

  it('stays inside [0, 1) over many draws', () => {
    const cursor = createCursor(seedToState('4F2A'));
    for (let i = 0; i < 100_000; i++) {
      const value = nextFloat(cursor);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});