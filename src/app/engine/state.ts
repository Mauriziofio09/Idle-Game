/**
 * The shape of a run, and how a fresh one is built from a seed.
 *
 * GameState is plain, serialisable data: no class instances, no functions, no Date.
 * `step` and `applyAction` are the only things allowed to produce a new one.
 */

import {
  COLLECTION_FLOORS,
  ENERGY,
  FLOOR_COUNT,
  HUMIDITY,
  MATERIAL,
  PROTOCOLS,
  COLLECTIONS,
  START_INTEGRITY,
  SYSTEMS,
} from './balance';
import { createCursor, nextRange, seedToState } from './rng';
import type { ProtocolRule } from './protocol-types';

export const SCHEMA_VERSION = 2;

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

/** 0 cellar, 1 ground floor, 2 first floor, 3 second floor, 4 attic. */
export type FloorIndex = 0 | 1 | 2 | 3 | 4;

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
  /** Units that rotted away. intact + sent + rotted === COLLECTIONS.unitsEach. */
  rotted: number;
  lost: boolean;
}

export type EndReason = 'silence' | 'nothing-left';

export interface GameState {
  schemaVersion: number;
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

  ended: boolean;
  endReason: EndReason | null;
}

function floorOf(id: SystemId): FloorIndex {
  return SYSTEMS[id].floor as FloorIndex;
}

export function systemFloor(id: SystemId): FloorIndex {
  return floorOf(id);
}

/**
 * A fresh archive. Start integrities are drawn from the seed, so `?archiv=4F2A`
 * always hands you the same building.
 */
export function createInitialState(seed: string): GameState {
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
      floor: COLLECTION_FLOORS[id] as FloorIndex,
      intact: COLLECTIONS.unitsEach,
      sent: 0,
      rotted: 0,
      lost: false,
    };
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    seed,
    rngState: cursor.state,
    tick: 0,
    entropy: 0,
    water: 0,
    humidity: new Array<number>(FLOOR_COUNT).fill(HUMIDITY.base),
    energy: ENERGY.start,
    material: MATERIAL.start,
    systems,
    collections,
    transmitting: null,
    supplyRatio: 1,
    protocols: [],
    protocolSlots: PROTOCOLS.startingSlots,
    materialReserve: PROTOCOLS.defaultMaterialReserve,
    custodianCooldown: 0,
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
