/**
 * Where a save is kept.
 *
 * `localStorage` is not always there: private windows, blocked site data, and test
 * runners all take it away. Putting it behind a token means the absence is handled in
 * one place, and that persistence can be tested without a browser global.
 */

import { InjectionToken } from '@angular/core';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Null when this browser gives us nowhere to write; the game then runs unsaved. */
export const GAME_STORAGE = new InjectionToken<KeyValueStorage | null>('GAME_STORAGE', {
  providedIn: 'root',
  factory: () => browserStorage(),
});

/** A storage that keeps nothing. Useful for tests and for a blocked browser. */
export function memoryStorage(): KeyValueStorage {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
    removeItem: (key) => void entries.delete(key),
  };
}

function browserStorage(): KeyValueStorage | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return null;
    }
    // Existing is not the same as usable: Safari's private mode throws on write.
    const probe = '__entropie_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}
