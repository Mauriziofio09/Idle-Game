import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OFFLINE, TICK_MS } from '../engine/balance';
import { GameLoop } from './game-loop';
import { GameStore } from './game-store';

/**
 * The loop is the one place that touches wall-clock time, so it is also the one place
 * where a sleeping laptop, a throttled tab or a user-adjusted clock can wreck a run.
 * These tests drive the frames by hand instead of waiting for real ones.
 */
describe('GameLoop', () => {
  /** Pending frames by handle. A cancelled frame really disappears, as in a browser. */
  let frames: Map<number, FrameRequestCallback>;
  let nextHandle: number;
  let clock: number;
  let loop: GameLoop;
  let store: GameStore;

  /** Runs every pending frame callback with the given timestamp. */
  function frameAt(now: number): void {
    const pending = [...frames.entries()];
    frames.clear();
    for (const [, callback] of pending) {
      callback(now);
    }
  }

  function setHidden(hidden: boolean): void {
    Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    frames = new Map();
    nextHandle = 0;
    clock = 0;

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const handle = ++nextHandle;
      frames.set(handle, callback);
      return handle;
    });
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
      frames.delete(handle);
    });
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.spyOn(Date, 'now').mockImplementation(() => clock);

    TestBed.configureTestingModule({});
    store = TestBed.inject(GameStore);
    loop = TestBed.inject(GameLoop);
  });

  afterEach(() => {
    loop.stop();
    setHidden(false);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('measures time from timestamps, not from how often it was called', () => {
    loop.start();

    // One single frame five seconds later must be worth five ticks, not one.
    frameAt(5 * TICK_MS);
    expect(store.state().tick).toBe(5);

    // Three frames inside one tick are worth nothing yet.
    frameAt(5 * TICK_MS + 100);
    frameAt(5 * TICK_MS + 200);
    frameAt(5 * TICK_MS + 300);
    expect(store.state().tick).toBe(5);

    // The leftover milliseconds are kept, not thrown away.
    frameAt(6 * TICK_MS);
    expect(store.state().tick).toBe(6);
  });

  it('starts only once, however often it is asked', () => {
    loop.start();
    loop.start();
    loop.start();
    expect(frames.size).toBe(1);

    frameAt(TICK_MS);
    expect(store.state().tick).toBe(1);
  });

  it('pauses while the tab is away and catches the time up on return', () => {
    loop.start();
    frameAt(TICK_MS);
    expect(store.state().tick).toBe(1);

    clock = 10_000;
    setHidden(true);
    // A paused loop holds no pending frame at all.
    expect(frames.size).toBe(0);

    // No frames arrive while hidden, so nothing advances on its own.
    const whileAway = store.state().tick;
    expect(whileAway).toBe(1);

    // Two minutes later the tab comes back.
    clock = 10_000 + 120_000;
    setHidden(false);
    expect(store.state().tick).toBe(1 + 120);
  });

  it('never rewinds the archive when the system clock jumps backwards', () => {
    loop.start();
    frameAt(TICK_MS);

    clock = 50_000;
    setHidden(true);
    clock = 10_000; // the user moved the clock back an hour
    setHidden(false);

    expect(store.state().tick).toBe(1);
  });

  // These two assert on how many ticks the loop *asks* for. Asserting on the resulting
  // state would prove nothing: the archive falls silent after a few hundred ticks either
  // way, so an unclamped week would look identical from the outside.
  it('clamps an absence to the offline window', () => {
    const advance = vi.spyOn(store, 'advance');
    loop.start();
    clock = 1000;
    setHidden(true);

    // Away for a week.
    clock = 1000 + 7 * 24 * 60 * 60 * 1000;
    setHidden(false);

    const requested = advance.mock.calls.map((call) => call[0]);
    expect(Math.max(...requested)).toBe(OFFLINE.maxHours * 60 * 60);
  });

  it('clamps a huge frame gap too, for a machine waking from sleep', () => {
    const advance = vi.spyOn(store, 'advance');
    loop.start();
    // No visibilitychange fires on resume from sleep; the gap arrives as one frame.
    frameAt(7 * 24 * 60 * 60 * 1000);

    const requested = advance.mock.calls.map((call) => call[0]);
    expect(Math.max(...requested)).toBe(OFFLINE.maxHours * 60 * 60);
  });

  it('keeps a single frame chain when the page opened in a background tab', () => {
    // The tab is already hidden when the component starts the loop.
    setHidden(true);
    loop.start();
    expect(frames.size).toBe(1);

    // Switching to the tab must not leave the first, never-fired frame behind.
    clock = 5000;
    setHidden(false);
    expect(frames.size).toBe(1);

    // And after stopping, nothing may advance the archive any more.
    loop.stop();
    const settled = store.state().tick;
    frameAt(60 * TICK_MS);
    expect(store.state().tick).toBe(settled);
  });

  it('stops asking for frames once the archive falls silent', () => {
    loop.start();
    frameAt(OFFLINE.maxHours * 60 * 60 * 1000);
    expect(store.state().ended).toBe(true);

    expect(frames.size).toBe(0);
  });

  it('lets go of the document listener when stopped', () => {
    loop.start();
    loop.stop();

    const before = store.state().tick;
    clock = 60_000;
    setHidden(true);
    setHidden(false);
    expect(store.state().tick).toBe(before);
  });
});
