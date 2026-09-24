import { LEGACY } from '../engine/balance';
import {
  CLOSING_SENTENCES,
  COLLECTION_NAMES,
  LOG,
  LORE,
  SYSTEM_NAMES,
  floorAccusative,
  floorDative,
  floorName,
} from './de';
import { SYSTEM_IDS, COLLECTION_IDS } from '../engine/state';

/**
 * The content file is where the game's voice lives, so its shape is worth pinning:
 * prompt.md section 4 asks for 24 fragments, a quiet tone and no emoji anywhere.
 */
describe('the city chronicle', () => {
  it('has exactly as many fragments written as the balance promises', () => {
    expect(LORE.length).toBe(LEGACY.fragmentCount);
  });

  it('gives every fragment a title and two to four sentences', () => {
    for (const fragment of LORE) {
      expect(fragment.title.length).toBeGreaterThan(0);
      const sentences = fragment.text.split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length).toBeGreaterThanOrEqual(2);
      expect(sentences.length).toBeLessThanOrEqual(4);
    }
  });

  it('holds the resolution back until the end', () => {
    // The city comes first; the archivist enters a third of the way in, and what
    // became of her, and whether anyone is listening, only at the very end.
    const opening = LORE.slice(0, 7)
      .map((fragment) => fragment.text)
      .join(' ');
    expect(opening).not.toContain('Halden');
    expect(opening).not.toContain('Empfangsbestätigung');

    const firstTwoThirds = LORE.slice(0, 20)
      .map((fragment) => fragment.text)
      .join(' ');
    expect(firstTwoThirds).not.toContain('Empfangsbestätigung');

    expect(LORE[LORE.length - 1].text).toContain('Empfangsbestätigung');
  });
});

describe('the voice', () => {
  const everyString = (value: unknown): string[] => {
    if (typeof value === 'string') {
      return [value];
    }
    if (Array.isArray(value)) {
      return value.flatMap(everyString);
    }
    if (value && typeof value === 'object') {
      return Object.values(value).flatMap(everyString);
    }
    return [];
  };

  it('uses no emoji and no flood of exclamation marks', () => {
    const texts = [...LORE.flatMap((f) => [f.title, f.text]), ...everyString(CLOSING_SENTENCES)];
    for (const text of texts) {
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(text).not.toContain('!');
    }
  });

  it('names every system and every collection', () => {
    for (const id of SYSTEM_IDS) {
      expect(SYSTEM_NAMES[id]?.length).toBeGreaterThan(0);
    }
    for (const id of COLLECTION_IDS) {
      expect(COLLECTION_NAMES[id]?.length).toBeGreaterThan(0);
    }
  });
});

describe('floor names in German cases', () => {
  it('names every floor of the five-floor archive', () => {
    expect([0, 1, 2, 3, 4].map((i) => floorName(i, 5))).toEqual([
      'Keller',
      'Erdgeschoss',
      'Erster Stock',
      'Zweiter Stock',
      'Dachboden',
    ]);
  });

  it('names every floor of the seven-floor tower', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => floorName(i, 7))).toEqual([
      'Keller',
      'Erdgeschoss',
      'Erster Stock',
      'Zweiter Stock',
      'Dritter Stock',
      'Vierter Stock',
      'Dachboden',
    ]);
  });

  it('declines where something is, instead of gluing a preposition to a name', () => {
    // "im Erster Stock" and "im Dachboden" are what naive composition produces.
    expect([0, 1, 2, 4].map((i) => floorDative(i, 5))).toEqual([
      'im Keller',
      'im Erdgeschoss',
      'im ersten Stock',
      'auf dem Dachboden',
    ]);
  });

  it('declines where something is going', () => {
    // "in den Erdgeschoss" is the error this replaces.
    expect([0, 1, 2, 4].map((i) => floorAccusative(i, 5))).toEqual([
      'in den Keller',
      'ins Erdgeschoss',
      'in den ersten Stock',
      'auf den Dachboden',
    ]);
  });

  it('reads correctly in the sentences that use it', () => {
    expect(LOG.floorFlooded(floorDative(2, 5))).toBe('Das Wasser steht im ersten Stock.');
    expect(LOG.relocationStarted('Kartenwerk', floorAccusative(1, 5))).toBe(
      'Kartenwerk wird ins Erdgeschoss getragen.',
    );
    expect(LOG.relocationFinished('Kartenwerk', floorDative(4, 5))).toBe(
      'Kartenwerk steht jetzt auf dem Dachboden.',
    );
  });
});
