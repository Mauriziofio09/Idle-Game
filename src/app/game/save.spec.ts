import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { simulate } from '../engine/offline';
import { createInitialState } from '../engine/state';
import { BACKUP_KEY, LEGACY_KEY, SAVE_KEY, SaveService } from './save';
import { GAME_STORAGE, memoryStorage, type KeyValueStorage } from './storage';

describe('SaveService', () => {
  let saves: SaveService;
  let storage: KeyValueStorage;

  beforeEach(() => {
    storage = memoryStorage();
    TestBed.configureTestingModule({
      providers: [{ provide: GAME_STORAGE, useValue: storage }],
    });
    saves = TestBed.inject(SaveService);
  });

  it('writes a run and reads it back unchanged', () => {
    const state = simulate(createInitialState('4F2A'), 120).state;
    saves.write(state, 1_700_000_000_000);

    const outcome = saves.load();
    expect(outcome.kind).toBe('loaded');
    if (outcome.kind !== 'loaded') return;
    expect(outcome.save.file.state).toEqual(state);
    expect(outcome.save.file.savedAt).toBe(1_700_000_000_000);
    expect(outcome.save.fromBackup).toBe(false);
  });

  it('reports an empty storage as empty, not as broken', () => {
    expect(saves.load().kind).toBe('empty');
  });

  it('falls back to the backup when the current slot is corrupt', () => {
    const first = createInitialState('4F2A');
    saves.write(first, 1000);
    // A second write rotates the first, readable save into the backup slot.
    saves.write(simulate(first, 60).state, 2000);

    storage.setItem(SAVE_KEY, '{"schemaVersion":1,"state":{"seed"');

    const outcome = saves.load();
    expect(outcome.kind).toBe('loaded');
    if (outcome.kind !== 'loaded') return;
    expect(outcome.save.fromBackup).toBe(true);
    expect(outcome.save.file.state.seed).toBe('4F2A');
  });

  it('never rotates an unreadable save into the backup slot', () => {
    saves.write(createInitialState('4F2A'), 1000);
    const goodBackupSource = storage.getItem(SAVE_KEY);

    // Corrupt the current slot, then write again: the corrupt one must not become
    // the backup, or a single bad write would destroy both slots.
    storage.setItem(SAVE_KEY, 'rubbish');
    saves.write(createInitialState('9B01'), 2000);

    expect(storage.getItem(BACKUP_KEY)).not.toBe('rubbish');
    expect(storage.getItem(BACKUP_KEY)).not.toBe(goodBackupSource);
  });

  it('says so when both slots are beyond saving', () => {
    storage.setItem(SAVE_KEY, 'rubbish');
    storage.setItem(BACKUP_KEY, 'also rubbish');
    expect(saves.load()).toMatchObject({ kind: 'broken' });
  });

  it('keeps the legacy when a run is cleared', () => {
    saves.write(createInitialState('4F2A'), 1000);
    saves.writeLegacy({ schemaVersion: 1, sent: { maps: 42 }, runs: 3 });

    saves.clearRun();

    expect(saves.load().kind).toBe('empty');
    expect(saves.readLegacy()).toMatchObject({ sent: { maps: 42 }, runs: 3 });
  });

  it('survives a damaged legacy without taking the run with it', () => {
    storage.setItem(LEGACY_KEY, '{oh no');
    expect(() => saves.readLegacy()).not.toThrow();
    expect(saves.readLegacy()).toMatchObject({ sent: {}, runs: 0 });

    storage.setItem(LEGACY_KEY, JSON.stringify({ sent: { maps: 'lots' }, runs: -1 }));
    expect(saves.readLegacy()).toMatchObject({ sent: {}, runs: 0 });
  });

  it('exports a run that imports back into the same state', () => {
    const state = simulate(createInitialState('4F2A'), 200).state;
    const text = saves.exportRun(state, 5000);

    const result = saves.importRun(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.state).toEqual(state);
    }
  });

  it('refuses an import it cannot trust, with a reason', () => {
    const result = saves.importRun('definitely not a save');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toBeTruthy();
    }
  });

  it('runs unsaved, without complaint, when the browser refuses storage', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: GAME_STORAGE, useValue: null }],
    });
    const offline = TestBed.inject(SaveService);

    expect(offline.available).toBe(false);
    expect(() => offline.write(createInitialState('4F2A'), 1000)).not.toThrow();
    expect(offline.load().kind).toBe('empty');
    // Export still works: it is the player's way out of a browser that cannot save.
    expect(offline.exportRun(createInitialState('4F2A'), 1000).length).toBeGreaterThan(0);
  });

  it('survives a storage that throws on every call', () => {
    const hostile: KeyValueStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: GAME_STORAGE, useValue: hostile }] });
    const fragile = TestBed.inject(SaveService);

    expect(() => fragile.write(createInitialState('4F2A'), 1000)).not.toThrow();
    expect(() => fragile.clearRun()).not.toThrow();
    expect(fragile.load().kind).toBe('empty');
    expect(fragile.readLegacy()).toMatchObject({ sent: {}, runs: 0 });
  });
});
