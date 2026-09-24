import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTOSAVE_INTERVAL_MS, AutoSave } from './autosave';
import { GameStore } from './game-store';
import { GAME_STORAGE, memoryStorage } from './storage';

describe('AutoSave', () => {
  let autoSave: AutoSave;
  let store: GameStore;
  let persist: ReturnType<typeof vi.spyOn>;

  function setHidden(hidden: boolean): void {
    Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [{ provide: GAME_STORAGE, useValue: memoryStorage() }],
    });
    store = TestBed.inject(GameStore);
    autoSave = TestBed.inject(AutoSave);
    persist = vi.spyOn(store, 'persist');
  });

  afterEach(() => {
    autoSave.stop();
    setHidden(false);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('writes on the interval prompt.md asks for', () => {
    autoSave.start();
    expect(persist).not.toHaveBeenCalled();

    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS);
    expect(persist).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS * 3);
    expect(persist).toHaveBeenCalledTimes(4);
  });

  it('writes the moment the tab goes away', () => {
    autoSave.start();
    setHidden(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('does not write just because the tab came back', () => {
    autoSave.start();
    setHidden(true);
    persist.mockClear();
    setHidden(false);
    expect(persist).not.toHaveBeenCalled();
  });

  it('writes on pagehide, which fires where beforeunload does not', () => {
    autoSave.start();
    window.dispatchEvent(new Event('pagehide'));
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('starts only once', () => {
    autoSave.start();
    autoSave.start();
    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('lets go of its timer and listeners when stopped', () => {
    autoSave.start();
    autoSave.stop();

    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS * 5);
    setHidden(true);
    window.dispatchEvent(new Event('pagehide'));

    expect(persist).not.toHaveBeenCalled();
  });

  it('leaves a save a later session can actually pick up', () => {
    autoSave.start();
    store.advance(90);
    const seed = store.seed();

    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS);
    expect(persist).toHaveBeenCalled();

    // A fresh session against the same storage, as after a reload.
    const shared = TestBed.inject(GAME_STORAGE);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: GAME_STORAGE, useValue: shared }] });
    const reloaded = TestBed.inject(GameStore);

    const report = reloaded.initialize(Date.now());
    expect(report).not.toBeNull();
    expect(reloaded.seed()).toBe(seed);
    expect(reloaded.state().tick).toBeGreaterThanOrEqual(90);
  });
});
