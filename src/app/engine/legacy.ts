/**
 * What outlasts a run.
 *
 * Everything transmitted counts towards the legacy for good. The legacy unlocks
 * knowledge and options — lore fragments, protocol slots — and deliberately no large
 * multipliers: prompt.md 5.12 is explicit that the ending stays inevitable. A stronger
 * archive would only make the second run a repetition of the first.
 */

import { LEGACY, PROTOCOLS } from './balance';
import { COLLECTION_IDS, type CollectionId, type GameState } from './state';

export const LEGACY_SCHEMA_VERSION = 1;

export interface LegacyRecord {
  schemaVersion: number;
  /** Units transmitted across every run, per collection. */
  sent: Record<string, number>;
  runs: number;
}

export function emptyLegacy(): LegacyRecord {
  return { schemaVersion: LEGACY_SCHEMA_VERSION, sent: {}, runs: 0 };
}

export function totalSent(record: LegacyRecord): number {
  let sum = 0;
  for (const id of COLLECTION_IDS) {
    sum += record.sent[id] ?? 0;
  }
  return sum;
}

/** One fragment per 25 units, up to the 24 that exist. */
export function fragmentsUnlocked(record: LegacyRecord): number {
  return Math.min(
    LEGACY.fragmentCount,
    Math.floor(totalSent(record) / LEGACY.unitsPerFragment),
  );
}

/** Units still to transmit before the next fragment, or null once all are found. */
export function unitsToNextFragment(record: LegacyRecord): number | null {
  if (fragmentsUnlocked(record) >= LEGACY.fragmentCount) {
    return null;
  }
  const total = totalSent(record);
  return LEGACY.unitsPerFragment - (total % LEGACY.unitsPerFragment);
}

/** How many protocol slots a new archive starts with, given what has been saved. */
export function protocolSlotsFor(record: LegacyRecord): number {
  const total = totalSent(record);
  const earned = LEGACY.slotThresholds.filter((threshold) => total >= threshold).length;
  return Math.min(PROTOCOLS.maxSlots, PROTOCOLS.startingSlots + earned);
}

/** Units still to transmit before the next slot, or null once all are earned. */
export function unitsToNextSlot(record: LegacyRecord): number | null {
  const total = totalSent(record);
  const next = LEGACY.slotThresholds.find((threshold) => total < threshold);
  return next === undefined ? null : next - total;
}

/** Folds a finished run into the legacy. Pure: the record handed in is untouched. */
export function bankRun(record: LegacyRecord, state: GameState): LegacyRecord {
  const sent: Record<string, number> = { ...record.sent };
  for (const id of COLLECTION_IDS) {
    const transmitted = state.collections[id as CollectionId].sent;
    if (transmitted > 0) {
      sent[id] = (sent[id] ?? 0) + transmitted;
    }
  }
  return { schemaVersion: LEGACY_SCHEMA_VERSION, sent, runs: record.runs + 1 };
}
