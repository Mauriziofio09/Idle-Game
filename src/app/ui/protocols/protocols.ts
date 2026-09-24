import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  viewChild,
  viewChildren,
} from '@angular/core';

import {
  COLLECTION_NAMES,
  CONDITION_LABELS,
  CONDITION_UNITS,
  FLOOR_NAMES,
  PROTOCOL_ACTION_LABELS,
  PROTOCOL_LABELS,
  SYSTEM_NAMES,
} from '../../content/de';
import { METRES_PER_FLOOR, PROTOCOLS, WATER } from '../../engine/balance';
import type { ProtocolCondition, ProtocolRule } from '../../engine/protocol-types';
import { COLLECTION_IDS, SYSTEM_IDS, type CollectionId, type SystemId } from '../../engine/state';
import { GameStore } from '../../game/game-store';
import { formatInteger, formatSeconds } from '../../format';

type ConditionKind = ProtocolCondition['kind'];
type ActionChoice = 'repair' | 'toggle-on' | 'toggle-off' | 'transmit-start' | 'transmit-stop';

/** Which target an action needs: a system, a collection, or nothing at all. */
const ACTION_TARGET: Record<ActionChoice, 'system' | 'collection' | 'none'> = {
  repair: 'system',
  'toggle-on': 'system',
  'toggle-off': 'system',
  'transmit-start': 'collection',
  'transmit-stop': 'none',
};

/** Which extra dropdown a condition needs, if any. */
const CONDITION_TARGET: Record<ConditionKind, 'system' | 'collection' | 'floor' | 'none'> = {
  'system-integrity-below': 'system',
  'water-above': 'none',
  'energy-below': 'none',
  'energy-above': 'none',
  'humidity-above': 'floor',
  'collection-below': 'collection',
  'material-above': 'none',
};

/** The unit the threshold is typed in. Water is metres to the player, floors inside. */
const CONDITION_UNIT: Record<ConditionKind, keyof typeof CONDITION_UNITS> = {
  'system-integrity-below': 'percent',
  'water-above': 'metres',
  'energy-below': 'amount',
  'energy-above': 'amount',
  'humidity-above': 'percent',
  'collection-below': 'percent',
  'material-above': 'amount',
};

/**
 * The protocol editor.
 *
 * A rule reads as a sentence — "Wenn Pumpen unter 40 % dann Pumpen reparieren" — and is
 * edited through the dropdowns and the number inside that sentence. Order is priority,
 * and it can be changed from the keyboard alone.
 */
@Component({
  selector: 'app-protocols',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './protocols.html',
  styleUrl: './protocols.css',
})
export class Protocols {
  private readonly store = inject(GameStore);
  private readonly injector = inject(Injector);
  private readonly ruleItems = viewChildren<ElementRef<HTMLElement>>('ruleItem');

  protected readonly labels = PROTOCOL_LABELS;
  protected readonly conditionLabels = CONDITION_LABELS;
  protected readonly actionLabels = PROTOCOL_ACTION_LABELS;

  protected readonly conditionKinds = Object.keys(CONDITION_LABELS) as ConditionKind[];
  protected readonly actionChoices: ActionChoice[] = [
    'repair',
    'toggle-on',
    'toggle-off',
    'transmit-start',
    'transmit-stop',
  ];
  protected readonly systems = SYSTEM_IDS.map((id) => ({ id, name: SYSTEM_NAMES[id] }));
  protected readonly collections = COLLECTION_IDS.map((id) => ({
    id,
    name: COLLECTION_NAMES[id],
  }));
  protected readonly floors = FLOOR_NAMES.map((name, index) => ({ index, name }));

  protected readonly canAdd = this.store.canAddProtocol;
  protected readonly depotWorking = this.store.depotWorking;
  protected readonly maxReserve = PROTOCOLS.maxMaterialReserve;
  protected readonly reserve = this.store.materialReserve;

  private readonly addButton = viewChild<ElementRef<HTMLButtonElement>>('addButton');

  protected readonly slotsLabel = computed(() =>
    PROTOCOL_LABELS.slots(
      formatInteger(this.store.protocols().length),
      formatInteger(this.store.protocolSlots()),
    ),
  );

  protected readonly depotRate = computed(() => {
    const seconds = this.store.depotCooldownSeconds();
    return Number.isFinite(seconds)
      ? PROTOCOL_LABELS.depotRate(formatSeconds(Math.round(seconds)))
      : null;
  });

  protected readonly rules = computed(() =>
    this.store.protocols().map((rule, index) => {
      const position = formatInteger(index + 1);
      const unit = CONDITION_UNITS[CONDITION_UNIT[rule.condition.kind]];
      return {
      rule,
      index,
      name: PROTOCOL_LABELS.ruleName(position),
      conditionLabel: PROTOCOL_LABELS.conditionFor(position),
      conditionTargetLabel: PROTOCOL_LABELS.conditionTargetFor(position),
      thresholdLabel: PROTOCOL_LABELS.thresholdFor(position, unit),
      actionLabel: PROTOCOL_LABELS.actionFor(position),
      actionTargetLabel: PROTOCOL_LABELS.actionTargetFor(position),
      moveUpLabel: PROTOCOL_LABELS.moveUpFor(position),
      moveDownLabel: PROTOCOL_LABELS.moveDownFor(position),
      removeLabel: PROTOCOL_LABELS.removeFor(position),
      enabledLabel: PROTOCOL_LABELS.enabledFor(position),
      first: index === 0,
      last: index === this.store.protocols().length - 1,
      kind: rule.condition.kind,
      targetKind: CONDITION_TARGET[rule.condition.kind],
      unit,
      threshold: this.thresholdFor(rule.condition),
      systemTarget: 'systemId' in rule.condition ? rule.condition.systemId : SYSTEM_IDS[0],
      collectionTarget:
        'collectionId' in rule.condition ? rule.condition.collectionId : COLLECTION_IDS[0],
      floorTarget: 'floor' in rule.condition ? rule.condition.floor : 0,
      actionChoice: this.actionChoiceOf(rule),
      actionTargetKind: ACTION_TARGET[this.actionChoiceOf(rule)],
      actionSystem: 'systemId' in rule.action ? rule.action.systemId : SYSTEM_IDS[0],
      actionCollection:
        'collectionId' in rule.action ? rule.action.collectionId : COLLECTION_IDS[0],
      firedLabel: PROTOCOL_LABELS.fired(formatInteger(rule.firedCount)),
      };
    }),
  );

  protected add(): void {
    // A first rule that already makes sense: keep the pumps alive.
    this.store.addProtocol(
      { kind: 'system-integrity-below', systemId: 'pumps', value: 50 },
      { type: 'repair', systemId: 'pumps' },
    );
  }

  protected remove(id: string): void {
    const rules = this.store.protocols();
    const index = rules.findIndex((rule) => rule.id === id);
    const neighbour = rules[index + 1]?.id ?? rules[index - 1]?.id ?? null;
    this.store.removeProtocol(id);
    // The whole row is gone; land on the rule that took its place.
    afterNextRender(
      () => {
        if (neighbour) {
          this.focusRule(neighbour);
        } else {
          this.addButton()?.nativeElement.focus();
        }
      },
      { injector: this.injector },
    );
  }

  private focusRule(id: string): void {
    const index = this.store.protocols().findIndex((rule) => rule.id === id);
    const item = this.ruleItems()[index];
    item?.nativeElement.querySelector<HTMLElement>('button, select, input')?.focus();
  }

  /**
   * Moving a rule to an end disables the very button that was pressed, which drops
   * keyboard focus to <body>. Focus follows the rule instead, so the player keeps
   * their place in the list.
   */
  protected move(id: string, direction: -1 | 1, pressed: HTMLElement): void {
    this.store.moveProtocol(id, direction);
    afterNextRender(
      () => {
        if (pressed.isConnected && !(pressed as HTMLButtonElement).disabled) {
          pressed.focus();
          return;
        }
        this.focusRule(id);
      },
      { injector: this.injector },
    );
  }

  protected setEnabled(id: string, enabled: boolean): void {
    this.store.updateProtocol(id, { enabled });
  }

  protected setConditionKind(rule: ProtocolRule, kind: ConditionKind): void {
    this.store.updateProtocol(rule.id, { condition: this.defaultCondition(kind) });
  }

  protected setConditionSystem(rule: ProtocolRule, systemId: SystemId): void {
    if (rule.condition.kind !== 'system-integrity-below') {
      return;
    }
    this.store.updateProtocol(rule.id, { condition: { ...rule.condition, systemId } });
  }

  protected setConditionCollection(rule: ProtocolRule, collectionId: CollectionId): void {
    if (rule.condition.kind !== 'collection-below') {
      return;
    }
    this.store.updateProtocol(rule.id, { condition: { ...rule.condition, collectionId } });
  }

  protected setConditionFloor(rule: ProtocolRule, floor: number): void {
    if (rule.condition.kind !== 'humidity-above') {
      return;
    }
    this.store.updateProtocol(rule.id, { condition: { ...rule.condition, floor } });
  }

  protected setThreshold(rule: ProtocolRule, field: HTMLInputElement): void {
    const typed = Number(field.value);
    const value = Number.isFinite(typed) ? typed : 0;
    // The water level is typed in metres and kept in floors.
    const stored =
      rule.condition.kind === 'water-above'
        ? Math.max(0, Math.min(WATER.max, value / METRES_PER_FLOOR))
        : Math.max(0, value);
    this.store.updateProtocol(rule.id, { condition: { ...rule.condition, value: stored } });

    // A clamped value may leave the state unchanged, and then the binding would not
    // repaint — the field would go on showing a number the archive is not using.
    field.value = String(this.thresholdFor({ ...rule.condition, value: stored }));
  }

  protected setAction(rule: ProtocolRule, choice: ActionChoice): void {
    const systemId = 'systemId' in rule.action ? rule.action.systemId : SYSTEM_IDS[0];
    const collectionId =
      'collectionId' in rule.action ? rule.action.collectionId : COLLECTION_IDS[0];
    this.store.updateProtocol(rule.id, { action: this.actionFor(choice, systemId, collectionId) });
  }

  protected setActionSystem(rule: ProtocolRule, systemId: SystemId): void {
    const collectionId =
      'collectionId' in rule.action ? rule.action.collectionId : COLLECTION_IDS[0];
    this.store.updateProtocol(rule.id, {
      action: this.actionFor(this.actionChoiceOf(rule), systemId, collectionId),
    });
  }

  protected setActionCollection(rule: ProtocolRule, collectionId: CollectionId): void {
    const systemId = 'systemId' in rule.action ? rule.action.systemId : SYSTEM_IDS[0];
    this.store.updateProtocol(rule.id, {
      action: this.actionFor(this.actionChoiceOf(rule), systemId, collectionId),
    });
  }

  protected setReserve(field: HTMLInputElement): void {
    const typed = Number(field.value);
    this.store.setMaterialReserve(Number.isFinite(typed) ? typed : 0);
    field.value = String(this.store.materialReserve());
  }

  private actionChoiceOf(rule: ProtocolRule): ActionChoice {
    switch (rule.action.type) {
      case 'repair':
        return 'repair';
      case 'transmit-start':
        return 'transmit-start';
      case 'transmit-stop':
        return 'transmit-stop';
      case 'toggle':
        return rule.action.on ? 'toggle-on' : 'toggle-off';
    }
  }

  private actionFor(
    choice: ActionChoice,
    systemId: SystemId,
    collectionId: CollectionId,
  ): ProtocolRule['action'] {
    switch (choice) {
      case 'repair':
        return { type: 'repair', systemId };
      case 'transmit-start':
        return { type: 'transmit-start', collectionId };
      case 'transmit-stop':
        return { type: 'transmit-stop' };
      default:
        return { type: 'toggle', systemId, on: choice === 'toggle-on' };
    }
  }

  private thresholdFor(condition: ProtocolCondition): number {
    if (condition.kind === 'water-above') {
      return Math.round(condition.value * METRES_PER_FLOOR * 10) / 10;
    }
    return Math.round(condition.value * 10) / 10;
  }

  private defaultCondition(kind: ConditionKind): ProtocolCondition {
    switch (kind) {
      case 'system-integrity-below':
        return { kind, systemId: 'pumps', value: 50 };
      case 'water-above':
        return { kind, value: 1 };
      case 'energy-below':
        return { kind, value: 30 };
      case 'energy-above':
        return { kind, value: 100 };
      case 'humidity-above':
        return { kind, floor: 0, value: 70 };
      case 'collection-below':
        return { kind, collectionId: 'maps', value: 50 };
      case 'material-above':
        return { kind, value: 20 };
    }
  }
}
