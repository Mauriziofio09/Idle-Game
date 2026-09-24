import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import {
  APP,
  END_LABELS,
  PANEL_TITLES,
  SETTINGS_LABELS,
  STARTUP_NOTICES,
  STARTUP_NOTICE_DISMISS,
} from './content/de';
import {
  CHRONICLE_LABELS,
  LEGACY_LABELS,
  PROTOCOL_LABELS,
  SCENARIO_LABELS,
} from './content/de';
import { OFFLINE } from './engine/balance';
import { AutoSave } from './game/autosave';
import type { AwayReport } from './game/away-report';
import { GameLoop } from './game/game-loop';
import { GameStore } from './game/game-store';
import { formatDuration, formatPercent } from './format';
import { ArchiveLog } from './ui/archive-log/archive-log';
import { CrossSection } from './ui/cross-section/cross-section';
import { DetailPanel } from './ui/detail-panel/detail-panel';
import { ResourceBar } from './ui/resource-bar/resource-bar';
import { ReturnSummary } from './ui/return-summary/return-summary';
import { Chronicle } from './ui/chronicle/chronicle';
import { Legacy } from './ui/legacy/legacy';
import { Protocols } from './ui/protocols/protocols';
import { Scenarios } from './ui/scenarios/scenarios';
import { Settings } from './ui/settings/settings';
import { Card } from './ui/kit/card';
import { Icon } from './ui/kit/icon';
import { IconBox } from './ui/kit/icon-box';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ArchiveLog,
    Card,
    Chronicle,
    CrossSection,
    DetailPanel,
    Icon,
    IconBox,
    Legacy,
    Protocols,
    ResourceBar,
    Scenarios,
    ReturnSummary,
    Settings,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly store = inject(GameStore);
  private readonly loop = inject(GameLoop);
  private readonly autoSave = inject(AutoSave);
  private readonly injector = inject(Injector);
  private readonly title = viewChild<ElementRef<HTMLElement>>('pageTitle');

  protected readonly content = APP;
  protected readonly titles = PANEL_TITLES;
  protected readonly endLabels = END_LABELS;
  protected readonly settingsLabels = SETTINGS_LABELS;
  protected readonly noticeDismiss = STARTUP_NOTICE_DISMISS;
  protected readonly protocolLabels = PROTOCOL_LABELS;
  protected readonly chronicleLabels = CHRONICLE_LABELS;
  protected readonly legacyLabels = LEGACY_LABELS;
  protected readonly scenarioLabels = SCENARIO_LABELS;

  /** Set when the player was away long enough to deserve an account of it. */
  protected readonly awayReport = signal<AwayReport | null>(null);

  protected readonly startupNotice = computed(() => {
    const notice = this.store.startupNotice();
    return notice ? STARTUP_NOTICES[notice] : null;
  });

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
    const params = new URLSearchParams(location.search);
    const report = this.store.initialize(Date.now(), params.get('archiv'), params.get('haus'));
    // The gate is on what actually happened, not on wall-clock absence: reloading an
    // archive that fell silent days ago must not claim two days in which "nothing was
    // lost". An ending during the absence is always worth showing.
    if (
      report &&
      (report.simulatedSeconds >= OFFLINE.summaryThresholdSeconds || report.endedWhileAway)
    ) {
      this.awayReport.set(report);
    }
    this.autoSave.start();
    this.loop.start();
  }

  protected dismissReport(): void {
    this.awayReport.set(null);
  }

  protected dismissNotice(): void {
    this.store.dismissStartupNotice();
  }

  /** The chronicle unmounts with the run it describes, so focus comes home to the page. */
  protected onRestarted(): void {
    afterNextRender(() => this.title()?.nativeElement.focus(), { injector: this.injector });
  }
}
