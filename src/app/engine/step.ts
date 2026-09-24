/**
 * One simulation tick.
 *
 * `step` is pure and knows nothing about clocks: it takes a state and returns the
 * next one. Online play, catching up after a hidden tab, offline simulation and the
 * headless balancing run all go through this same function, which is what makes the
 * return summary trustworthy.
 *
 * Order within a tick matters and is deliberate:
 *   entropy -> power -> water -> humidity -> wear -> rot -> losses -> end check
 * Power is settled before the pumps move water, because an undersupplied pump moves
 * proportionally less.
 */

import {
  COLLECTIONS,
  ENERGY,
  ENTROPY,
  FLOOR_COUNT,
  HUMIDITY,
  SECONDS_PER_TICK,
  SYSTEMS,
  SYSTEM_DECAY,
  WATER,
} from './balance';
import type { DomainEvent, StepResult } from './domain-events';
import {
  COLLECTION_IDS,
  SYSTEM_IDS,
  cloneState,
  isFlooded,
  totalIntact,
  type CollectionId,
  type GameState,
  type SystemId,
} from './state';

/** The decay multiplier m(S). Monotonically increasing, never below 1. */
export function decayMultiplier(entropy: number): number {
  return 1 + entropy / ENTROPY.decayDivisor;
}

/** How much a floor's dampness accelerates decay: 0.5 when bone dry, 2.5 when soaked. */
export function humidityFactor(humidity: number): number {
  return 0.5 + humidity / HUMIDITY.humidityDivisor;
}

/** Energy produced per second right now. */
export function production(state: GameState): number {
  const generator = state.systems.generator;
  if (generator.lost || !generator.on) {
    return 0;
  }
  return (ENERGY.generatorOutputPerSecond * generator.integrity) / 100;
}

/** Energy demanded per second by everything currently switched on. */
export function demand(state: GameState): number {
  let sum = 0;
  for (const id of SYSTEM_IDS) {
    const system = state.systems[id];
    if (!system.lost && system.on) {
      sum += SYSTEMS[id].drawPerSecond;
    }
  }
  return sum;
}

/** Water entering per second: rain, made worse by entropy. */
export function inflow(state: GameState): number {
  return WATER.rainBasePerSecond * (1 + state.entropy / ENTROPY.rainDivisor);
}

/** Water removed per second by the pumps, scaled by how much power they actually get. */
export function outflow(state: GameState, supplyRatio: number): number {
  const pumps = state.systems.pumps;
  if (pumps.lost || !pumps.on) {
    return 0;
  }
  return (WATER.pumpMaxPerSecond * pumps.integrity * supplyRatio) / 100;
}

/** The dampness each floor is heading towards, before smoothing. */
export function humidityTarget(state: GameState, floor: number, supplyRatio: number): number {
  let target = HUMIDITY.base + HUMIDITY.perEntropy * state.entropy;

  // Closeness to the waterline. A floor the water has reached is as damp as it gets.
  const dryGap = floor - state.water;
  if (dryGap <= 0) {
    target += HUMIDITY.waterWeight;
  } else {
    target += HUMIDITY.waterWeight * Math.max(0, 1 - dryGap / HUMIDITY.waterReachFloors);
  }

  // Only the attic suffers from a leaking roof. A lost roof leaks as if at zero integrity.
  if (floor === FLOOR_COUNT - 1) {
    const roof = state.systems.roof;
    const integrity = roof.lost ? 0 : roof.integrity;
    target += (100 - integrity) * HUMIDITY.roofLeakFactor;
  }

  // Deviation from prompt.md 5.5, documented in PLAN.md section 9: the spec writes the
  // climate term without a supply factor. Scaling it by supplyRatio follows 5.6, which
  // says every running consumer works at its share of the power — climate control is a
  // consumer, so a browned-out unit must dry less air.
  const climate = state.systems.climate;
  if (!climate.lost && climate.on) {
    target -= climate.integrity * HUMIDITY.climateFactor * supplyRatio;
  }

  return clamp(target, HUMIDITY.min, HUMIDITY.max);
}

export function step(state: GameState): StepResult {
  if (state.ended) {
    return { state, events: [] };
  }

  const events: DomainEvent[] = [];
  const next = cloneState(state);
  const dt = SECONDS_PER_TICK;

  next.tick += 1;

  // 1 — Entropy only ever grows.
  next.entropy += ENTROPY.passivePerSecond * dt;
  const multiplier = decayMultiplier(next.entropy);

  // 2 — Power. When production falls short and the battery is empty, every consumer
  //     runs at the same fraction of its demand. Deterministic and visible in the UI.
  //
  //     Deviation from prompt.md 5.6, documented in PLAN.md section 9: the spec writes
  //     the ratio as production / demand. On the single tick where the battery runs dry
  //     it still holds a partial charge, and that charge is real power. Folding it in
  //     keeps energy conserved (consumed === ratio * demand); the plain formula would
  //     silently discard the last fraction of the battery.
  const produced = production(next);
  const demanded = demand(next);
  let supplyRatio = 1;
  if (produced >= demanded) {
    next.energy = Math.min(ENERGY.capacity, next.energy + (produced - demanded) * dt);
  } else {
    const deficit = (demanded - produced) * dt;
    if (next.energy >= deficit) {
      next.energy -= deficit;
    } else {
      supplyRatio = demanded > 0 ? (produced + next.energy / dt) / demanded : 1;
      next.energy = 0;
    }
  }
  next.supplyRatio = supplyRatio;
  if (crossedSupplyThreshold(state.supplyRatio, supplyRatio)) {
    events.push({ type: 'undersupply-changed', tick: next.tick, ratio: supplyRatio });
  }

  // 3 — Water. Remember which floors were dry so a new flooding is worth a log line.
  const floodedBefore = floodedFlags(next);
  next.water = clamp(
    next.water + (inflow(next) - outflow(next, supplyRatio)) * dt,
    WATER.min,
    WATER.max,
  );
  const floodedAfter = floodedFlags(next);
  for (let floor = 0; floor < FLOOR_COUNT; floor++) {
    if (!floodedBefore[floor] && floodedAfter[floor]) {
      events.push({ type: 'floor-flooded', tick: next.tick, floor });
    }
  }

  // 4 — Humidity drifts towards its target rather than jumping to it.
  for (let floor = 0; floor < FLOOR_COUNT; floor++) {
    const target = humidityTarget(next, floor, supplyRatio);
    const current = next.humidity[floor];
    next.humidity[floor] = current + (target - current) * HUMIDITY.approachPerSecond * dt;
  }

  // 5 — Wear. Switching a system off conserves it but gives up its function.
  for (const id of SYSTEM_IDS) {
    const system = next.systems[id];
    if (system.lost) {
      continue;
    }
    const floor = SYSTEMS[id].floor;
    let loss =
      SYSTEMS[id].baseDecayPerSecond *
      multiplier *
      humidityFactor(next.humidity[floor]) *
      (system.on ? 1 : SYSTEM_DECAY.offMultiplier);

    // Submerged machinery goes quickly. The pumps are built to work under water.
    if (floodedAfter[floor] && id !== 'pumps') {
      loss += SYSTEM_DECAY.floodedExtraPerSecond;
    }

    system.integrity -= loss * dt;
    if (system.integrity <= 0) {
      system.integrity = 0;
      system.lost = true;
      system.on = false;
      events.push({ type: 'system-lost', tick: next.tick, systemId: id });
    }
  }

  // 6 — Rot. Paper goes slowly in dry air and all at once under water.
  for (const id of COLLECTION_IDS) {
    const collection = next.collections[id];
    if (collection.lost || collection.intact <= 0) {
      continue;
    }
    const rate = floodedAfter[collection.floor]
      ? COLLECTIONS.floodedDecayPerSecond
      : COLLECTIONS.decayPerSecond * multiplier * humidityFactor(next.humidity[collection.floor]);

    const lost = collection.intact * Math.min(1, rate * dt);
    collection.intact -= lost;
    collection.rotted += lost;

    if (collection.intact <= COLLECTIONS.lostThreshold) {
      // Close the books exactly. Summing float losses tick after tick leaves a residue
      // of ~1e-14, which is harmless in play but makes the totals fail a strict check.
      collection.intact = 0;
      collection.rotted = Math.max(0, COLLECTIONS.unitsEach - collection.sent);
      collection.lost = true;
      if (next.transmitting === id) {
        next.transmitting = null;
      }
      events.push({
        type: 'collection-lost',
        tick: next.tick,
        collectionId: id as CollectionId,
        sent: collection.sent,
      });
    }
  }

  // 7 — Is the archive still speaking?
  const endReason = checkEnd(next);
  if (endReason) {
    next.ended = true;
    next.endReason = endReason;
    events.push({ type: 'run-ended', tick: next.tick, reason: endReason });
  }

  return { state: next, events };
}

function checkEnd(state: GameState): GameState['endReason'] {
  const generator = state.systems.generator;
  const generatorGone = generator.lost || isFlooded(state, SYSTEMS.generator.floor);
  if (state.energy <= 0 && generatorGone) {
    return 'silence';
  }
  if (totalIntact(state) <= 0) {
    return 'nothing-left';
  }
  return null;
}

function floodedFlags(state: GameState): boolean[] {
  const flags = new Array<boolean>(FLOOR_COUNT);
  for (let floor = 0; floor < FLOOR_COUNT; floor++) {
    flags[floor] = isFlooded(state, floor);
  }
  return flags;
}

/** Only report the swing into or out of undersupply, not every fractional wobble. */
function crossedSupplyThreshold(before: number, after: number): boolean {
  const wasShort = before < 1;
  const isShort = after < 1;
  return wasShort !== isShort;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function systemIdsOnFloor(floor: number): SystemId[] {
  return SYSTEM_IDS.filter((id) => SYSTEMS[id].floor === floor);
}
