import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { RESOURCE_LABELS, RESOURCE_NOTES } from '../../content/de';
import { ENERGY } from '../../engine/balance';
import { GameStore } from '../../game/game-store';
import {
  formatDuration,
  formatEntropy,
  formatInteger,
  formatMetres,
  formatMultiplier,
  formatPercent,
  formatRate,
} from '../../format';
import { Stat } from '../kit/stat';

/**
 * The top row: what the archive has, what it is losing, and how long it has held.
 * Every figure carries its rate, so the player can plan instead of guess.
 */
@Component({
  selector: 'app-resource-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Stat],
  template: `
    <app-stat
      [value]="energy()"
      [label]="labels.energy"
      [note]="energyNote()"
    />
    <app-stat [value]="material()" [label]="labels.material" />
    <app-stat [value]="entropy()" [label]="labels.entropy" [note]="decayNote()" />
    <app-stat [value]="water()" [label]="labels.water" />
    <app-stat [value]="runtime()" [label]="labels.runtime" />
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(var(--stat-column-min), 1fr));
      gap: var(--space-4);
    }
  `,
})
export class ResourceBar {
  private readonly store = inject(GameStore);

  protected readonly labels = RESOURCE_LABELS;

  protected readonly energy = computed(() => formatInteger(this.store.state().energy));
  protected readonly material = computed(() => formatInteger(this.store.state().material));
  protected readonly entropy = computed(() => formatEntropy(this.store.state().entropy));
  protected readonly water = computed(() => formatMetres(this.store.waterMetres()));
  protected readonly runtime = computed(() => formatDuration(this.store.state().tick));

  /** The net rate, or the supply share once the battery is empty and rationing starts. */
  protected readonly energyNote = computed(() => {
    const state = this.store.state();
    if (state.supplyRatio < 1) {
      return RESOURCE_NOTES.energyShare(formatPercent(state.supplyRatio * 100));
    }
    return RESOURCE_NOTES.energyRate(
      formatRate(this.store.energyRate()),
      formatInteger(ENERGY.capacity),
    );
  });

  protected readonly decayNote = computed(() =>
    RESOURCE_NOTES.decay(formatMultiplier(this.store.decayMultiplier())),
  );
}
