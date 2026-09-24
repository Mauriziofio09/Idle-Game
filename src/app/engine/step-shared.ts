/**
 * The handful of pure formulas that more than one module needs.
 *
 * They live apart from step.ts so that events.ts can use them without importing the
 * tick itself, which would be a cycle.
 */

import { ENTROPY, HUMIDITY } from './balance';

/** The decay multiplier m(S). Monotonically increasing, never below 1. */
export function decayMultiplier(entropy: number): number {
  return 1 + entropy / ENTROPY.decayDivisor;
}

/** How much a floor's dampness accelerates decay: 0.5 when bone dry, 2.5 when soaked. */
export function humidityFactor(humidity: number): number {
  return 0.5 + humidity / HUMIDITY.humidityDivisor;
}
