import { LEGACY } from '../engine/balance';
import { CLOSING_SENTENCES, LORE, SYSTEM_NAMES, COLLECTION_NAMES } from './de';
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
