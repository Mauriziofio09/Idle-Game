/**
 * The clock.
 *
 * Time is always measured from timestamps, never by counting callbacks, because
 * browsers throttle background tabs. A hidden tab pauses the loop; on return the
 * elapsed time is caught up through the very same engine path the live loop uses,
 * so nothing can drift between playing and being away.
 *
 * Milestone 3 adds persistence and the "while you were away" summary on top of this.
 */

import { DestroyRef, Injectable, inject } from '@angular/core';

import { OFFLINE, TICK_MS } from '../engine/balance';
import { GameStore } from './game-store';

/** The most game time a single step forward may cover, however it was reached. */
const MAX_CATCH_UP_MS = OFFLINE.maxHours * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class GameLoop {
  private readonly store = inject(GameStore);
  private readonly destroyRef = inject(DestroyRef);

  private frame = 0;
  private lastFrame = 0;
  private accumulator = 0;
  /** Timestamp of the moment the tab went away. */
  private hiddenSince: number | null = null;
  private running = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.stop());
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.resume();
  }

  stop(): void {
    this.running = false;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.cancelFrame();
  }

  private resume(): void {
    // Opening the page in a background tab requests a frame that never fires. Without
    // cancelling it first, the switch back would start a second chain and lose the
    // handle to the first — an orphan that keeps ticking after stop() and onDestroy.
    this.cancelFrame();
    this.lastFrame = performance.now();
    this.accumulator = 0;
    this.frame = requestAnimationFrame(this.onFrame);
  }

  private cancelFrame(): void {
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }

  private readonly onFrame = (now: number): void => {
    // A machine waking from sleep, or a throttled background tab, can hand us an
    // enormous gap without ever firing visibilitychange. Clamp here too, or one frame
    // would try to simulate days at once. A clock that jumped backwards yields 0.
    const elapsed = Math.min(Math.max(0, now - this.lastFrame), MAX_CATCH_UP_MS);
    this.accumulator += elapsed;
    this.lastFrame = now;

    const ticks = Math.floor(this.accumulator / TICK_MS);
    if (ticks > 0) {
      this.accumulator -= ticks * TICK_MS;
      this.store.advance(ticks);
    }

    if (this.store.ended()) {
      this.cancelFrame();
      return;
    }
    this.frame = requestAnimationFrame(this.onFrame);
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.hiddenSince = Date.now();
      this.cancelFrame();
      return;
    }
    this.catchUp();
    if (!this.store.ended()) {
      this.resume();
    }
  };

  /** Simulates the time the tab was away, clamped to the offline window. */
  private catchUp(): void {
    const since = this.hiddenSince;
    this.hiddenSince = null;
    if (since === null) {
      return;
    }
    // A clock moved backwards must never rewind the archive.
    const elapsed = Math.max(0, Date.now() - since);
    const capped = Math.min(elapsed, MAX_CATCH_UP_MS);
    this.store.advance(Math.floor(capped / TICK_MS));
  }
}
