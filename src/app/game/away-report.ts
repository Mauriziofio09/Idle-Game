/**
 * What happened while the player was away.
 *
 * Built from the state before, the state after and the domain events in between — the
 * same events the log renders. Nothing here re-simulates or guesses; the summary can
 * only ever describe what the engine actually did.
 */

import type { DomainEvent } from '../engine/domain-events';
import type { CollectionId, GameState, SystemId } from '../engine/state';

export interface AwayReport {
  /** Seconds of game time actually simulated, after clamping. */
  simulatedSeconds: number;
  /** How long the player was really gone, before clamping. */
  absentSeconds: number;
  /** True when the absence exceeded the offline window and the archive was held still. */
  stasis: boolean;
  /** True when the main save was unreadable and the backup slot was used. */
  fromBackup: boolean;
  water: { before: number; after: number };
  energy: { before: number; after: number };
  entropy: { before: number; after: number };
  lostSystems: SystemId[];
  lostCollections: CollectionId[];
  floodedFloors: number[];
  endedWhileAway: boolean;
}

export function buildAwayReport(options: {
  before: GameState;
  after: GameState;
  events: readonly DomainEvent[];
  absentSeconds: number;
  simulatedSeconds: number;
  stasis: boolean;
  fromBackup: boolean;
}): AwayReport {
  const lostSystems: SystemId[] = [];
  const lostCollections: CollectionId[] = [];
  const floodedFloors: number[] = [];
  let endedWhileAway = false;

  for (const event of options.events) {
    switch (event.type) {
      case 'system-lost':
        lostSystems.push(event.systemId);
        break;
      case 'collection-lost':
        lostCollections.push(event.collectionId);
        break;
      case 'floor-flooded':
        floodedFloors.push(event.floor);
        break;
      case 'run-ended':
        endedWhileAway = true;
        break;
      default:
        break;
    }
  }

  return {
    simulatedSeconds: options.simulatedSeconds,
    absentSeconds: options.absentSeconds,
    stasis: options.stasis,
    fromBackup: options.fromBackup,
    water: { before: options.before.water, after: options.after.water },
    energy: { before: options.before.energy, after: options.after.energy },
    entropy: { before: options.before.entropy, after: options.after.entropy },
    lostSystems,
    lostCollections,
    floodedFloors,
    endedWhileAway,
  };
}
