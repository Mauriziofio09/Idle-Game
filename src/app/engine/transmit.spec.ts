import { applyAction, canApply } from './actions';
import { COLLECTIONS, ENERGY, TRANSMIT, SYSTEMS } from './balance';
import { simulate } from './offline';
import { createInitialState, savedShare, type GameState } from './state';
import { demand, isTransmitting, step, transmitRate } from './step';

function ready(patch: Partial<GameState> = {}): GameState {
  const base = createInitialState('4F2A');
  return { ...base, energy: ENERGY.capacity, supplyRatio: 1, ...patch };
}

describe('starting and stopping a transmission', () => {
  it('switches the mast on as part of the decision', () => {
    const result = applyAction(ready(), { type: 'transmit-start', collectionId: 'maps' });

    expect(result.applied).toBe(true);
    expect(result.state.transmitting).toBe('maps');
    expect(result.state.systems.transmitter.on).toBe(true);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'transmission-started', collectionId: 'maps' }),
    );
  });

  it('sends only one collection at a time', () => {
    const sending = applyAction(ready(), { type: 'transmit-start', collectionId: 'maps' }).state;
    const switched = applyAction(sending, {
      type: 'transmit-start',
      collectionId: 'chronicle',
    });

    // Switching is allowed, but the first one stops.
    expect(switched.applied).toBe(true);
    expect(switched.state.transmitting).toBe('chronicle');
  });

  it('refuses a collection with nothing left, and a lost mast', () => {
    const empty = ready();
    empty.collections.maps.intact = 0;
    empty.collections.maps.lost = true;
    expect(canApply(empty, { type: 'transmit-start', collectionId: 'maps' })).toBe(false);

    const noMast = ready();
    noMast.systems.transmitter = { integrity: 0, on: false, repairs: 0, lost: true };
    expect(canApply(noMast, { type: 'transmit-start', collectionId: 'chronicle' })).toBe(false);
  });

  it('stops on request, and refuses to stop when nothing is going out', () => {
    const idle = ready();
    expect(applyAction(idle, { type: 'transmit-stop' }).applied).toBe(false);

    const sending = applyAction(idle, { type: 'transmit-start', collectionId: 'maps' }).state;
    const stopped = applyAction(sending, { type: 'transmit-stop' });
    expect(stopped.applied).toBe(true);
    expect(stopped.state.transmitting).toBeNull();
    expect(stopped.state.systems.transmitter.on).toBe(false);
  });

  it('stops when the mast is dismantled', () => {
    const sending = applyAction(ready(), { type: 'transmit-start', collectionId: 'maps' }).state;
    const gone = applyAction(sending, { type: 'dismantle', systemId: 'transmitter' }).state;
    expect(gone.transmitting).toBeNull();
  });
});

describe('sending', () => {
  it('moves units out of the building and they never come back', () => {
    const sending = applyAction(ready(), { type: 'transmit-start', collectionId: 'maps' }).state;
    const after = simulate(sending, 60).state;

    expect(after.collections.maps.sent).toBeGreaterThan(0);
    expect(after.collections.maps.intact).toBeLessThan(COLLECTIONS.unitsEach);
    expect(savedShare(after)).toBeGreaterThan(0);

    // What is sent is safe. Stop the mast, drown the floor, and the tally holds.
    const stopped = applyAction(after, { type: 'transmit-stop' }).state;
    const drowned = simulate({ ...stopped, water: 1.5 }, 300).state;
    expect(drowned.collections.maps.lost).toBe(true);
    expect(drowned.collections.maps.intact).toBe(0);
    expect(drowned.collections.maps.sent).toBeCloseTo(stopped.collections.maps.sent, 6);
  });

  it('moves at the documented rate, scaled by the power it gets', () => {
    const sending = applyAction(ready(), { type: 'transmit-start', collectionId: 'maps' }).state;
    const integrity = sending.systems.transmitter.integrity;

    expect(transmitRate(sending, 1)).toBeCloseTo((TRANSMIT.unitsPerSecond * integrity) / 100, 10);
    expect(transmitRate(sending, 0.5)).toBeCloseTo(transmitRate(sending, 1) * 0.5, 10);
  });

  it('draws power only while it is sending', () => {
    const idle = ready();
    const sending = applyAction(idle, { type: 'transmit-start', collectionId: 'maps' }).state;
    expect(demand(sending) - demand(idle)).toBeCloseTo(TRANSMIT.energyPerSecond, 10);
    expect(isTransmitting(idle)).toBe(false);
  });

  it('wears the mast faster while it sends', () => {
    const idle = ready();
    const sending = applyAction(idle, { type: 'transmit-start', collectionId: 'maps' }).state;

    // Same archive, same tick, only the mast's job differs.
    const idleLoss =
      idle.systems.transmitter.integrity - step({ ...idle, systems: { ...idle.systems, transmitter: { ...idle.systems.transmitter, on: true } } }).state.systems.transmitter.integrity;
    const sendingLoss =
      sending.systems.transmitter.integrity - step(sending).state.systems.transmitter.integrity;

    expect(sendingLoss).toBeGreaterThan(idleLoss);
    expect(TRANSMIT.decayWhileSending).toBeGreaterThan(SYSTEMS.transmitter.baseDecayPerSecond);
  });

  it('reports completion and releases the mast', () => {
    const base = ready();
    base.collections.maps.intact = 0.5;
    base.collections.maps.rotted = COLLECTIONS.unitsEach - 0.5;
    const sending = applyAction(base, { type: 'transmit-start', collectionId: 'maps' }).state;

    const result = simulate(sending, 120);
    expect(result.state.transmitting).toBeNull();
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'transmission-completed', collectionId: 'maps' }),
    );
  });

  it('keeps the books balanced while units leave', () => {
    const sending = applyAction(ready(), { type: 'transmit-start', collectionId: 'maps' }).state;
    const after = simulate(sending, 200).state;
    const maps = after.collections.maps;
    expect(maps.intact + maps.sent + maps.rotted).toBeCloseTo(COLLECTIONS.unitsEach, 6);
  });

  it('stops when the mast wears out, and says so', () => {
    const base = ready();
    base.systems.transmitter.integrity = 0.01;
    const sending = applyAction(base, { type: 'transmit-start', collectionId: 'maps' }).state;

    const result = step(sending);

    expect(result.state.systems.transmitter.lost).toBe(true);
    // Nothing may go on "sending" into a mast that has fallen.
    expect(result.state.transmitting).toBeNull();
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'transmission-stopped', collectionId: 'maps' }),
    );
  });

  it('stops when the player switches the mast off, and says so', () => {
    const sending = applyAction(ready(), { type: 'transmit-start', collectionId: 'maps' }).state;
    const off = applyAction(sending, { type: 'toggle', systemId: 'transmitter', on: false });

    expect(off.applied).toBe(true);
    expect(off.state.transmitting).toBeNull();
    expect(off.events).toContainEqual(
      expect.objectContaining({ type: 'transmission-stopped', collectionId: 'maps' }),
    );

    // And nothing leaves the building afterwards.
    const later = simulate(off.state, 60).state;
    expect(later.collections.maps.sent).toBe(0);
  });
});
