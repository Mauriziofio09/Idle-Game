import { COLLECTION_NAMES, FLOOR_NAMES, SYSTEM_NAMES } from '../content/de';
import type { DomainEvent } from '../engine/domain-events';
import { describe as describeEvent } from './log';

describe('log lines', () => {
  it('names the system in every system line', () => {
    const events: DomainEvent[] = [
      { type: 'system-repaired', tick: 1, systemId: 'pumps', gain: 21, cost: 8 },
      { type: 'system-toggled', tick: 1, systemId: 'pumps', on: false },
      { type: 'system-dismantled', tick: 1, systemId: 'pumps', material: 30 },
      { type: 'system-lost', tick: 1, systemId: 'pumps' },
    ];
    for (const event of events) {
      expect(describeEvent(event)?.text).toContain(SYSTEM_NAMES.pumps);
    }
  });

  it('marks losses so the log can set them apart without colour', () => {
    expect(describeEvent({ type: 'system-lost', tick: 1, systemId: 'roof' })?.kind).toBe('loss');
    expect(
      describeEvent({ type: 'collection-lost', tick: 1, collectionId: 'maps', sent: 12 })?.kind,
    ).toBe('loss');
    expect(describeEvent({ type: 'floor-flooded', tick: 1, floor: 0 })?.kind).toBe('loss');
    expect(describeEvent({ type: 'run-ended', tick: 1, reason: 'silence' })?.kind).toBe('end');
  });

  it('names the collection and how much of it got out', () => {
    const line = describeEvent({
      type: 'collection-lost',
      tick: 1,
      collectionId: 'maps',
      sent: 12,
    });
    expect(line?.text).toContain(COLLECTION_NAMES.maps);
    expect(line?.text).toContain('12 %');
  });

  it('names the floor the water reached', () => {
    expect(describeEvent({ type: 'floor-flooded', tick: 1, floor: 0 })?.text).toContain(
      FLOOR_NAMES[0],
    );
  });

  it('tells the two endings apart', () => {
    const silence = describeEvent({ type: 'run-ended', tick: 1, reason: 'silence' })?.text;
    const nothing = describeEvent({ type: 'run-ended', tick: 1, reason: 'nothing-left' })?.text;
    expect(silence).not.toBe(nothing);
  });

  it('distinguishes losing and regaining supply', () => {
    const short = describeEvent({ type: 'undersupply-changed', tick: 1, ratio: 0.74 })?.text;
    const restored = describeEvent({ type: 'undersupply-changed', tick: 1, ratio: 1 })?.text;
    expect(short).toContain('74 %');
    expect(restored).not.toBe(short);
  });

  it('stays silent about events the player never needs as a sentence', () => {
    expect(describeEvent({ type: 'action-rejected', tick: 1, reason: 'run-ended' })).toBeNull();
  });
});
