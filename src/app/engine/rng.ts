/**
 * Seeded PRNG (mulberry32). The whole engine draws randomness from here so that
 * a seed plus a list of actions reproduces a run exactly — online, offline and in
 * the headless simulator alike.
 *
 * The generator state is a plain uint32 and lives inside GameState, which means it
 * is saved and restored with everything else.
 */

/** A mutable cursor over the generator state. Only used inside a single step. */
export interface RngCursor {
  state: number;
}

export function createCursor(state: number): RngCursor {
  return { state: state >>> 0 };
}

/** Next float in [0, 1). Advances the cursor. */
export function nextFloat(cursor: RngCursor): number {
  cursor.state = (cursor.state + 0x6d2b79f5) | 0;
  let t = cursor.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Next float in [min, max). Advances the cursor. */
export function nextRange(cursor: RngCursor, min: number, max: number): number {
  return min + nextFloat(cursor) * (max - min);
}

/** Next integer in [0, exclusiveMax). Advances the cursor. */
export function nextInt(cursor: RngCursor, exclusiveMax: number): number {
  return Math.floor(nextFloat(cursor) * exclusiveMax);
}

/** Picks one element. The array must not be empty. */
export function pick<T>(cursor: RngCursor, items: readonly T[]): T {
  return items[nextInt(cursor, items.length)];
}

const SEED_ALPHABET = '0123456789ABCDEF';
const SEED_LENGTH = 4;

/** Turns a seed string such as "4F2A" into the initial generator state (FNV-1a). */
export function seedToState(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // A zero state would make mulberry32 start in a degenerate spot.
  return (hash >>> 0) || 0x9e3779b9;
}

/** Builds a display seed ("4F2A") out of a raw number, e.g. a timestamp or a random draw. */
export function stateToSeed(raw: number): string {
  let value = raw >>> 0;
  let seed = '';
  for (let i = 0; i < SEED_LENGTH; i++) {
    seed = SEED_ALPHABET[value & 0x0f] + seed;
    value >>>= 4;
  }
  return seed;
}

/** True for strings the game accepts as a seed, e.g. from `?archiv=4F2A`. */
export function isValidSeed(seed: string): boolean {
  return new RegExp(`^[0-9A-F]{${SEED_LENGTH}}$`).test(seed);
}

/** Normalises user input ("4f2a ") into a canonical seed, or null if it is not one. */
export function normaliseSeed(input: string): string | null {
  const candidate = input.trim().toUpperCase();
  return isValidSeed(candidate) ? candidate : null;
}

/**
 * The seed everyone plays today.
 *
 * Derived from the calendar date alone, so two people who never spoke get the same
 * archive and can compare what they saved. The caller supplies the date, because the
 * engine has no clock.
 */
export function dailySeed(year: number, month: number, day: number): string {
  return stateToSeed(seedToState(`${year}-${month}-${day}`));
}
