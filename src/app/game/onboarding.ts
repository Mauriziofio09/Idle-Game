/**
 * Whether the player has been introduced to the archive.
 *
 * Its own key, like the sound setting: seeing the introduction is something that happened
 * to the person, not to the run, so a new archive or a hard reset must not bring it back.
 * A browser that refuses storage simply shows it every time, which is the harmless way to
 * be wrong.
 */

import { Injectable, computed, inject, signal } from '@angular/core';

import { GAME_STORAGE } from './storage';

export const TUTORIAL_KEY = 'entropie.tutorial';

@Injectable({ providedIn: 'root' })
export class Onboarding {
  private readonly storage = inject(GAME_STORAGE);

  private readonly _seen = signal(this.read());

  /** True once the introduction has been read or skipped. */
  readonly seen = this._seen.asReadonly();

  /** What the interface asks: should the introduction be on screen right now? */
  readonly showIntroduction = computed(() => !this._seen());

  /** Called when the player closes it, whether they read it through or skipped. */
  markSeen(): void {
    this._seen.set(true);
    this.write('seen');
  }

  /** From the settings panel, for somebody who wants to read it again. */
  showAgain(): void {
    this._seen.set(false);
    this.write(null);
  }

  private read(): boolean {
    try {
      return this.storage?.getItem(TUTORIAL_KEY) === 'seen';
    } catch {
      return false;
    }
  }

  private write(value: string | null): void {
    try {
      if (value === null) {
        this.storage?.removeItem(TUTORIAL_KEY);
      } else {
        this.storage?.setItem(TUTORIAL_KEY, value);
      }
    } catch {
      // No memory of it this time; the introduction is cheap to show again.
    }
  }
}
