import { TestBed } from '@angular/core/testing';

import { LOG } from '../content/de';
import { GameStore } from './game-store';

describe('GameStore', () => {
  let store: GameStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
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
});
