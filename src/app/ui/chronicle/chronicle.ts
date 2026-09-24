import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';

import {
  CHRONICLE_LABELS,
  CLOSING_SENTENCES,
  COLLECTION_NAMES,
  END_LABELS,
  SYSTEM_NAMES,
  floorName,
} from '../../content/de';
import { buildChronicle } from '../../engine/chronicle';
import { GameStore } from '../../game/game-store';
import { bar, seedLink, shareText } from '../../game/share';
import { formatDuration, formatInteger, formatLogTime, formatPercent } from '../../format';
import { Button } from '../kit/button';

/**
 * The chronicle: what the run amounted to, and a text the player can pass on.
 *
 * It is the only screen that looks backwards, so it states plainly what happened and
 * offers exactly two ways forward — share it, or begin again.
 */
@Component({
  selector: 'app-chronicle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  templateUrl: './chronicle.html',
  styleUrl: './chronicle.css',
})
export class Chronicle {
  private readonly store = inject(GameStore);

  /** Raised after the archive has been replaced, so the page can move focus. */
  readonly restarted = output<void>();

  protected readonly labels = CHRONICLE_LABELS;
  protected readonly shareMessage = signal<string | null>(null);
  protected readonly shareBody = signal<string | null>(null);

  private readonly chronicle = computed(() => buildChronicle(this.store.state()));

  protected readonly seed = computed(() => this.chronicle().seed);
  protected readonly held = computed(() => formatDuration(this.chronicle().ticks));
  protected readonly saved = computed(() => formatPercent(this.chronicle().savedShare * 100));

  protected readonly reason = computed(() => {
    const reason = this.chronicle().endReason;
    if (!reason) {
      return null;
    }
    return reason === 'silence' ? END_LABELS.silence : END_LABELS.nothingLeft;
  });

  protected readonly closing = computed(() => CLOSING_SENTENCES[this.chronicle().closing]);

  protected readonly collections = computed(() =>
    this.chronicle().collections.map((entry) => ({
      id: entry.id,
      name: COLLECTION_NAMES[entry.id],
      bar: bar(entry.share),
      share: formatPercent(entry.share),
      value: entry.share,
    })),
  );

  protected readonly timeline = computed(() =>
    this.chronicle().timeline.map((entry, index) => ({
      key: `${entry.tick}-${entry.kind}-${entry.id}-${index}`,
      time: formatLogTime(entry.tick),
      text: this.describeLoss(entry.kind, entry.id),
    })),
  );

  protected readonly mostUsed = computed(() => {
    const rule = this.chronicle().mostUsedRule;
    return rule
      ? CHRONICLE_LABELS.mostUsedValue(
          formatInteger(rule.position),
          formatInteger(rule.firedCount),
        )
      : CHRONICLE_LABELS.noProtocol;
  });

  protected readonly lastFell = computed(() => {
    const loss = this.chronicle().lastLoss;
    return loss ? CHRONICLE_LABELS.lastFell(this.nameOf(loss.kind, loss.id)) : null;
  });

  protected async share(): Promise<void> {
    const text = `${shareText(this.chronicle(), this.store.floorCount())}\n${this.link()}`;
    this.shareBody.set(text);

    // Web Share where it exists, clipboard everywhere else, and the text on screen if
    // neither is allowed — no dead end.
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Cancelled or refused; fall through to the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      this.shareMessage.set(CHRONICLE_LABELS.shareCopied);
    } catch {
      this.shareMessage.set(CHRONICLE_LABELS.shareFailed);
    }
  }

  protected newArchive(): void {
    this.store.startNewArchive();
    // This whole card goes with the run, including the button just pressed, so the page
    // takes over: the focus target has to be something that outlives the chronicle.
    this.restarted.emit();
  }

  private link(): string {
    return seedLink(this.seed(), this.store.scenarioId(), location.origin, location.pathname);
  }

  private describeLoss(kind: string, id: string): string {
    const name = this.nameOf(kind, id);
    switch (kind) {
      case 'system-lost':
        return CHRONICLE_LABELS.lostSystem(name);
      case 'collection-lost':
        return CHRONICLE_LABELS.lostCollection(name);
      case 'collection-burned':
        return CHRONICLE_LABELS.burnedCollection(name);
      default:
        return CHRONICLE_LABELS.flooded(name);
    }
  }

  private nameOf(kind: string, id: string): string {
    if (kind === 'system-lost') {
      return SYSTEM_NAMES[id as keyof typeof SYSTEM_NAMES] ?? id;
    }
    if (kind === 'collection-lost' || kind === 'collection-burned') {
      return COLLECTION_NAMES[id as keyof typeof COLLECTION_NAMES] ?? id;
    }
    // The floor names depend on how tall this archive is.
    return floorName(Number(id), this.store.floorCount());
  }
}
