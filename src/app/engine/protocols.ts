/**
 * The protocols — the part of the game that plays while nobody is watching.
 *
 * The custodian depot performs at most one action per cooldown. It reads the same
 * state the player sees and calls the same `applyAction`, which is what makes an
 * evening away and an evening at the keyboard the same game.
 *
 * The automation decays like everything else: the weaker the depot, the longer it
 * waits between actions. That is the point, not a flaw.
 */

import { applyAction, canApply, repairPreview } from './actions';
import { CUSTODIAN, SECONDS_PER_TICK } from './balance';
import type { DomainEvent } from './domain-events';
import type { ProtocolCondition, ProtocolRule } from './protocol-types';
import { COLLECTIONS } from './balance';
import type { GameState } from './state';

export interface ProtocolResult {
  state: GameState;
  events: DomainEvent[];
}

/**
 * Seconds the depot waits between actions: `base / (integrity / 100)`, never below the
 * floor. A depot at full health acts every 20 s; at half health every 40 s.
 */
export function cooldownSeconds(state: GameState): number {
  const depot = state.systems.custodian;
  if (depot.lost || depot.integrity <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(
    CUSTODIAN.minCooldownSeconds,
    CUSTODIAN.cooldownBaseSeconds / (depot.integrity / 100),
  );
}

/** Whether the depot can act at all: switched on, not lost, and receiving power. */
export function depotIsWorking(state: GameState): boolean {
  const depot = state.systems.custodian;
  return !depot.lost && depot.on && state.supplyRatio > 0;
}

export function evaluateCondition(state: GameState, condition: ProtocolCondition): boolean {
  switch (condition.kind) {
    case 'system-integrity-below': {
      const system = state.systems[condition.systemId];
      return !system.lost && system.integrity < condition.value;
    }
    case 'water-above':
      return state.water > condition.value;
    case 'energy-below':
      return state.energy < condition.value;
    case 'energy-above':
      return state.energy > condition.value;
    case 'humidity-above':
      return (state.humidity[condition.floor] ?? 0) > condition.value;
    case 'collection-below': {
      const collection = state.collections[condition.collectionId];
      return (collection.intact / COLLECTIONS.unitsEach) * 100 < condition.value;
    }
    case 'material-above':
      return state.material > condition.value;
  }
}

/**
 * Whether the depot may spend on this rule. Beyond affordability it honours the
 * material reserve, so automation cannot empty the stores the player is saving.
 */
export function ruleIsActionable(state: GameState, rule: ProtocolRule): boolean {
  if (!rule.enabled || !evaluateCondition(state, rule.condition)) {
    return false;
  }
  if (!canApply(state, rule.action)) {
    return false;
  }
  if (rule.action.type === 'repair') {
    const cost = repairPreview(state, rule.action.systemId).materialCost;
    if (state.material - cost < state.materialReserve) {
      return false;
    }
  }
  return true;
}

/**
 * One tick of the depot. Advances the cooldown by how much power the depot actually
 * received, then runs the highest-priority rule that matches and is affordable.
 *
 * Scaling the cooldown by the supply ratio rather than stopping outright follows
 * prompt.md section 5.6 — every running consumer works at its share of the power.
 * At a ratio of zero the depot is unsupplied and does nothing, as section 5.9 requires.
 */
export function runProtocols(state: GameState): ProtocolResult {
  const events: DomainEvent[] = [];

  if (!depotIsWorking(state) || state.protocols.length === 0) {
    return { state, events };
  }

  const cooldown = Math.max(0, state.custodianCooldown - state.supplyRatio * SECONDS_PER_TICK);
  if (cooldown > 0) {
    return { state: { ...state, custodianCooldown: cooldown }, events };
  }

  const index = state.protocols.findIndex((rule) => ruleIsActionable(state, rule));
  if (index < 0) {
    // Ready, but nothing to do. The depot stays ready rather than idling a cooldown away.
    return { state: { ...state, custodianCooldown: 0 }, events };
  }

  const rule = state.protocols[index];
  const result = applyAction(state, rule.action);
  if (!result.applied) {
    return { state: { ...state, custodianCooldown: 0 }, events };
  }

  const next = result.state;
  next.custodianCooldown = cooldownSeconds(next);
  next.protocols = next.protocols.map((current, position) =>
    position === index ? { ...current, firedCount: current.firedCount + 1 } : current,
  );

  events.push(...result.events);
  events.push({ type: 'protocol-fired', tick: next.tick, ruleId: rule.id, action: rule.action });

  return { state: next, events };
}
