/**
 * Running many ticks at once.
 *
 * This is the same `step` the live loop uses, called in a row. That is the whole
 * trick behind "while you were away": there is no separate offline model that could
 * drift from the online one. Milestone 3 adds the clamping and stasis rules on top.
 */

import { OFFLINE } from './balance';
import type { DomainEvent } from './domain-events';
import type { GameState } from './state';
import { step } from './step';

export interface SimulationResult {
  state: GameState;
  events: DomainEvent[];
  /** Ticks actually simulated — fewer than requested when the run ended on the way. */
  ticks: number;
}

/** Simulates `ticks` steps, stopping early if the archive falls silent. */
export function simulate(state: GameState, ticks: number, collectEvents = true): SimulationResult {
  let current = state;
  const events: DomainEvent[] = [];
  let simulated = 0;

  for (let i = 0; i < ticks; i++) {
    if (current.ended) {
      break;
    }
    const result = step(current);
    current = result.state;
    simulated += 1;
    if (collectEvents && result.events.length > 0) {
      events.push(...result.events);
    }
  }

  return { state: current, events, ticks: simulated };
}

/**
 * Same as `simulate`, but in bounded chunks, reporting progress as it goes. The result
 * is identical to one long run.
 *
 * Note what this does NOT do: it is synchronous, so it never yields to the event loop
 * and cannot repaint between chunks. That is deliberate — a full 24 h catch-up measures
 * ~45 ms (see PLAN.md), far below anything a player could notice, so the progress
 * indicator prompt.md offers "bei Bedarf" is not needed. `onChunk` exists so that a
 * future scenario with a longer window can be made asynchronous without changing callers.
 */
export function simulateInChunks(
  state: GameState,
  ticks: number,
  onChunk?: (done: number, total: number) => void,
): SimulationResult {
  let current = state;
  const events: DomainEvent[] = [];
  let simulated = 0;

  while (simulated < ticks && !current.ended) {
    const size = Math.min(OFFLINE.chunkTicks, ticks - simulated);
    const result = simulate(current, size);
    current = result.state;
    events.push(...result.events);
    simulated += result.ticks;
    onChunk?.(simulated, ticks);
    if (result.ticks < size) {
      break;
    }
  }

  return { state: current, events, ticks: simulated };
}
