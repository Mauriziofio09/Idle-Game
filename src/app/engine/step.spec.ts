import { COLLECTIONS, ENERGY, HUMIDITY, SYSTEMS, SYSTEM_DECAY, WATER } from './balance';
import { applyAction } from './actions';
import { createInitialState, isFlooded, type GameState } from './state';
import { demand, humidityTarget, inflow, outflow, production, step } from './step';
import { simulate } from './offline';

function allSystemsOff(state: GameState): GameState {
  let current = state;
  for (const id of ['pumps', 'climate', 'custodian'] as const) {
    current = applyAction(current, { type: 'toggle', systemId: id, on: false }).state;
  }
  return current;
}

describe('power', () => {
  it('charges the battery while the generator produces a surplus', () => {
    const base = allSystemsOff({ ...createInitialState('4F2A'), energy: 10 });
    const after = step(base).state;
    expect(after.energy).toBeCloseTo(10 + production(base), 10);
    expect(after.supplyRatio).toBe(1);
  });

  it('never charges past the battery capacity', () => {
    const base = allSystemsOff({ ...createInitialState('4F2A'), energy: ENERGY.capacity });
    expect(step(base).state.energy).toBe(ENERGY.capacity);
  });

  it('drains the battery before it starves anything', () => {
    const base = { ...createInitialState('4F2A'), energy: 100 };
    const deficit = demand(base) - production(base);
    expect(deficit).toBeGreaterThan(0);

    const after = step(base).state;
    expect(after.energy).toBeCloseTo(100 - deficit, 10);
    expect(after.supplyRatio).toBe(1);
  });

  it('shares an empty battery proportionally between all consumers', () => {
    const base = { ...createInitialState('4F2A'), energy: 0 };
    const after = step(base).state;

    const expected = production(base) / demand(base);
    expect(after.supplyRatio).toBeCloseTo(expected, 10);
    expect(after.supplyRatio).toBeGreaterThan(0);
    expect(after.supplyRatio).toBeLessThan(1);
    expect(after.energy).toBe(0);
  });

  it('lets the pumps move proportionally less water when undersupplied', () => {
    // Two archives identical but for the battery, stepped for real: the starved one
    // must lose ground faster, because its pumps only get their share of the power.
    const base = createInitialState('4F2A');
    const starved = step({ ...base, energy: 0 }).state;
    const supplied = step({ ...base, energy: ENERGY.capacity }).state;

    expect(starved.supplyRatio).toBeLessThan(1);
    expect(supplied.supplyRatio).toBe(1);
    expect(starved.water - base.water).toBeGreaterThan(supplied.water - base.water);

    // And the reduction is exactly the supply ratio, not some other fudge.
    // Entropy has already grown by the time step() computes the inflow, so read it
    // from the stepped state rather than from the one before the tick.
    const inflowPerTick = inflow(starved);
    expect(inflowPerTick).toBeCloseTo(inflow(supplied), 12);
    const pumpedWhenStarved = inflowPerTick - (starved.water - base.water);
    const pumpedWhenSupplied = inflowPerTick - (supplied.water - base.water);
    expect(pumpedWhenStarved).toBeCloseTo(pumpedWhenSupplied * starved.supplyRatio, 10);
  });

  it('rations every consumer by the same share, not just the pumps', () => {
    // Enough entropy that the climate term lands inside 0..100 — at the clamp both
    // the full and the rationed effect would collapse to the same number and the
    // test would pass without proving anything.
    const base = { ...createInitialState('4F2A'), entropy: 200 };
    const starved = step({ ...base, energy: 0 }).state;
    const ratio = starved.supplyRatio;
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(1);

    // Pumps: share of the water they would have moved at full power.
    const pumpShare = outflow(starved, ratio) / outflow(starved, 1);

    // Climate control: share of the dampness it would have removed at full power.
    const climateOff = applyAction(starved, {
      type: 'toggle',
      systemId: 'climate',
      on: false,
    }).state;
    const withoutClimate = humidityTarget(climateOff, 2, 1);
    const fullEffect = withoutClimate - humidityTarget(starved, 2, 1);
    const rationedEffect = withoutClimate - humidityTarget(starved, 2, ratio);
    expect(fullEffect).toBeGreaterThan(0);
    expect(humidityTarget(starved, 2, 1)).toBeGreaterThan(HUMIDITY.min);
    expect(withoutClimate).toBeLessThan(HUMIDITY.max);

    expect(rationedEffect / fullEffect).toBeCloseTo(pumpShare, 10);
    expect(pumpShare).toBeCloseTo(ratio, 10);
  });

  it('reports the swing into undersupply exactly once', () => {
    const base = { ...createInitialState('4F2A'), energy: 0 };
    const first = step(base);
    expect(first.events.some((event) => event.type === 'undersupply-changed')).toBe(true);
    const second = step(first.state);
    expect(second.events.some((event) => event.type === 'undersupply-changed')).toBe(false);
  });
});

describe('water', () => {
  it('rises when the pumps are off and falls when they run at full power', () => {
    const base = createInitialState('4F2A');
    const withPumps = { ...base, energy: ENERGY.capacity };
    expect(inflow(withPumps)).toBeGreaterThan(0);

    const idle = allSystemsOff(base);
    expect(outflow(idle, 1)).toBe(0);
    expect(step(idle).state.water).toBeGreaterThan(idle.water);
  });

  it('never falls below zero', () => {
    const base = {
      ...createInitialState('4F2A'),
      water: 0,
      energy: ENERGY.capacity,
    };
    base.systems.pumps.integrity = 100;
    expect(step(base).state.water).toBeGreaterThanOrEqual(WATER.min);
  });

  it('logs a floor going under exactly once', () => {
    const base = { ...createInitialState('4F2A'), water: 0.999, energy: ENERGY.capacity };
    const flooded = allSystemsOff(base);
    const first = step(flooded);
    expect(first.events).toContainEqual(
      expect.objectContaining({ type: 'floor-flooded', floor: 0 }),
    );
    const second = step(first.state);
    expect(second.events.some((event) => event.type === 'floor-flooded')).toBe(false);
  });
});

describe('wear', () => {
  it('conserves a system that is switched off', () => {
    const base = createInitialState('4F2A');
    const running = step(base).state.systems.climate.integrity;
    const idle = step(applyAction(base, { type: 'toggle', systemId: 'climate', on: false }).state)
      .state.systems.climate.integrity;
    expect(idle).toBeGreaterThan(running);
  });

  it('destroys submerged machinery quickly, but spares the pumps', () => {
    // Water at 2.2 drowns the cellar (pumps) and the ground floor (generator).
    const base: GameState = { ...createInitialState('4F2A'), water: 2.2, energy: ENERGY.capacity };
    base.systems.pumps.integrity = 80;
    base.systems.generator.integrity = 80;
    expect(isFlooded(base, SYSTEMS.pumps.floor)).toBe(true);
    expect(isFlooded(base, SYSTEMS.generator.floor)).toBe(true);

    const after = simulate(base, 30).state;

    // The pumps are built for this; the generator is not.
    expect(after.systems.pumps.integrity).toBeGreaterThan(50);
    const generatorLoss = 80 - after.systems.generator.integrity;
    expect(generatorLoss).toBeGreaterThan(30 * SYSTEM_DECAY.floodedExtraPerSecond * 0.9);
  });

  it('marks a system lost when its integrity reaches zero', () => {
    const base = createInitialState('4F2A');
    base.systems.roof.integrity = 0.01;
    const result = step(base);
    expect(result.state.systems.roof.lost).toBe(true);
    expect(result.state.systems.roof.integrity).toBe(0);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'system-lost', systemId: 'roof' }),
    );
  });
});

describe('humidity', () => {
  it('approaches its target smoothly instead of jumping', () => {
    const base = createInitialState('4F2A');
    const target = humidityTarget(base, 0, 1);
    const after = step(base).state;
    const moved = Math.abs(after.humidity[0] - base.humidity[0]);
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(Math.abs(target - base.humidity[0]));
  });

  it('is driven up by a leaking roof and down by climate control', () => {
    const base = createInitialState('4F2A');

    const goodRoof = { ...base, systems: { ...base.systems, roof: { ...base.systems.roof, integrity: 100 } } };
    const badRoof = { ...base, systems: { ...base.systems, roof: { ...base.systems.roof, integrity: 0 } } };
    expect(humidityTarget(badRoof, 4, 1)).toBeGreaterThan(humidityTarget(goodRoof, 4, 1));

    const climateOff = applyAction(base, { type: 'toggle', systemId: 'climate', on: false }).state;
    expect(humidityTarget(climateOff, 2, 1)).toBeGreaterThan(humidityTarget(base, 2, 1));
  });

  it('is highest on the floors nearest the water', () => {
    const base = { ...createInitialState('4F2A'), water: 1 };
    expect(humidityTarget(base, 0, 1)).toBeGreaterThan(humidityTarget(base, 3, 1));
    expect(humidityTarget(base, 0, 1)).toBeLessThan(HUMIDITY.max);
  });
});

describe('rot', () => {
  it('erases a collection on a fully flooded floor within about a minute', () => {
    const base = { ...createInitialState('4F2A'), water: 1.2, energy: ENERGY.capacity };
    const result = simulate(base, 300);
    expect(result.state.collections.maps.lost).toBe(true);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'collection-lost', collectionId: 'maps' }),
    );
  });

  it('conserves what has been sent even when the rest rots away', () => {
    const base = createInitialState('4F2A');
    base.collections.maps.sent = 40;
    base.collections.maps.intact = 60;
    const after = { ...base, water: 1.2 };
    const result = simulate(after, 300).state;
    expect(result.collections.maps.sent).toBe(40);
    expect(result.collections.maps.intact).toBe(0);
  });

  it('keeps intact, sent and rotted adding up to the full collection', () => {
    const result = simulate(createInitialState('4F2A'), 600).state;
    const maps = result.collections.maps;
    expect(maps.intact + maps.sent + maps.rotted).toBeCloseTo(COLLECTIONS.unitsEach, 6);
  });
});

describe('the end', () => {
  it('falls silent once the power is gone and the generator with it', () => {
    const base = createInitialState('4F2A');
    base.energy = 0;
    base.systems.generator.lost = true;
    base.systems.generator.on = false;
    base.systems.generator.integrity = 0;

    const result = step(base);
    expect(result.state.ended).toBe(true);
    expect(result.state.endReason).toBe('silence');
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'run-ended', reason: 'silence' }),
    );
  });

  it('ends when there is nothing left to save', () => {
    const base = createInitialState('4F2A');
    for (const id of ['maps', 'chronicle', 'naturalHistory', 'music', 'letters', 'languages'] as const) {
      base.collections[id].intact = 0;
      base.collections[id].rotted = COLLECTIONS.unitsEach;
    }
    expect(step(base).state.endReason).toBe('nothing-left');
  });

  it('stops changing once it has ended', () => {
    const base = createInitialState('4F2A');
    base.energy = 0;
    base.systems.generator.lost = true;
    const ended = step(base).state;
    const result = step(ended);
    expect(result.state).toBe(ended);
    expect(result.events).toEqual([]);
  });
});
