/**
 * The only way a player or a protocol may change the world.
 *
 * `applyAction` is pure: it copies the state, mutates the copy and hands it back
 * together with the domain events it produced. The UI and protocols.ts call exactly
 * this function, which is what keeps offline play identical to online play.
 */

import { DISMANTLE, ENTROPY, REPAIR } from './balance';
import type { DomainEvent } from './domain-events';
import type { CollectionId, GameState, SystemId } from './state';
import { cloneState } from './state';

export type Action =
  | { type: 'repair'; systemId: SystemId }
  | { type: 'toggle'; systemId: SystemId; on: boolean }
  | { type: 'dismantle'; systemId: SystemId }
  | { type: 'transmit-start'; collectionId: CollectionId }
  | { type: 'transmit-stop' };


export interface ActionResult {
  state: GameState;
  events: DomainEvent[];
  /** False when nothing changed. The reason is in the emitted `action-rejected` event. */
  applied: boolean;
}

/** What a repair would cost and gain right now. The detail panel shows exactly this. */
export interface RepairPreview {
  gain: number;
  materialCost: number;
  energyCost: number;
  entropyCost: number;
}

/**
 * The workshop makes repairs more effective — but only while it is intact and running.
 * Switching it off conserves it and costs you the bonus.
 */
export function workshopFactor(state: GameState): number {
  const workshop = state.systems.workshop;
  if (workshop.lost || !workshop.on) {
    return REPAIR.workshopFloor;
  }
  return REPAIR.workshopFloor + (REPAIR.workshopRange * workshop.integrity) / 100;
}

export function repairPreview(state: GameState, systemId: SystemId): RepairPreview {
  const system = state.systems[systemId];
  const rawGain =
    REPAIR.baseGain * workshopFactor(state) * Math.pow(REPAIR.diminishing, system.repairs);
  return {
    gain: Math.min(rawGain, REPAIR.maxIntegrity - system.integrity),
    materialCost: REPAIR.materialBase * (1 + REPAIR.materialGrowth * system.repairs),
    energyCost: REPAIR.energyCost,
    entropyCost: ENTROPY.perRepair,
  };
}

/** Material returned by dismantling. Early dismantling pays better — and costs you the function. */
export function dismantleYield(state: GameState, systemId: SystemId): number {
  const system = state.systems[systemId];
  return DISMANTLE.materialBase + (DISMANTLE.materialPerIntegrity * system.integrity) / 100;
}

/**
 * Whether an action would go through. Protocols check this before spending their
 * cooldown on a rule, and the UI uses it to disable buttons.
 */
export function canApply(state: GameState, action: Action): boolean {
  if (state.ended) {
    return false;
  }

  if (action.type === 'transmit-stop') {
    return state.transmitting !== null;
  }
  if (action.type === 'transmit-start') {
    const mast = state.systems.transmitter;
    const collection = state.collections[action.collectionId];
    return (
      !mast.lost &&
      !collection.lost &&
      collection.intact > 0 &&
      state.transmitting !== action.collectionId
    );
  }

  const system = state.systems[action.systemId];
  if (system.lost) {
    return false;
  }

  switch (action.type) {
    case 'repair': {
      if (system.integrity >= REPAIR.maxIntegrity) {
        return false;
      }
      const preview = repairPreview(state, action.systemId);
      return state.material >= preview.materialCost && state.energy >= preview.energyCost;
    }
    case 'toggle':
      return system.on !== action.on;
    case 'dismantle':
      return true;
  }
}

export function applyAction(state: GameState, action: Action): ActionResult {
  const events: DomainEvent[] = [];
  const reject = (reason: Parameters<typeof rejectionEvent>[1]): ActionResult => {
    events.push(rejectionEvent(state.tick, reason));
    return { state, events, applied: false };
  };

  if (state.ended) {
    return reject('run-ended');
  }

  if (action.type === 'transmit-start' || action.type === 'transmit-stop') {
    return applyTransmit(state, action, events, reject);
  }

  if (state.systems[action.systemId].lost) {
    return reject('system-lost');
  }

  switch (action.type) {
    case 'repair': {
      const system = state.systems[action.systemId];
      if (system.integrity >= REPAIR.maxIntegrity) {
        return reject('already-at-full-integrity');
      }
      const preview = repairPreview(state, action.systemId);
      if (state.material < preview.materialCost) {
        return reject('not-enough-material');
      }
      if (state.energy < preview.energyCost) {
        return reject('not-enough-energy');
      }

      const next = cloneState(state);
      const target = next.systems[action.systemId];
      target.integrity = Math.min(REPAIR.maxIntegrity, target.integrity + preview.gain);
      target.repairs += 1;
      next.material -= preview.materialCost;
      next.energy -= preview.energyCost;
      // Order out of disorder, paid for in disorder elsewhere.
      next.entropy += ENTROPY.perRepair;

      events.push({
        type: 'system-repaired',
        tick: next.tick,
        systemId: action.systemId,
        gain: preview.gain,
        cost: preview.materialCost,
      });
      return { state: next, events, applied: true };
    }

    case 'toggle': {
      if (state.systems[action.systemId].on === action.on) {
        return { state, events, applied: false };
      }
      const next = cloneState(state);
      next.systems[action.systemId].on = action.on;
      events.push({
        type: 'system-toggled',
        tick: next.tick,
        systemId: action.systemId,
        on: action.on,
      });

      // Switching the mast off ends the transmission. Leaving it "sending" into a dead
      // mast would show the player a state the archive is not in.
      if (action.systemId === 'transmitter' && !action.on && next.transmitting !== null) {
        events.push({
          type: 'transmission-stopped',
          tick: next.tick,
          collectionId: next.transmitting,
        });
        next.transmitting = null;
      }
      return { state: next, events, applied: true };
    }

    case 'dismantle': {
      const yielded = dismantleYield(state, action.systemId);
      const next = cloneState(state);
      const target = next.systems[action.systemId];
      target.lost = true;
      target.on = false;
      target.integrity = 0;
      next.material += yielded;
      next.entropy += ENTROPY.perDismantle;

      // A dismantled transmitter cannot go on sending.
      if (action.systemId === 'transmitter') {
        next.transmitting = null;
      }

      events.push({
        type: 'system-dismantled',
        tick: next.tick,
        systemId: action.systemId,
        material: yielded,
      });
      return { state: next, events, applied: true };
    }
  }
}

/**
 * Starting and stopping the transmission. Only ever one collection at a time: the mast
 * has one channel, and choosing what goes out is the whole game.
 */
function applyTransmit(
  state: GameState,
  action: Extract<Action, { type: 'transmit-start' | 'transmit-stop' }>,
  events: DomainEvent[],
  reject: (reason: ActionRejectionReason) => ActionResult,
): ActionResult {
  if (action.type === 'transmit-stop') {
    const current = state.transmitting;
    if (current === null) {
      return reject('nothing-to-transmit');
    }
    const next = cloneState(state);
    next.transmitting = null;
    next.systems.transmitter.on = false;
    events.push({ type: 'transmission-stopped', tick: next.tick, collectionId: current });
    return { state: next, events, applied: true };
  }

  const mast = state.systems.transmitter;
  if (mast.lost) {
    return reject('transmitter-unavailable');
  }
  const collection = state.collections[action.collectionId];
  if (collection.lost || collection.intact <= 0) {
    return reject('nothing-to-transmit');
  }
  if (state.transmitting === action.collectionId) {
    return { state, events, applied: false };
  }

  const next = cloneState(state);
  next.transmitting = action.collectionId;
  // Switching the mast on is part of the decision, not a second step.
  next.systems.transmitter.on = true;
  events.push({
    type: 'transmission-started',
    tick: next.tick,
    collectionId: action.collectionId,
  });
  return { state: next, events, applied: true };
}

function rejectionEvent(tick: number, reason: ActionRejectionReason): DomainEvent {
  return { type: 'action-rejected', tick, reason };
}

type ActionRejectionReason = Extract<DomainEvent, { type: 'action-rejected' }>['reason'];
