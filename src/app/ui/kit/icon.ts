import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Outline icons in the Lucide style demanded by styles.md, 2px stroke.
 *
 * The paths are copied from Lucide (ISC licence, credited in README) instead of
 * pulling in a package: it keeps the bundle small and avoids an external request.
 */
const ICON_PATHS: Record<string, string> = {
  archive: 'M4 8h16M4 8a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2M4 8v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8M10 12h4',
  droplet: 'M12 2.69 17.66 8.34A8 8 0 1 1 6.34 8.34Z',
  zap: 'M4 14h7l-2 8 11-12h-7l2-8z',
  wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  radio: 'M4.9 19.1a10 10 0 0 1 0-14.2M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M19.1 4.9a10 10 0 0 1 0 14.2',
  power: 'M12 2v10M18.36 6.64a9 9 0 1 1-12.73 0',
  alert: 'M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  clock: 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  layers: 'm12.83 2.18 8.34 4.17a1 1 0 0 1 0 1.79l-8.34 4.17a2 2 0 0 1-1.66 0L2.83 8.14a1 1 0 0 1 0-1.79l8.34-4.17a2 2 0 0 1 1.66 0zM2 12.5l9.17 4.58a2 2 0 0 0 1.66 0L22 12.5M2 17.5l9.17 4.58a2 2 0 0 0 1.66 0L22 17.5',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
};

export type IconName = keyof typeof ICON_PATHS;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="square"
      stroke-linejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
  host: {
    '[class.lg]': "size() === 'lg'",
  },
  styles: `
    :host {
      display: inline-flex;
      color: inherit;
      width: var(--icon-size-md);
      height: var(--icon-size-md);
    }
    :host(.lg) {
      width: var(--icon-size-lg);
      height: var(--icon-size-lg);
    }
    svg {
      width: 100%;
      height: 100%;
      stroke-width: var(--icon-stroke-width);
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  /** Sizes come from tokens, never from a pixel literal in a template. */
  readonly size = input<'md' | 'lg'>('md');

  protected readonly path = computed(() => ICON_PATHS[this.name()] ?? '');
}
