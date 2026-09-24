import { TestBed } from '@angular/core/testing';

import { App } from './app';
import { FLOOR_COUNT } from './engine/balance';
import { LOG } from './content/de';
import { GameStore } from './game/game-store';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('shows the archive and its seed', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('ENTROPIE');
    expect(element.textContent).toContain('Archiv #');
  });

  it('draws one selectable tab per floor', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const tabs = element.querySelectorAll('.floor-tab');
    expect(tabs.length).toBe(FLOOR_COUNT);
  });

  it('opens the log with the situation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const log = element.querySelector('[aria-live="polite"]');
    expect(log).toBeTruthy();
    expect(log?.textContent).toContain(LOG.opening[0]);
  });

  it('opens the detail panel when a system is picked, with its costs', async () => {
    const fixture = TestBed.createComponent(App);
    const store = TestBed.inject(GameStore);
    await fixture.whenStable();

    store.select({ kind: 'system', id: 'pumps' });
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const panel = element.querySelector('app-detail-panel');
    expect(panel?.textContent).toContain('Pumpen');
    expect(panel?.textContent).toContain('Material');
    expect(panel?.textContent).toContain('Entropie');
  });

  it('gives every bar a real value, a label, and a place in the accessibility tree', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const meters = Array.from(element.querySelectorAll('[role="meter"]'));
    expect(meters.length).toBeGreaterThan(0);

    for (const meter of meters) {
      const value = Number(meter.getAttribute('aria-valuenow'));
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);

      const label = meter.getAttribute('aria-label') ?? '';
      expect(label.length).toBeGreaterThan(0);
      expect(meter.getAttribute('aria-valuetext')).toMatch(/%/);

      // A button has presentational children: a meter nested inside one is stripped
      // from the accessibility tree together with its value.
      expect(meter.closest('button')).toBeNull();
    }
  });

  it('never signals a critical system by colour alone', async () => {
    const fixture = TestBed.createComponent(App);
    const store = TestBed.inject(GameStore);
    await fixture.whenStable();

    // Wear the pumps down until they are critical.
    while (!store.isCritical('pumps') && !store.state().systems.pumps.lost) {
      store.advance(60);
    }
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const chip = element.querySelector('.chip.critical, .chip.lost');
    expect(chip).toBeTruthy();
    expect(chip?.textContent).toMatch(/kritisch|VERLOREN/);
  });
});
