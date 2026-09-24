/**
 * The shape of a protocol rule. The evaluation lives in protocols.ts (milestone 4);
 * the types live here so that GameState can carry rules from milestone 1 onwards
 * without the state module depending on the evaluator.
 */

import type { Action } from './actions';
import type { CollectionId, SystemId } from './state';

/**
 * What a protocol may do. Deliberately narrower than Action: prompt.md section 5.9
 * lists repair, on/off, transmit and relocate — never a dismantle. Giving away a
 * system for good stays a decision the player makes in person.
 */
export type ProtocolAction = Extract<Action, { type: 'repair' } | { type: 'toggle' }>;

export type ProtocolCondition =
  | { kind: 'system-integrity-below'; systemId: SystemId; value: number }
  | { kind: 'water-above'; value: number }
  | { kind: 'energy-below'; value: number }
  | { kind: 'energy-above'; value: number }
  | { kind: 'humidity-above'; floor: number; value: number }
  | { kind: 'collection-below'; collectionId: CollectionId; value: number }
  | { kind: 'material-above'; value: number };

export interface ProtocolRule {
  id: string;
  condition: ProtocolCondition;
  action: ProtocolAction;
  enabled: boolean;
  /** How often this rule fired during the current run. Shown next to the rule. */
  firedCount: number;
}
