import { COLLECTION_NAMES } from '../content/de';
import { buildChronicle } from '../engine/chronicle';
import { createInitialState } from '../engine/state';
import { bar, seedLink, shareText } from './share';

describe('the shareable chronicle', () => {
  const chronicleOf = () => {
    const state = createInitialState('4F2A');
    state.tick = 9_999;
    state.collections.maps.sent = 12;
    state.collections.chronicle.sent = 61;
    state.chronicle = [{ tick: 500, kind: 'system-lost', id: 'transmitter' }];
    return buildChronicle(state);
  };

  it('fills the bar in proportion, and never past its ends', () => {
    expect(bar(0)).toBe('▱▱▱▱▱');
    expect(bar(100)).toBe('▰▰▰▰▰');
    // Five cells, rounded: half the collection lands on three of them. The exact
    // figure stands next to the bar, so the bar only has to give the shape.
    expect(bar(50)).toBe('▰▰▰▱▱');
    expect(bar(40)).toBe('▰▰▱▱▱');
    // Anything saved at all shows, rather than reading as nothing.
    expect(bar(12)).toBe('▰▱▱▱▱');
    expect(bar(-20)).toBe('▱▱▱▱▱');
    expect(bar(500)).toBe('▰▰▰▰▰');
  });

  it('reads as the record prompt.md section 5.11 sketches', () => {
    const text = shareText(chronicleOf());

    expect(text).toContain('ENTROPIE · Archiv #4F2A');
    expect(text).toContain('02:46:39');
    expect(text).toContain(COLLECTION_NAMES.maps);
    expect(text).toContain('12 %');
    expect(text).toContain('61 %');
    expect(text).toContain('Zuletzt fiel: Sendemast.');
  });

  it('lines the bars up in a column', () => {
    const lines = shareText(chronicleOf()).split('\n');
    const barLines = lines.filter((line) => line.includes('▱') || line.includes('▰'));
    expect(barLines.length).toBe(6);

    const positions = new Set(barLines.map((line) => line.search(/[▰▱]/)));
    expect(positions.size).toBe(1);
  });

  it('stays plain: a record of a run, not an advertisement', () => {
    const text = shareText(chronicleOf());

    // No exclamation anywhere — prompt.md section 4 rules them out of every game text.
    expect(text).not.toContain('!');
    // Nothing that reads as promotion, and no emoji.
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(text.toLowerCase()).not.toContain('jetzt spielen');

    // Only the archive marker carries a '#', and only once.
    expect(text.split('#').length - 1).toBe(1);
    expect(text).toContain('Archiv #4F2A');

    // It fits in any client without wrapping into nonsense.
    for (const line of text.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(60);
    }
  });

  it('builds a link that starts the very same archive', () => {
    expect(seedLink('4F2A', 'https://example.org', '/entropie/')).toBe(
      'https://example.org/entropie/?archiv=4F2A',
    );
  });

  it('says nothing about a loss when nothing has been lost', () => {
    const state = createInitialState('9B01');
    expect(shareText(buildChronicle(state))).not.toContain('Zuletzt fiel');
  });
});
