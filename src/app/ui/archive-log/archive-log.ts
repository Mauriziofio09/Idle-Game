import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { GameStore } from '../../game/game-store';
import { formatLogTime } from '../../format';

/**
 * The archive log. Newest line on top, announced politely to screen readers so a loss
 * is never silent for someone who cannot see the cross-section.
 */
@Component({
  selector: 'app-archive-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!--
      role="log" is what this actually is, and it carries aria-live="polite" implicitly.
      The explicit attribute stays: some screen readers announce a live region reliably
      only when it is spelled out, and it costs nothing to say both.
    -->
    <ol role="log" aria-live="polite" aria-relevant="additions">
      @for (entry of log(); track entry.id) {
        <li [class.loss]="entry.kind === 'loss'" [class.end]="entry.kind === 'end'">
          <span class="time">{{ time(entry.tick) }}</span>
          <span class="text">{{ entry.text }}</span>
        </li>
      }
    </ol>
  `,
  styles: `
    ol {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
      max-height: var(--log-max-height);
      overflow-y: auto;
    }

    li {
      display: flex;
      gap: var(--space-3);
      font-size: var(--font-size-body);
      line-height: var(--line-height-body);
    }

    .time {
      flex: none;
      width: var(--log-time-width);
      font-size: var(--font-size-label);
      color: var(--color-text-muted);
      font-variant-numeric: tabular-nums;
      padding-top: var(--space-hair);
    }

    /* A loss is marked by weight and a rule, not by a colour we do not have. */
    li.loss .text {
      font-weight: var(--font-weight-button);
    }

    li.end {
      border-top: var(--border);
      padding-top: var(--space-2);
    }

    li.end .text {
      font-weight: var(--font-weight-heading);
    }
  `,
})
export class ArchiveLog {
  private readonly store = inject(GameStore);

  protected readonly log = this.store.log;

  protected time(tick: number): string {
    return formatLogTime(tick);
  }
}
