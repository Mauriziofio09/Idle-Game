import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OFFLINE, TICK_MS } from '../engine/balance';
import { FRAME_SCHEDULER, manualFrameScheduler } from './frame-scheduler';
import { GameLoop } from './game-loop';
import { GameStore } from './game-store';
import { GAME_STORAGE, memoryStorage } from './storage';

/**
 * The loop is the one place that touches wall-clock time, so it is also the one place
 * where a sleeping laptop, a throttled tab or a user-adjusted clock can wreck a run.
 * These tests drive the frames by hand instead of waiting for real ones.
 */
describe('GameLoop', () => {
  /**
   * The loop's own scheduler. Driving it directly keeps Angular's zoneless change
   * detection — which also schedules animation frames — out of these measurements.
   */
  let scheduler: ReturnType<typeof manualFrameScheduler>;
  let clock: number;
  let loop: GameLoop;
  let store: GameStore;

  /** Runs every pending frame callback with the given timestamp. */
  function frameAt(now: number): void {
    scheduler.run(now);
  }

  function setHidden(hidden: boolean): void {
    Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    scheduler = manualFrameScheduler();
    clock = 0;

    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.spyOn(Date, 'now').mockImplementation(() => clock);

    TestBed.configureTestingModule({
      providers: [
        { provide: FRAME_SCHEDULER, useValue: scheduler },
        { provide: GAME_STORAGE, useValue: memoryStorage() },
      ],
    });
    store = TestBed.inject(GameStore);
    loop = TestBed.inject(GameLoop);
  });

  afterEach(() => {
    loop.stop();
    setHidden(false);
    vi.restoreAllMocks();
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
    expect(scheduler.pending.size).toBe(1);

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
    expect(scheduler.pending.size).toBe(0);

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
    expect(scheduler.pending.size).toBe(1);

    // Switching to the tab must not leave the first, never-fired frame behind.
    clock = 5000;
    setHidden(false);
    expect(scheduler.pending.size).toBe(1);

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

    expect(scheduler.pending.size).toBe(0);
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

  it('stamps a save with the frozen time, not the clock, while the tab is away', () => {
    loop.start();
    frameAt(30 * TICK_MS);
    expect(store.state().tick).toBe(30);

    // Hidden at 30 s in, and the tab is not closed until eight hours later.
    clock = 30 * TICK_MS;
    setHidden(true);
    clock = 30 * TICK_MS + 8 * 60 * 60 * 1000;
    store.persist();

    // The save must say it is current as of the moment the simulation froze. Stamping
    // it with the wall clock would declare those eight hours as already simulated and
    // erase them — the archive would come back exactly as it was left.
    const shared = TestBed.inject(GAME_STORAGE);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: GAME_STORAGE, useValue: shared }] });
    const reloaded = TestBed.inject(GameStore);

    const report = reloaded.initialize(clock);
    expect(report).not.toBeNull();
    expect(report!.absentSeconds).toBeGreaterThan(7 * 60 * 60);
    expect(reloaded.state().tick).toBeGreaterThan(30);
  });

  it('starts ticking again for an archive that replaces a finished one', () => {
    loop.start();

    // Run it into the ground.
    frameAt(OFFLINE.maxHours * 60 * 60 * 1000);
    expect(store.ended()).toBe(true);
    expect(scheduler.pending.size).toBe(0);

    store.startNewArchive(clock);
    TestBed.tick();

    // Without this the clock would sit at zero until the player happened to switch tabs.
    expect(scheduler.pending.size).toBe(1);
    const before = store.state().tick;
    frameAt(clock + 5 * TICK_MS);
    expect(store.state().tick).toBeGreaterThan(before);
  });
});
