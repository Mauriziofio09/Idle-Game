import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import {
  SCENARIO_DESCRIPTIONS,
  SCENARIO_LABELS,
  SCENARIO_NAMES,
  SETTINGS_LABELS,
} from '../../content/de';
import { SCENARIO_IDS, type ScenarioId } from '../../engine/balance';
import { GameStore } from '../../game/game-store';
import { formatInteger } from '../../format';
import { Button } from '../kit/button';

/**
 * Choosing which archive to play.
 *
 * A scenario changes the starting conditions and the shape of the house, never a rule —
 * so everything the player has learned still holds. Starting one ends the current run,
 * which is why it asks first.
 */
@Component({
  selector: 'app-scenarios',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  templateUrl: './scenarios.html',
  styleUrl: './scenarios.css',
})
export class Scenarios {
  private readonly store = inject(GameStore);
  private readonly injector = inject(Injector);
  private readonly confirmButton = viewChild<Button>('confirmButton');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly labels = SCENARIO_LABELS;
  protected readonly settingsLabels = SETTINGS_LABELS;
  protected readonly current = this.store.scenarioId;

  /** Which scenario is armed for a start, if any. Starting ends the running archive. */
  protected readonly pending = signal<ScenarioId | null>(null);
  protected readonly pendingDaily = signal(false);

  protected readonly scenarios = computed(() =>
    SCENARIO_IDS.map((id) => {
      const units = this.store.unitsToScenario(id);
      return {
        id,
        name: SCENARIO_NAMES[id],
        description: SCENARIO_DESCRIPTIONS[id],
        isCurrent: id === this.current(),
        unlocked: this.store.scenarioUnlocked(id),
        lockedHint: units === null ? null : SCENARIO_LABELS.locked(formatInteger(units)),
      };
    }),
  );

  protected ask(id: ScenarioId): void {
    this.pendingDaily.set(false);
    this.pending.set(id);
    this.focusConfirm();
  }

  protected askDaily(): void {
    this.pending.set(null);
    this.pendingDaily.set(true);
    this.focusConfirm();
  }

  protected cancel(): void {
    this.pending.set(null);
    this.pendingDaily.set(false);
    // The confirmation is gone; come back to the list rather than to <body>.
    this.after(() => this.list()?.nativeElement.querySelector<HTMLElement>('button')?.focus());
  }

  private focusConfirm(): void {
    this.after(() => this.confirmButton()?.focus());
  }

  private after(focus: () => void): void {
    afterNextRender(focus, { injector: this.injector });
  }

  protected start(): void {
    const id = this.pending();
    if (this.pendingDaily()) {
      this.store.startDailyArchive(Date.now());
    } else if (id && this.store.scenarioUnlocked(id)) {
      this.store.startNewArchive(Date.now(), undefined, id);
    }
    this.pending.set(null);
    this.pendingDaily.set(false);
    this.after(() => this.list()?.nativeElement.querySelector<HTMLElement>('button')?.focus());
  }
}
