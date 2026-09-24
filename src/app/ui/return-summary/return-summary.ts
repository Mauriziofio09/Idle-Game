import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import {
  COLLECTION_NAMES,
  FLOOR_NAMES,
  RETURN_LABELS,
  SYSTEM_NAMES,
} from '../../content/de';
import { METRES_PER_FLOOR, OFFLINE } from '../../engine/balance';
import type { AwayReport } from '../../game/away-report';
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

  protected readonly floodedNote = computed(() => {
    const floors = this.report().floodedFloors;
    return floors.length > 0 ? floors.map((floor) => FLOOR_NAMES[floor]).join(' · ') : null;
  });
}
