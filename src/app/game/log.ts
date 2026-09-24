/**
 * Turns domain events into German log lines.
 *
 * This is the only place where a fact from the engine becomes a sentence. The engine
 * stays language-free; swapping content/de.ts for another file is all a translation needs.
 */

import { COLLECTION_NAMES, FLOOR_NAMES, LOG, SYSTEM_NAMES } from '../content/de';
import type { DomainEvent } from '../engine/domain-events';
import { formatAmount, formatPercent } from '../format';

export type LogKind = 'note' | 'loss' | 'end';

export interface LogEntry {
  /** Tick the line belongs to. The UI renders the timestamp from it. */
  tick: number;
  text: string;
  kind: LogKind;
  /** Distinguishes lines that share a tick, so @for can track them. */
  id: number;
}

/**
 * Returns the line for an event, or null for events that deserve no line
 * (rejections are prevented by the UI, so they would only be noise).
 */
export function describe(event: DomainEvent): { text: string; kind: LogKind } | null {
  switch (event.type) {
    case 'system-repaired':
      return {
        kind: 'note',
        text: LOG.systemRepaired(SYSTEM_NAMES[event.systemId], formatPercent(event.gain)),
      };
    case 'system-toggled':
      return {
        kind: 'note',
        text: event.on
          ? LOG.systemSwitchedOn(SYSTEM_NAMES[event.systemId])
          : LOG.systemSwitchedOff(SYSTEM_NAMES[event.systemId]),
      };
    case 'system-dismantled':
      return {
        kind: 'loss',
        text: LOG.systemDismantled(SYSTEM_NAMES[event.systemId], formatAmount(event.material)),
      };
    case 'system-lost':
      return { kind: 'loss', text: LOG.systemLost(SYSTEM_NAMES[event.systemId]) };
    case 'collection-lost':
      return {
        kind: 'loss',
        text: LOG.collectionLost(COLLECTION_NAMES[event.collectionId], formatPercent(event.sent)),
      };
    case 'floor-flooded':
      return { kind: 'loss', text: LOG.floorFlooded(FLOOR_NAMES[event.floor]) };
    case 'undersupply-changed':
      return {
        kind: 'note',
        text: event.ratio < 1 ? LOG.undersupply(formatPercent(event.ratio * 100)) : LOG.supplyRestored,
      };
    case 'run-ended':
      return {
        kind: 'end',
        text: event.reason === 'silence' ? LOG.endedSilence : LOG.endedNothingLeft,
      };
    case 'transmission-started':
    case 'transmission-stopped':
    case 'transmission-completed':
    case 'action-rejected':
      return null;
  }
}
