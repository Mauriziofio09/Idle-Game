import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { IMPORT_PROBLEMS, SETTINGS_LABELS, TUTORIAL } from '../../content/de';
import { GameStore } from '../../game/game-store';
import { Onboarding } from '../../game/onboarding';
import { Sound } from '../../game/sound';
import { Button } from '../kit/button';

/**
 * Export, import and starting over.
 *
 * Import replaces the running archive and a reset ends it, so both say what they will
 * do before they do it, and the reset needs a second, deliberate press.
 */
@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  private readonly store = inject(GameStore);
  private readonly sound = inject(Sound);
  private readonly onboarding = inject(Onboarding);
  private readonly injector = inject(Injector);

  protected readonly labels = SETTINGS_LABELS;
  protected readonly tutorialLabels = TUTORIAL;
  protected readonly canSave = this.store.canSave;

  /** prompt.md section 7 wants sound off by default, with the switch in the settings. */
  protected readonly soundOn = this.sound.enabled;

  protected setSound(on: boolean): void {
    this.sound.setEnabled(on);
  }

  protected showIntroductionAgain(): void {
    this.onboarding.showAgain();
  }

  protected readonly exported = signal<string | null>(null);
  protected readonly exportMessage = signal<string | null>(null);
  protected readonly importText = signal('');
  protected readonly importMessage = signal<string | null>(null);
  protected readonly confirmingReset = signal(false);

  private readonly confirmButton = viewChild<Button>('confirmButton');
  private readonly resetButton = viewChild<Button>('resetButton');
  private readonly exportedField = viewChild<ElementRef<HTMLTextAreaElement>>('exportedField');

  protected async exportRun(): Promise<void> {
    const text = this.store.exportRun(Date.now());
    this.exported.set(text);
    try {
      await navigator.clipboard.writeText(text);
      this.exportMessage.set(SETTINGS_LABELS.exportDone);
    } catch {
      // Clipboard access can be refused; the text stays on screen to copy by hand.
      this.exportMessage.set(SETTINGS_LABELS.exportFailed);
    }
    // The field only exists once there is something to show; put the player in it,
    // which is also the only way to copy by hand when the clipboard was refused.
    this.afterRender(() => this.exportedField()?.nativeElement.focus());
  }

  protected importRun(): void {
    const text = this.importText().trim();
    if (text.length === 0) {
      return;
    }
    const result = this.store.importRun(text);
    if (result.ok) {
      this.importMessage.set(SETTINGS_LABELS.importDone);
      this.importText.set('');
      return;
    }
    this.importMessage.set(
      IMPORT_PROBLEMS[result.problem as keyof typeof IMPORT_PROBLEMS] ??
        IMPORT_PROBLEMS['invalid-data'],
    );
  }

  protected askReset(): void {
    this.confirmingReset.set(true);
    // Each of these swaps out the button that was just pressed; without moving focus
    // a keyboard player is dropped back onto <body> mid-decision.
    this.afterRender(() => this.confirmButton()?.focus());
  }

  protected cancelReset(): void {
    this.confirmingReset.set(false);
    this.afterRender(() => this.resetButton()?.focus());
  }

  protected reset(): void {
    this.store.startNewArchive();
    this.confirmingReset.set(false);
    this.exported.set(null);
    this.exportMessage.set(null);
    this.importMessage.set(null);
    this.afterRender(() => this.resetButton()?.focus());
  }

  private afterRender(focus: () => void): void {
    afterNextRender(focus, { injector: this.injector });
  }
}
