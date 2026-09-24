/**
 * Headless balancing run — `npm run sim`.
 *
 * Plays whole runs without a UI, using the same engine the browser uses, and prints
 * the distribution of runtime and rescued share per strategy. Milestone 8 tunes the
 * numbers in src/app/engine/balance.ts against the targets in prompt.md section 6.
 *
 * Version 1 covers the strategies that only need milestone 1 actions. "Rescued" stays
 * at 0 % until the transmitter arrives in milestone 5.
 */

import { applyAction, canApply, type Action } from '../src/app/engine/actions';
import { TARGETS } from '../src/app/engine/balance';
import { COLLECTION_IDS, SYSTEM_IDS, createInitialState, savedShare, type GameState } from '../src/app/engine/state';
import { step } from '../src/app/engine/step';
import { stateToSeed } from '../src/app/engine/rng';
import type { ProtocolRule } from '../src/app/engine/protocol-types';

/** Pillar 1: every strategy has to end. The ceiling lives in balance.ts with the other targets. */
const MAX_TICKS = TARGETS.maxRunTicks;
const SEED_COUNT = Number(process.env.SIM_SEEDS ?? 200);

interface Strategy {
  readonly name: string;
  /** Prepares the archive before the first tick, e.g. by writing protocols. */
  setup?(state: GameState): GameState;
  /** Returns the action to take this tick, or null to sit still. */
  decide(state: GameState): Action | null;
}

const doNothing: Strategy = {
  name: 'Nichts tun',
  decide: () => null,
};

const repairWeakest: Strategy = {
  name: 'Naiv (schwächstes System)',
  decide(state) {
    let weakest: Action | null = null;
    let lowest = Infinity;
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
  },
};

/**
 * Gives up the cellar on purpose: the pumps are switched off and left to rot, which
 * saves power for everything above. Pillar check — this has to be a real option.
 */
const abandonCellar: Strategy = {
  name: 'Keller aufgeben',
  decide(state) {
    if (state.systems.pumps.on && !state.systems.pumps.lost) {
      return { type: 'toggle', systemId: 'pumps', on: false };
    }
    const generator = state.systems.generator;
    if (!generator.lost && generator.integrity < 60) {
      const action: Action = { type: 'repair', systemId: 'generator' };
      if (canApply(state, action)) {
        return action;
      }
    }
    return repairWeakest.decide(state);
  },
};

function rule(
  id: string,
  condition: ProtocolRule['condition'],
  action: ProtocolRule['action'],
): ProtocolRule {
  return { id, condition, action, enabled: true, firedCount: 0 };
}

/**
 * The idle heart: the player writes two protocols and then walks away. Everything
 * after tick 0 is the custodian depot's doing, which is exactly what has to carry an
 * absence. Milestone 8 tunes against this.
 */
const protocolsOnly: Strategy = {
  name: 'Protokolle, dann weggehen',
  setup: (state) => ({
    ...state,
    // Only two slots at the start of a run, so these have to be the two that matter:
    // shed load to get the battery charging again, then keep the pumps alive.
    protocols: [
      rule(
        'p1',
        { kind: 'energy-below', value: 40 },
        { type: 'toggle', systemId: 'climate', on: false },
      ),
      rule(
        'p2',
        { kind: 'system-integrity-below', systemId: 'pumps', value: 45 },
        { type: 'repair', systemId: 'pumps' },
      ),
    ],
  }),
  decide: () => null,
};

interface RunResult {
  seed: string;
  ticks: number;
  saved: number;
  endReason: string;
  lostSystems: number;
  lostCollections: number;
  /** How many actions the custodian depot took on its own. */
  protocolRuns: number;
}

function playRun(seed: string, strategy: Strategy): RunResult {
  let state = createInitialState(seed);
  if (strategy.setup) {
    state = strategy.setup(state);
  }

  while (!state.ended && state.tick < MAX_TICKS) {
    const action = strategy.decide(state);
    if (action) {
      state = applyAction(state, action).state;
    }
    state = step(state).state;
  }

  let lostSystems = 0;
  for (const id of SYSTEM_IDS) {
    if (state.systems[id].lost) lostSystems++;
  }
  let lostCollections = 0;
  for (const id of COLLECTION_IDS) {
    if (state.collections[id].lost) lostCollections++;
  }

  let protocolRuns = 0;
  for (const rule of state.protocols) {
    protocolRuns += rule.firedCount;
  }

  return {
    seed,
    ticks: state.tick,
    saved: savedShare(state),
    endReason: state.endReason ?? 'LÄUFT NOCH',
    lostSystems,
    lostCollections,
    protocolRuns,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[index];
}

function formatMinutes(ticks: number): string {
  const minutes = ticks / 60;
  if (minutes < 90) return `${minutes.toFixed(1)} min`;
  return `${(minutes / 60).toFixed(1)} h`;
}

function summarise(strategy: Strategy, results: RunResult[]): void {
  const ticks = results.map((r) => r.ticks).sort((a, b) => a - b);
  const saved = results.map((r) => r.saved).sort((a, b) => a - b);
  const unfinished = results.filter((r) => r.endReason === 'LÄUFT NOCH').length;

  const reasons = new Map<string, number>();
  for (const result of results) {
    reasons.set(result.endReason, (reasons.get(result.endReason) ?? 0) + 1);
  }
  const reasonText = [...reasons.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => `${reason} ${Math.round((count / results.length) * 100)} %`)
    .join(' · ');

  console.log(`\n${strategy.name}`);
  console.log('─'.repeat(64));
  console.log(
    `  Laufzeit   P10 ${formatMinutes(percentile(ticks, 0.1)).padStart(9)}` +
      `   Median ${formatMinutes(percentile(ticks, 0.5)).padStart(9)}` +
      `   P90 ${formatMinutes(percentile(ticks, 0.9)).padStart(9)}`,
  );
  console.log(
    `  Gerettet   P10 ${(percentile(saved, 0.1) * 100).toFixed(1).padStart(7)} %` +
      `   Median ${(percentile(saved, 0.5) * 100).toFixed(1).padStart(7)} %` +
      `   P90 ${(percentile(saved, 0.9) * 100).toFixed(1).padStart(7)} %`,
  );
  console.log(`  Ende       ${reasonText}`);
  const runs = results.map((r) => r.protocolRuns).sort((a, b) => a - b);
  console.log(
    `  Protokolle Median ${percentile(runs, 0.5)} Aktionen durch das Depot` +
      ` (P90 ${percentile(runs, 0.9)})`,
  );
  if (unfinished > 0) {
    console.log(`  ⚠ ${unfinished} von ${results.length} Runs liefen über 72 h — Säule 1 verletzt.`);
  }
}

/**
 * Offline budget from prompt.md section 9: 24 h of catch-up (86 400 ticks) in under
 * 1.5 s. Measured on raw step throughput, restarting whenever a run falls silent.
 */
function measureThroughput(): void {
  const target = 24 * 60 * 60;
  let state = createInitialState(stateToSeed(0xc0de));
  let done = 0;

  const started = performance.now();
  while (done < target) {
    if (state.ended) {
      state = createInitialState(stateToSeed(0xc0de));
    }
    state = step(state).state;
    done++;
  }
  const elapsed = performance.now() - started;

  const budget = TARGETS.offlineBudgetMs;
  const verdict = elapsed < budget ? 'ok' : 'ZU LANGSAM';
  console.log(
    `\nOffline-Budget  ${target} Ticks (24 h) in ${elapsed.toFixed(0)} ms — Ziel < ${budget} ms — ${verdict}`,
  );
  if (elapsed >= budget) {
    process.exitCode = 1;
  }
}

function main(): void {
  const strategies = [doNothing, repairWeakest, abandonCellar, protocolsOnly];
  const seeds = Array.from({ length: SEED_COUNT }, (_, i) => stateToSeed(i * 2654435761));

  console.log(`ENTROPIE · Headless-Simulation über ${seeds.length} Seeds`);

  let violations = 0;
  for (const strategy of strategies) {
    const results = seeds.map((seed) => playRun(seed, strategy));
    summarise(strategy, results);
    violations += results.filter((r) => r.endReason === 'LÄUFT NOCH').length;
  }

  measureThroughput();

  console.log('');
  if (violations > 0) {
    console.error(`FEHLER: ${violations} Runs endeten nicht innerhalb von 72 h.`);
    process.exitCode = 1;
  }
}

main();
