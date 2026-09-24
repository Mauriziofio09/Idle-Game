import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

/**
 * styles.md > Components: full width, 16px vertical padding, 16px/500 label,
 * 2px black border, no radius. The secondary variant is the exact inversion.
 */
@Component({
  selector: 'app-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      #native
      [type]="type()"
      [disabled]="disabled()"
      [class]="variant()"
      (click)="pressed.emit()"
    >
      <ng-content />
    </button>
  `,
  styles: `
    :host {
      display: block;
    }
    button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      width: 100%;
      padding: var(--button-padding-block) var(--space-4);
      border: var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      font-family: var(--font-family-sans);
      font-size: var(--font-size-button);
      font-weight: var(--font-weight-button);
      line-height: var(--line-height-none);
      cursor: pointer;
      transition: background-color var(--motion-fast) var(--motion-ease);
    }
    button.primary {
      background: var(--color-button-primary-bg);
      color: var(--color-button-primary-fg);
    }
    button.secondary {
      background: var(--color-button-secondary-bg);
      color: var(--color-button-secondary-fg);
    }
    button:disabled {
      cursor: not-allowed;
      color: var(--color-text-muted);
      border-color: var(--color-text-muted);
      background: var(--color-surface-subtle);
    }
  `,
})
export class Button {
  readonly variant = input<'primary' | 'secondary'>('secondary');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
  readonly pressed = output<void>();

  private readonly native = viewChild<ElementRef<HTMLButtonElement>>('native');

  /** Lets a panel move focus here when it replaces the control the user was on. */
  focus(): void {
    this.native()?.nativeElement.focus();
  }
}
