import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';

import {
  APP,
  END_LABELS,
  PANEL_TABS,
  PANEL_TABS_LABEL,
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
import { Onboarding } from './game/onboarding';
import { Sound } from './game/sound';
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
import { Tutorial } from './ui/tutorial/tutorial';
import { Card } from './ui/kit/card';
import { Icon } from './ui/kit/icon';
import { IconBox } from './ui/kit/icon-box';

/** The panels that share the strip on a phone. */
type PanelId = 'detail' | 'protocols' | 'legacy' | 'scenarios' | 'settings';

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
    Tutorial,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly store = inject(GameStore);
  private readonly loop = inject(GameLoop);
  private readonly autoSave = inject(AutoSave);
  private readonly sound = inject(Sound);
  private readonly onboarding = inject(Onboarding);
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

  /**
   * One quiet tone for one new line in the log.
   *
   * Only when a single line arrived. Coming back after hours away adds dozens at once,
   * and a burst of tones at somebody who just opened the tab would be the opposite of the
   * restraint prompt.md section 7 asks for — that moment already has the return summary
   * to explain itself.
   */
  private lastHeardLine = -1;

  protected readonly soundCues = effect(() => {
    const log = this.store.log();
    const newest = log[0];
    if (newest === undefined) {
      return;
    }
    const arrived = log.filter((entry) => entry.id > this.lastHeardLine);
    this.lastHeardLine = newest.id;
    if (arrived.length === 1) {
      this.sound.cue(arrived[0].kind);
    }
  });

  /** The introduction, shown once. See game/onboarding.ts. */
  protected readonly showTutorial = this.onboarding.showIntroduction;

  protected closeTutorial(): void {
    this.onboarding.markSeen();
    // The introduction covered the page; put the keyboard back at the top of it.
    afterNextRender(() => this.title()?.nativeElement.focus(), { injector: this.injector });
  }

  protected readonly revealed = this.store.revealed;

  /**
   * The panel strip. prompt.md section 7 asks for the panels to become tabs on a phone
   * and for the archive to stay playable at 375 px.
   *
   * Which panel is open is tracked here at all times, but only matters on a narrow
   * screen: the stylesheet shows the whole stack above the phone breakpoint and hides
   * the strip entirely, so there is no media query to listen to and nothing to measure.
   * The layout decides, the component only remembers.
   */
  protected readonly tabsLabel = PANEL_TABS_LABEL;

  protected readonly tabs = computed(() => {
    const tabs: { id: PanelId; label: string }[] = [{ id: 'detail', label: PANEL_TABS.detail }];
    // The protocols tab appears with the panel it opens, not before.
    if (this.revealed().protocols) {
      tabs.push({ id: 'protocols', label: PANEL_TABS.protocols });
    }
    tabs.push(
      { id: 'legacy', label: PANEL_TABS.legacy },
      { id: 'scenarios', label: PANEL_TABS.scenarios },
      { id: 'settings', label: PANEL_TABS.settings },
    );
    return tabs;
  });

  /** Falls back to the selection panel whenever the open tab stops existing. */
  protected readonly activePanel = linkedSignal<{ id: PanelId; label: string }[], PanelId>({
    source: () => this.tabs(),
    computation: (tabs, previous) =>
      previous !== undefined && tabs.some((tab) => tab.id === previous.value)
        ? previous.value
        : 'detail',
  });

  protected selectPanel(id: PanelId): void {
    this.activePanel.set(id);
  }

  /**
   * Picking something in the building opens the panel that can act on it. On a phone the
   * detail panel sits behind a tab, and a cross-section whose taps quietly changed an
   * off-screen panel would feel dead.
   */
  protected readonly followSelection = effect(() => {
    if (this.store.selection() !== null) {
      this.activePanel.set('detail');
    }
  });

  /**
   * Left and right walk the strip and wrap around; Home and End jump to its ends, which
   * the WAI-ARIA tab pattern asks for. Focus follows the selection, so a keyboard player
   * lands in the panel they just opened.
   */
  protected onTabKeys(event: KeyboardEvent, index: number): void {
    const tabs = this.tabs();
    const target = this.tabIndexFor(event.key, index, tabs.length);
    if (target === null) {
      return;
    }
    event.preventDefault();
    const next = tabs[target];
    this.activePanel.set(next.id);
    this.tabButtons()[target]?.nativeElement.focus();
  }

  private tabIndexFor(key: string, index: number, count: number): number | null {
    if (key === 'Home') return 0;
    if (key === 'End') return count - 1;
    const step = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
    return step === 0 ? null : (index + step + count) % count;
  }

  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  /**
   * Keeps the keyboard somewhere whenever the archive is replaced.
   *
   * Starting a new archive tears down whatever the player was standing on: a tab that only
   * exists after a repair, a control inside a panel, or the mast, which M7 hides until it
   * answers. The browser then drops focus onto the document body and a keyboard player is
   * stranded. This project had shipped that bug in five milestones before this one, and an
   * earlier attempt here guarded only the tab strip — which is invisible on a desktop, so
   * it fixed nothing outside the test that claimed it did.
   *
   * The guard is one level up from any of those controls: the page title outlives every
   * archive, and the chronicle already uses it for exactly this. It only ever acts when
   * focus really was lost, so a player whose button survived keeps it.
   */
  protected readonly keepFocusAfterRestart = effect(() => {
    this.store.archiveGeneration();
    afterNextRender(
      () => {
        if (document.activeElement === document.body || document.activeElement === null) {
          this.title()?.nativeElement.focus();
        }
      },
      { injector: this.injector },
    );
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
