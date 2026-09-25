import { TestBed } from '@angular/core/testing';

import { App } from './app';
import { FLOOR_COUNT, REVEAL, UI_THRESHOLDS } from './engine/balance';
import {
  LOG,
  PANEL_TABS_LABEL,
  RESOURCE_LABELS,
  STATE_LABELS,
  SYSTEM_NAMES,
} from './content/de';
import { GameStore } from './game/game-store';
import { Sound } from './game/sound';

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

  describe('the panel strip', () => {
    it('gives every panel a tab, and marks exactly one of them open', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;

      const tabs = [...element.querySelectorAll('[role="tab"]')];
      const panels = [...element.querySelectorAll('[role="tabpanel"]')];
      expect(tabs.length).toBe(panels.length);
      expect(tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true')).toHaveLength(1);

      // Every tab points at a panel that is really there, and names it back.
      for (const tab of tabs) {
        const id = tab.getAttribute('aria-controls');
        const panel = element.querySelector(`#${id}`);
        expect(panel).toBeTruthy();
        expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id);
      }
    });

    it('holds the protocols tab back until the first repair, like the panel', async () => {
      const fixture = TestBed.createComponent(App);
      const store = TestBed.inject(GameStore);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;

      expect(element.querySelector('#tab-protocols')).toBeNull();

      store.dispatch({ type: 'repair', systemId: 'generator' });
      await fixture.whenStable();
      expect(element.querySelector('#tab-protocols')).toBeTruthy();
    });

    it('keeps exactly one tab reachable by Tab, as the tab pattern asks', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;

      const reachable = [...element.querySelectorAll('[role="tab"]')].filter(
        (tab) => tab.getAttribute('tabindex') === '0',
      );
      expect(reachable).toHaveLength(1);
      expect(reachable[0].getAttribute('aria-selected')).toBe('true');
    });

    it('opens the panel that can act on whatever was picked in the building', async () => {
      const fixture = TestBed.createComponent(App);
      const store = TestBed.inject(GameStore);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;

      // Walk away from the selection panel first, then pick something in the house.
      const otherTab = element.querySelector<HTMLButtonElement>('#tab-settings');
      otherTab?.click();
      await fixture.whenStable();
      expect(otherTab?.getAttribute('aria-selected')).toBe('true');

      store.select({ kind: 'system', id: 'pumps' });
      await fixture.whenStable();
      expect(element.querySelector('#tab-detail')?.getAttribute('aria-selected')).toBe('true');
    });

    it('keeps the archive log out of the strip and on the screen', async () => {
      // The log is what the archive is telling you while you play. Putting it behind a
      // tab would mean choosing between acting and hearing what the action did, so it
      // sits below the strip at every width and has no tab of its own.
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;

      expect(element.querySelector('#tab-log')).toBeNull();
      const log = element.querySelector('[role="log"]');
      expect(log).toBeTruthy();
      expect(element.querySelector('.log')?.contains(log!)).toBe(true);

      // And it stays there whichever panel is open.
      element.querySelector<HTMLButtonElement>('#tab-settings')?.click();
      await fixture.whenStable();
      expect(element.querySelector('[role="log"]')).toBeTruthy();
    });

    it('is a real tab strip, named, and in the order the game is played in', async () => {
      const fixture = TestBed.createComponent(App);
      const store = TestBed.inject(GameStore);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;

      const strip = element.querySelector('[role="tablist"]');
      expect(strip).toBeTruthy();
      expect(strip?.getAttribute('aria-label')).toBe(PANEL_TABS_LABEL);

      // The selection panel comes first because it is the one that acts on the building;
      // settings last because it is the one nobody needs mid-run.
      store.dispatch({ type: 'repair', systemId: 'generator' });
      await fixture.whenStable();
      expect([...element.querySelectorAll('[role="tab"]')].map((tab) => tab.id)).toEqual([
        'tab-detail',
        'tab-protocols',
        'tab-legacy',
        'tab-scenarios',
        'tab-settings',
      ]);
    });

    it('jumps to the ends of the strip with Home and End', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const tabs = [...element.querySelectorAll<HTMLButtonElement>('[role="tab"]')];

      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      await fixture.whenStable();
      expect(tabs[tabs.length - 1].getAttribute('aria-selected')).toBe('true');

      tabs[tabs.length - 1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      await fixture.whenStable();
      expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    });

    it('walks the strip with the arrow keys', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;

      const tabs = [...element.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await fixture.whenStable();
      expect(tabs[1].getAttribute('aria-selected')).toBe('true');

      // And it wraps round the end rather than stopping dead.
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      await fixture.whenStable();
      expect(tabs[tabs.length - 1].getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('sound', () => {
    /** Counts what the app asks to be played, without a sound card in sight. */
    function countingSound() {
      const cues: string[] = [];
      return { cues, stub: { enabled: () => false, cue: (kind: string) => cues.push(kind) } };
    }

    it('plays one tone for one new line, and stays silent through a catch-up', async () => {
      const sound = countingSound();
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [App],
        providers: [{ provide: Sound, useValue: sound.stub }],
      }).compileComponents();

      const fixture = TestBed.createComponent(App);
      const store = TestBed.inject(GameStore);
      await fixture.whenStable();

      // The three opening lines arrive together and must not be announced one by one.
      sound.cues.length = 0;

      store.dispatch({ type: 'repair', systemId: 'generator' });
      await fixture.whenStable();
      expect(sound.cues).toHaveLength(1);

      // An hour away lands dozens of lines at once: the summary explains that, not tones.
      sound.cues.length = 0;
      store.advance(60 * 60);
      await fixture.whenStable();
      expect(sound.cues).toHaveLength(0);
    });
  });

  /**
   * Starting a new archive removes whatever the keyboard was standing on. This project
   * shipped that bug in five milestones running, so each way of reaching it gets its own
   * case here rather than one that happens to pass.
   *
   * Note what these do NOT assert: that focus lands back on the same kind of control. The
   * earlier attempt asserted exactly that for the tab strip and passed only because jsdom
   * lets you focus an element inside `display: none`, which a real browser does not — and
   * the strip is hidden on a desktop. The page title is the one thing that outlives every
   * archive, so it is the only honest place to check.
   */
  describe('keyboard focus when the archive is replaced', () => {
    async function focusSurvives(
      prepare: (
        element: HTMLElement,
        store: GameStore,
        settle: () => Promise<void>,
      ) => Promise<HTMLElement | null | undefined>,
    ) {
      const fixture = TestBed.createComponent(App);
      const store = TestBed.inject(GameStore);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;

      const target = await prepare(element, store, async () => {
        await fixture.whenStable();
      });
      expect(target).toBeTruthy();
      target?.focus();
      expect(document.activeElement).toBe(target);

      store.startNewArchive();
      await fixture.whenStable();

      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement).toBe(element.querySelector('h1'));
    }

    it('survives losing the protocols tab', async () => {
      await focusSurvives(async (element, store, settle) => {
        store.dispatch({ type: 'repair', systemId: 'generator' });
        await settle();
        return element.querySelector<HTMLElement>('#tab-protocols');
      });
    });

    it('survives losing a control inside a panel that goes away', async () => {
      // How a desktop player reaches it: the strip is invisible above the phone
      // breakpoint, so the focus is inside the panel, never on its tab.
      await focusSurvives(async (element, store, settle) => {
        store.dispatch({ type: 'repair', systemId: 'generator' });
        await settle();
        return element.querySelector<HTMLElement>('#panel-protocols button');
      });
    });

    it('survives losing the mast, which is hidden again in a fresh archive', async () => {
      await focusSurvives(async (element, store, settle) => {
        store.advance(REVEAL.transmitterTicks + 80);
        await settle();
        return [...element.querySelectorAll<HTMLElement>('.chip .chip-select')].find((chip) =>
          chip.textContent?.includes('Sendemast'),
        );
      });
    });

    it('leaves focus alone when the control the player is on survives', async () => {
      const fixture = TestBed.createComponent(App);
      const store = TestBed.inject(GameStore);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;

      // The settings panel outlives a restart, and so does its button. Pulling focus to
      // the title here would be the guard overreaching.
      const survivor = element.querySelector<HTMLElement>('#panel-settings button');
      survivor?.focus();
      store.startNewArchive();
      await fixture.whenStable();

      expect(document.activeElement).toBe(survivor);
    });
  });

  /**
   * That the store knows something is not the same as the player seeing it. A review of
   * this milestone found every one of these could be switched off in the template without
   * a single test failing — the whole visible half of the polish was unguarded.
   */
  describe('what actually reaches the screen', () => {
    async function render() {
      const fixture = TestBed.createComponent(App);
      const store = TestBed.inject(GameStore);
      await fixture.whenStable();
      return {
        fixture,
        store,
        element: fixture.nativeElement as HTMLElement,
        settle: () => fixture.whenStable(),
      };
    }

    function chipNamed(element: HTMLElement, name: string): HTMLElement | undefined {
      return [...element.querySelectorAll<HTMLElement>('.chip')].find((chip) =>
        chip.querySelector('.chip-name')?.textContent?.includes(name),
      );
    }

    it('keeps the entropy readout off the bar until the first repair', async () => {
      const { element, store, settle } = await render();
      const bar = element.querySelector('app-resource-bar');
      expect(bar?.textContent).not.toContain(RESOURCE_LABELS.entropy);

      store.dispatch({ type: 'repair', systemId: 'generator' });
      await settle();
      expect(bar?.textContent).toContain(RESOURCE_LABELS.entropy);
    });

    it('keeps the mast out of the building until it answers', async () => {
      const { element, store, settle } = await render();
      expect(chipNamed(element, SYSTEM_NAMES.transmitter)).toBeUndefined();

      store.advance(REVEAL.transmitterTicks);
      await settle();
      expect(chipNamed(element, SYSTEM_NAMES.transmitter)).toBeTruthy();
    });

    it('names the first sensible action in words and marks the thing it means', async () => {
      const { element, store } = await render();
      const suggestion = store.suggestion();
      expect(suggestion?.kind).toBe('system');
      if (suggestion === null || suggestion.kind !== 'system') return;

      const hint = element.querySelector('app-cross-section .hint');
      expect(hint?.textContent).toContain(SYSTEM_NAMES[suggestion.id]);

      const chip = chipNamed(element, SYSTEM_NAMES[suggestion.id]);
      expect(chip?.classList.contains('suggested')).toBe(true);
      // Never the accent alone: the word has to be there too.
      expect(chip?.textContent).toContain(STATE_LABELS.suggested);
    });

    it('takes the hint away once the advice has been followed', async () => {
      const { element, store, settle } = await render();
      store.dispatch({ type: 'repair', systemId: 'generator' });
      await settle();
      expect(element.querySelector('app-cross-section .hint')).toBeNull();
    });

    it('answers an action on the thing that was acted on', async () => {
      const { element, store, settle } = await render();
      expect(chipNamed(element, SYSTEM_NAMES.generator)?.classList.contains('pulsing')).toBe(false);

      store.dispatch({ type: 'repair', systemId: 'generator' });
      await settle();
      expect(chipNamed(element, SYSTEM_NAMES.generator)?.classList.contains('pulsing')).toBe(true);
      // Only that one thing.
      expect(chipNamed(element, SYSTEM_NAMES.pumps)?.classList.contains('pulsing')).toBe(false);
    });

    it('gives something just lost its moment, in words as well as in the mark', async () => {
      const { element, store, settle } = await render();

      let lost: string | undefined;
      for (let i = 0; i < 60 * 60 && lost === undefined; i += 1) {
        store.advance(1);
        lost = store.state().chronicle.find((entry) => entry.kind === 'system-lost')?.id;
      }
      expect(lost).toBeDefined();
      if (lost === undefined) return;
      await settle();

      const chip = chipNamed(element, SYSTEM_NAMES[lost as keyof typeof SYSTEM_NAMES]);
      expect(chip?.classList.contains('just-lost')).toBe(true);
      expect(chip?.textContent).toContain(STATE_LABELS.justLost);

      // And then it settles into being simply gone.
      store.advance(UI_THRESHOLDS.lossMomentTicks + 1);
      await settle();
      const settled = chipNamed(element, SYSTEM_NAMES[lost as keyof typeof SYSTEM_NAMES]);
      expect(settled?.classList.contains('just-lost')).toBe(false);
      expect(settled?.textContent).toContain(STATE_LABELS.lost);
    });
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
