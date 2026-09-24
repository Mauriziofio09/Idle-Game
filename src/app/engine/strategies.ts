/**
 * How the balancing targets are measured.
 *
 * prompt.md section 6 states its goals in terms of players: someone who does nothing,
 * someone who patches whatever looks worst, someone who understands the house. These
 * functions stand in for those people, so that `balance.spec.ts` and `npm run sim`
 * measure the same thing and cannot drift apart.
 *
 * They are decision functions over a state, nothing more — no clock, no randomness of
 * their own. A strategy never reaches past `applyAction`, exactly like the interface.
 */

import { canApply, type Action } from './actions';
import { COLLECTION_IDS, SYSTEM_IDS, type GameState, type SystemId } from './state';

export type Strategy = (state: GameState) => Action | null;

/**
 * The thresholds the simulated players act on.
 *
 * These are deliberately NOT in balance.ts. That file holds the numbers the archive is
 * made of; these are the numbers a person plays by, and the difference matters: changing
 * one alters the house, changing the other alters who is being measured in it. Keeping
 * them apart is what lets `balance.spec.ts` say "these players, this house" rather than
 * tuning both ends of the comparison at once. They are gathered here rather than left
 * inline so that a reader can see the whole of each player in one place.
 */
const NAIVE = {
  /** Below this a naive player notices something is wrong and patches it. */
  threshold: 55,
} as const;

const WELL_PLAYED = {
  /** Shed the climate unit below this, switch it back on above the other. */
  shedClimateBelowEnergy: 40,
  restoreClimateAboveEnergy: 120,
  /** Start cannibalising the house at the first figure, get desperate at the second. */
  stripBelowMaterial: 25,
  desperateBelowMaterial: 12,
  /** Not worth tearing out a system already this far gone. */
  worthStripping: 20,
  /** Repair thresholds, in the order the checks are made. */
  generator: 60,
  transmitter: 50,
  pumps: 50,
  workshop: 40,
} as const;

/** Someone who opens the page and lets it run. */
export const doNothing: Strategy = () => null;

/**
 * The obvious way to play: press send, then keep patching whatever looks worst.
 * It never sheds load and never asks whether the thing it repairs is worth the entropy.
 */
export const patchTheWorst: Strategy = (state) => {
  const sending = startSending(state);
  if (sending) {
    return sending;
  }

  let weakest: Action | null = null;
  let lowest: number = NAIVE.threshold;
  for (const id of SYSTEM_IDS) {
    const system = state.systems[id];
    if (system.lost || system.integrity >= lowest) {
      continue;
    }
    const action: Action = { type: 'repair', systemId: id };
    if (canApply(state, action)) {
      lowest = system.integrity;
      weakest = action;
    }
  }
  return weakest;
};

/**
 * Someone who understands the house.
 *
 * The order of the checks is the strategy: power first, because nothing works without
 * it; then the mast, because it is the only thing that saves anything; then the pumps
 * while the cellar is still worth holding. It sheds the climate unit when the battery
 * runs low, and it cannibalises the house for material — prompt.md 5.6 names dismantling
 * as one of only two sources, and tearing out the climate control to keep the pumps
 * running is the archive's real economy.
 */
export const playWell: Strategy = (state) => {
  const repair = (id: SystemId): Action | null => {
    const action: Action = { type: 'repair', systemId: id };
    return canApply(state, action) ? action : null;
  };
  const strip = (id: SystemId): Action | null => {
    const action: Action = { type: 'dismantle', systemId: id };
    return state.systems[id].integrity > WELL_PLAYED.worthStripping && canApply(state, action)
      ? action
      : null;
  };

  if (state.energy < WELL_PLAYED.shedClimateBelowEnergy && state.systems.climate.on && !state.systems.climate.lost) {
    return { type: 'toggle', systemId: 'climate', on: false };
  }
  if (state.energy > WELL_PLAYED.restoreClimateAboveEnergy && !state.systems.climate.on && !state.systems.climate.lost) {
    return { type: 'toggle', systemId: 'climate', on: true };
  }

  if (state.material < WELL_PLAYED.stripBelowMaterial) {
    const spare = strip('climate') ?? (state.water >= 1 ? strip('pumps') : null);
    if (spare) {
      return spare;
    }
  }
  if (state.material < WELL_PLAYED.desperateBelowMaterial) {
    const spare = strip('workshop') ?? strip('custodian');
    if (spare) {
      return spare;
    }
  }

  if (state.systems.generator.integrity < WELL_PLAYED.generator) {
    const action = repair('generator');
    if (action) return action;
  }
  if (state.systems.transmitter.integrity < WELL_PLAYED.transmitter) {
    const action = repair('transmitter');
    if (action) return action;
  }
  if (state.water < 1 && state.systems.pumps.integrity < WELL_PLAYED.pumps) {
    const action = repair('pumps');
    if (action) return action;
  }
  if (!state.systems.workshop.lost && state.systems.workshop.integrity < WELL_PLAYED.workshop) {
    const action = repair('workshop');
    if (action) return action;
  }

  return startSending(state, true);
};

/** Puts the fullest collection on the air, or the first one that will go. */
function startSending(state: GameState, preferFullest = false): Action | null {
  if (state.transmitting !== null) {
    return null;
  }
  let best: Action | null = null;
  let most = 0;
  for (const id of COLLECTION_IDS) {
    const action: Action = { type: 'transmit-start', collectionId: id };
    if (!canApply(state, action)) {
      continue;
    }
    if (!preferFullest) {
      return action;
    }
    if (state.collections[id].intact > most) {
      most = state.collections[id].intact;
      best = action;
    }
  }
  return best;
}
