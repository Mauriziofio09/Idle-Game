/**
 * What a run amounted to.
 *
 * Reads a finished (or running) state and returns facts only — no sentences. The
 * closing line is chosen here as a key, so the decision is made from the run's own
 * numbers while the wording stays in content/de.ts.
 */

import { COLLECTIONS } from './balance';
import {
  COLLECTION_IDS,
  type ChronicleEntry,
  type CollectionId,
  type EndReason,
  type GameState,
} from './state';

export type ClosingKey =
  | 'nothing-saved'
  | 'a-little'
  | 'a-good-part'
  | 'most-of-it'
  | 'mast-fell-last'
  | 'held-long';

export interface CollectionResult {
  id: CollectionId;
  sent: number;
  share: number;
}

export interface RunChronicle {
  seed: string;
  ticks: number;
  savedShare: number;
  collections: CollectionResult[];
  timeline: readonly ChronicleEntry[];
  /** The rule that fired most often, if any rule fired at all. */
  mostUsedRule: { id: string; position: number; firedCount: number } | null;
  lastLoss: ChronicleEntry | null;
  endReason: EndReason | null;
  closing: ClosingKey;
}

/** An hour is a long night in this house; used only to pick a closing line. */
const LONG_RUN_TICKS = 60 * 60;

export function buildChronicle(state: GameState): RunChronicle {
  const collections: CollectionResult[] = COLLECTION_IDS.map((id) => ({
    id,
    sent: state.collections[id].sent,
    share: (state.collections[id].sent / COLLECTIONS.unitsEach) * 100,
  }));

  const savedShare =
    collections.reduce((sum, entry) => sum + entry.sent, 0) /
    (COLLECTION_IDS.length * COLLECTIONS.unitsEach);

  let mostUsedRule: RunChronicle['mostUsedRule'] = null;
  state.protocols.forEach((rule, index) => {
    if (rule.firedCount > 0 && (!mostUsedRule || rule.firedCount > mostUsedRule.firedCount)) {
      mostUsedRule = { id: rule.id, position: index + 1, firedCount: rule.firedCount };
    }
  });

  const losses = state.chronicle.filter((entry) => entry.kind !== 'floor-flooded');
  const lastLoss = losses.length > 0 ? losses[losses.length - 1] : null;

  return {
    seed: state.seed,
    ticks: state.tick,
    savedShare,
    collections,
    timeline: state.chronicle,
    mostUsedRule,
    lastLoss,
    endReason: state.endReason,
    closing: closingFor(savedShare, state.tick, lastLoss),
  };
}

function closingFor(
  savedShare: number,
  ticks: number,
  lastLoss: ChronicleEntry | null,
): ClosingKey {
  if (lastLoss?.kind === 'system-lost' && lastLoss.id === 'transmitter') {
    // The one machine that saved anything was also the last to go.
    return 'mast-fell-last';
  }
  if (savedShare <= 0) {
    return 'nothing-saved';
  }
  if (ticks >= LONG_RUN_TICKS) {
    return 'held-long';
  }
  if (savedShare < 0.2) {
    return 'a-little';
  }
  if (savedShare < 0.5) {
    return 'a-good-part';
  }
  return 'most-of-it';
}
