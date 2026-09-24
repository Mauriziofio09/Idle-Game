/**
 * Reading and writing a save, without touching storage.
 *
 * Everything here is a pure function so it can be tested against hostile input: a file
 * someone edited by hand, a truncated export, a save from an older build. Nothing is
 * ever evaluated — the payload is parsed and then checked field by field. A bad import
 * has to produce a friendly reason, never a crash and never a half-loaded run.
 */

import {
  COLLECTIONS,
  ENERGY,
  MAX_FLOORS,
  PROTOCOLS,
  SCENARIOS,
  SCENARIO_IDS,
  type ScenarioId,
} from '../engine/balance';
import { RELOCATE } from '../engine/balance';
import type { ProtocolAction, ProtocolCondition, ProtocolRule } from '../engine/protocol-types';
import {
  COLLECTION_IDS,
  EVENT_KINDS,
  SCHEMA_VERSION,
  SYSTEM_IDS,
  type ActiveEffects,
  type ChronicleEntry,
  type CollectionId,
  type EventKind,
  type GameState,
  type PendingEvent,
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
  // v4 gave the archive a scenario, and collections a burned tally and a transit timer.
  // A run from v3 is the standard house that has neither burned nor carried anything.
  3: (raw) => {
    const state = isObject(raw['state']) ? { ...raw['state'] } : {};
    const collections = isObject(state['collections']) ? { ...state['collections'] } : {};
    for (const [id, value] of Object.entries(collections)) {
      if (isObject(value)) {
        collections[id] = { ...value, burned: 0, transitTicks: 0 };
      }
    }
    return {
      ...raw,
      schemaVersion: 4,
      state: { ...state, schemaVersion: 4, scenarioId: 'standard', collections },
    };
  },
  // v3 added weather effects, announcements and the loss timeline. A run from v2 has
  // simply had no events yet; an empty set is exactly right.
  2: (raw) => {
    const state = isObject(raw['state']) ? { ...raw['state'] } : {};
    return {
      ...raw,
      schemaVersion: 3,
      state: {
        ...state,
        schemaVersion: 3,
        effects: { inflowFactor: 1, inflowTicks: 0, mouldId: null, mouldTicks: 0 },
        pending: [],
        chronicle: [],
      },
    };
  },
  // v2 added the material reserve; rules were always empty before, so nothing else moves.
  1: (raw) => {
    const state = isObject(raw['state']) ? { ...raw['state'] } : {};
    return {
      ...raw,
      schemaVersion: 2,
      state: {
        ...state,
        schemaVersion: 2,
        materialReserve: PROTOCOLS.defaultMaterialReserve,
      },
    };
  },
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

  const scenarioId = input['scenarioId'];
  if (typeof scenarioId !== 'string' || !(SCENARIO_IDS as readonly string[]).includes(scenarioId)) {
    return null;
  }
  const scenario = SCENARIOS[scenarioId as ScenarioId];
  const floors = scenario.floors;

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
    !isInRange(water, 0, floors + EPSILON) ||
    !isInRange(energy, 0, ENERGY.capacity + EPSILON) ||
    !isInRange(material, 0, Number.MAX_SAFE_INTEGER) ||
    !isInRange(supplyRatio, 0, 1 + EPSILON) ||
    !isInRange(protocolSlots, 0, PROTOCOLS.maxSlots) ||
    !isInRange(input['materialReserve'], 0, PROTOCOLS.maxMaterialReserve) ||
    !isInRange(custodianCooldown, 0, Number.MAX_SAFE_INTEGER)
  ) {
    return null;
  }

  const humidity = input['humidity'];
  if (!Array.isArray(humidity) || humidity.length !== floors) {
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

  const collections = validateCollections(input['collections'], floors);
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

  // The engine stops a transmission the moment the mast is lost or switched off, so a
  // save that claims otherwise is one the game can never produce — and it would show
  // "Wird gerade gesendet" while nothing left the building.
  if (transmitting !== null && (systems.transmitter.lost || !systems.transmitter.on)) {
    return null;
  }
  // A collection on the stairs is not also going out over the mast.
  if (transmitting !== null && collections[transmitting as CollectionId].transitTicks > 0) {
    return null;
  }

  // No floor holds more than the limit, counting what is on its way up to it.
  const occupancy = new Map<number, number>();
  for (const id of COLLECTION_IDS) {
    const collection = collections[id];
    if (collection.lost) {
      continue;
    }
    const destination =
      collection.transitTicks > 0 ? collection.floor + 1 : collection.floor;
    const count = (occupancy.get(destination) ?? 0) + 1;
    if (count > RELOCATE.maxPerFloor) {
      return null;
    }
    occupancy.set(destination, count);
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

  const protocols = validateProtocols(input['protocols'], protocolSlots);
  if (!protocols) {
    return null;
  }

  const effects = validateEffects(input['effects']);
  const pending = validatePending(input['pending']);
  const chronicle = validateChronicle(input['chronicle'], floors);
  if (!effects || !pending || !chronicle) {
    return null;
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    scenarioId: scenarioId as ScenarioId,
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
    protocols,
    protocolSlots,
    materialReserve: input['materialReserve'] as number,
    effects,
    pending,
    chronicle,
    custodianCooldown,
    ended,
    endReason: endReason as GameState['endReason'],
  };
}

function validateEffects(input: unknown): ActiveEffects | null {
  if (!isObject(input)) {
    return null;
  }
  const inflowFactor = input['inflowFactor'];
  const inflowTicks = input['inflowTicks'];
  const mouldTicks = input['mouldTicks'];
  const mouldId = input['mouldId'];

  if (
    !isInRange(inflowFactor, 0, 10) ||
    !isInRange(inflowTicks, 0, 3600) ||
    !isInRange(mouldTicks, 0, 3600) ||
    (mouldId !== null && !isCollectionId(mouldId))
  ) {
    return null;
  }

  // Cross-field invariants the engine always holds. Without them an edited save could
  // carry an effect that never expires — rain stopped for good, or mould forever —
  // which would quietly switch off the decay the whole game rests on.
  if (inflowTicks === 0 && inflowFactor !== 1) {
    return null;
  }
  if ((mouldTicks === 0) !== (mouldId === null)) {
    return null;
  }

  return { inflowFactor, inflowTicks, mouldId: mouldId as CollectionId | null, mouldTicks };
}

function validatePending(input: unknown): PendingEvent[] | null {
  if (!Array.isArray(input) || input.length > EVENT_KINDS.length * 4) {
    return null;
  }
  const pending: PendingEvent[] = [];
  for (const raw of input) {
    if (!isObject(raw) || !isEventKind(raw['kind']) || !isInRange(raw['ticks'], 0, 600)) {
      return null;
    }
    pending.push({ kind: raw['kind'], ticks: raw['ticks'] });
  }
  return pending;
}

function validateChronicle(input: unknown, floors: number): ChronicleEntry[] | null {
  // Every system, every collection and every floor appears at most once — the engine
  // records a floor's flooding only the first time. The cap and that rule must agree,
  // or a legitimate run would produce a save this validator refuses.
  const limit = SYSTEM_IDS.length + COLLECTION_IDS.length * 2 + floors;
  if (!Array.isArray(input) || input.length > limit) {
    return null;
  }
  const entries: ChronicleEntry[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!isObject(raw) || !isInRange(raw['tick'], 0, Number.MAX_SAFE_INTEGER)) {
      return null;
    }
    const kind = raw['kind'];
    const id = raw['id'];
    if (
      typeof id !== 'string' ||
      (kind !== 'system-lost' &&
        kind !== 'collection-lost' &&
        kind !== 'floor-flooded' &&
        kind !== 'collection-burned')
    ) {
      return null;
    }
    // The id has to name something in this archive; the chronicle and the share text
    // render it straight through, so "banana ausgefallen" must be impossible.
    if (!namesSomething(kind, id, floors)) {
      return null;
    }
    const key = `${kind}:${id}`;
    if (seen.has(key)) {
      return null;
    }
    seen.add(key);
    entries.push({ tick: raw['tick'], kind, id });
  }
  return entries;
}

function namesSomething(kind: ChronicleEntry['kind'], id: string, floors: number): boolean {
  switch (kind) {
    case 'system-lost':
      return isSystemId(id);
    case 'collection-lost':
    case 'collection-burned':
      return isCollectionId(id);
    case 'floor-flooded': {
      const floor = Number(id);
      return Number.isInteger(floor) && floor >= 0 && floor < floors && String(floor) === id;
    }
  }
}

function isEventKind(value: unknown): value is EventKind {
  return typeof value === 'string' && (EVENT_KINDS as readonly string[]).includes(value);
}

/** Rules are player-authored data, so every field is checked before it is trusted. */
function validateProtocols(input: unknown, slots: number): ProtocolRule[] | null {
  if (!Array.isArray(input) || input.length > slots) {
    return null;
  }

  const rules: ProtocolRule[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!isObject(raw)) {
      return null;
    }
    const id = raw['id'];
    if (typeof id !== 'string' || id.length === 0 || id.length > 64 || seen.has(id)) {
      return null;
    }
    seen.add(id);

    if (typeof raw['enabled'] !== 'boolean') {
      return null;
    }
    const firedCount = raw['firedCount'];
    if (!isInRange(firedCount, 0, Number.MAX_SAFE_INTEGER)) {
      return null;
    }

    const condition = validateCondition(raw['condition']);
    const action = validateProtocolAction(raw['action']);
    if (!condition || !action) {
      return null;
    }
    rules.push({ id, condition, action, enabled: raw['enabled'], firedCount });
  }
  return rules;
}

function validateCondition(input: unknown): ProtocolCondition | null {
  if (!isObject(input)) {
    return null;
  }
  const value = input['value'];
  if (!isFiniteNumber(value)) {
    return null;
  }

  switch (input['kind']) {
    case 'system-integrity-below':
      return isSystemId(input['systemId'])
        ? { kind: 'system-integrity-below', systemId: input['systemId'], value }
        : null;
    case 'water-above':
      return { kind: 'water-above', value };
    case 'energy-below':
      return { kind: 'energy-below', value };
    case 'energy-above':
      return { kind: 'energy-above', value };
    case 'humidity-above': {
      const floor = input['floor'];
      // A rule may name any floor a scenario can have; the evaluator reads a missing
      // one as zero humidity rather than crashing.
      return isInRange(floor, 0, MAX_FLOORS - 1) && Number.isInteger(floor)
        ? { kind: 'humidity-above', floor, value }
        : null;
    }
    case 'collection-below':
      return isCollectionId(input['collectionId'])
        ? { kind: 'collection-below', collectionId: input['collectionId'], value }
        : null;
    case 'material-above':
      return { kind: 'material-above', value };
    default:
      return null;
  }
}

function validateProtocolAction(input: unknown): ProtocolAction | null {
  if (!isObject(input)) {
    return null;
  }
  if (input['type'] === 'transmit-stop') {
    return { type: 'transmit-stop' };
  }
  if (input['type'] === 'transmit-start' && isCollectionId(input['collectionId'])) {
    return { type: 'transmit-start', collectionId: input['collectionId'] };
  }
  if (input['type'] === 'relocate' && isCollectionId(input['collectionId'])) {
    return { type: 'relocate', collectionId: input['collectionId'] };
  }
  if (!isSystemId(input['systemId'])) {
    return null;
  }
  if (input['type'] === 'repair') {
    return { type: 'repair', systemId: input['systemId'] };
  }
  if (input['type'] === 'toggle' && typeof input['on'] === 'boolean') {
    return { type: 'toggle', systemId: input['systemId'], on: input['on'] };
  }
  return null;
}

function isSystemId(value: unknown): value is SystemId {
  return typeof value === 'string' && (SYSTEM_IDS as readonly string[]).includes(value);
}

function isCollectionId(value: unknown): value is CollectionId {
  return typeof value === 'string' && (COLLECTION_IDS as readonly string[]).includes(value);
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

function validateCollections(input: unknown, floors: number): GameState['collections'] | null {
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
    const burned = raw['burned'];
    const transitTicks = raw['transitTicks'];
    const lost = raw['lost'];
    if (
      !isInRange(floor, 0, floors - 1) ||
      !Number.isInteger(floor) ||
      !isInRange(intact, 0, COLLECTIONS.unitsEach + EPSILON) ||
      !isInRange(sent, 0, COLLECTIONS.unitsEach + EPSILON) ||
      !isInRange(rotted, 0, COLLECTIONS.unitsEach + EPSILON) ||
      !isInRange(burned, 0, COLLECTIONS.unitsEach + EPSILON) ||
      !isInRange(transitTicks, 0, RELOCATE.transitSeconds) ||
      !Number.isInteger(transitTicks) ||
      typeof lost !== 'boolean'
    ) {
      return null;
    }
    // Units cannot be invented or lost in bookkeeping.
    if (Math.abs(intact + sent + rotted + burned - COLLECTIONS.unitsEach) > 0.01) {
      return null;
    }
    // A collection already on the top floor cannot be on its way anywhere.
    if (transitTicks > 0 && floor >= floors - 1) {
      return null;
    }
    // A lost collection holds nothing. Otherwise its units would sit there untouched —
    // the rot skips them — while still counting towards "there is something to save",
    // so the run could never reach its end.
    if (lost && intact > 0) {
      return null;
    }
    collections[id as CollectionId] = {
      floor,
      intact,
      sent,
      rotted,
      burned,
      transitTicks,
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
