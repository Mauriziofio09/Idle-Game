/**
 * What the engine reports back after a tick or an action.
 *
 * Domain events carry facts, never sentences. The UI turns them into German log
 * lines using content/de.ts, which keeps the engine free of presentation and makes
 * a second language a content change rather than an engine change.
 */

import type { CollectionId, EndReason, SystemId } from './state';

export type ActionRejection =
  | 'not-enough-material'
  | 'not-enough-energy'
  | 'system-lost'
  | 'already-at-full-integrity'
  | 'run-ended'
  | 'nothing-to-transmit'
  | 'transmitter-unavailable';

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
  | { type: 'undersupply-changed'; tick: number; ratio: number }
  | { type: 'action-rejected'; tick: number; reason: ActionRejection }
  | { type: 'run-ended'; tick: number; reason: EndReason };

/** What every engine entry point returns: the next state plus what happened on the way. */
export interface StepResult {
  state: import('./state').GameState;
  events: DomainEvent[];
}
