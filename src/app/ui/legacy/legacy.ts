import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { COLLECTION_NAMES, LEGACY_LABELS, LORE } from '../../content/de';
import { LEGACY } from '../../engine/balance';
import { COLLECTION_IDS } from '../../engine/state';
import { GameStore } from '../../game/game-store';
import { formatInteger } from '../../format';

/**
 * The legacy: everything that ever left the building, and the city's chronicle it buys.
 *
 * It unlocks knowledge and options only — no multipliers. The archive does not get
 * stronger, the player does.
 */
@Component({
  selector: 'app-legacy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legacy.html',
  styleUrl: './legacy.css',
})
export class Legacy {
  private readonly store = inject(GameStore);

  protected readonly labels = LEGACY_LABELS;

  protected readonly total = computed(() => formatInteger(this.store.legacyTotal()));
  protected readonly runs = computed(() => formatInteger(this.store.legacy().runs));
  protected readonly slots = computed(() => formatInteger(this.store.protocolSlots()));

  protected readonly fragmentsLabel = computed(() =>
    `${formatInteger(this.store.legacyFragments())} / ${formatInteger(LEGACY.fragmentCount)}`,
  );

  protected readonly nextFragment = computed(() => {
    const units = this.store.legacyNextFragment();
    return units === null
      ? LEGACY_LABELS.allFragments
      : LEGACY_LABELS.nextFragment(formatInteger(Math.ceil(units)));
  });

  protected readonly nextSlot = computed(() => {
    const units = this.store.legacyNextSlot();
    return units === null
      ? LEGACY_LABELS.allSlots
      : LEGACY_LABELS.nextSlot(formatInteger(Math.ceil(units)));
  });

  protected readonly perCollection = computed(() => {
    const sent = this.store.legacy().sent;
    return COLLECTION_IDS.map((id) => ({
      id,
      name: COLLECTION_NAMES[id],
      value: formatInteger(sent[id] ?? 0),
    }));
  });

  /** Only the fragments that have been paid for; the rest are not hinted at. */
  protected readonly fragments = computed(() =>
    LORE.slice(0, this.store.legacyFragments()).map((fragment, index) => ({
      index,
      number: formatInteger(index + 1),
      ...fragment,
    })),
  );
}
