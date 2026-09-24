/**
 * Reading and writing a save, without touching storage.
 *
 * Everything here is a pure function so it can be tested against hostile input: a file
 * someone edited by hand, a truncated export, a save from an older build. Nothing is
 * ever evaluated — the payload is parsed and then checked field by field. A bad import
 * has to produce a friendly reason, never a crash and never a half-loaded run.
 */

import { COLLECTIONS, ENERGY, FLOOR_COUNT, PROTOCOLS } from '../engine/balance';
import {
  COLLECTION_IDS,
  SCHEMA_VERSION,
  SYSTEM_IDS,
  type CollectionId,
  type GameState,
  type SystemId,
} from '../engine/state';

/** Bumped whenever the shape of GameState changes; every older version needs a migration. */
export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION;

/** Marks our own exports, so a stray string is rejected before anything else happens. */
export const EXPORT_FORMAT = 'ENTROPIE-1';

export interface SaveFile {
  schemaVersion: number;
  /** Epoch milliseconds the save was written — the "lastSeen" the catch-up works from. */
  savedAt: number;
  state: GameState;
}

export type SaveProblem =
  | 'not-readable'
  | 'not-json'
  | 'wrong-format'
  | 'checksum-mismatch'
  | 'unsupported-version'
  | 'invalid-data';

export type ReadResult =
  | { ok: true; file: SaveFile }
  | { ok: false; problem: SaveProblem };

type Raw = Record<string, unknown>;

/**
 * Float tolerance. Amounts are summed tick after tick, so a run legitimately arrives at
 * 100.00000000000006 units. A validator that refuses that would call a healthy archive
 * corrupt and silently fall back to the backup.
 */
const EPSILON = 1e-6;

/* ------------------------------------------------------------------ checksum */

/** FNV-1a over the payload. Catches truncation and casual tampering, nothing more. */
export function checksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/* -------------------------------------------------------------------- base64 */

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(text: string): string | null {
  try {
    const binary = atob(text.trim());
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------- export/import */

/** A save as one line the player can copy anywhere. */
export function encodeExport(file: SaveFile): string {
  const payload = JSON.stringify(file);
  return toBase64(
    JSON.stringify({ format: EXPORT_FORMAT, checksum: checksum(payload), payload }),
  );
}

export function decodeExport(text: string): ReadResult {
  const json = fromBase64(text);
  if (json === null) {
    return { ok: false, problem: 'not-readable' };
  }

  let envelope: Raw;
  try {
    envelope = JSON.parse(json) as Raw;
  } catch {
    return { ok: false, problem: 'not-json' };
  }

  if (!isObject(envelope) || envelope['format'] !== EXPORT_FORMAT) {
    return { ok: false, problem: 'wrong-format' };
  }
  const payload = envelope['payload'];
  if (typeof payload !== 'string') {
    return { ok: false, problem: 'wrong-format' };
  }
  if (envelope['checksum'] !== checksum(payload)) {
    return { ok: false, problem: 'checksum-mismatch' };
  }
  return parseSaveFile(payload);
}

/* ---------------------------------------------------------------- parse/load */

export function parseSaveFile(json: string): ReadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, problem: 'not-json' };
  }
  if (!isObject(raw)) {
    return { ok: false, problem: 'invalid-data' };
  }

  const version = raw['schemaVersion'];
  if (!isFiniteNumber(version) || !Number.isInteger(version) || version < 0) {
    return { ok: false, problem: 'invalid-data' };
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    // A save from a newer build. Refusing beats silently dropping what we cannot read.
    return { ok: false, problem: 'unsupported-version' };
  }

  const migrated = migrate(raw, version);
  if (!migrated) {
    return { ok: false, problem: 'unsupported-version' };
  }

  const state = validateState(migrated['state']);
  if (!state) {
    return { ok: false, problem: 'invalid-data' };
  }

  const savedAt = migrated['savedAt'];
  return {
    ok: true,
    file: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      savedAt: isFiniteNumber(savedAt) ? savedAt : 0,
      state,
    },
  };
}

/* ----------------------------------------------------------------- migration */

/**
 * One step per version. Each step takes the raw object of version n and returns the
 * raw object of version n+1 — never a typed GameState, because the validator runs last.
 */
const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {
  // v0 was the pre-release shape: it had no supply ratio and knew nothing of protocols.
  0: (raw) => {
    const state = isObject(raw['state']) ? { ...raw['state'] } : {};
    return {
      ...raw,
      schemaVersion: 1,
      state: {
        ...state,
        schemaVersion: 1,
        supplyRatio: 1,
        protocols: [],
        protocolSlots: PROTOCOLS.startingSlots,
        custodianCooldown: 0,
      },
    };
  },
};

function migrate(raw: Raw, from: number): Raw | null {
  let current = raw;
  for (let version = from; version < CURRENT_SCHEMA_VERSION; version++) {
    const step = MIGRATIONS[version];
    if (!step) {
      return null;
    }
    current = step(current);
  }
  return current;
}

/* ----------------------------------------------------------------- validation */

/**
 * Rebuilds a GameState field by field. Anything missing, mistyped or out of range makes
 * the whole save invalid: a partially trusted state is worse than a fresh archive.
 */
export function validateState(input: unknown): GameState | null {
  if (!isObject(input)) {
    return null;
  }

  const seed = input['seed'];
  if (typeof seed !== 'string' || seed.length === 0 || seed.length > 16) {
    return null;
  }

  const rngState = input['rngState'];
  const tick = input['tick'];
  const entropy = input['entropy'];
  const water = input['water'];
  const energy = input['energy'];
  const material = input['material'];
  const supplyRatio = input['supplyRatio'];
  const protocolSlots = input['protocolSlots'];
  const custodianCooldown = input['custodianCooldown'];

  // mulberry32 keeps its state as a signed 32-bit integer, so it is regularly negative;
  // createCursor normalises it on the way back in.
  if (
    !isInt32(rngState) ||
    !isInRange(tick, 0, Number.MAX_SAFE_INTEGER) ||
    !isInRange(entropy, 0, Number.MAX_SAFE_INTEGER) ||
    !isInRange(water, 0, FLOOR_COUNT + EPSILON) ||
    !isInRange(energy, 0, ENERGY.capacity + EPSILON) ||
    !isInRange(material, 0, Number.MAX_SAFE_INTEGER) ||
    !isInRange(supplyRatio, 0, 1 + EPSILON) ||
    !isInRange(protocolSlots, 0, PROTOCOLS.maxSlots) ||
    !isInRange(custodianCooldown, 0, Number.MAX_SAFE_INTEGER)
  ) {
    return null;
  }

  const humidity = input['humidity'];
  if (!Array.isArray(humidity) || humidity.length !== FLOOR_COUNT) {
    return null;
  }
  const humidityValues: number[] = [];
  for (const value of humidity) {
    if (!isInRange(value, 0, 100 + EPSILON)) {
      return null;
    }
    humidityValues.push(value);
  }

  const systems = validateSystems(input['systems']);
  if (!systems) {
    return null;
  }

  const collections = validateCollections(input['collections']);
  if (!collections) {
    return null;
  }

  const transmitting = input['transmitting'];
  if (
    transmitting !== null &&
    !(typeof transmitting === 'string' && (COLLECTION_IDS as readonly string[]).includes(transmitting))
  ) {
    return null;
  }

  const ended = input['ended'];
  const endReason = input['endReason'];
  if (typeof ended !== 'boolean') {
    return null;
  }
  if (endReason !== null && endReason !== 'silence' && endReason !== 'nothing-left') {
    return null;
  }
  // A finished run must say how it finished, and an unfinished one must not.
  if (ended !== (endReason !== null)) {
    return null;
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    seed,
    rngState,
    tick,
    entropy,
    water,
    humidity: humidityValues,
    energy,
    material,
    systems,
    collections,
    transmitting: transmitting as CollectionId | null,
    supplyRatio,
    // Protocols arrive in milestone 4; until then a save carries an empty list.
    protocols: [],
    protocolSlots,
    custodianCooldown,
    ended,
    endReason: endReason as GameState['endReason'],
  };
}

function validateSystems(input: unknown): GameState['systems'] | null {
  if (!isObject(input)) {
    return null;
  }
  const systems = {} as GameState['systems'];
  for (const id of SYSTEM_IDS) {
    const raw = input[id];
    if (!isObject(raw)) {
      return null;
    }
    const integrity = raw['integrity'];
    const repairs = raw['repairs'];
    const on = raw['on'];
    const lost = raw['lost'];
    if (
      !isInRange(integrity, 0, 100 + EPSILON) ||
      !isInRange(repairs, 0, Number.MAX_SAFE_INTEGER) ||
      typeof on !== 'boolean' ||
      typeof lost !== 'boolean'
    ) {
      return null;
    }
    // A lost system is switched off and has nothing left; anything else is corrupt.
    if (lost && (on || integrity > 0)) {
      return null;
    }
    systems[id as SystemId] = { integrity, on, repairs, lost };
  }
  return systems;
}

function validateCollections(input: unknown): GameState['collections'] | null {
  if (!isObject(input)) {
    return null;
  }
  const collections = {} as GameState['collections'];
  for (const id of COLLECTION_IDS) {
    const raw = input[id];
    if (!isObject(raw)) {
      return null;
    }
    const floor = raw['floor'];
    const intact = raw['intact'];
    const sent = raw['sent'];
    const rotted = raw['rotted'];
    const lost = raw['lost'];
    if (
      !isInRange(floor, 0, FLOOR_COUNT - 1) ||
      !Number.isInteger(floor) ||
      !isInRange(intact, 0, COLLECTIONS.unitsEach + EPSILON) ||
      !isInRange(sent, 0, COLLECTIONS.unitsEach + EPSILON) ||
      !isInRange(rotted, 0, COLLECTIONS.unitsEach + EPSILON) ||
      typeof lost !== 'boolean'
    ) {
      return null;
    }
    // Units cannot be invented or lost in bookkeeping.
    if (Math.abs(intact + sent + rotted - COLLECTIONS.unitsEach) > 0.01) {
      return null;
    }
    collections[id as CollectionId] = {
      floor: floor as GameState['collections'][CollectionId]['floor'],
      intact,
      sent,
      rotted,
      lost,
    };
  }
  return collections;
}

/* --------------------------------------------------------------------- guards */

function isObject(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInRange(value: unknown, min: number, max: number): value is number {
  return isFiniteNumber(value) && value >= min && value <= max;
}

function isInt32(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= -0x80000000 && value <= 0xffffffff;
}
