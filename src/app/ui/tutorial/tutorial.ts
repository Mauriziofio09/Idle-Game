import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { TUTORIAL } from '../../content/de';
import { formatInteger } from '../../format';
import { Button } from '../kit/button';

/**
 * The introduction shown once, on a first archive.
 *
 * A deliberate departure from prompt.md section 7, which asks for no tutorial modal —
 * recorded in PLAN.md section 9. What the spec was protecting against is a wall of text
 * standing between a player and the game, so that part is kept: seven short steps, three
 * sentences at most each, an obvious way out on every one of them, and it never appears
 * again once it has been seen.
 *
 * It is a real dialog: focus moves in and is held there, Escape leaves, the arrow keys
 * page through it, and focus goes back to where it came from on the way out.
 */
@Component({
  selector: 'app-tutorial',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  templateUrl: './tutorial.html',
  styleUrl: './tutorial.css',
})
export class Tutorial {
  private readonly injector = inject(Injector);

  /** Raised when the player is done with it, whether they read it or skipped it. */
  readonly closed = output<void>();

  protected readonly labels = TUTORIAL;
  protected readonly steps = TUTORIAL.steps;

  private readonly index = signal(0);
  protected readonly step = computed(() => this.steps[this.index()]);
  protected readonly isFirst = computed(() => this.index() === 0);
  protected readonly isLast = computed(() => this.index() === this.steps.length - 1);
  protected readonly progress = computed(() =>
    TUTORIAL.progress(formatInteger(this.index() + 1), formatInteger(this.steps.length)),
  );

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly primary = viewChild<Button>('primary');

  constructor() {
    // Into the dialog, not onto the page behind it.
    afterNextRender(() => this.primary()?.focus(), { injector: this.injector });
  }

  protected next(): void {
    if (this.isLast()) {
      this.closed.emit();
      return;
    }
    this.index.update((i) => i + 1);
  }

  protected back(): void {
    this.index.update((i) => Math.max(0, i - 1));
  }

  protected skip(): void {
    this.closed.emit();
  }

  /**
   * Escape leaves, the arrows page through, and Tab is kept inside.
   *
   * The trap is hand-written rather than left to the browser because this is not a
   * <dialog> element: styles.md's card is the shape the whole interface uses, and a
   * native dialog brings its own backdrop and border that would have to be undone.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.skip();
      return;
    }
    if (event.key === 'ArrowRight' && !this.isLast()) {
      event.preventDefault();
      this.next();
      return;
    }
    if (event.key === 'ArrowLeft' && !this.isFirst()) {
      event.preventDefault();
      this.back();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }

    const focusable = this.focusable();
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !this.dialog()?.nativeElement.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusable(): HTMLElement[] {
    const root = this.dialog()?.nativeElement;
    if (!root) {
      return [];
    }
    return [...root.querySelectorAll<HTMLElement>('button:not([disabled])')];
  }
}
