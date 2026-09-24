/**
 * Every tunable number in the game lives here and nowhere else.
 *
 * This file holds NO logic — only values — so that milestone 8 is pure number tuning
 * driven by `npm run sim`. The starting values come from prompt.md section 5; the
 * targets they have to hit are in prompt.md section 6.
 */

/** One simulation step. The engine never reads a clock; it counts ticks. */
export const TICK_MS = 1000;

/** Seconds of game time per tick. Used to keep the rate formulas readable. */
export const SECONDS_PER_TICK = TICK_MS / 1000;

/** The standard archive. Scenarios may build a different house; see SCENARIOS. */
export const FLOOR_COUNT = 5;

/** No scenario may exceed this; the save validator and the UI lean on it. */
export const MAX_FLOORS = 7;

/** A floor is 3.5 m tall — used only to display the water level in metres. */
export const METRES_PER_FLOOR = 3.5;

export const ENTROPY = {
  /** Entropy never falls. It creeps up on its own. */
  passivePerSecond: 0.02,
  perRepair: 3,
  perDismantle: 6,
  perBurn: 10,
  /** Decay multiplier m(S) = 1 + S / decayDivisor. */
  decayDivisor: 120,
  /** Rain grows with entropy: inflow factor = 1 + S / rainDivisor. */
  rainDivisor: 200,
} as const;

export const ENERGY = {
  capacity: 150,
  start: 80,
  /** Generator output at full integrity, in energy per second. */
  generatorOutputPerSecond: 3.0,
} as const;

export const MATERIAL = {
  start: 50,
} as const;

export const WATER = {
  /** Floors per second of inflow before entropy and events are applied. */
  rainBasePerSecond: 0.004,
  /** Floors per second the pumps remove at full integrity. */
  pumpMaxPerSecond: 0.005,
  min: 0,
  /** The ceiling for the standard house; a scenario's own floor count overrides it. */
  max: FLOOR_COUNT,
} as const;

export const HUMIDITY = {
  /** Base dampness of the house at zero entropy, in percent. */
  base: 20,
  /** Added base dampness per point of entropy. */
  perEntropy: 0.25,
  /** Full weight of the water's influence on the floor directly at the waterline. */
  waterWeight: 45,
  /** How many floors above the waterline the water is still felt. */
  waterReachFloors: 2,
  /** Roof leak on the top floor: (100 - roofIntegrity) * roofLeakFactor. */
  roofLeakFactor: 0.6,
  /** Climate control removes climateIntegrity * climateFactor percent when running. */
  climateFactor: 0.5,
  /** Exponential smoothing: humidity moves this share of the remaining gap per second. */
  approachPerSecond: 0.02,
  /** Decay factor from humidity: 0.5 + h / humidityDivisor, so 0.5 (dry) to 2.5 (soaked). */
  humidityDivisor: 50,
  min: 0,
  max: 100,
} as const;

export const SYSTEM_DECAY = {
  /** A system that is switched off decays at this share of its base rate. */
  offMultiplier: 0.3,
  /**
   * Extra integrity lost per second by a system standing on a fully flooded floor.
   * Chosen value (prompt.md only says "fast"): a submerged system is gone in ~1 minute.
   */
  floodedExtraPerSecond: 1.5,
} as const;

export const START_INTEGRITY = {
  min: 55,
  max: 85,
} as const;

export const REPAIR = {
  /** Integrity restored at full workshop support before diminishing returns. */
  baseGain: 30,
  /** Workshop factor w = workshopFloor + workshopRange * workshopIntegrity / 100. */
  workshopFloor: 0.4,
  workshopRange: 0.6,
  /** Each repair of the same system is worth diminishing^n of the last. */
  diminishing: 0.8,
  /** Material cost = materialBase * (1 + materialGrowth * n). */
  materialBase: 8,
  materialGrowth: 0.25,
  energyCost: 10,
  maxIntegrity: 100,
} as const;

export const DISMANTLE = {
  /** Material returned = base + perIntegrity * integrity / 100. */
  materialBase: 10,
  materialPerIntegrity: 40,
} as const;

export const TRANSMIT = {
  /** Units per second at full transmitter integrity. */
  unitsPerSecond: 0.2,
  energyPerSecond: 1.5,
} as const;

export const COLLECTIONS = {
  unitsEach: 100,
  /** Share of the remaining intact units lost per second (0.01 % in prompt.md section 5.8). */
  decayPerSecond: 0.0001,
  /** Share of the remaining intact units lost per second on a fully flooded floor. */
  floodedDecayPerSecond: 0.05,
  /** Below this many units a collection counts as gone, so it cannot decay forever. */
  lostThreshold: 0.05,
} as const;

export const CUSTODIAN = {
  /** Seconds between protocol actions = base / (integrity / 100), never below minimum. */
  cooldownBaseSeconds: 20,
  minCooldownSeconds: 5,
} as const;

export const PROTOCOLS = {
  startingSlots: 2,
  maxSlots: 8,
  /** Protocols never spend material below this; the player keeps a reserve in hand. */
  defaultMaterialReserve: 0,
  maxMaterialReserve: 200,
} as const;

export const EVENTS = {
  /** Probability per minute = basePerMinute * m(S). */
  basePerMinute: 0.08,
  /** Announced events warn the player this many seconds ahead. */
  warningSeconds: 20,
  /** Storm surge: the rain triples for a minute. Announced. */
  stormSurge: { factor: 3, seconds: 60 },
  /** Short circuit: one running system takes a hit. */
  shortCircuit: { integrityLoss: 15 },
  /** Driftwood: something usable washes up. */
  driftwood: { min: 15, max: 30 },
  /** A pause in the rain. The only kind event in the list. */
  rainPause: { factor: 0.3, seconds: 90 },
  /** Mould: one collection rots three times as fast for a minute. */
  mould: { factor: 3, seconds: 60 },
  /** Cloudburst: the roof takes damage. Announced. */
  cloudburst: { roofLoss: 10 },
} as const;

export const LEGACY = {
  /** One lore fragment per this many units transmitted, across all runs. */
  unitsPerFragment: 25,
  /** Total fragments written. The last few carry the resolution. */
  fragmentCount: 24,
  /** Transmitted units that unlock the next protocol slot, cumulative. */
  slotThresholds: [60, 150, 300, 500, 750, 1050] as readonly number[],
  /** Transmitted units before protocols may carry a collection upstairs. */
  relocateThreshold: 100,
  /** Transmitted units before another archive opens up. The standard house is free. */
  scenarioThresholds: { standard: 0, drought: 200, tower: 400 } as Record<string, number>,
} as const;

export const OFFLINE = {
  /** Time away is clamped to this window before it is simulated. */
  maxHours: 24,
  /** Ticks simulated per chunk so the UI can breathe. */
  chunkTicks: 3600,
  /** Absence below this does not deserve a return summary. */
  summaryThresholdSeconds: 120,
} as const;

/**
 * Thresholds the interface uses to label a state. Not simulation inputs, but still
 * game numbers, so they belong here rather than in a component.
 */
export const UI_THRESHOLDS = {
  /** Below this integrity a system is shown as critical (pattern + word, never colour alone). */
  criticalIntegrity: 25,
} as const;

/**
 * The targets from prompt.md section 6 and the performance budget from section 9.
 * `npm run sim` checks against these, and milestone 8's balance.spec.ts will too.
 */
export const TARGETS = {
  /** Pillar 1: every strategy has to end within this many ticks. */
  maxRunTicks: 72 * 60 * 60,
  runtimeMinutes: {
    idle: { min: 8, max: 15 },
    naive: { min: 20, max: 35 },
    active: { min: 35, max: 60 },
  },
  savedShare: {
    idle: { min: 0, max: 0.02 },
    naive: { min: 0.1, max: 0.2 },
    active: { min: 0.2, max: 0.4 },
  },
  /** 24 h of catch-up must simulate in less than this. */
  offlineBudgetMs: 1500,
} as const;

/** Per-system configuration. Floors: 0 cellar, 1 ground, 2 first, 3 second, 4 attic. */
export const SYSTEMS = {
  generator: { floor: 1, baseDecayPerSecond: 0.06, drawPerSecond: 0 },
  pumps: { floor: 0, baseDecayPerSecond: 0.09, drawPerSecond: 1.2 },
  workshop: { floor: 1, baseDecayPerSecond: 0.03, drawPerSecond: 0 },
  climate: { floor: 2, baseDecayPerSecond: 0.05, drawPerSecond: 0.8 },
  custodian: { floor: 2, baseDecayPerSecond: 0.05, drawPerSecond: 0.4 },
  roof: { floor: 4, baseDecayPerSecond: 0.04, drawPerSecond: 0 },
  /** The transmitter wears faster while it is sending; see TRANSMITTER_DECAY_SENDING. */
  transmitter: { floor: 4, baseDecayPerSecond: 0.03, drawPerSecond: 0 },
} as const;

export const TRANSMITTER_DECAY_SENDING = 0.07;

/** Where each collection starts. Two of them sit below the waterline's first targets. */
export const COLLECTION_FLOORS = {
  maps: 0,
  chronicle: 1,
  naturalHistory: 2,
  music: 2,
  letters: 3,
  languages: 4,
} as const;

export const RELOCATE = {
  /** Seconds a collection spends in transit before it arrives one floor up. */
  transitSeconds: 30,
  energyCost: 15,
  /** No floor holds more than this many collections. */
  maxPerFloor: 3,
} as const;

export const BURN = {
  /** Energy won per unit burned. Half of what is left, and it is gone for good. */
  energyPerUnit: 0.5,
} as const;

/**
 * Alternative archives. The standard house is the one prompt.md describes; the others
 * change the starting conditions without changing a single rule, so everything the
 * player learned still applies.
 */
export const SCENARIOS = {
  standard: {
    floors: 5,
    rainBasePerSecond: 0.004,
    generatorOutputPerSecond: 3.0,
    materialStart: 50,
    systemFloors: { generator: 1, pumps: 0, workshop: 1, climate: 2, custodian: 2, roof: 4, transmitter: 4 },
    collectionFloors: { maps: 0, chronicle: 1, naturalHistory: 2, music: 2, letters: 3, languages: 4 },
  },
  /** Little rain, but a generator that never quite keeps up. Time instead of water. */
  drought: {
    floors: 5,
    rainBasePerSecond: 0.0018,
    generatorOutputPerSecond: 2.2,
    materialStart: 50,
    systemFloors: { generator: 1, pumps: 0, workshop: 1, climate: 2, custodian: 2, roof: 4, transmitter: 4 },
    collectionFloors: { maps: 0, chronicle: 1, naturalHistory: 2, music: 2, letters: 3, languages: 4 },
  },
  /** Seven floors and less material: further to carry, less to repair with. */
  tower: {
    floors: 7,
    rainBasePerSecond: 0.004,
    generatorOutputPerSecond: 3.0,
    materialStart: 30,
    systemFloors: { generator: 1, pumps: 0, workshop: 1, climate: 3, custodian: 3, roof: 6, transmitter: 6 },
    collectionFloors: { maps: 0, chronicle: 1, naturalHistory: 2, music: 3, letters: 4, languages: 6 },
  },
} as const;

export const SCENARIO_IDS = ['standard', 'drought', 'tower'] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];
