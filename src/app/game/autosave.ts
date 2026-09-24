/**
 * When the archive is written down.
 *
 * On a timer while playing, and on every way a page can go away: `visibilitychange`
 * when it is hidden, and `pagehide`, which fires in cases `beforeunload` misses —
 * notably a tab discarded on a phone. `unload` is deliberately not used; it is
 * unreliable and blocks the back/forward cache.
 */

import { DestroyRef, Injectable, inject } from '@angular/core';

import { GameStore } from './game-store';

/** prompt.md section 9: autosave every 15 seconds. */
export const AUTOSAVE_INTERVAL_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class AutoSave {
  private readonly store = inject(GameStore);
  private readonly destroyRef = inject(DestroyRef);

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.stop());
  }

  start(): void {
    if (this.timer !== null) {
      return;
    }
    this.timer = setInterval(this.save, AUTOSAVE_INTERVAL_MS);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.save);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pagehide', this.save);
  }

  private readonly save = (): void => {
    // The store decides which moment the save is stamped with — a hidden tab is
    // frozen, and stamping it with the current clock would erase the time away.
    this.store.persist();
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.save();
    }
  };
}
