import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { STATE_LABELS } from '../../content/de';
import { formatPercent } from '../../format';

/**
 * A value bar. Black fill on white with a 2px border — the bar-chart shape from
 * styles.md, in black because the accent green is reserved for what was saved.
 *
 * State is never carried by colour alone (prompt.md section 7): "critical" adds a
 * hard-stop stripe pattern, "lost" inverts the bar, and both carry visible text.
 */
@Component({
  selector: 'app-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <span class="name">{{ label() }}</span>
      <span class="readout">{{ readout() }}</span>
    </div>
    <div
      class="track"
      role="meter"
      [attr.aria-label]="label()"
      [attr.aria-valuenow]="rounded()"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-valuetext]="readout()"
    >
      @if (!lost()) {
        <div class="fill" [class.critical]="critical()" [style.width.%]="clamped()"></div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .head {
      display: flex;
      justify-content: space-between;
      gap: var(--space-2);
      margin-bottom: var(--space-1);
      font-size: var(--font-size-label);
    }
    .name {
      color: var(--color-text-primary);
    }
    .readout {
      color: var(--color-text-muted);
      font-variant-numeric: tabular-nums;
    }
    .track {
      height: var(--space-3);
      border: var(--border);
      border-radius: var(--radius);
      background: var(--color-meter-track);
      overflow: hidden;
    }
    :host(.lost) .track {
      background: var(--color-lost-bg);
    }
    .fill {
      height: 100%;
      background: var(--color-meter-fill);
      transition: width var(--motion-slow) var(--motion-ease);
    }
    .fill.critical {
      background-image: var(--pattern-critical);
      background-color: transparent;
    }
  `,
  host: {
    '[class.lost]': 'lost()',
  },
})
export class Meter {
  readonly label = input.required<string>();
  /** 0 to 100. */
  readonly value = input.required<number>();
  readonly critical = input(false);
  readonly lost = input(false);
  /** Overrides the numeric readout, e.g. "VERLOREN". */
  readonly text = input<string>();

  protected readonly clamped = computed(() => Math.min(100, Math.max(0, this.value())));
  protected readonly rounded = computed(() => Math.round(this.clamped()));
  protected readonly readout = computed(() => {
    const override = this.text();
    if (override) {
      return override;
    }
    const value = formatPercent(this.clamped());
    return this.critical() ? `${value} · ${STATE_LABELS.critical}` : value;
  });
}
