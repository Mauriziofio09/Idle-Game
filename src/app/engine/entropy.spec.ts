import { ENTROPY } from './balance';
import { applyAction } from './actions';
import { createInitialState } from './state';
import { decayMultiplier, humidityFactor, step } from './step';
import { simulate } from './offline';

describe('entropy', () => {
  it('never decreases across a long run', () => {
    let state = createInitialState('4F2A');
    let previous = state.entropy;

    for (let i = 0; i < 5000; i++) {
      state = step(state).state;
      expect(state.entropy).toBeGreaterThanOrEqual(previous);
      previous = state.entropy;
      if (state.ended) {
        break;
      }
    }
  });

  it('never decreases when actions are applied', () => {
    const start = createInitialState('4F2A');
    const repaired = applyAction(start, { type: 'repair', systemId: 'pumps' });
    expect(repaired.state.entropy).toBe(start.entropy + ENTROPY.perRepair);

    const dismantled = applyAction(repaired.state, { type: 'dismantle', systemId: 'roof' });
    expect(dismantled.state.entropy).toBe(repaired.state.entropy + ENTROPY.perDismantle);
  });

  it('m(S) is monotonically increasing and starts at 1', () => {
    expect(decayMultiplier(0)).toBe(1);
    let previous = decayMultiplier(0);
    for (let s = 1; s <= 500; s++) {
      const current = decayMultiplier(s);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });

  it('turns humidity into a decay factor between 0.5 and 2.5', () => {
    expect(humidityFactor(0)).toBeCloseTo(0.5, 10);
    expect(humidityFactor(100)).toBeCloseTo(2.5, 10);
    expect(humidityFactor(50)).toBeGreaterThan(humidityFactor(49));
  });

  it('makes the rain heavier as entropy grows', () => {
    const calm = createInitialState('4F2A');
    const anxious = { ...calm, entropy: 200 };

    const calmRise = simulate(calm, 60).state.water;
    const anxiousRise = simulate(anxious, 60).state.water;
    expect(anxiousRise).toBeGreaterThan(calmRise);
  });
});
