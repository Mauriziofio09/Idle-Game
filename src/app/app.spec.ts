import { TestBed } from '@angular/core/testing';

import { App } from './app';
import { SYSTEM_IDS } from './engine/state';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('shows the archive and its seed', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('ENTROPIE');
    expect(element.textContent).toContain('Archiv #4F2A');
  });

  it('renders one accessible meter per system', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const meters = element.querySelectorAll('[role="meter"]');
    expect(meters.length).toBe(SYSTEM_IDS.length);
    for (const meter of Array.from(meters)) {
      expect(meter.getAttribute('aria-valuenow')).toBeTruthy();
      expect(meter.getAttribute('aria-label')).toBeTruthy();
    }
  });
});
