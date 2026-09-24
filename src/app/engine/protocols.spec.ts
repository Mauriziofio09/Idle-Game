import { CUSTODIAN, PROTOCOLS, REPAIR } from './balance';
import { simulate, simulateInChunks } from './offline';
import type { ProtocolRule } from './protocol-types';
import { applyAction } from './actions';
import { cooldownSeconds, depotIsWorking, evaluateCondition, runProtocols } from './protocols';
import { createInitialState, type GameState } from './state';
import { step } from './step';

function rule(partial: Partial<ProtocolRule> = {}): ProtocolRule {
  return {
    id: 'r1',
    condition: { kind: 'system-integrity-below', systemId: 'pumps', value: 100 },
    action: { type: 'repair', systemId: 'pumps' },
    enabled: true,
    firedCount: 0,
    ...partial,
  };
}

/** A well-stocked archive whose depot is ready to act this very tick. */
function readyState(rules: ProtocolRule[], patch: Partial<GameState> = {}): GameState {
  const base = createInitialState('4F2A');
  return {
    ...base,
    material: 500,
    energy: 140,
    supplyRatio: 1,
    custodianCooldown: 0,
    protocols: rules,
    ...patch,
  };
}

describe('the custodian cooldown', () => {
  it('waits longer the weaker the depot is', () => {
    const base = createInitialState('4F2A');
    const full = { ...base, systems: { ...base.systems, custodian: { ...base.systems.custodian, integrity: 100 } } };
    const half = { ...base, systems: { ...base.systems, custodian: { ...base.systems.custodian, integrity: 50 } } };

    expect(cooldownSeconds(full)).toBe(CUSTODIAN.cooldownBaseSeconds);
    expect(cooldownSeconds(half)).toBe(CUSTODIAN.cooldownBaseSeconds * 2);
    // The automation decaying is the point, not a flaw.
    expect(cooldownSeconds(half)).toBeGreaterThan(cooldownSeconds(full));
  });

  it('never drops below the floor', () => {
    const base = createInitialState('4F2A');
    const impossible = {
      ...base,
      systems: { ...base.systems, custodian: { ...base.systems.custodian, integrity: 1000 } },
    };
    expect(cooldownSeconds(impossible)).toBe(CUSTODIAN.minCooldownSeconds);
  });

  it('is unreachable for a lost depot', () => {
    const base = createInitialState('4F2A');
    const lost = {
      ...base,
      systems: { ...base.systems, custodian: { integrity: 0, on: false, repairs: 0, lost: true } },
    };
    expect(cooldownSeconds(lost)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('when the depot may act at all', () => {
  it('needs to be switched on, intact and supplied', () => {
    const base = createInitialState('4F2A');
    expect(depotIsWorking({ ...base, supplyRatio: 1 })).toBe(true);

    const off = { ...base, systems: { ...base.systems, custodian: { ...base.systems.custodian, on: false } } };
    expect(depotIsWorking(off)).toBe(false);

    const lost = {
      ...base,
      systems: { ...base.systems, custodian: { integrity: 0, on: false, repairs: 0, lost: true } },
    };
    expect(depotIsWorking(lost)).toBe(false);

    expect(depotIsWorking({ ...base, supplyRatio: 0 })).toBe(false);
  });

  it('runs nothing without a depot, however good the rules are', () => {
    const base = readyState([rule()]);
    const withoutDepot = {
      ...base,
      systems: { ...base.systems, custodian: { integrity: 0, on: false, repairs: 0, lost: true } },
    };
    const result = runProtocols(withoutDepot);
    expect(result.state).toBe(withoutDepot);
    expect(result.events).toEqual([]);
  });

  it('runs nothing without power', () => {
    const starved = readyState([rule()], { supplyRatio: 0 });
    expect(runProtocols(starved).events).toEqual([]);
  });
});

describe('conditions', () => {
  const base = readyState([]);

  it('reads every kind the editor offers', () => {
    expect(evaluateCondition(base, { kind: 'water-above', value: -1 })).toBe(true);
    expect(evaluateCondition(base, { kind: 'water-above', value: 10 })).toBe(false);

    expect(evaluateCondition(base, { kind: 'energy-below', value: 1000 })).toBe(true);
    expect(evaluateCondition(base, { kind: 'energy-above', value: 1000 })).toBe(false);

    expect(evaluateCondition(base, { kind: 'material-above', value: 1 })).toBe(true);
    expect(evaluateCondition(base, { kind: 'humidity-above', floor: 0, value: -1 })).toBe(true);

    expect(
      evaluateCondition(base, { kind: 'collection-below', collectionId: 'maps', value: 101 }),
    ).toBe(true);
    expect(
      evaluateCondition(base, { kind: 'collection-below', collectionId: 'maps', value: 1 }),
    ).toBe(false);
  });

  it('never fires a system rule for a system that is already gone', () => {
    const lost = {
      ...base,
      systems: { ...base.systems, pumps: { integrity: 0, on: false, repairs: 0, lost: true } },
    };
    expect(
      evaluateCondition(lost, { kind: 'system-integrity-below', systemId: 'pumps', value: 50 }),
    ).toBe(false);
  });
});

describe('running the protocols', () => {
  it('takes the highest matching rule, not the first that matches later', () => {
    const state = readyState([
      rule({ id: 'top', action: { type: 'repair', systemId: 'generator' } }),
      rule({ id: 'below', action: { type: 'repair', systemId: 'roof' } }),
    ]);

    const result = runProtocols(state);
    expect(result.state.systems.generator.repairs).toBe(1);
    expect(result.state.systems.roof.repairs).toBe(0);
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'protocol-fired', ruleId: 'top' }));
  });

  it('skips a rule it cannot pay for and takes the next one', () => {
    const state = readyState(
      [
        rule({ id: 'expensive', action: { type: 'repair', systemId: 'generator' } }),
        rule({
          id: 'free',
          condition: { kind: 'material-above', value: -1 },
          action: { type: 'toggle', systemId: 'climate', on: false },
        }),
      ],
      { material: 0 },
    );

    const result = runProtocols(state);
    expect(result.state.systems.generator.repairs).toBe(0);
    expect(result.state.systems.climate.on).toBe(false);
    expect(result.events).toContainEqual(expect.objectContaining({ ruleId: 'free' }));
  });

  it('skips a rule whose condition does not hold', () => {
    const state = readyState([
      rule({ id: 'idle', condition: { kind: 'water-above', value: 4 } }),
      rule({ id: 'active', action: { type: 'repair', systemId: 'roof' } }),
    ]);
    expect(runProtocols(state).state.systems.roof.repairs).toBe(1);
  });

  it('ignores a rule the player switched off', () => {
    const state = readyState([rule({ enabled: false })]);
    expect(runProtocols(state).events).toEqual([]);
  });

  it('counts every firing on the rule itself', () => {
    // The pumps start low on purpose: a stronger repair once lifted them to 100 on the
    // first firing, the rule's own condition stopped holding, and the count stayed at 1.
    const base = createInitialState('4F2A');
    let state = readyState([rule()], {
      systems: { ...base.systems, pumps: { ...base.systems.pumps, integrity: 10 } },
    });
    state = runProtocols(state).state;
    expect(state.protocols[0].firedCount).toBe(1);

    state = { ...state, custodianCooldown: 0 };
    state = runProtocols(state).state;
    expect(state.protocols[0].firedCount).toBe(2);
  });

  it('acts once per cooldown, not once per tick', () => {
    const state = readyState([rule()]);
    const after = runProtocols(state).state;
    expect(after.custodianCooldown).toBeCloseTo(cooldownSeconds(after), 6);

    // Immediately afterwards it is not ready again.
    const again = runProtocols(after);
    expect(again.events).toEqual([]);
    expect(again.state.systems.pumps.repairs).toBe(after.systems.pumps.repairs);
  });

  it('counts the cooldown down by the power it actually receives', () => {
    const state = readyState([rule()], { custodianCooldown: 10, supplyRatio: 0.5 });
    const after = runProtocols(state).state;
    // Half the power, half the progress.
    expect(after.custodianCooldown).toBeCloseTo(9.5, 6);
  });

  it('stays ready while nothing matches, instead of idling a cooldown away', () => {
    const state = readyState([rule({ condition: { kind: 'water-above', value: 4 } })]);
    const after = runProtocols(state).state;
    expect(after.custodianCooldown).toBe(0);
  });
});

describe('the material reserve', () => {
  it('stops protocols from spending below it', () => {
    const preview = REPAIR.materialBase;
    const state = readyState([rule()], { material: preview + 5, materialReserve: 10 });

    // The repair would leave 5 material, below the reserve of 10.
    expect(runProtocols(state).events).toEqual([]);
  });

  it('lets a repair through that keeps the reserve intact', () => {
    const state = readyState([rule()], { material: REPAIR.materialBase + 20, materialReserve: 10 });
    expect(runProtocols(state).state.systems.pumps.repairs).toBe(1);
  });

  it('never restrains the player, only the automation', () => {
    const state = readyState([rule()], { material: REPAIR.materialBase + 2, materialReserve: 100 });

    // The depot refuses: the repair would break into the reserve.
    expect(runProtocols(state).events).toEqual([]);

    // The player's own path spends the same material without a second thought.
    const byHand = applyAction(state, { type: 'repair', systemId: 'pumps' });
    expect(byHand.applied).toBe(true);
    expect(byHand.state.material).toBeLessThan(state.materialReserve);
  });

  it('starts at the documented default', () => {
    expect(createInitialState('4F2A').materialReserve).toBe(PROTOCOLS.defaultMaterialReserve);
  });
});

describe('protocols inside the tick', () => {
  it('keep a system alive that would otherwise be lost', () => {
    const withRule = readyState(
      [rule({ condition: { kind: 'system-integrity-below', systemId: 'pumps', value: 60 } })],
      { material: 5000, energy: 150 },
    );
    const without = { ...withRule, protocols: [] };

    const guarded = simulate(withRule, 600).state;
    const abandoned = simulate(without, 600).state;

    expect(guarded.systems.pumps.integrity).toBeGreaterThan(abandoned.systems.pumps.integrity);
    expect(guarded.protocols[0].firedCount).toBeGreaterThan(0);
  });

  it('give the same run whether it is played through, chunked, or caught up offline', () => {
    // The backbone of "offline is the same game". Without a rule in the state this
    // guarantee was never exercised with the depot acting.
    const start = readyState([rule()], { material: 5000 });

    let straight = start;
    for (let i = 0; i < 1200 && !straight.ended; i++) {
      straight = step(straight).state;
    }

    const chunked = simulateInChunks(start, 1200).state;
    expect(chunked).toEqual(straight);

    // And in uneven chunks, the way a hidden tab produces them.
    let uneven = start;
    for (const size of [1, 7, 60, 300, 2, 830]) {
      uneven = simulate(uneven, size).state;
    }
    expect(uneven).toEqual(straight);

    expect(straight.protocols[0].firedCount).toBeGreaterThan(3);
  });
});
