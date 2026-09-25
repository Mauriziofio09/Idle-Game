/**
 * Contrast check — `npm run contrast`.
 *
 * prompt.md section 7 asks for contrasts from styles.md, and at least WCAG AA where
 * styles.md is silent. styles.md names colours but no ratios, so AA applies: 4.5:1 for
 * text, 3:1 for graphics and user interface components (WCAG 1.4.3 and 1.4.11).
 *
 * The ratios are computed from `src/styles/tokens.css` itself rather than from a copy
 * kept here, so this cannot drift from the palette it is checking. The pairs below are
 * the combinations the interface actually renders; each names where it occurs, so a
 * failure says which screen to go and look at.
 */

import { readFileSync } from 'node:fs';

const TOKENS = new URL('../src/styles/tokens.css', import.meta.url);

/** WCAG 2.1 thresholds. */
const AA_TEXT = 4.5;
const AA_LARGE_TEXT = 3;
const AA_NON_TEXT = 3;

type Usage = 'text' | 'large-text' | 'graphic';

interface Pair {
  readonly what: string;
  readonly foreground: string;
  readonly background: string;
  readonly usage: Usage;
}

const PAIRS: readonly Pair[] = [
  { what: 'body text on the page', foreground: '--color-text-primary', background: '--color-background', usage: 'text' },
  { what: 'muted labels and notes', foreground: '--color-text-muted', background: '--color-background', usage: 'text' },
  { what: 'muted text inside a subtle surface (a switched-off system)', foreground: '--color-text-muted', background: '--color-surface-subtle', usage: 'text' },
  { what: 'a primary button', foreground: '--color-button-primary-fg', background: '--color-button-primary-bg', usage: 'text' },
  { what: 'a secondary button', foreground: '--color-button-secondary-fg', background: '--color-button-secondary-bg', usage: 'text' },
  { what: 'a lost system or collection, inverted', foreground: '--color-lost-fg', background: '--color-lost-bg', usage: 'text' },
  // Graphics and controls. The accent lives here on purpose: at 4.35:1 on white it clears
  // the 3:1 asked of a border or an icon but not the 4.5:1 asked of a word, which is why
  // no text in this interface is green.
  { what: 'the accent as an icon or a border (never as text)', foreground: '--color-accent', background: '--color-background', usage: 'graphic' },
  { what: 'the focus outline', foreground: '--color-accent', background: '--color-background', usage: 'graphic' },
  { what: 'a card border against the page', foreground: '--color-border', background: '--color-background', usage: 'graphic' },
  { what: 'a meter fill against its track', foreground: '--color-meter-fill', background: '--color-meter-track', usage: 'graphic' },
  { what: 'the sent share of a collection', foreground: '--color-sent', background: '--color-meter-track', usage: 'graphic' },
  { what: 'the water against the page', foreground: '--color-water', background: '--color-background', usage: 'graphic' },
];

function tokens(): Map<string, string> {
  const css = readFileSync(TOKENS, 'utf8');
  const found = new Map<string, string>();
  // Only :root declarations, and only the first definition of each: the reduced-motion
  // block below redefines durations, never colours.
  for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, raw] = match;
    if (!found.has(name)) {
      found.set(name, raw.trim());
    }
  }
  return found;
}

/** Follows `var(--x)` chains until a literal colour falls out. */
function resolve(name: string, table: Map<string, string>, seen = new Set<string>()): string {
  if (seen.has(name)) {
    throw new Error(`${name} refers to itself`);
  }
  seen.add(name);
  const value = table.get(name);
  if (value === undefined) {
    throw new Error(`${name} is not defined in tokens.css`);
  }
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  return reference === null ? value : resolve(reference[1], table, seen);
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const digits = hex.replace('#', '');
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  if (!/^[0-9a-f]{6}$/i.test(full)) {
    throw new Error(`not a hex colour: ${hex}`);
  }
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function required(usage: Usage): number {
  if (usage === 'text') return AA_TEXT;
  if (usage === 'large-text') return AA_LARGE_TEXT;
  return AA_NON_TEXT;
}

function main(): void {
  const table = tokens();
  const failures: string[] = [];

  console.log('ENTROPIE · Kontrastprüfung gegen WCAG AA\n');
  for (const pair of PAIRS) {
    const foreground = resolve(pair.foreground, table);
    const background = resolve(pair.background, table);
    const ratio = contrast(foreground, background);
    const need = required(pair.usage);
    const ok = ratio >= need;
    if (!ok) {
      failures.push(`${pair.what}: ${ratio.toFixed(2)}:1, verlangt ${need}:1`);
    }
    console.log(
      `  ${ok ? '✓' : '✗'} ${ratio.toFixed(2).padStart(5)}:1  (≥ ${need})  ` +
        `${pair.what}\n      ${pair.foreground} ${foreground} auf ${pair.background} ${background}`,
    );
  }

  if (failures.length > 0) {
    console.log(`\n${failures.length} Kombination(en) unter AA:`);
    for (const failure of failures) {
      console.log(`  ${failure}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`\nAlle ${PAIRS.length} Kombinationen erfüllen AA.`);
}

main();
