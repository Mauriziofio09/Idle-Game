import { DISMANTLE, ENTROPY, REPAIR } from './balance';
import { applyAction, canApply, dismantleYield, repairPreview, workshopFactor } from './actions';
import { createInitialState, type GameState } from './state';

function withSystem(state: GameState, patch: Partial<GameState['systems']>): GameState {
  return { ...state, systems: { ...state.systems, ...patch } };
}

describe('repair', () => {
  it('yields diminishing returns with every repeat', () => {
    let state = createInitialState('4F2A');
    state = { ...state, material: 1000, energy: 1000 };

    const gains: number[] = [];
    for (let i = 0; i < 4; i++) {
      // Keep headroom so the 100 % cap never hides the diminishing curve.
      state = withSystem(state, { pumps: { ...state.systems.pumps, integrity: 10 } });
      const preview = repairPreview(state, 'pumps');
      gains.push(preview.gain);
      state = applyAction(state, { type: 'repair', systemId: 'pumps' }).state;
    }

    for (let i = 1; i < gains.length; i++) {
      expect(gains[i]).toBeCloseTo(gains[i - 1] * REPAIR.diminishing, 10);
    }
  });

  it('is worth more with a healthy workshop and least with none', () => {
    const base = createInitialState('4F2A');

    const withoutWorkshop = withSystem(base, {
      workshop: { ...base.systems.workshop, lost: true, on: false, integrity: 0 },
    });
    expect(workshopFactor(withoutWorkshop)).toBe(REPAIR.workshopFloor);

    const switchedOff = withSystem(base, { workshop: { ...base.systems.workshop, on: false } });
    expect(workshopFactor(switchedOff)).toBe(REPAIR.workshopFloor);

    const perfect = withSystem(base, { workshop: { ...base.systems.workshop, integrity: 100 } });
    expect(workshopFactor(perfect)).toBeCloseTo(
      REPAIR.workshopFloor + REPAIR.workshopRange,
      10,
    );
    expect(workshopFactor(perfect)).toBeGreaterThan(workshopFactor(withoutWorkshop));
  });

  it('charges material that grows with each repair, plus fixed energy and entropy', () => {
    let state = createInitialState('4F2A');
    state = { ...state, material: 1000, energy: 1000 };

    const first = repairPreview(state, 'pumps');
    expect(first.materialCost).toBeCloseTo(REPAIR.materialBase, 10);
    expect(first.energyCost).toBe(REPAIR.energyCost);
    expect(first.entropyCost).toBe(ENTROPY.perRepair);

    const materialBefore = state.material;
    const energyBefore = state.energy;
    state = applyAction(state, { type: 'repair', systemId: 'pumps' }).state;
    expect(state.material).toBeCloseTo(materialBefore - first.materialCost, 10);
    expect(state.energy).toBeCloseTo(energyBefore - first.energyCost, 10);

    const second = repairPreview(state, 'pumps');
    expect(second.materialCost).toBeCloseTo(
      REPAIR.materialBase * (1 + REPAIR.materialGrowth),
      10,
    );
  });

  it('never pushes integrity above 100', () => {
    let state = createInitialState('4F2A');
    state = { ...state, material: 1000, energy: 1000 };
    state = withSystem(state, { pumps: { ...state.systems.pumps, integrity: 95 } });

    state = applyAction(state, { type: 'repair', systemId: 'pumps' }).state;
    expect(state.systems.pumps.integrity).toBe(REPAIR.maxIntegrity);
  });

  it('is rejected when material or energy is short, and changes nothing', () => {
    const base = createInitialState('4F2A');

    const broke = { ...base, material: 0, energy: 1000 };
    const noMaterial = applyAction(broke, { type: 'repair', systemId: 'pumps' });
    expect(noMaterial.applied).toBe(false);
    expect(noMaterial.state).toBe(broke);
    expect(noMaterial.events[0]).toMatchObject({ reason: 'not-enough-material' });
    expect(canApply(broke, { type: 'repair', systemId: 'pumps' })).toBe(false);

    const dark = { ...base, material: 1000, energy: 0 };
    const noEnergy = applyAction(dark, { type: 'repair', systemId: 'pumps' });
    expect(noEnergy.applied).toBe(false);
    expect(noEnergy.events[0]).toMatchObject({ reason: 'not-enough-energy' });
  });
});

describe('dismantle', () => {
  it('pays more the healthier the system still is', () => {
    const base = createInitialState('4F2A');
    const healthy = withSystem(base, { roof: { ...base.systems.roof, integrity: 100 } });
    const ruined = withSystem(base, { roof: { ...base.systems.roof, integrity: 0 } });

    expect(dismantleYield(healthy, 'roof')).toBeCloseTo(
      DISMANTLE.materialBase + DISMANTLE.materialPerIntegrity,
      10,
    );
    expect(dismantleYield(ruined, 'roof')).toBeCloseTo(DISMANTLE.materialBase, 10);
    expect(dismantleYield(healthy, 'roof')).toBeGreaterThan(dismantleYield(ruined, 'roof'));
  });

  it('is irreversible: a lost system stays lost and refuses every action', () => {
    const base = { ...createInitialState('4F2A'), material: 1000, energy: 1000 };
    const after = applyAction(base, { type: 'dismantle', systemId: 'roof' }).state;

    expect(after.systems.roof.lost).toBe(true);
    expect(after.systems.roof.on).toBe(false);
    expect(after.systems.roof.integrity).toBe(0);

    for (const action of [
      { type: 'repair', systemId: 'roof' },
      { type: 'toggle', systemId: 'roof', on: true },
      { type: 'dismantle', systemId: 'roof' },
    ] as const) {
      const result = applyAction(after, action);
      expect(result.applied).toBe(false);
      expect(result.events[0]).toMatchObject({ reason: 'system-lost' });
      expect(canApply(after, action)).toBe(false);
    }
  });
});

describe('toggle', () => {
  it('switches a system and reports it once', () => {
    const base = createInitialState('4F2A');
    const off = applyAction(base, { type: 'toggle', systemId: 'climate', on: false });
    expect(off.applied).toBe(true);
    expect(off.state.systems.climate.on).toBe(false);
    expect(off.events[0]).toMatchObject({ type: 'system-toggled', on: false });

    const again = applyAction(off.state, { type: 'toggle', systemId: 'climate', on: false });
    expect(again.applied).toBe(false);
    expect(again.state).toBe(off.state);
  });
});

describe('purity', () => {
  it('leaves the input state untouched', () => {
    const base = { ...createInitialState('4F2A'), material: 1000, energy: 1000 };
    const snapshot = JSON.stringify(base);
    applyAction(base, { type: 'repair', systemId: 'pumps' });
    applyAction(base, { type: 'dismantle', systemId: 'roof' });
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
