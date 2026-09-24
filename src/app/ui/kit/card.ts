import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** styles.md > Components: white, 2px black border, 0 radius, 16px padding, no shadow. */
@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label(); as text) {
      <p class="section-label">{{ text }}</p>
    }
    <ng-content />
  `,
  styles: `
    :host {
      display: block;
      background: var(--color-background);
      border: var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: var(--card-padding);
    }
    .section-label {
      margin-bottom: var(--space-3);
    }
  `,
})
export class Card {
  /** Optional uppercase section label, as in styles.md's "GAMES LAST 7 DAYS". */
  readonly label = input<string>();
}
