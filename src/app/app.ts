import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import {
  APP,
  FLOOR_NAMES,
  PANEL_LABELS,
  RESOURCE_LABELS,
  STATE_LABELS,
  SYSTEM_NAMES,
} from './content/de';
import { METRES_PER_FLOOR, UI_THRESHOLDS } from './engine/balance';
import { SYSTEM_IDS, createInitialState, type SystemId } from './engine/state';
import { systemFloor } from './engine/state';
import { formatDuration, formatEntropy, formatInteger, formatMetres } from './format';
import { Card } from './ui/kit/card';
import { Icon } from './ui/kit/icon';
import { IconBox } from './ui/kit/icon-box';
import { Meter } from './ui/kit/meter';
import { Stat } from './ui/kit/stat';

/**
 * Milestone 1 shell. It renders a freshly seeded archive with the real engine and the
 * real component kit, which is what the styles.md comparison is checked against.
 * Milestone 2 replaces this with the cross-section and the live loop.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, Icon, IconBox, Meter, Stat],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly content = APP;
  protected readonly labels = RESOURCE_LABELS;
  protected readonly panels = PANEL_LABELS;

  private readonly state = signal(createInitialState('4F2A'));

  protected readonly seed = computed(() => this.state().seed);
  protected readonly runtime = computed(() => formatDuration(this.state().tick));
  protected readonly energy = computed(() => formatInteger(this.state().energy));
  protected readonly material = computed(() => formatInteger(this.state().material));
  protected readonly entropy = computed(() => formatEntropy(this.state().entropy));
  protected readonly water = computed(() => formatMetres(this.state().water * METRES_PER_FLOOR));

  protected readonly systems = computed(() =>
    SYSTEM_IDS.map((id: SystemId) => {
      const system = this.state().systems[id];
      return {
        id,
        name: SYSTEM_NAMES[id],
        floor: FLOOR_NAMES[systemFloor(id)],
        integrity: system.integrity,
        critical: system.integrity < UI_THRESHOLDS.criticalIntegrity,
        lost: system.lost,
        stateText: system.lost ? STATE_LABELS.lost : undefined,
      };
    }),
  );
}
