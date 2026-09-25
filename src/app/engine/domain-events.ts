/**
 * What the engine reports back after a tick or an action.
 *
 * Domain events carry facts, never sentences. The UI turns them into German log
 * lines using content/de.ts, which keeps the engine free of presentation and makes
 * a second language a content change rather than an engine change.
 */

import type { ProtocolAction } from './protocol-types';
import type { CollectionId, EndReason, EventKind, SystemId } from './state';

export type ActionRejection =
  | 'not-enough-material'
  | 'not-enough-energy'
  | 'system-lost'
  | 'already-at-full-integrity'
  | 'run-ended'
  | 'nothing-to-transmit'
  | 'transmitter-unavailable'
  | 'already-in-transit'
  | 'no-floor-above'
  | 'floor-is-full'
  | 'nothing-to-burn';

export type DomainEvent =
  | { type: 'system-repaired'; tick: number; systemId: SystemId; gain: number; cost: number }
  | { type: 'system-toggled'; tick: number; systemId: SystemId; on: boolean }
  | { type: 'system-dismantled'; tick: number; systemId: SystemId; material: number }
  | { type: 'system-lost'; tick: number; systemId: SystemId }
  | { type: 'collection-lost'; tick: number; collectionId: CollectionId; sent: number }
  | { type: 'floor-flooded'; tick: number; floor: number }
  | { type: 'transmission-started'; tick: number; collectionId: CollectionId }
  | { type: 'transmission-stopped'; tick: number; collectionId: CollectionId }
  | { type: 'transmission-completed'; tick: number; collectionId: CollectionId }
  | { type: 'relocation-started'; tick: number; collectionId: CollectionId; toFloor: number }
  | { type: 'relocation-finished'; tick: number; collectionId: CollectionId; toFloor: number }
  | {
      type: 'collection-burned';
      tick: number;
      collectionId: CollectionId;
      units: number;
      energy: number;
    }
  /** The mast finishes its self test and can be used. Once per run, see balance REVEAL. */
  | { type: 'transmitter-online'; tick: number }
  | { type: 'undersupply-changed'; tick: number; ratio: number }
  | { type: 'protocol-fired'; tick: number; ruleId: string; action: ProtocolAction }
  | { type: 'event-announced'; tick: number; kind: EventKind }
  | {
      type: 'event-struck';
      tick: number;
      kind: EventKind;
      systemId?: SystemId;
      collectionId?: CollectionId;
      amount?: number;
    }
  | { type: 'action-rejected'; tick: number; reason: ActionRejection }
  | { type: 'run-ended'; tick: number; reason: EndReason };

/** What every engine entry point returns: the next state plus what happened on the way. */
export interface StepResult {
  state: import('./state').GameState;
  events: DomainEvent[];
}
