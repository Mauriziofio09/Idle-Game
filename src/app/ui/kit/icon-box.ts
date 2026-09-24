import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** styles.md > Shape Language: square, fixed size, 2px border, centred icon. */
@Component({
  selector: 'app-icon-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    '[class.lg]': "size() === 'lg'",
    '[class.sm]': "size() === 'sm'",
  },
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: var(--border);
      border-radius: var(--radius);
      background: var(--color-surface-subtle);
      color: var(--color-text-primary);
      flex: none;
    }
    :host(.lg) {
      width: var(--icon-box-lg);
      height: var(--icon-box-lg);
    }
    :host(.sm) {
      width: var(--icon-box-sm);
      height: var(--icon-box-sm);
    }
    :host(.accent) {
      color: var(--color-accent);
    }
  `,
})
export class IconBox {
  readonly size = input<'lg' | 'sm'>('lg');
}
