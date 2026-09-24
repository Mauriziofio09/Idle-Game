import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import {
  COLLECTION_NAMES,
  RETURN_LABELS,
  SYSTEM_NAMES,
  floorName,
} from '../../content/de';
import { METRES_PER_FLOOR, OFFLINE } from '../../engine/balance';
import type { AwayReport } from '../../game/away-report';
import { GameStore } from '../../game/game-store';
import { formatDuration, formatInteger, formatMetres } from '../../format';
import { Button } from '../kit/button';

/**
 * "While you were away" — calm and chronological, never a scoreboard.
 *
 * It states what changed and what was lost, in that order, and offers one way out.
 */
@Component({
  selector: 'app-return-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  templateUrl: './return-summary.html',
  styleUrl: './return-summary.css',
})
export class ReturnSummary {
  private readonly store = inject(GameStore);

  readonly report = input.required<AwayReport>();
  readonly dismissed = output<void>();

  protected readonly labels = RETURN_LABELS;

  protected readonly away = computed(() => formatDuration(this.report().absentSeconds));
  protected readonly simulated = computed(() => formatDuration(this.report().simulatedSeconds));

  protected readonly stasisNote = computed(() =>
    this.report().stasis ? RETURN_LABELS.stasis(`${formatInteger(OFFLINE.maxHours)} h`) : null,
  );

  /** The water line, phrased by direction rather than by a signed number. */
  protected readonly waterNote = computed(() => {
    const { before, after } = this.report().water;
    const delta = after - before;
    const metres = formatMetres(Math.abs(delta) * METRES_PER_FLOOR);
    if (Math.abs(delta) < 0.01) {
      return RETURN_LABELS.waterHeld;
    }
    return delta > 0
      ? `${RETURN_LABELS.waterRose} ${metres}.`
      : `${RETURN_LABELS.waterFell} ${metres}.`;
  });

  protected readonly energyNote = computed(() =>
    formatInteger(this.report().energy.after),
  );

  protected readonly losses = computed(() => {
    const report = this.report();
    return [
      ...report.lostSystems.map((id) => SYSTEM_NAMES[id]),
      ...report.lostCollections.map((id) => COLLECTION_NAMES[id]),
    ];
  });

  /**
   * What the protocols did. Rules are named by their position, which is what the
   * editor shows too — an id would mean nothing to the player.
   */
  protected readonly protocolRuns = computed(() => {
    const runs = this.report().protocolRuns;
    const rules = this.store.protocols();
    return Object.entries(runs)
      .map(([id, count]) => ({ position: rules.findIndex((rule) => rule.id === id) + 1, count }))
      .filter((entry) => entry.position > 0)
      .sort((a, b) => a.position - b.position)
      .map((entry) =>
        RETURN_LABELS.protocolRun(formatInteger(entry.position), formatInteger(entry.count)),
      );
  });

  protected readonly floodedNote = computed(() => {
    const flooded = this.report().floodedFloors;
    const floors = this.store.floorCount();
    return flooded.length > 0
      ? flooded.map((floor) => floorName(floor, floors)).join(' · ')
      : null;
  });
}
