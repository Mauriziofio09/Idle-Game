/**
 * Balancing instrument — `npm run tune`.
 *
 * Sweeps the handful of numbers that decide whether playing is worth anything, and
 * reports which combinations land inside the targets of prompt.md section 6. It exists
 * because tuning by hand means changing one number, running 600 archives, and forgetting
 * what the last combination did.
 *
 * It only writes to balance.ts's values at runtime; nothing here changes a rule.
 */

import { applyAction, type Action } from '../src/app/engine/actions';
import {
  ENERGY,
  ENTROPY,
  REPAIR,
  SCENARIOS,
  SYSTEMS,
  TARGETS,
  TRANSMIT,
  WATER,
} from '../src/app/engine/balance';
import { stateToSeed } from '../src/app/engine/rng';
import { createInitialState, savedShare, type GameState } from '../src/app/engine/state';
import { step } from '../src/app/engine/step';
import { doNothing, patchTheWorst, playWell } from '../src/app/engine/strategies';

const SEEDS = Number(process.env.TUNE_SEEDS ?? 40);

/**
 * The values as they are shipped today, captured before any sweep overwrites them.
 * A scale of 1.0 therefore means "as shipped", which is the only reference point a sweep
 * can be read against. An earlier version claimed these were prompt.md 5.3's original
 * rates while in fact reading the already tuned ones, so its grid of 0.22–0.3 scaled an
 * already reduced number into a region where nothing moved: three identical runs.
 */
const SHIPPED_DECAY = Object.fromEntries(
  Object.entries(SYSTEMS).map(([id, config]) => [id, config.baseDecayPerSecond]),
) as Record<string, number>;
const SHIPPED_MAST_DECAY = TRANSMIT.decayWhileSending;
const MAX_TICKS = TARGETS.maxRunTicks;

/** The knobs. Every one of them is a value, never a rule. */
interface Knobs {
  generator: number;
  mastDraw: number;
  pumpDraw: number;
  /** Floors per second the pumps move at full integrity. */
  pumpMax: number;
  /** Starting material — the wall a long run runs into. */
  material: number;
  /** How much of its value each repeat repair keeps. The separator between strategies. */
  diminishing: number;
  /** Multiplies every system's base decay: the scale for every run length at once. */
  decayScale: number;
  /** The pumps get their own scale: they are what an idle archive loses first. */
  pumpDecayScale: number;
  /** And the mast its own: whoever does not tend it stops saving anything. */
  mastDecayScale: number;
  /** What a first repair costs in material, and how fast that price climbs. */
  materialBase: number;
  materialGrowth: number;
  /** Entropy per repair — what punishes repairing without thinking. */
  entropyPerRepair: number;
  /** m(S) = 1 + S / divisor. Smaller means entropy bites sooner. */
  decayDivisor: number;
}

function apply(knobs: Knobs): void {
  const writable = <T>(value: T): Record<string, number> => value as Record<string, number>;
  for (const scenario of Object.values(SCENARIOS)) {
    if (scenario.generatorOutputPerSecond === undefined) continue;
    writable(scenario)['generatorOutputPerSecond'] = knobs.generator;
  }
  writable(ENERGY)['generatorOutputPerSecond'] = knobs.generator;
  writable(TRANSMIT)['energyPerSecond'] = knobs.mastDraw;
  writable(SYSTEMS.pumps)['drawPerSecond'] = knobs.pumpDraw;
  writable(WATER)['pumpMaxPerSecond'] = knobs.pumpMax;
  for (const scenario of Object.values(SCENARIOS)) {
    writable(scenario)['materialStart'] = knobs.material;
  }
  writable(REPAIR)['diminishing'] = knobs.diminishing;
  writable(TRANSMIT)['decayWhileSending'] = SHIPPED_MAST_DECAY * knobs.mastDecayScale;
  writable(REPAIR)['materialBase'] = knobs.materialBase;
  writable(REPAIR)['materialGrowth'] = knobs.materialGrowth;
  writable(ENTROPY)['perRepair'] = knobs.entropyPerRepair;
  writable(ENTROPY)['decayDivisor'] = knobs.decayDivisor;
  for (const [id, base] of Object.entries(SHIPPED_DECAY)) {
    const scale =
      id === 'pumps'
        ? knobs.pumpDecayScale
        : id === 'transmitter'
          ? knobs.mastDecayScale
          : knobs.decayScale;
    writable(SYSTEMS[id as keyof typeof SYSTEMS])['baseDecayPerSecond'] = base * scale;
  }
}

type Decide = (state: GameState) => Action | null;

/**
 * The same three players `npm run sim` and balance.spec.ts use. They were copied out by
 * hand once and had already drifted; a tuning run that measures different players than
 * the test it is tuning towards is worse than no tuning run.
 */
const idle: Decide = doNothing;
const naive: Decide = patchTheWorst;
const active: Decide = playWell;

interface Outcome {
  minutes: number;
  saved: number;
  unfinished: number;
}

function play(seeds: string[], decide: Decide): Outcome {
  const minutes: number[] = [];
  const saved: number[] = [];
  let unfinished = 0;

  for (const seed of seeds) {
    let state = createInitialState(seed);
    while (!state.ended && state.tick < MAX_TICKS) {
      const action = decide(state);
      if (action) state = applyAction(state, action).state;
      state = step(state).state;
    }
    if (!state.ended) unfinished++;
    minutes.push(state.tick / 60);
    saved.push(savedShare(state) * 100);
  }

  minutes.sort((a, b) => a - b);
  saved.sort((a, b) => a - b);
  const middle = (values: number[]) => values[Math.floor(values.length / 2)];
  return { minutes: middle(minutes), saved: middle(saved), unfinished };
}

function within(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

function main(): void {
  const seeds = Array.from({ length: SEEDS }, (_, i) => stateToSeed(i * 2654435761));
  const t = TARGETS.runtimeMinutes;
  const s = TARGETS.savedShare;

  // Read from balance.ts rather than repeated here: the starting point of a sweep must be
  // what is actually shipped, or the grid explores around a number nobody runs.
  const base = {
    generator: ENERGY.generatorOutputPerSecond,
    mastDraw: TRANSMIT.energyPerSecond,
    pumpDraw: SYSTEMS.pumps.drawPerSecond,
    material: SCENARIOS.standard.materialStart,
    diminishing: REPAIR.diminishing,
    materialBase: REPAIR.materialBase,
    materialGrowth: REPAIR.materialGrowth,
    entropyPerRepair: ENTROPY.perRepair,
    decayDivisor: ENTROPY.decayDivisor,
    pumpMax: WATER.pumpMaxPerSecond,
  };
  const grid: Knobs[] = [];
  // Scales bracket 1.0 — as shipped — so every row can be read against the current game.
  for (const decayScale of [0.8, 1.0, 1.25]) {
    for (const pumpDecayScale of [0.85, 1.0, 1.15]) {
      for (const mastDecayScale of [0.8, 1.0, 1.2]) {
        grid.push({ ...base, decayScale, pumpDecayScale, mastDecayScale });
      }
    }
  }

  console.log(
    `Ziele — Nichts tun ${t.idle.min}–${t.idle.max} min · ` +
      `Naiv ${t.naive.min}–${t.naive.max} min / ${s.naive.min * 100}–${s.naive.max * 100} % · ` +
      `Aktiv ${t.active.min}–${t.active.max} min / ${s.active.min * 100}–${s.active.max * 100} %`,
  );
  console.log(`${grid.length} Kombinationen über ${seeds.length} Seeds\n`);

  const hits: { knobs: Knobs; idle: Outcome; naive: Outcome; active: Outcome }[] = [];
  const verbose = process.env.TUNE_VERBOSE === '1';

  for (const knobs of grid) {
    apply(knobs);
    const i = play(seeds, idle);
    const n = play(seeds, naive);
    const a = play(seeds, active);

    if (verbose) {
      console.log(
        `gen ${knobs.generator.toFixed(1)} mast ${knobs.mastDraw.toFixed(1)} ` +
          `pumpQ ${knobs.pumpMax.toFixed(3)} mat ${String(knobs.material).padStart(3)} ` +
          `S/rep ${knobs.entropyPerRepair} decay ×${knobs.decayScale.toFixed(2)} ` +
          `pumpD ×${knobs.pumpDecayScale.toFixed(1)} mastD ×${knobs.mastDecayScale.toFixed(1)} → ` +
          `idle ${i.minutes.toFixed(1)}  naiv ${n.minutes.toFixed(1)}/${n.saved.toFixed(0)}%  ` +
          `aktiv ${a.minutes.toFixed(1)}/${a.saved.toFixed(0)}%`,
      );
    }

    if (!within(i.minutes, t.idle.min, t.idle.max)) continue;
    if (i.unfinished + n.unfinished + a.unfinished > 0) continue;

    const score =
      Number(within(n.minutes, t.naive.min, t.naive.max)) +
      Number(within(n.saved, s.naive.min * 100, s.naive.max * 100)) +
      Number(within(a.minutes, t.active.min, t.active.max)) +
      Number(within(a.saved, s.active.min * 100, s.active.max * 100));

    if (score >= 3) {
      hits.push({ knobs, idle: i, naive: n, active: a });
      const mark = (ok: boolean) => (ok ? '✓' : '·');
      console.log(
        `gen ${knobs.generator.toFixed(1)} · mast ${knobs.mastDraw.toFixed(1)} · ` +
          `pumpQ ${knobs.pumpMax.toFixed(3)} · mat ${String(knobs.material).padStart(3)} · ` +
          `S/rep ${knobs.entropyPerRepair} · decay ×${knobs.decayScale.toFixed(2)} · ` +
          `pumpD ×${knobs.pumpDecayScale.toFixed(1)} · mastD ×${knobs.mastDecayScale.toFixed(1)}  →  ` +
          `idle ${i.minutes.toFixed(1)}${mark(true)}  ` +
          `naiv ${n.minutes.toFixed(1)}${mark(within(n.minutes, t.naive.min, t.naive.max))}/` +
          `${n.saved.toFixed(0)}%${mark(within(n.saved, s.naive.min * 100, s.naive.max * 100))}  ` +
          `aktiv ${a.minutes.toFixed(1)}${mark(within(a.minutes, t.active.min, t.active.max))}/` +
          `${a.saved.toFixed(0)}%${mark(within(a.saved, s.active.min * 100, s.active.max * 100))}` +
          `  [${score}/4]`,
      );
    }
  }

  console.log(`\n${hits.length} Kombinationen mit mindestens 3 von 4 Zielen.`);
}

main();
