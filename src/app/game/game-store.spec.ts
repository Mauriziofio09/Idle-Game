import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { LOG } from '../content/de';
import { OFFLINE, PROTOCOLS } from '../engine/balance';
import { simulate } from '../engine/offline';
import { createInitialState } from '../engine/state';
import { SaveService } from './save';
import { GAME_STORAGE, memoryStorage, type KeyValueStorage } from './storage';
import { GameStore } from './game-store';

describe('GameStore', () => {
  let store: GameStore;

  let storage: KeyValueStorage;

  beforeEach(() => {
    storage = memoryStorage();
    TestBed.configureTestingModule({
      providers: [{ provide: GAME_STORAGE, useValue: storage }],
    });
    store = TestBed.inject(GameStore);
  });

  it('opens with the three lines that explain the situation, newest first', () => {
    const texts = store.log().map((entry) => entry.text);
    expect(texts).toEqual([...LOG.opening].reverse());
  });

  it('starts on a seed a share link could carry', () => {
    expect(store.seed()).toMatch(/^[0-9A-F]{4}$/);
  });

  it('stops advancing once the archive falls silent mid-catch-up', () => {
    // Far more ticks than any archive survives: the store must stop at the ending
    // rather than keep stepping a finished run.
    store.advance(24 * 60 * 60);
    expect(store.state().ended).toBe(true);

    const atEnd = store.state();
    store.advance(600);
    expect(store.state()).toBe(atEnd);
  });

  it('routes a repair through the engine and writes one line', () => {
    const before = store.state().systems.pumps.integrity;
    const lines = store.log().length;

    expect(store.dispatch({ type: 'repair', systemId: 'pumps' })).toBe(true);

    expect(store.state().systems.pumps.integrity).toBeGreaterThan(before);
    expect(store.log().length).toBe(lines + 1);
    expect(store.log()[0].text).toContain('repariert');
  });

  it('refuses an action the engine rejects and leaves the log alone', () => {
    // Repairing the same system again and again exhausts material and energy;
    // the store must then refuse rather than push an impossible action through.
    let guard = 0;
    while (store.canApply({ type: 'repair', systemId: 'pumps' }) && guard++ < 50) {
      store.dispatch({ type: 'repair', systemId: 'pumps' });
    }
    expect(guard).toBeLessThan(50);
    expect(store.canApply({ type: 'repair', systemId: 'pumps' })).toBe(false);

    const stateBefore = store.state();
    const lines = store.log().length;

    expect(store.dispatch({ type: 'repair', systemId: 'pumps' })).toBe(false);
    expect(store.state()).toBe(stateBefore);
    expect(store.log().length).toBe(lines);
  });

  it('advances time through the engine', () => {
    store.advance(120);
    expect(store.state().tick).toBe(120);
    expect(store.state().entropy).toBeGreaterThan(0);
  });

  it('ignores a non-positive number of ticks', () => {
    const before = store.state();
    store.advance(0);
    store.advance(-5);
    expect(store.state()).toBe(before);
  });

  it('remembers what the player focused', () => {
    expect(store.selection()).toBeNull();
    store.select({ kind: 'system', id: 'generator' });
    expect(store.selection()).toEqual({ kind: 'system', id: 'generator' });
    store.select(null);
    expect(store.selection()).toBeNull();
  });

  it('knows what sits on each floor', () => {
    expect(store.systemsOnFloor(0)).toEqual(['pumps']);
    expect(store.collectionsOnFloor(0)).toEqual(['maps']);
    expect(store.systemsOnFloor(4)).toEqual(['roof', 'transmitter']);
  });

  it('reports the net energy rate the resource bar shows', () => {
    // Everything on: the generator cannot cover pumps, climate and the depot.
    expect(store.energyRate()).toBeLessThan(0);
    store.dispatch({ type: 'toggle', systemId: 'pumps', on: false });
    store.dispatch({ type: 'toggle', systemId: 'climate', on: false });
    store.dispatch({ type: 'toggle', systemId: 'custodian', on: false });
    expect(store.energyRate()).toBeGreaterThan(0);
  });

  it('keeps the log bounded during a long catch-up', () => {
    store.advance(24 * 60 * 60);
    expect(store.log().length).toBeLessThanOrEqual(120);
  });

  describe('starting up', () => {
    const NOW = 1_700_000_000_000;

    function storeSave(state = createInitialState('4F2A'), savedAt = NOW): void {
      TestBed.inject(SaveService).write(state, savedAt);
    }

    it('starts a fresh archive when there is nothing saved', () => {
      expect(store.initialize(NOW)).toBeNull();
      expect(store.state().tick).toBe(0);
    });

    it('restores a saved archive and simulates the time away', () => {
      const saved = simulate(createInitialState('4F2A'), 300).state;
      storeSave(saved);

      // A fresh store, as after a reload.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: GAME_STORAGE, useValue: storage }],
      });
      const reloaded = TestBed.inject(GameStore);

      const report = reloaded.initialize(NOW + 120_000);
      expect(report).not.toBeNull();
      expect(reloaded.state().seed).toBe('4F2A');
      expect(reloaded.state().tick).toBe(300 + 120);
      expect(report?.simulatedSeconds).toBe(120);
      expect(report?.absentSeconds).toBe(120);
      expect(report?.stasis).toBe(false);
    });

    it('catches up through the very same path the live loop uses', () => {
      const saved = simulate(createInitialState('4F2A'), 60).state;
      storeSave(saved);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: GAME_STORAGE, useValue: storage }],
      });
      const reloaded = TestBed.inject(GameStore);
      reloaded.initialize(NOW + 600_000);

      expect(reloaded.state()).toEqual(simulate(saved, 600).state);
    });

    it('treats a clock that moved backwards as no time at all', () => {
      const saved = simulate(createInitialState('4F2A'), 60).state;
      storeSave(saved, NOW);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: GAME_STORAGE, useValue: storage }],
      });
      const reloaded = TestBed.inject(GameStore);

      const report = reloaded.initialize(NOW - 60 * 60 * 1000);
      expect(report?.simulatedSeconds).toBe(0);
      expect(reloaded.state()).toEqual(saved);
    });

    it('holds the archive still beyond the offline window', () => {
      const saved = createInitialState('4F2A');
      storeSave(saved, NOW);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: GAME_STORAGE, useValue: storage }],
      });
      const reloaded = TestBed.inject(GameStore);

      const week = 7 * 24 * 60 * 60 * 1000;
      const report = reloaded.initialize(NOW + week);

      expect(report?.stasis).toBe(true);
      expect(report?.absentSeconds).toBe(week / 1000);
      // The run ends inside the window, so fewer ticks than the cap were simulated —
      // never more.
      expect(report?.simulatedSeconds).toBeLessThanOrEqual(OFFLINE.maxHours * 60 * 60);
      expect(reloaded.state().ended).toBe(true);
    });

    it('reports what was lost while the player was away', () => {
      storeSave(createInitialState('4F2A'), NOW);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: GAME_STORAGE, useValue: storage }],
      });
      const reloaded = TestBed.inject(GameStore);

      const report = reloaded.initialize(NOW + 60 * 60 * 1000);
      expect(report).not.toBeNull();
      expect(report?.endedWhileAway).toBe(true);
      expect(report?.water.after).toBeGreaterThan(report!.water.before);
      expect(report?.lostSystems.length).toBeGreaterThan(0);
    });

    it('starts a new archive without touching the legacy', () => {
      const saves = TestBed.inject(SaveService);
      saves.writeLegacy({ schemaVersion: 1, sent: { maps: 12 }, runs: 2 });
      store.advance(120);
      store.persist();

      const before = store.seed();
      store.startNewArchive();

      expect(store.state().tick).toBe(0);
      expect(store.seed()).not.toBe(before);
      expect(saves.readLegacy()).toMatchObject({ sent: { maps: 12 }, runs: 2 });
    });

    it('replaces the run on a good import and refuses a bad one', () => {
      const saves = TestBed.inject(SaveService);
      const other = simulate(createInitialState('9B01'), 90).state;

      expect(store.importRun(saves.exportRun(other, NOW))).toEqual({ ok: true });
      expect(store.state().seed).toBe('9B01');
      expect(store.state().tick).toBe(90);

      const refused = store.importRun('rubbish');
      expect(refused.ok).toBe(false);
      // A refused import leaves the running archive exactly where it was.
      expect(store.state().seed).toBe('9B01');
    });

    it('tells the player when both slots are unreadable, and keeps the wreckage', () => {
      storage.setItem('entropie.save', 'rubbish');
      storage.setItem('entropie.save.backup', 'also rubbish');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: GAME_STORAGE, useValue: storage }],
      });
      const reloaded = TestBed.inject(GameStore);

      expect(reloaded.initialize(NOW)).toBeNull();
      expect(reloaded.startupNotice()).toBe('broken');
      // The unreadable data is set aside rather than buried by the next autosave.
      expect(storage.getItem('entropie.save.broken')).toBe('rubbish');

      reloaded.dismissStartupNotice();
      expect(reloaded.startupNotice()).toBeNull();
    });

    it('says so when it had to fall back to the backup', () => {
      const first = createInitialState('4F2A');
      const saves = TestBed.inject(SaveService);
      saves.write(first, NOW);
      saves.write(simulate(first, 60).state, NOW);
      storage.setItem('entropie.save', 'rubbish');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: GAME_STORAGE, useValue: storage }],
      });
      const reloaded = TestBed.inject(GameStore);

      reloaded.initialize(NOW);
      expect(reloaded.startupNotice()).toBe('from-backup');
    });

    it('reports nothing simulated for an archive that was already silent', () => {
      // Play it to the end, save, and come back two days later.
      store.advance(24 * 60 * 60);
      expect(store.state().ended).toBe(true);
      store.persist();

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: GAME_STORAGE, useValue: storage }],
      });
      const reloaded = TestBed.inject(GameStore);

      const report = reloaded.initialize(NOW + 48 * 60 * 60 * 1000);
      // The absence is real, but nothing happened in it — the summary must not claim
      // two days in which "nothing was lost".
      expect(report?.simulatedSeconds).toBe(0);
      expect(report?.endedWhileAway).toBe(false);
    });
  });

  describe('protocol rules', () => {
    const condition = { kind: 'material-above', value: 10 } as const;
    const action = { type: 'repair', systemId: 'pumps' } as const;

    it('refuses a rule beyond the slots the archive has', () => {
      expect(store.protocolSlots()).toBe(PROTOCOLS.startingSlots);

      for (let i = 0; i < PROTOCOLS.startingSlots; i++) {
        expect(store.addProtocol(condition, action)).not.toBeNull();
      }
      expect(store.canAddProtocol()).toBe(false);
      expect(store.addProtocol(condition, action)).toBeNull();
      expect(store.protocols().length).toBe(PROTOCOLS.startingSlots);
    });

    it('never hands two live rules the same id', () => {
      const first = store.addProtocol(condition, action)!;
      const second = store.addProtocol(condition, action)!;
      expect(second.id).not.toBe(first.id);

      store.removeProtocol(first.id);
      // The freed id may be reused; a collision with a live rule must not happen.
      const third = store.addProtocol(condition, action)!;
      expect(third.id).not.toBe(second.id);
      expect(new Set(store.protocols().map((rule) => rule.id)).size).toBe(
        store.protocols().length,
      );
    });

    it('carries the counter with the rule when the order changes', () => {
      const first = store.addProtocol(condition, action)!;
      const second = store.addProtocol({ kind: 'energy-above', value: 5 }, action)!;
      store.updateProtocol(second.id, { firedCount: 12 });

      store.moveProtocol(second.id, -1);

      const rules = store.protocols();
      expect(rules[0].id).toBe(second.id);
      expect(rules[0].firedCount).toBe(12);
      expect(rules[1].id).toBe(first.id);
      expect(rules[1].firedCount).toBe(0);
    });

    it('ignores a move that would fall off either end', () => {
      const only = store.addProtocol(condition, action)!;
      store.moveProtocol(only.id, -1);
      store.moveProtocol(only.id, 1);
      expect(store.protocols().map((rule) => rule.id)).toEqual([only.id]);
    });

    it('keeps the counter across an edit', () => {
      const rule = store.addProtocol(condition, action)!;
      store.updateProtocol(rule.id, { firedCount: 5 });
      store.updateProtocol(rule.id, { condition: { kind: 'energy-below', value: 20 } });

      expect(store.protocols()[0].firedCount).toBe(5);
      expect(store.protocols()[0].condition).toEqual({ kind: 'energy-below', value: 20 });
    });

    it('clamps the material reserve into its range', () => {
      store.setMaterialReserve(-50);
      expect(store.materialReserve()).toBe(0);

      store.setMaterialReserve(10_000);
      expect(store.materialReserve()).toBe(PROTOCOLS.maxMaterialReserve);

      store.setMaterialReserve(30.7);
      expect(store.materialReserve()).toBe(31);
    });

    it('keeps rules and reserve across a save and reload', () => {
      const rule = store.addProtocol(condition, action)!;
      store.updateProtocol(rule.id, { firedCount: 3, enabled: false });
      store.setMaterialReserve(25);
      store.persist();

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: GAME_STORAGE, useValue: storage }],
      });
      const reloaded = TestBed.inject(GameStore);
      reloaded.initialize(1_700_000_000_000);

      expect(reloaded.materialReserve()).toBe(25);
      expect(reloaded.protocols()).toEqual([
        { id: rule.id, condition, action, enabled: false, firedCount: 3 },
      ]);
    });
  });
});
