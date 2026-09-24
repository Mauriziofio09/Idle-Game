import { COLLECTION_NAMES, FLOOR_NAMES, SYSTEM_NAMES } from '../content/de';
import type { DomainEvent } from '../engine/domain-events';
import { describe as describeEvent } from './log';

/** The standard archive, which every fixture here plays in. */
const FLOORS = 5;

describe('log lines', () => {
  it('names the system in every system line', () => {
    const events: DomainEvent[] = [
      { type: 'system-repaired', tick: 1, systemId: 'pumps', gain: 21, cost: 8 },
      { type: 'system-toggled', tick: 1, systemId: 'pumps', on: false },
      { type: 'system-dismantled', tick: 1, systemId: 'pumps', material: 30 },
      { type: 'system-lost', tick: 1, systemId: 'pumps' },
    ];
    for (const event of events) {
      expect(describeEvent(event, FLOORS)?.text).toContain(SYSTEM_NAMES.pumps);
    }
  });

  it('marks losses so the log can set them apart without colour', () => {
    expect(describeEvent({ type: 'system-lost', tick: 1, systemId: 'roof' }, FLOORS)?.kind).toBe('loss');
    expect(
      describeEvent({ type: 'collection-lost', tick: 1, collectionId: 'maps', sent: 12 }, FLOORS)?.kind,
    ).toBe('loss');
    expect(describeEvent({ type: 'floor-flooded', tick: 1, floor: 0 }, FLOORS)?.kind).toBe('loss');
    expect(describeEvent({ type: 'run-ended', tick: 1, reason: 'silence' }, FLOORS)?.kind).toBe('end');
  });

  it('names the collection and how much of it got out', () => {
    const line = describeEvent(
      { type: 'collection-lost', tick: 1, collectionId: 'maps', sent: 12 },
      FLOORS,
    );
    expect(line?.text).toContain(COLLECTION_NAMES.maps);
    expect(line?.text).toContain('12 %');
  });

  it('names the floor the water reached', () => {
    expect(describeEvent({ type: 'floor-flooded', tick: 1, floor: 0 }, FLOORS)?.text).toContain(
      FLOOR_NAMES[0],
    );
  });

  it('tells the two endings apart', () => {
    const silence = describeEvent({ type: 'run-ended', tick: 1, reason: 'silence' }, FLOORS)?.text;
    const nothing = describeEvent({ type: 'run-ended', tick: 1, reason: 'nothing-left' }, FLOORS)?.text;
    expect(silence).not.toBe(nothing);
  });

  it('distinguishes losing and regaining supply', () => {
    const short = describeEvent({ type: 'undersupply-changed', tick: 1, ratio: 0.74 }, FLOORS)?.text;
    const restored = describeEvent({ type: 'undersupply-changed', tick: 1, ratio: 1 }, FLOORS)?.text;
    expect(short).toContain('74 %');
    expect(restored).not.toBe(short);
  });

  it('stays silent about events the player never needs as a sentence', () => {
    expect(describeEvent({ type: 'action-rejected', tick: 1, reason: 'run-ended' }, FLOORS)).toBeNull();
  });

  it('names the floor the way this archive calls it, not the tallest one', () => {
    // The five-floor archive's top floor is the attic. Feeding the maximum instead of
    // the run's own height called it "im dritten Stock" in every standard game.
    expect(describeEvent({ type: 'floor-flooded', tick: 1, floor: 4 }, 5)?.text).toBe(
      'Das Wasser steht auf dem Dachboden.',
    );
    // In the tower, floor 4 really is a storey.
    expect(describeEvent({ type: 'floor-flooded', tick: 1, floor: 4 }, 7)?.text).toBe(
      'Das Wasser steht im dritten Stock.',
    );
  });

  it('declines the floor in a relocation, in both directions', () => {
    expect(
      describeEvent(
        { type: 'relocation-started', tick: 1, collectionId: 'maps', toFloor: 1 },
        5,
      )?.text,
    ).toBe('Kartenwerk wird ins Erdgeschoss getragen.');

    expect(
      describeEvent(
        { type: 'relocation-finished', tick: 1, collectionId: 'maps', toFloor: 4 },
        5,
      )?.text,
    ).toBe('Kartenwerk steht jetzt auf dem Dachboden.');
  });

  it('names a burned collection, and marks it as a loss', () => {
    const line = describeEvent(
      { type: 'collection-burned', tick: 1, collectionId: 'maps', units: 40, energy: 20 },
      FLOORS,
    );
    expect(line?.kind).toBe('loss');
    expect(line?.text).toContain(COLLECTION_NAMES.maps);
    expect(line?.text).toContain('40');
    expect(line?.text).toContain('20');
  });
});
