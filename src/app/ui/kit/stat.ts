import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * styles.md > Typography: a bold 24px number over a 12px muted label.
 * Used for the resource bar and the chronicle.
 */
@Component({
  selector: 'app-stat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="value">{{ value() }}</span>
    <span class="label">{{ label() }}</span>
    @if (note(); as text) {
      <span class="note">{{ text }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      min-width: 0;
    }
    .value {
      font-size: var(--font-size-stat);
      font-weight: var(--font-weight-heading);
      line-height: var(--line-height-none);
      letter-spacing: var(--letter-spacing-tight);
      font-variant-numeric: tabular-nums;
    }
    .label,
    .note {
      font-size: var(--font-size-label);
      color: var(--color-text-muted);
      line-height: var(--line-height-none);
    }
  `,
})
export class Stat {
  readonly value = input.required<string>();
  readonly label = input.required<string>();
  /** A second line, e.g. the net rate next to the energy figure. */
  readonly note = input<string>();
}
