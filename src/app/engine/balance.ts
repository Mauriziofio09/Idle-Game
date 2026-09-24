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
  /**
   * Generator output at full integrity, in energy per second, for the standard archive.
   * SCENARIOS reads it from here; the drought sets its own. Nothing else may, or there
   * would be two answers to what the generator produces and only one of them would run.
   *
   * Milestone 8 raised this from 3.0. At 3.0 a house with everything switched on was
   * already short of power at tick one, the battery never refilled, and a repair —
   * which costs energy — was unaffordable for the rest of the run. Nothing the player
   * did could change the outcome, which left pillar 2 with no decisions to make.
   */
  generatorOutputPerSecond: 4.2,
  /**
   * What the house draws whatever is switched on: sensors, emergency lighting, me.
   *
   * Added in milestone 8. Without it an archive whose systems are all lost or off has a
   * demand of zero, so the battery never empties and "Energie = 0" never becomes true —
   * a dead house would sit at a steady charge until the last collection happened to rot.
   * Measured before the change: 21.9 minutes in which nothing ran and nothing could be
   * decided. It also makes switching everything off a delay rather than an escape,
   * which is what pillar 1 asks for.
   */
  baseDrawPerSecond: 0.3,
} as const;

export const MATERIAL = {
  /**
   * Starting material for the standard archive; SCENARIOS reads it from here.
   *
   * Raised from 50 in milestone 8, together with much cheaper repairs below.
   * Measured before: a whole run supported twelve repairs and was blocked on material
   * 1134 times against zero times on energy. Material was not scarce, it was absent.
   */
  start: 90,
} as const;

export const WATER = {
  /** Floors per second of inflow before entropy and events are applied. */
  rainBasePerSecond: 0.004,
  /**
   * Floors per second the pumps remove at full integrity. Raised from 0.005 in
   * milestone 8: below the rain's 0.004 they could only ever delay the water, never
   * hold it, so keeping them alive bought nothing and the cellar decision was no
   * decision. At 0.011 a well-kept pump holds the line and a neglected one does not.
   */
  pumpMaxPerSecond: 0.011,
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
  /**
   * Integrity restored at full workshop support before diminishing returns. Raised
   * from prompt.md's 30 in milestone 8: it is the one number that lengthens a naive
   * run without touching an untended one, because it only pays out to someone who
   * repairs. At 30 the naive player outlived the idle archive by three minutes; the
   * target asks for five to twenty.
   */
  baseGain: 42,
  /** Workshop factor w = workshopFloor + workshopRange * workshopIntegrity / 100. */
  workshopFloor: 0.4,
  workshopRange: 0.6,
  /**
   * Each repair of the same system is worth diminishing^n of the last. Raised from
   * prompt.md's 0.8 in milestone 8, and this is the largest deviation in the file.
   *
   * At 0.8 the fifth repair of a system was worth a third of the first, which capped
   * what any system could ever be given at 30 / (1 - 0.8) = 150 integrity. The pumps
   * lose that in twenty minutes, so no strategy could hold the cellar and good play
   * ended no later than naive play. The measured effect of raising it: good play went
   * from 31 to 36 minutes while an untended archive did not move by a single second,
   * because nobody repairs it. 0.99 is the mildest value that reaches the target band;
   * 0.97 was still short. What ends a run now is material and entropy, not a ceiling
   * on how often a thing may be mended.
   */
  diminishing: 0.99,
  /** Material cost = materialBase * (1 + materialGrowth * n). Both cut in milestone 8. */
  materialBase: 3,
  materialGrowth: 0.08,
  energyCost: 10,
  maxIntegrity: 100,
} as const;

export const DISMANTLE = {
  /** Material returned = base + perIntegrity * integrity / 100. */
  materialBase: 10,
  materialPerIntegrity: 40,
} as const;

export const TRANSMIT = {
  /**
   * Units per second at full transmitter integrity. Lowered from 0.2 in milestone 8 to
   * hold the naive player's saved share under a fifth once the longer runs arrived;
   * runtime barely notices it, saved share scales with it almost exactly.
   */
  unitsPerSecond: 0.15,
  /**
   * Lowered from 1.5 in milestone 8. At 1.5 the mast alone needed half the generator's
   * whole output, so sending shortened a run instead of being what a run is for.
   */
  energyPerSecond: 0.8,
  /**
   * The mast wears faster while it sends; that is the price of the only thing that
   * saves anything. Raised from 0.07 in milestone 8, because it is what separates a
   * player who tends the mast from one who does not — and with it, what they save.
   */
  decayWhileSending: 0.105,
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
/**
 * Per-system configuration. Floors: 0 cellar, 1 ground, 2 first, 3 second, 4 attic.
 *
 * Milestone 8 rebalanced the decay rates around a single idea: the house should fall
 * apart slowly enough that tending it is worth the effort, while the two machines the
 * player's attention actually lands on — the pumps and the mast — fall apart fast
 * enough that neglecting them shows. The others run at roughly a third of their old
 * rate; the pumps and the mast at half again as fast as they used to.
 */
export const SYSTEMS = {
  generator: { floor: 1, baseDecayPerSecond: 0.018, drawPerSecond: 0 },
  /** 0.150 rather than 0.135: the one rate that pulled the untended archive back under
   * its fifteen minute ceiling without pushing the naive run out of its own band. */
  pumps: { floor: 0, baseDecayPerSecond: 0.150, drawPerSecond: 0.8 },
  workshop: { floor: 1, baseDecayPerSecond: 0.009, drawPerSecond: 0 },
  climate: { floor: 2, baseDecayPerSecond: 0.015, drawPerSecond: 0.8 },
  custodian: { floor: 2, baseDecayPerSecond: 0.015, drawPerSecond: 0.4 },
  roof: { floor: 4, baseDecayPerSecond: 0.012, drawPerSecond: 0 },
  /** The transmitter wears faster while it is sending; see TRANSMIT.decayWhileSending. */
  transmitter: { floor: 4, baseDecayPerSecond: 0.045, drawPerSecond: 0 },
} as const;


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
    generatorOutputPerSecond: ENERGY.generatorOutputPerSecond,
    materialStart: MATERIAL.start,
    systemFloors: { generator: 1, pumps: 0, workshop: 1, climate: 2, custodian: 2, roof: 4, transmitter: 4 },
    collectionFloors: { maps: 0, chronicle: 1, naturalHistory: 2, music: 2, letters: 3, languages: 4 },
  },
  /** Little rain, but a generator that never quite keeps up. Time instead of water. */
  drought: {
    floors: 5,
    rainBasePerSecond: 0.0018,
    generatorOutputPerSecond: 3.1,
    materialStart: MATERIAL.start,
    systemFloors: { generator: 1, pumps: 0, workshop: 1, climate: 2, custodian: 2, roof: 4, transmitter: 4 },
    collectionFloors: { maps: 0, chronicle: 1, naturalHistory: 2, music: 2, letters: 3, languages: 4 },
  },
  /** Seven floors and less material: further to carry, less to repair with. */
  tower: {
    floors: 7,
    rainBasePerSecond: 0.004,
    generatorOutputPerSecond: ENERGY.generatorOutputPerSecond,
    materialStart: 55,
    systemFloors: { generator: 1, pumps: 0, workshop: 1, climate: 3, custodian: 3, roof: 6, transmitter: 6 },
    collectionFloors: { maps: 0, chronicle: 1, naturalHistory: 2, music: 3, letters: 4, languages: 6 },
  },
} as const;

export const SCENARIO_IDS = ['standard', 'drought', 'tower'] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];
