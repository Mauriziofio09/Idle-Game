import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
  viewChild,
} from '@angular/core';

import {
  ACTION_HINTS,
  ACTION_LABELS,
  COLLECTION_NAMES,
  DETAIL_LABELS,
  FLOOR_NAMES,
  PANEL_TITLES,
  STATE_LABELS,
  SYSTEM_NAMES,
  TRANSMIT_HINTS,
} from '../../content/de';
import { ENTROPY, REPAIR, SYSTEMS, TRANSMIT } from '../../engine/balance';
import { GameStore } from '../../game/game-store';
import { systemFloor, type CollectionId, type SystemId } from '../../engine/state';
import type { Selection } from '../../game/game-store';
import { formatInteger, formatPerSecond, formatPercent, formatResource } from '../../format';
import { Button } from '../kit/button';
import { Meter } from '../kit/meter';

/**
 * What the player can do with whatever they focused, and exactly what it costs.
 *
 * Every action shows its price before it is taken — pillar 4: the player should be able
 * to plan, and should understand afterwards why something was lost.
 */
@Component({
  selector: 'app-detail-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Meter],
  templateUrl: './detail-panel.html',
  styleUrl: './detail-panel.css',
})
export class DetailPanel {
  private readonly store = inject(GameStore);
  private readonly injector = inject(Injector);

  protected readonly titles = PANEL_TITLES;
  protected readonly actionLabels = ACTION_LABELS;
  protected readonly hints = ACTION_HINTS;
  protected readonly transmitHints = TRANSMIT_HINTS;
  protected readonly labels = DETAIL_LABELS;
  protected readonly stateLabels = STATE_LABELS;

  protected readonly selection = this.store.selection;

  /**
   * A dismantle is irreversible, so it takes a second, deliberate press. Tied to the
   * selection, so coming back to a system never drops the player straight into the
   * confirmation they armed earlier.
   */
  protected readonly confirmingDismantle = linkedSignal<Selection, SystemId | null>({
    source: this.selection,
    computation: () => null,
  });

  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  private readonly confirmButton = viewChild<Button>('confirmButton');

  protected readonly system = computed(() => {
    const selection = this.selection();
    if (selection?.kind !== 'system') {
      return null;
    }
    const id = selection.id;
    const state = this.store.state();
    const system = state.systems[id];
    const preview = this.store.repairPreview(id);
    const config = SYSTEMS[id];

    return {
      id,
      name: SYSTEM_NAMES[id],
      floor: FLOOR_NAMES[systemFloor(id)],
      integrity: system.integrity,
      readout: formatPercent(system.integrity),
      on: system.on,
      lost: system.lost,
      critical: this.store.isCritical(id),
      repairs: system.repairs,
      draw: config.drawPerSecond,
      drawReadout: formatPerSecond(config.drawPerSecond),
      repairHint: ACTION_HINTS.repairPreview(
        formatPercent(preview.gain),
        formatResource(preview.materialCost),
        formatResource(preview.energyCost),
        formatResource(preview.entropyCost),
      ),
      canRepair: this.store.canApply({ type: 'repair', systemId: id }),
      repairBlockedReason: this.repairBlockedReason(id),
      dismantleHint: ACTION_HINTS.dismantlePreview(
        formatResource(this.store.dismantleYield(id)),
        formatResource(ENTROPY.perDismantle),
      ),
      dismantleWarning: ACTION_HINTS.dismantleWarning(SYSTEM_NAMES[id]),
    };
  });

  protected readonly collection = computed(() => {
    const selection = this.selection();
    if (selection?.kind !== 'collection') {
      return null;
    }
    const id: CollectionId = selection.id;
    const collection = this.store.state().collections[id];
    return {
      id,
      name: COLLECTION_NAMES[id],
      floor: FLOOR_NAMES[collection.floor],
      intact: collection.intact,
      readout: formatPercent(collection.intact),
      sent: formatPercent(collection.sent),
      rotted: formatPercent(collection.rotted),
      lost: collection.lost,
      transmitting: this.store.state().transmitting === id,
      canTransmit: this.store.canApply({ type: 'transmit-start', collectionId: id }),
      transmitHint: this.transmitHintFor(id),
      rateHint: TRANSMIT_HINTS.rate(
        formatResource(TRANSMIT.unitsPerSecond),
        formatResource(TRANSMIT.energyPerSecond),
      ),
    };
  });

  /** Says why sending is unavailable, or what it will cost — never leaves it blank. */
  private transmitHintFor(id: CollectionId): string {
    const state = this.store.state();
    if (state.systems.transmitter.lost) {
      return TRANSMIT_HINTS.mastLost;
    }
    if (state.transmitting === id) {
      return TRANSMIT_HINTS.sending;
    }
    const collection = state.collections[id];
    if (collection.lost || collection.intact <= 0) {
      return TRANSMIT_HINTS.nothingLeft;
    }
    if (state.transmitting !== null) {
      return TRANSMIT_HINTS.busy(COLLECTION_NAMES[state.transmitting]);
    }
    return TRANSMIT_HINTS.mastWears;
  }

  protected transmit(id: CollectionId): void {
    this.store.dispatch({ type: 'transmit-start', collectionId: id });
  }

  protected stopTransmit(): void {
    this.store.dispatch({ type: 'transmit-stop' });
  }

  protected readonly floor = computed(() => {
    const selection = this.selection();
    if (selection?.kind !== 'floor') {
      return null;
    }
    const index = selection.index;
    const state = this.store.state();
    const names = [
      ...this.store.systemsOnFloor(index).map((id) => SYSTEM_NAMES[id]),
      ...this.store.collectionsOnFloor(index).map((id) => COLLECTION_NAMES[id]),
    ];
    return {
      index,
      indexLabel: formatInteger(index),
      name: FLOOR_NAMES[index],
      humidity: state.humidity[index],
      humidityReadout: formatPercent(state.humidity[index]),
      flooded: this.store.floorIsFlooded(index),
      contents: names.length > 0 ? names.join(' · ') : DETAIL_LABELS.none,
    };
  });

  protected repair(id: SystemId): void {
    this.store.dispatch({ type: 'repair', systemId: id });
  }

  protected toggle(id: SystemId, on: boolean): void {
    this.store.dispatch({ type: 'toggle', systemId: id, on });
  }

  protected askDismantle(id: SystemId): void {
    this.confirmingDismantle.set(id);
    // The pressed button is gone after this; move focus onto the confirmation rather
    // than dropping a keyboard user back onto <body>.
    this.focusAfterRender(() => this.confirmButton()?.focus());
  }

  protected cancelDismantle(): void {
    this.confirmingDismantle.set(null);
  }

  protected dismantle(id: SystemId): void {
    this.store.dispatch({ type: 'dismantle', systemId: id });
    this.store.select(null);
    // The whole panel is replaced; land the player on its heading.
    this.focusAfterRender(() => this.heading()?.nativeElement.focus());
  }

  private focusAfterRender(focus: () => void): void {
    afterNextRender(focus, { injector: this.injector });
  }

  /** Says why the repair button is disabled, so the player is never left guessing. */
  private repairBlockedReason(id: SystemId): string | null {
    const state = this.store.state();
    const system = state.systems[id];
    if (system.lost) {
      return ACTION_HINTS.lost;
    }
    if (system.integrity >= REPAIR.maxIntegrity) {
      return ACTION_HINTS.alreadyFull;
    }
    const preview = this.store.repairPreview(id);
    if (state.material < preview.materialCost) {
      return ACTION_HINTS.notEnoughMaterial;
    }
    if (state.energy < preview.energyCost) {
      return ACTION_HINTS.notEnoughEnergy;
    }
    return null;
  }
}
