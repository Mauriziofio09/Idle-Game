import { LEGACY, PROTOCOLS } from './balance';
import { buildChronicle } from './chronicle';
import {
  bankRun,
  emptyLegacy,
  fragmentsUnlocked,
  protocolSlotsFor,
  totalSent,
  unitsToNextFragment,
  unitsToNextSlot,
} from './legacy';
import { createInitialState } from './state';

function withSent(sent: Record<string, number>) {
  return { ...emptyLegacy(), sent };
}

describe('the legacy', () => {
  it('starts empty', () => {
    expect(totalSent(emptyLegacy())).toBe(0);
    expect(fragmentsUnlocked(emptyLegacy())).toBe(0);
    expect(protocolSlotsFor(emptyLegacy())).toBe(PROTOCOLS.startingSlots);
  });

  it('adds a finished run without touching the record it was given', () => {
    const before = withSent({ maps: 10 });
    const state = createInitialState('4F2A');
    state.collections.maps.sent = 20;
    state.collections.chronicle.sent = 5;

    const after = bankRun(before, state);

    expect(after.sent['maps']).toBe(30);
    expect(after.sent['chronicle']).toBe(5);
    expect(after.runs).toBe(1);
    // The original is untouched.
    expect(before.sent['maps']).toBe(10);
    expect(before.runs).toBe(0);
  });

  it('unlocks one fragment per 25 units and never more than exist', () => {
    expect(fragmentsUnlocked(withSent({ maps: 24 }))).toBe(0);
    expect(fragmentsUnlocked(withSent({ maps: 25 }))).toBe(1);
    expect(fragmentsUnlocked(withSent({ maps: 74 }))).toBe(2);
    expect(fragmentsUnlocked(withSent({ maps: 99_999 }))).toBe(LEGACY.fragmentCount);
  });

  it('counts down to the next fragment, then says there are none left', () => {
    expect(unitsToNextFragment(emptyLegacy())).toBe(LEGACY.unitsPerFragment);
    expect(unitsToNextFragment(withSent({ maps: 10 }))).toBe(15);
    expect(unitsToNextFragment(withSent({ maps: 99_999 }))).toBeNull();
  });

  it('earns protocol slots at the documented thresholds, up to the maximum', () => {
    expect(protocolSlotsFor(withSent({ maps: LEGACY.slotThresholds[0] - 1 }))).toBe(
      PROTOCOLS.startingSlots,
    );
    expect(protocolSlotsFor(withSent({ maps: LEGACY.slotThresholds[0] }))).toBe(
      PROTOCOLS.startingSlots + 1,
    );
    expect(protocolSlotsFor(withSent({ maps: 99_999 }))).toBe(PROTOCOLS.maxSlots);
  });

  it('counts down to the next slot, then says all are earned', () => {
    expect(unitsToNextSlot(emptyLegacy())).toBe(LEGACY.slotThresholds[0]);
    expect(unitsToNextSlot(withSent({ maps: 99_999 }))).toBeNull();
  });

});

describe('the chronicle of a run', () => {
  it('reports what was saved, per collection and overall', () => {
    const state = createInitialState('4F2A');
    state.collections.maps.sent = 50;
    state.collections.maps.intact = 50;

    const chronicle = buildChronicle(state);
    expect(chronicle.seed).toBe('4F2A');
    expect(chronicle.collections.find((entry) => entry.id === 'maps')?.share).toBe(50);
    // One of six collections at half: one twelfth of everything.
    expect(chronicle.savedShare).toBeCloseTo(50 / 600, 10);
  });

  it('names the rule that fired most often, or says none did', () => {
    const state = createInitialState('4F2A');
    expect(buildChronicle(state).mostUsedRule).toBeNull();

    state.protocols = [
      {
        id: 'a',
        condition: { kind: 'material-above', value: 1 },
        action: { type: 'repair', systemId: 'pumps' },
        enabled: true,
        firedCount: 3,
      },
      {
        id: 'b',
        condition: { kind: 'material-above', value: 1 },
        action: { type: 'repair', systemId: 'roof' },
        enabled: true,
        firedCount: 9,
      },
    ];
    expect(buildChronicle(state).mostUsedRule).toMatchObject({ id: 'b', position: 2, firedCount: 9 });
  });

  it('picks a closing line from the run, not at random', () => {
    const empty = createInitialState('4F2A');
    expect(buildChronicle(empty).closing).toBe('nothing-saved');

    const little = createInitialState('4F2A');
    little.collections.maps.sent = 30;
    expect(buildChronicle(little).closing).toBe('a-little');

    const most = createInitialState('4F2A');
    for (const id of ['maps', 'chronicle', 'naturalHistory', 'music'] as const) {
      most.collections[id].sent = 90;
    }
    expect(buildChronicle(most).closing).toBe('most-of-it');

    // The mast falling last overrides the arithmetic: it is the more telling fact.
    const mast = createInitialState('4F2A');
    mast.collections.maps.sent = 30;
    mast.chronicle = [{ tick: 500, kind: 'system-lost', id: 'transmitter' }];
    expect(buildChronicle(mast).closing).toBe('mast-fell-last');
  });

  it('ignores flooded floors when naming what fell last', () => {
    const state = createInitialState('4F2A');
    state.chronicle = [
      { tick: 100, kind: 'system-lost', id: 'pumps' },
      { tick: 200, kind: 'floor-flooded', id: '0' },
    ];
    expect(buildChronicle(state).lastLoss).toMatchObject({ kind: 'system-lost', id: 'pumps' });
    // The timeline itself keeps everything, in order.
    expect(buildChronicle(state).timeline.length).toBe(2);
  });
});
