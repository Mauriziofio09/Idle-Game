/**
 * The shape of a run, and how a fresh one is built from a seed.
 *
 * GameState is plain, serialisable data: no class instances, no functions, no Date.
 * `step` and `applyAction` are the only things allowed to produce a new one.
 */

import {
  ENERGY,
  HUMIDITY,
  PROTOCOLS,
  COLLECTIONS,
  SCENARIOS,
  START_INTEGRITY,
  type ScenarioId,
} from './balance';
import { createCursor, nextRange, seedToState } from './rng';
import type { ProtocolRule } from './protocol-types';

export const SCHEMA_VERSION = 4;

export const SYSTEM_IDS = [
  'generator',
  'pumps',
  'workshop',
  'climate',
  'custodian',
  'roof',
  'transmitter',
] as const;
export type SystemId = (typeof SYSTEM_IDS)[number];

export const COLLECTION_IDS = [
  'maps',
  'chronicle',
  'naturalHistory',
  'music',
  'letters',
  'languages',
] as const;
export type CollectionId = (typeof COLLECTION_IDS)[number];

/**
 * 0 is the cellar, 1 the ground floor, the last one the attic. How many there are
 * depends on the scenario, so this is a plain index rather than a fixed union.
 */
export type FloorIndex = number;

export interface SystemState {
  integrity: number;
  /** Switched on by the player. A lost system is never on. */
  on: boolean;
  /** How often this system has been repaired — drives diminishing returns. */
  repairs: number;
  lost: boolean;
}

export interface CollectionState {
  floor: FloorIndex;
  /** Units still in the building and readable. */
  intact: number;
  /** Units transmitted. Safe forever. */
  sent: number;
  /** Units that rotted away. */
  rotted: number;
  /** Units burned for power. Gone by the player's own hand.
   *  intact + sent + rotted + burned === COLLECTIONS.unitsEach. */
  burned: number;
  /** Ticks left before it arrives one floor up, or 0 when it is standing still. */
  transitTicks: number;
  lost: boolean;
}

export type EndReason = 'silence' | 'nothing-left';

/** The six things the weather and the wiring can do to the archive. */
export const EVENT_KINDS = [
  'storm-surge',
  'short-circuit',
  'driftwood',
  'rain-pause',
  'mould',
  'cloudburst',
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Effects an event left behind, counted down tick by tick. */
export interface ActiveEffects {
  /** Multiplier on the rain, and how many ticks it still holds. */
  inflowFactor: number;
  inflowTicks: number;
  /** A collection rotting faster than it should, and for how long. */
  mouldId: CollectionId | null;
  mouldTicks: number;
}

/** An event that has been announced but has not struck yet. */
export interface PendingEvent {
  kind: EventKind;
  /** Ticks until it arrives. */
  ticks: number;
}

/** What fell, and when. The chronicle reads this back as a timeline. */
export interface ChronicleEntry {
  tick: number;
  kind: 'system-lost' | 'collection-lost' | 'floor-flooded' | 'collection-burned';
  /** A SystemId, a CollectionId, or a floor index as a string. */
  id: string;
}

export interface GameState {
  schemaVersion: number;
  /** Which archive this is. Decides the layout and the starting conditions. */
  scenarioId: ScenarioId;
  seed: string;
  /** mulberry32 state — part of the save so a reload continues the same run. */
  rngState: number;
  /** Elapsed ticks since the run started. One tick is one second of game time. */
  tick: number;

  entropy: number;
  /** Water level in floor units, 0 to 5. */
  water: number;
  /** Relative humidity per floor, 0 to 100. */
  humidity: number[];

  energy: number;
  material: number;

  systems: Record<SystemId, SystemState>;
  collections: Record<CollectionId, CollectionState>;

  /** The collection currently being transmitted, if any. Only ever one. */
  transmitting: CollectionId | null;

  /** Share of demand that was actually met last tick, 0 to 1. Shown in the UI. */
  supplyRatio: number;

  protocols: ProtocolRule[];
  protocolSlots: number;
  /** Protocols leave this much material untouched. Player actions ignore it. */
  materialReserve: number;
  /** Seconds remaining before the custodian depot may act again. */
  custodianCooldown: number;

  effects: ActiveEffects;
  pending: PendingEvent[];
  /** Losses in the order they happened. Bounded by what the archive contains. */
  chronicle: ChronicleEntry[];

  ended: boolean;
  endReason: EndReason | null;
}

/** The archive this run is playing in. */
export function scenarioOf(state: GameState): (typeof SCENARIOS)[ScenarioId] {
  return SCENARIOS[state.scenarioId];
}

export function floorCount(state: GameState): number {
  return scenarioOf(state).floors;
}

/** The top floor, where the roof and the mast are. */
export function topFloor(state: GameState): FloorIndex {
  return floorCount(state) - 1;
}

export function systemFloor(state: GameState, id: SystemId): FloorIndex {
  return scenarioOf(state).systemFloors[id];
}

/**
 * How many collections a floor will be holding.
 *
 * Counts the ones standing there and the ones already on their way up to it: a floor
 * that is about to be full is full. Counting only what has arrived would let three
 * moves to the same floor all start in the same instant and all be allowed.
 */
export function collectionsOn(state: GameState, floor: number): number {
  let count = 0;
  for (const id of COLLECTION_IDS) {
    const collection = state.collections[id];
    if (collection.lost) {
      continue;
    }
    const destination =
      collection.transitTicks > 0 ? collection.floor + 1 : collection.floor;
    if (destination === floor) {
      count += 1;
    }
  }
  return count;
}

/**
 * A fresh archive. Start integrities are drawn from the seed, so `?archiv=4F2A`
 * always hands you the same building.
 */
export function createInitialState(
  seed: string,
  options: { protocolSlots?: number; scenarioId?: ScenarioId } = {},
): GameState {
  const scenarioId = options.scenarioId ?? 'standard';
  const scenario = SCENARIOS[scenarioId];
  const cursor = createCursor(seedToState(seed));

  const systems = {} as Record<SystemId, SystemState>;
  for (const id of SYSTEM_IDS) {
    systems[id] = {
      integrity: nextRange(cursor, START_INTEGRITY.min, START_INTEGRITY.max),
      on: true,
      repairs: 0,
      lost: false,
    };
  }
  // The transmitter only draws power while sending, and sending is a deliberate act.
  systems.transmitter.on = false;

  const collections = {} as Record<CollectionId, CollectionState>;
  for (const id of COLLECTION_IDS) {
    collections[id] = {
      floor: scenario.collectionFloors[id],
      intact: COLLECTIONS.unitsEach,
      sent: 0,
      rotted: 0,
      burned: 0,
      transitTicks: 0,
      lost: false,
    };
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    scenarioId,
    seed,
    rngState: cursor.state,
    tick: 0,
    entropy: 0,
    water: 0,
    humidity: new Array<number>(scenario.floors).fill(HUMIDITY.base),
    energy: ENERGY.start,
    material: scenario.materialStart,
    systems,
    collections,
    transmitting: null,
    supplyRatio: 1,
    protocols: [],
    protocolSlots: options.protocolSlots ?? PROTOCOLS.startingSlots,
    materialReserve: PROTOCOLS.defaultMaterialReserve,
    custodianCooldown: 0,
    effects: { inflowFactor: 1, inflowTicks: 0, mouldId: null, mouldTicks: 0 },
    pending: [],
    chronicle: [],
    ended: false,
    endReason: null,
  };
}

/** A shallow-per-field copy. `step` mutates the copy, never its input. */
export function cloneState(state: GameState): GameState {
  const systems = {} as Record<SystemId, SystemState>;
  for (const id of SYSTEM_IDS) {
    systems[id] = { ...state.systems[id] };
  }

  const collections = {} as Record<CollectionId, CollectionState>;
  for (const id of COLLECTION_IDS) {
    collections[id] = { ...state.collections[id] };
  }

  return {
    ...state,
    humidity: state.humidity.slice(),
    systems,
    collections,
    effects: { ...state.effects },
    pending: state.pending.map((event) => ({ ...event })),
    chronicle: state.chronicle.slice(),
    // The nested condition and action must be copied too, or a rule edit would
    // reach back into the state it was cloned from.
    protocols: state.protocols.map((rule) => ({
      ...rule,
      condition: { ...rule.condition },
      action: { ...rule.action },
    })),
  };
}

/** True when floor `index` is completely under water. */
export function isFlooded(state: GameState, index: number): boolean {
  return state.water >= index + 1;
}

/** Total units transmitted across all collections. */
export function totalSent(state: GameState): number {
  let sum = 0;
  for (const id of COLLECTION_IDS) {
    sum += state.collections[id].sent;
  }
  return sum;
}

/** Total units still intact across all collections. */
export function totalIntact(state: GameState): number {
  let sum = 0;
  for (const id of COLLECTION_IDS) {
    sum += state.collections[id].intact;
  }
  return sum;
}

/** The run score: the share of everything the archive held that reached the outside. */
export function savedShare(state: GameState): number {
  return totalSent(state) / (COLLECTION_IDS.length * COLLECTIONS.unitsEach);
}
