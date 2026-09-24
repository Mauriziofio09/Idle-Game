/**
 * The chronicle as one block of text a player can paste anywhere.
 *
 * Kept deliberately small and plain: no links to us, no hashtags, no score-chasing.
 * It is a record of a run, not an advertisement.
 */

import {
  APP,
  CHRONICLE_LABELS,
  COLLECTION_NAMES,
  SYSTEM_NAMES,
  floorName,
} from '../content/de';
import type { RunChronicle } from '../engine/chronicle';
import { formatDuration, formatPercent } from '../format';

/** Five cells, filled in proportion — readable in any font, in any client. */
const BAR_CELLS = 5;
const FILLED = '▰';
const EMPTY = '▱';

export function bar(share: number): string {
  const filled = Math.round((Math.max(0, Math.min(100, share)) / 100) * BAR_CELLS);
  return FILLED.repeat(filled) + EMPTY.repeat(BAR_CELLS - filled);
}

export function shareText(chronicle: RunChronicle, floors: number): string {
  const width = Math.max(
    ...chronicle.collections.map((entry) => COLLECTION_NAMES[entry.id].length),
  );

  const lines = [
    `${APP.title} · ${APP.archivePrefix}${chronicle.seed}`,
    `${CHRONICLE_LABELS.held} ${formatDuration(chronicle.ticks)} · ` +
      `${CHRONICLE_LABELS.saved} ${formatPercent(chronicle.savedShare * 100)}`,
    '',
    ...chronicle.collections.map(
      (entry) =>
        `${COLLECTION_NAMES[entry.id].padEnd(width)}  ${bar(entry.share)} ` +
        `${formatPercent(entry.share)}`,
    ),
  ];

  if (chronicle.lastLoss) {
    lines.push('', CHRONICLE_LABELS.lastFell(lossName(chronicle.lastLoss, floors)));
  }

  return lines.join('\n');
}

/**
 * A link that opens exactly this archive — the seed alone is not enough, because the
 * same seed in a different house is a different game.
 */
export function seedLink(
  seed: string,
  scenarioId: string,
  origin: string,
  path: string,
): string {
  const house = scenarioId === 'standard' ? '' : `&haus=${scenarioId}`;
  return `${origin}${path}?archiv=${seed}${house}`;
}

function lossName(entry: RunChronicle['timeline'][number], floors: number): string {
  switch (entry.kind) {
    case 'system-lost':
      return SYSTEM_NAMES[entry.id as keyof typeof SYSTEM_NAMES] ?? entry.id;
    case 'collection-lost':
    case 'collection-burned':
      return COLLECTION_NAMES[entry.id as keyof typeof COLLECTION_NAMES] ?? entry.id;
    case 'floor-flooded':
      return floorName(Number(entry.id), floors);
  }
}
