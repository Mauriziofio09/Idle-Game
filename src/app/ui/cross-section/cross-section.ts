import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import {
  COLLECTION_NAMES,
  DETAIL_LABELS,
  STATE_LABELS,
  SYSTEM_NAMES,
  floorName,
} from '../../content/de';
import { COLLECTIONS } from '../../engine/balance';
import { GameStore } from '../../game/game-store';
import { formatInteger, formatPercent } from '../../format';
import { inflow } from '../../engine/step';
import { scenarioOf } from '../../engine/state';

/** How many segments the roof is drawn from; broken ones show the damage. */
const ROOF_SEGMENTS = 12;
/** Rain stroke count at the base inflow, and the ceiling at the heaviest downpour. */
const RAIN_STROKES_AT_BASE = 10;
const MAX_RAIN_STROKES = 26;

/**
 * The cross-section of the archive: five floors, water rising from below, rain above,
 * roof damage visible, systems and collections sitting where they are.
 *
 * Built from HTML and CSS rather than SVG so that every system and collection is a real
 * button: keyboard focus, aria-pressed and hit targets come for free instead of being
 * rebuilt inside an SVG.
 */
@Component({
  selector: 'app-cross-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cross-section.html',
  styleUrl: './cross-section.css',
})
export class CrossSection {
  private readonly store = inject(GameStore);

  protected readonly labels = DETAIL_LABELS;
  protected readonly stateLabels = STATE_LABELS;
  protected readonly selection = this.store.selection;

  /** How much of the building's height stands under water. */
  protected readonly waterHeight = computed(
    () => (this.store.state().water / this.store.floorCount()) * 100,
  );

  protected readonly roofSegments = computed(() => {
    const roof = this.store.state().systems.roof;
    const integrity = roof.lost ? 0 : roof.integrity;
    const broken = Math.round(((100 - integrity) / 100) * ROOF_SEGMENTS);
    return Array.from({ length: ROOF_SEGMENTS }, (_, index) => ({
      index,
      // Spread the gaps across the roof instead of eating it from one end — holes in
      // a roof, not a progress bar running down.
      broken: (index * broken) % ROOF_SEGMENTS < broken,
    }));
  });

  /** Rain strokes: more of them the harder it falls. Count, not motion. */
  protected readonly rain = computed(() => {
    const state = this.store.state();
    // Against this archive's own baseline, so the tower and the drought read alike.
    const intensity = inflow(state) / scenarioOf(state).rainBasePerSecond;
    const strokes = Math.max(
      4,
      Math.min(MAX_RAIN_STROKES, Math.round(intensity * RAIN_STROKES_AT_BASE)),
    );
    return Array.from({ length: strokes }, (_, index) => ({
      index,
      // Spread with a co-prime stride so it reads as rain rather than as a ruler.
      left: ((index * 37) % 97) + 1,
      length: 6 + ((index * 5) % 13),
    }));
  });

  /** Floors top down: the attic first, the cellar last. */
  protected readonly floors = computed(() => {
    const state = this.store.state();
    const floors = this.store.floorCount();
    return Array.from({ length: floors }, (_, offset) => {
      const index = floors - 1 - offset;
      return {
        index,
        indexLabel: formatInteger(index),
        name: floorName(index, floors),
        flooded: this.store.floorIsFlooded(index),
        humidity: formatPercent(state.humidity[index]),
        systems: this.store.systemsOnFloor(index).map((id) => {
          const system = state.systems[id];
          return {
            id,
            name: SYSTEM_NAMES[id],
            integrity: system.integrity,
            readout: formatPercent(system.integrity),
            // The bar is a sibling of the button, so it needs a name of its own.
            meterLabel: `${SYSTEM_NAMES[id]} · ${DETAIL_LABELS.integrity}`,
            on: system.on,
            lost: system.lost,
            critical: this.store.isCritical(id),
            selected: this.isSystemSelected(id),
          };
        }),
        collections: this.store.collectionsOnFloor(index).map((id) => {
          const collection = state.collections[id];
          return {
            id,
            name: COLLECTION_NAMES[id],
            // Shares of the whole collection, so a retuned unit count cannot skew the bar.
            intactShare: (collection.intact / COLLECTIONS.unitsEach) * 100,
            sentShare: (collection.sent / COLLECTIONS.unitsEach) * 100,
            readout: formatPercent((collection.intact / COLLECTIONS.unitsEach) * 100),
            meterLabel: `${COLLECTION_NAMES[id]} · ${DETAIL_LABELS.intact}`,
            lost: collection.lost,
            inTransit: collection.transitTicks > 0,
            selected: this.isCollectionSelected(id),
          };
        }),
      };
    });
  });

  protected isSystemSelected(id: string): boolean {
    const selection = this.selection();
    return selection?.kind === 'system' && selection.id === id;
  }

  protected isCollectionSelected(id: string): boolean {
    const selection = this.selection();
    return selection?.kind === 'collection' && selection.id === id;
  }

  protected isFloorSelected(index: number): boolean {
    const selection = this.selection();
    return selection?.kind === 'floor' && selection.index === index;
  }

  protected selectFloor(index: number): void {
    this.store.select({ kind: 'floor', index });
  }

  protected selectSystem(id: ReturnType<GameStore['systemsOnFloor']>[number]): void {
    this.store.select({ kind: 'system', id });
  }

  protected selectCollection(id: ReturnType<GameStore['collectionsOnFloor']>[number]): void {
    this.store.select({ kind: 'collection', id });
  }
}
