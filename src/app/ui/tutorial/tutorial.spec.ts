import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { App } from '../../app';
import { TUTORIAL } from '../../content/de';
import { Onboarding, TUTORIAL_KEY } from '../../game/onboarding';
import { GAME_STORAGE, memoryStorage, type KeyValueStorage } from '../../game/storage';

/**
 * The introduction is a departure from prompt.md section 7 ("kein Tutorial-Modal"), made
 * on request and recorded in PLAN.md section 9. What the spec was guarding against —
 * something standing between a player and the game — is what these tests hold: it appears
 * once, it can always be left, and it never traps anybody.
 */
describe('the introduction', () => {
  let storage: KeyValueStorage;

  beforeEach(async () => {
    storage = memoryStorage();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: GAME_STORAGE, useValue: storage }],
    }).compileComponents();
  });

  async function open() {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      element,
      dialog: () => element.querySelector('[role="dialog"]'),
      heading: () => element.querySelector('#tutorial-heading')?.textContent?.trim(),
      buttons: () => [...element.querySelectorAll<HTMLButtonElement>('app-button button')],
      press: (key: string) => {
        element
          .querySelector('[role="dialog"]')
          ?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        return fixture.whenStable();
      },
      settle: () => fixture.whenStable(),
    };
  }

  it('greets a newcomer, and is a real dialog while it does', async () => {
    const ui = await open();
    expect(ui.dialog()).toBeTruthy();
    expect(ui.dialog()?.getAttribute('aria-modal')).toBe('true');
    expect(ui.dialog()?.getAttribute('aria-labelledby')).toBe('tutorial-heading');
    expect(ui.heading()).toBe(TUTORIAL.steps[0].heading);
  });

  it('pages forward and back, and offers no way back from the first step', async () => {
    const ui = await open();
    expect(ui.buttons()[0].disabled).toBe(true);

    await ui.press('ArrowRight');
    expect(ui.heading()).toBe(TUTORIAL.steps[1].heading);
    expect(ui.buttons()[0].disabled).toBe(false);

    await ui.press('ArrowLeft');
    expect(ui.heading()).toBe(TUTORIAL.steps[0].heading);
  });

  it('calls the last step what it is, and lets go when it is pressed', async () => {
    const ui = await open();
    for (let i = 0; i < TUTORIAL.steps.length - 1; i += 1) {
      await ui.press('ArrowRight');
    }
    expect(ui.heading()).toBe(TUTORIAL.steps[TUTORIAL.steps.length - 1].heading);
    expect(ui.buttons()[1].textContent?.trim()).toBe(TUTORIAL.start);

    ui.buttons()[1].click();
    await ui.settle();
    expect(ui.dialog()).toBeNull();
  });

  it('can be left at any step, with Escape or with the skip', async () => {
    const ui = await open();
    await ui.press('ArrowRight');
    await ui.press('Escape');
    expect(ui.dialog()).toBeNull();

    // And the skip does the same from the very first step.
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: GAME_STORAGE, useValue: memoryStorage() }],
    }).compileComponents();
    const second = await open();
    second.element.querySelector<HTMLButtonElement>('.skip')?.click();
    await second.settle();
    expect(second.dialog()).toBeNull();
  });

  it('does not come back once it has been seen', async () => {
    const ui = await open();
    ui.element.querySelector<HTMLButtonElement>('.skip')?.click();
    await ui.settle();
    expect(storage.getItem(TUTORIAL_KEY)).toBe('seen');

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: GAME_STORAGE, useValue: storage }],
    }).compileComponents();
    const again = await open();
    expect(again.dialog()).toBeNull();
  });

  it('gives the keyboard back to the page instead of dropping it', async () => {
    const ui = await open();
    ui.element.querySelector<HTMLButtonElement>('.skip')?.click();
    await ui.settle();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(ui.element.querySelector('h1'));
  });

  it('comes back when somebody asks for it again', async () => {
    const ui = await open();
    ui.element.querySelector<HTMLButtonElement>('.skip')?.click();
    await ui.settle();
    expect(ui.dialog()).toBeNull();

    TestBed.inject(Onboarding).showAgain();
    await ui.settle();
    expect(ui.dialog()).toBeTruthy();
    expect(storage.getItem(TUTORIAL_KEY)).toBeNull();
  });
});
