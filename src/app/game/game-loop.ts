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

import { DestroyRef, Injectable, effect, inject } from '@angular/core';

import { OFFLINE, TICK_MS } from '../engine/balance';
import { FRAME_SCHEDULER } from './frame-scheduler';
import { GameStore } from './game-store';

/** The most game time a single step forward may cover, however it was reached. */
const MAX_CATCH_UP_MS = OFFLINE.maxHours * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class GameLoop {
  private readonly store = inject(GameStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly frames = inject(FRAME_SCHEDULER);

  private frame = 0;
  private lastFrame = 0;
  private accumulator = 0;
  /** Timestamp of the moment the tab went away. */
  private hiddenSince: number | null = null;
  private running = false;
  /** True while the chain is stopped only because the archive fell silent. */
  private pausedByEnding = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.stop());

    // The chain stops when the archive falls silent. A new or imported archive is
    // alive again, and nothing else would ever ask for another frame — the clock
    // would sit at zero until the player happened to switch tabs.
    effect(() => {
      const ended = this.store.ended();
      if (!ended && this.running && this.pausedByEnding && !document.hidden) {
        this.pausedByEnding = false;
        this.resume();
      }
    });
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.pausedByEnding = false;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.resume();
  }

  stop(): void {
    this.running = false;
    this.pausedByEnding = false;
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
    this.frame = this.frames.request(this.onFrame);
  }

  private cancelFrame(): void {
    if (this.frame) {
      this.frames.cancel(this.frame);
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
      this.pausedByEnding = true;
      this.cancelFrame();
      return;
    }
    this.frame = this.frames.request(this.onFrame);
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
