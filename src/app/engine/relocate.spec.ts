import { applyAction, burnYield, canApply, canRelocate } from './actions';
import { BURN, COLLECTIONS, ENERGY, ENTROPY, RELOCATE, SCENARIOS } from './balance';
import { simulate } from './offline';
import { collectionsOn, createInitialState, topFloor, type GameState } from './state';
import { simulateInChunks } from './offline';
import { production, step } from './step';

function ready(patch: Partial<GameState> = {}): GameState {
  return { ...createInitialState('4F2A'), energy: ENERGY.capacity, ...patch };
}

describe('carrying a collection upstairs', () => {
  it('costs energy, takes the documented time, and then it has moved', () => {
    const base = ready();
    const from = base.collections.maps.floor;

    const started = applyAction(base, { type: 'relocate', collectionId: 'maps' });
    expect(started.applied).toBe(true);
    expect(started.state.energy).toBeCloseTo(ENERGY.capacity - RELOCATE.energyCost, 10);
    expect(started.state.collections.maps.transitTicks).toBe(RELOCATE.transitSeconds);
    expect(started.state.collections.maps.floor).toBe(from);
    expect(started.events).toContainEqual(
      expect.objectContaining({ type: 'relocation-started', toFloor: from + 1 }),
    );

    // One tick short of arrival it is still on its way.
    const almost = simulate(started.state, RELOCATE.transitSeconds - 1).state;
    expect(almost.collections.maps.floor).toBe(from);
    expect(almost.collections.maps.transitTicks).toBe(1);

    const arrived = step(almost);
    expect(arrived.state.collections.maps.floor).toBe(from + 1);
    expect(arrived.state.collections.maps.transitTicks).toBe(0);
    expect(arrived.events).toContainEqual(
      expect.objectContaining({ type: 'relocation-finished', toFloor: from + 1 }),
    );
  });

  it('goes on rotting where it started, so a move is no way to pause the decay', () => {
    const base = ready({ water: 1.2 });
    // The cellar is under water; carrying the maps out takes half a minute.
    expect(base.collections.maps.floor).toBe(0);

    const moving = applyAction(base, { type: 'relocate', collectionId: 'maps' }).state;
    const standing = base;

    const movedAfter = simulate(moving, RELOCATE.transitSeconds - 1).state.collections.maps.intact;
    const stoodAfter = simulate(standing, RELOCATE.transitSeconds - 1).state.collections.maps.intact;

    expect(movedAfter).toBeCloseTo(stoodAfter, 6);
  });

  it('refuses a floor that is already full', () => {
    const base = ready();
    // The first floor of the standard house holds the chronicle; fill it up.
    const target = base.collections.chronicle.floor;
    for (const id of ['naturalHistory', 'music'] as const) {
      base.collections[id] = { ...base.collections[id], floor: target };
    }
    expect(collectionsOn(base, target)).toBe(RELOCATE.maxPerFloor);

    expect(canRelocate(base, 'maps')).toBe(false);
    expect(applyAction(base, { type: 'relocate', collectionId: 'maps' }).applied).toBe(false);
  });

  it('refuses when there is no floor above, and when the energy is not there', () => {
    const base = ready();
    base.collections.languages.floor = topFloor(base);
    expect(canRelocate(base, 'languages')).toBe(false);

    const broke = ready({ energy: RELOCATE.energyCost - 1 });
    expect(canRelocate(broke, 'maps')).toBe(false);
  });

  it('refuses a second move while the first is still under way', () => {
    const moving = applyAction(ready(), { type: 'relocate', collectionId: 'maps' }).state;
    expect(canRelocate(moving, 'maps')).toBe(false);
    expect(applyAction(moving, { type: 'relocate', collectionId: 'maps' }).applied).toBe(false);
  });

  it('stops a transmission of the collection it picks up', () => {
    const sending = applyAction(ready(), { type: 'transmit-start', collectionId: 'maps' }).state;
    const moving = applyAction(sending, { type: 'relocate', collectionId: 'maps' });

    expect(moving.state.transmitting).toBeNull();
    expect(moving.events).toContainEqual(
      expect.objectContaining({ type: 'transmission-stopped', collectionId: 'maps' }),
    );
  });

  it('cannot be sent while it is on its way', () => {
    const moving = applyAction(ready(), { type: 'relocate', collectionId: 'maps' }).state;
    expect(canApply(moving, { type: 'transmit-start', collectionId: 'maps' })).toBe(false);
  });
});

describe('burning a collection', () => {
  it('turns what is left into energy and destroys it', () => {
    const base = ready({ energy: 0 });
    const units = base.collections.maps.intact;
    expect(burnYield(base, 'maps')).toBeCloseTo(units * BURN.energyPerUnit, 10);

    const after = applyAction(base, { type: 'burn', collectionId: 'maps' });
    expect(after.applied).toBe(true);

    const maps = after.state.collections.maps;
    expect(maps.intact).toBe(0);
    expect(maps.burned).toBeCloseTo(units, 10);
    expect(maps.lost).toBe(true);
    expect(after.state.energy).toBeCloseTo(units * BURN.energyPerUnit, 10);
  });

  it('costs the entropy prompt.md puts on it — the heaviest of any action', () => {
    const base = ready();
    const after = applyAction(base, { type: 'burn', collectionId: 'maps' }).state;
    expect(after.entropy - base.entropy).toBeCloseTo(ENTROPY.perBurn, 10);
    expect(ENTROPY.perBurn).toBeGreaterThan(ENTROPY.perDismantle);
  });

  it('never fills the battery past its capacity', () => {
    const base = ready({ energy: ENERGY.capacity });
    const after = applyAction(base, { type: 'burn', collectionId: 'maps' }).state;
    expect(after.energy).toBe(ENERGY.capacity);
  });

  it('keeps the books balanced, with the burned units counted apart from the rotten', () => {
    const base = ready();
    base.collections.maps.intact = 40;
    base.collections.maps.sent = 25;
    base.collections.maps.rotted = 35;

    const maps = applyAction(base, { type: 'burn', collectionId: 'maps' }).state.collections.maps;
    expect(maps.burned).toBe(40);
    expect(maps.sent).toBe(25);
    expect(maps.rotted).toBe(35);
    expect(maps.intact + maps.sent + maps.rotted + maps.burned).toBeCloseTo(
      COLLECTIONS.unitsEach,
      6,
    );
  });

  it('is irreversible and writes itself into the timeline', () => {
    const after = applyAction(ready(), { type: 'burn', collectionId: 'maps' });
    expect(after.state.chronicle).toContainEqual(
      expect.objectContaining({ kind: 'collection-burned', id: 'maps' }),
    );
    // Nothing can be done with it afterwards.
    for (const action of [
      { type: 'burn', collectionId: 'maps' },
      { type: 'relocate', collectionId: 'maps' },
      { type: 'transmit-start', collectionId: 'maps' },
    ] as const) {
      expect(canApply(after.state, action)).toBe(false);
    }
  });

  it('stops a transmission of the collection it destroys', () => {
    const sending = applyAction(ready(), { type: 'transmit-start', collectionId: 'maps' }).state;
    const burned = applyAction(sending, { type: 'burn', collectionId: 'maps' }).state;
    expect(burned.transmitting).toBeNull();
  });

  it('refuses a collection that is on its way', () => {
    const moving = applyAction(ready(), { type: 'relocate', collectionId: 'maps' }).state;
    expect(canApply(moving, { type: 'burn', collectionId: 'maps' })).toBe(false);
  });
});

describe('scenarios', () => {
  it('builds the house the scenario describes', () => {
    const tower = createInitialState('4F2A', { scenarioId: 'tower' });
    expect(topFloor(tower)).toBe(SCENARIOS.tower.floors - 1);
    expect(tower.humidity.length).toBe(SCENARIOS.tower.floors);
    expect(tower.material).toBe(SCENARIOS.tower.materialStart);
    expect(tower.collections.languages.floor).toBe(SCENARIOS.tower.collectionFloors.languages);

    const standard = createInitialState('4F2A');
    expect(topFloor(standard)).toBe(SCENARIOS.standard.floors - 1);
    expect(standard.humidity.length).toBe(SCENARIOS.standard.floors);
  });

  it('changes the conditions, never a rule', () => {
    // Same seed, same engine: only the starting numbers differ.
    const drought = createInitialState('4F2A', { scenarioId: 'drought' });
    const standard = createInitialState('4F2A');

    // Less rain in the drought...
    expect(simulate(drought, 300).state.water).toBeLessThan(
      simulate(standard, 300).state.water,
    );

    // ...and a weaker generator. Comparing the battery after 300 ticks proves nothing:
    // both archives sit at exactly zero by then, so the assertion would hold however
    // strong the generator was. Measure the output itself.
    expect(production(drought)).toBeLessThan(production(standard));
    expect(production(drought)).toBeCloseTo(
      (SCENARIOS.drought.generatorOutputPerSecond * drought.systems.generator.integrity) / 100,
      10,
    );
  });

  it('gives the same run for the same seed, played through or caught up', () => {
    // The scenario travels in the state, so chunking must not change a thing.
    const start = createInitialState('9B01', { scenarioId: 'tower' });

    let straight = start;
    for (let i = 0; i < 2000 && !straight.ended; i++) {
      straight = step(straight).state;
    }

    expect(simulateInChunks(start, 2000).state).toEqual(straight);

    let uneven = start;
    for (const size of [7, 113, 991, 2, 887]) {
      uneven = simulate(uneven, size).state;
    }
    expect(uneven).toEqual(straight);
  });

  it('runs a seven-floor archive without special-casing anything', () => {
    const tower = createInitialState('4F2A', { scenarioId: 'tower' });
    const after = simulate(tower, 2000).state;

    expect(after.humidity.length).toBe(SCENARIOS.tower.floors);
    expect(after.water).toBeLessThanOrEqual(SCENARIOS.tower.floors);
    // Every collection is still on a floor that exists.
    for (const collection of Object.values(after.collections)) {
      expect(collection.floor).toBeGreaterThanOrEqual(0);
      expect(collection.floor).toBeLessThan(SCENARIOS.tower.floors);
    }
  });

  it('every scenario ends, whatever house it builds', () => {
    for (const id of ['standard', 'drought', 'tower'] as const) {
      const result = simulate(createInitialState('4F2A', { scenarioId: id }), 72 * 60 * 60);
      expect(result.state.ended).toBe(true);
    }
  });

  it('counts a collection already on its way when a floor fills up', () => {
    const base = ready();
    // Put three collections on the floor above the cellar's target, minus one, then
    // start two moves into the same floor at once.
    const target = 2;
    base.collections.naturalHistory.floor = target;
    base.collections.music.floor = target;
    base.collections.chronicle.floor = 1;
    base.collections.maps.floor = 1;

    const first = applyAction(base, { type: 'relocate', collectionId: 'chronicle' });
    expect(first.applied).toBe(true);

    // The second move would make four on that floor once both arrive.
    expect(canRelocate(first.state, 'maps')).toBe(false);
    expect(applyAction(first.state, { type: 'relocate', collectionId: 'maps' }).applied).toBe(
      false,
    );

    const arrived = simulate(first.state, RELOCATE.transitSeconds).state;
    expect(collectionsOn(arrived, target)).toBeLessThanOrEqual(RELOCATE.maxPerFloor);
  });

  it('does not deliver a collection that rotted away on the stairs', () => {
    // Almost nothing left, and the cellar is under water: it will not survive the
    // half minute on the stairs.
    const base = ready({ water: 1.5 });
    base.collections.maps = { ...base.collections.maps, intact: 0.2, rotted: 99.8 };
    const moving = applyAction(base, { type: 'relocate', collectionId: 'maps' }).state;
    expect(moving.collections.maps.transitTicks).toBe(RELOCATE.transitSeconds);

    const result = simulate(moving, RELOCATE.transitSeconds + 5);
    const maps = result.state.collections.maps;

    expect(maps.lost).toBe(true);
    expect(maps.floor).toBe(0);
    expect(maps.transitTicks).toBe(0);
    // Nothing "arrives" that no longer exists.
    expect(result.events.some((event) => event.type === 'relocation-finished')).toBe(false);
  });
});
