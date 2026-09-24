/**
 * The chronicle as one block of text a player can paste anywhere.
 *
 * Kept deliberately small and plain: no links to us, no hashtags, no score-chasing.
 * It is a record of a run, not an advertisement.
 */

import { CHRONICLE_LABELS, COLLECTION_NAMES, SYSTEM_NAMES, FLOOR_NAMES, APP } from '../content/de';
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

export function shareText(chronicle: RunChronicle): string {
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
    lines.push('', CHRONICLE_LABELS.lastFell(lossName(chronicle.lastLoss)));
  }

  return lines.join('\n');
}

/** A seed link, so someone else can play exactly this archive. */
export function seedLink(seed: string, origin: string, path: string): string {
  return `${origin}${path}?archiv=${seed}`;
}

function lossName(entry: RunChronicle['timeline'][number]): string {
  switch (entry.kind) {
    case 'system-lost':
      return SYSTEM_NAMES[entry.id as keyof typeof SYSTEM_NAMES] ?? entry.id;
    case 'collection-lost':
      return COLLECTION_NAMES[entry.id as keyof typeof COLLECTION_NAMES] ?? entry.id;
    case 'floor-flooded':
      return FLOOR_NAMES[Number(entry.id)] ?? entry.id;
  }
}
