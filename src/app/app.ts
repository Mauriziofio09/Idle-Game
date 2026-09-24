import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';

import { APP, END_LABELS, PANEL_TITLES } from './content/de';
import { GameLoop } from './game/game-loop';
import { GameStore } from './game/game-store';
import { formatDuration, formatPercent } from './format';
import { ArchiveLog } from './ui/archive-log/archive-log';
import { CrossSection } from './ui/cross-section/cross-section';
import { DetailPanel } from './ui/detail-panel/detail-panel';
import { ResourceBar } from './ui/resource-bar/resource-bar';
import { Card } from './ui/kit/card';
import { Icon } from './ui/kit/icon';
import { IconBox } from './ui/kit/icon-box';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ArchiveLog, Card, CrossSection, DetailPanel, Icon, IconBox, ResourceBar],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly store = inject(GameStore);
  private readonly loop = inject(GameLoop);

  protected readonly content = APP;
  protected readonly titles = PANEL_TITLES;
  protected readonly endLabels = END_LABELS;

  protected readonly seed = this.store.seed;
  protected readonly ended = this.store.ended;
  protected readonly runtime = computed(() => formatDuration(this.store.state().tick));
  protected readonly saved = computed(() => formatPercent(this.store.savedShare() * 100));
  protected readonly endReason = computed(() => {
    const reason = this.store.state().endReason;
    if (!reason) {
      return null;
    }
    return reason === 'silence' ? END_LABELS.silence : END_LABELS.nothingLeft;
  });

  ngOnInit(): void {
    this.loop.start();
  }
}
