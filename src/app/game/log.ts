/**
 * Turns domain events into German log lines.
 *
 * This is the only place where a fact from the engine becomes a sentence. The engine
 * stays language-free; swapping content/de.ts for another file is all a translation needs.
 */

import {
  COLLECTION_NAMES,
  EVENT_LOG,
  LOG,
  SYSTEM_NAMES,
  floorAccusative,
  floorDative,
} from '../content/de';
import type { DomainEvent } from '../engine/domain-events';
import type { EventKind } from '../engine/state';
import { EVENTS } from '../engine/balance';
import { formatPercent, formatResource, formatSeconds } from '../format';

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
/**
 * @param floors how many floors this archive has. A domain event carries no layout, and
 * guessing the maximum would call the attic of a five-floor house "the third storey".
 */
export function describe(
  event: DomainEvent,
  floors: number,
): { text: string; kind: LogKind } | null {
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
        text: LOG.systemDismantled(SYSTEM_NAMES[event.systemId], formatResource(event.material)),
      };
    case 'system-lost':
      return { kind: 'loss', text: LOG.systemLost(SYSTEM_NAMES[event.systemId]) };
    case 'collection-lost':
      return {
        kind: 'loss',
        text: LOG.collectionLost(COLLECTION_NAMES[event.collectionId], formatPercent(event.sent)),
      };
    case 'floor-flooded':
      return { kind: 'loss', text: LOG.floorFlooded(floorDative(event.floor, floors)) };
    case 'transmitter-online':
      return { kind: 'note', text: LOG.transmitterAnswers };
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
      return {
        kind: 'note',
        text: LOG.transmissionStarted(COLLECTION_NAMES[event.collectionId]),
      };
    case 'transmission-stopped':
      return {
        kind: 'note',
        text: LOG.transmissionStopped(COLLECTION_NAMES[event.collectionId]),
      };
    case 'transmission-completed':
      return {
        kind: 'note',
        text: LOG.transmissionCompleted(COLLECTION_NAMES[event.collectionId]),
      };

    case 'relocation-started':
      return {
        kind: 'note',
        text: LOG.relocationStarted(
          COLLECTION_NAMES[event.collectionId],
          floorAccusative(event.toFloor, floors),
        ),
      };
    case 'relocation-finished':
      return {
        kind: 'note',
        text: LOG.relocationFinished(
          COLLECTION_NAMES[event.collectionId],
          floorDative(event.toFloor, floors),
        ),
      };
    case 'collection-burned':
      return {
        kind: 'loss',
        text: LOG.collectionBurned(
          COLLECTION_NAMES[event.collectionId],
          formatResource(event.units),
          formatResource(event.energy),
        ),
      };

    case 'event-announced': {
      const warning = formatSeconds(EVENTS.warningSeconds);
      return {
        kind: 'note',
        text:
          event.kind === 'storm-surge'
            ? EVENT_LOG.announced['storm-surge'](warning)
            : EVENT_LOG.announced.cloudburst(warning),
      };
    }

    case 'event-struck':
      return { kind: eventKind(event.kind), text: describeStrike(event) };

    // A fired protocol needs no line of its own: the action it took already wrote one.
    // Who acted is answered by the rule's own counter and by the return summary.
    case 'protocol-fired':
    case 'action-rejected':
      return null;
  }
}

/** Only the kind ones are notes; the rest read as losses. */
function eventKind(kind: EventKind): LogKind {
  return kind === 'driftwood' || kind === 'rain-pause' ? 'note' : 'loss';
}

function describeStrike(event: Extract<DomainEvent, { type: 'event-struck' }>): string {
  switch (event.kind) {
    case 'storm-surge':
      return EVENT_LOG.struck['storm-surge'];
    case 'rain-pause':
      return EVENT_LOG.struck['rain-pause'];
    case 'cloudburst':
      return EVENT_LOG.struck.cloudburst;
    case 'short-circuit':
      return EVENT_LOG.struck['short-circuit'](
        event.systemId ? SYSTEM_NAMES[event.systemId] : '',
      );
    case 'driftwood':
      return EVENT_LOG.struck.driftwood(formatResource(event.amount ?? 0));
    case 'mould':
      return EVENT_LOG.struck.mould(
        event.collectionId ? COLLECTION_NAMES[event.collectionId] : '',
      );
  }
}
