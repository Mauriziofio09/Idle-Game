import { COLLECTIONS, PROTOCOLS } from '../engine/balance';
import {
  COLLECTION_IDS,
  SYSTEM_IDS,
  createInitialState,
  SCHEMA_VERSION,
} from '../engine/state';
import { FLOOR_COUNT } from '../engine/balance';
import { stateToSeed } from '../engine/rng';
import { simulate } from '../engine/offline';
import {
  CURRENT_SCHEMA_VERSION,
  EXPORT_FORMAT,
  checksum,
  decodeExport,
  encodeExport,
  parseSaveFile,
  validateState,
  type SaveFile,
} from './save-format';

function fileFor(state = createInitialState('4F2A')): SaveFile {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, savedAt: 1_700_000_000_000, state };
}

/** Rebuilds an export string around a tampered payload, so only the payload is wrong. */
function exportWithPayload(payload: string, sum = checksum(payload)): string {
  return btoa(
    unescape(
      encodeURIComponent(JSON.stringify({ format: EXPORT_FORMAT, checksum: sum, payload })),
    ),
  );
}

describe('save round trip', () => {
  it('survives an export and import unchanged', () => {
    const played = simulate(createInitialState('4F2A'), 300).state;
    const result = decodeExport(encodeExport(fileFor(played)));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.state).toEqual(played);
      expect(result.file.savedAt).toBe(1_700_000_000_000);
    }
  });

  it('keeps a run deterministic across a save and reload', () => {
    const played = simulate(createInitialState('4F2A'), 300).state;
    const reloaded = decodeExport(encodeExport(fileFor(played)));
    expect(reloaded.ok).toBe(true);
    if (!reloaded.ok) return;

    // The generator state travels with the save, so the future is identical.
    expect(simulate(reloaded.file.state, 200).state).toEqual(simulate(played, 200).state);
  });
});

describe('a save that cannot be trusted', () => {
  it('rejects anything that is not one of our exports', () => {
    expect(decodeExport('')).toMatchObject({ ok: false });
    expect(decodeExport('nonsense!!')).toMatchObject({ ok: false });
    expect(decodeExport(btoa('{"not":"ours"}'))).toMatchObject({
      ok: false,
      problem: 'wrong-format',
    });
  });

  it('notices a truncated or edited payload through the checksum', () => {
    const original = encodeExport(fileFor());
    const decoded = JSON.parse(atob(original)) as { payload: string; checksum: string };

    const tampered = decoded.payload.replace('"material":50', '"material":9999');
    expect(tampered).not.toBe(decoded.payload);

    // Payload changed, checksum left alone: exactly what hand-editing looks like.
    expect(exportWithPayload(tampered, decoded.checksum)).toBeTruthy();
    expect(decodeExport(exportWithPayload(tampered, decoded.checksum))).toMatchObject({
      ok: false,
      problem: 'checksum-mismatch',
    });
  });

  it('refuses a save from a newer build rather than guessing', () => {
    const file = { ...fileFor(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    expect(parseSaveFile(JSON.stringify(file))).toMatchObject({
      ok: false,
      problem: 'unsupported-version',
    });
  });

  it('never throws, whatever it is handed', () => {
    const nasty = [
      '', '{', '[]', 'null', 'true', '"string"', '{"schemaVersion":"one"}',
      JSON.stringify({ schemaVersion: 1, state: null }),
      JSON.stringify({ schemaVersion: 1, state: { seed: 'A' } }),
      JSON.stringify({ schemaVersion: -1, state: {} }),
    ];
    for (const input of nasty) {
      expect(() => parseSaveFile(input)).not.toThrow();
      expect(parseSaveFile(input).ok).toBe(false);
    }
    for (const input of ['', 'x', '===', btoa('[]')]) {
      expect(() => decodeExport(input)).not.toThrow();
      expect(decodeExport(input).ok).toBe(false);
    }
  });
});

describe('validation', () => {
  const base = createInitialState('4F2A');

  it('accepts a state the engine produced', () => {
    expect(validateState(JSON.parse(JSON.stringify(base)))).not.toBeNull();
  });

  it('refuses values outside their range', () => {
    const cases: Record<string, unknown> = {
      water: 99,
      energy: -1,
      entropy: Number.NaN,
      supplyRatio: 2,
      tick: -5,
      rngState: 'x',
      material: -1,
    };
    for (const [field, value] of Object.entries(cases)) {
      const broken = { ...JSON.parse(JSON.stringify(base)), [field]: value };
      expect(validateState(broken)).toBeNull();
    }
  });

  it('accepts the signed generator states mulberry32 produces', () => {
    // mulberry32 keeps its state as a signed 32-bit integer, so a good half of all
    // archives carry a negative one. Every seed the game can hand out must validate.
    let sawNegative = false;
    let sawPositive = false;
    for (let i = 0; i < 64; i++) {
      const state = createInitialState(stateToSeed(i * 2654435761));
      sawNegative ||= state.rngState < 0;
      sawPositive ||= state.rngState > 0;
      expect(validateState(JSON.parse(JSON.stringify(state)))).not.toBeNull();
    }
    expect(sawNegative).toBe(true);
    expect(sawPositive).toBe(true);

    // A non-integer is still nonsense, whatever its sign.
    const broken = { ...JSON.parse(JSON.stringify(base)), rngState: 1.5 };
    expect(validateState(broken)).toBeNull();
  });

  it('accepts every state a run actually passes through', () => {
    // Amounts are summed tick after tick. A validator that refuses the resulting float
    // drift would declare a healthy archive corrupt and fall back to the backup —
    // exactly the bug this test exists to prevent.
    let state = base;
    for (let i = 0; i < 60 && !state.ended; i++) {
      state = simulate(state, 30).state;
      const validated = validateState(JSON.parse(JSON.stringify(state)));
      expect(validated).not.toBeNull();
    }
    // The run really did reach the point where collections are gone.
    expect(state.collections.maps.lost).toBe(true);
  });

  it('refuses a humidity array of the wrong length', () => {
    const broken = { ...JSON.parse(JSON.stringify(base)), humidity: [1, 2, 3] };
    expect(validateState(broken)).toBeNull();
  });

  it('refuses a system that is lost but still running', () => {
    const broken = JSON.parse(JSON.stringify(base));
    broken.systems.pumps = { integrity: 40, on: true, repairs: 0, lost: true };
    expect(validateState(broken)).toBeNull();
  });

  it('refuses a collection whose units do not add up', () => {
    const broken = JSON.parse(JSON.stringify(base));
    broken.collections.maps = {
      floor: 0,
      intact: COLLECTIONS.unitsEach,
      sent: 40,
      rotted: 0,
      lost: false,
    };
    expect(validateState(broken)).toBeNull();
  });

  it('refuses a run that claims to have ended without saying how', () => {
    const broken = { ...JSON.parse(JSON.stringify(base)), ended: true, endReason: null };
    expect(validateState(broken)).toBeNull();

    const alsoBroken = { ...JSON.parse(JSON.stringify(base)), ended: false, endReason: 'silence' };
    expect(validateState(alsoBroken)).toBeNull();
  });

  it('refuses a missing system outright', () => {
    const broken = JSON.parse(JSON.stringify(base));
    delete broken.systems.roof;
    expect(validateState(broken)).toBeNull();
  });
});

describe('migration', () => {
  it('lifts a version 0 save to the current schema', () => {
    // v0 is the pre-release shape: no supply ratio, no protocols.
    const v0 = JSON.parse(JSON.stringify(createInitialState('4F2A')));
    delete v0.supplyRatio;
    delete v0.protocols;
    delete v0.protocolSlots;
    delete v0.custodianCooldown;
    v0.schemaVersion = 0;

    const result = parseSaveFile(JSON.stringify({ schemaVersion: 0, savedAt: 1, state: v0 }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.file.state.supplyRatio).toBe(1);
    expect(result.file.state.protocols).toEqual([]);
    expect(result.file.state.protocolSlots).toBe(PROTOCOLS.startingSlots);
    expect(result.file.state.custodianCooldown).toBe(0);
    // Everything the old save did carry is preserved.
    expect(result.file.state.seed).toBe('4F2A');
  });

  it('lifts a version 1 save by giving it a material reserve', () => {
    const v1 = JSON.parse(JSON.stringify(createInitialState('4F2A')));
    delete v1.materialReserve;
    v1.schemaVersion = 1;

    const result = parseSaveFile(JSON.stringify({ schemaVersion: 1, savedAt: 1, state: v1 }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.state.materialReserve).toBe(PROTOCOLS.defaultMaterialReserve);
    expect(result.file.state.seed).toBe('4F2A');
  });

  it('carries a version 0 save all the way up, one step at a time', () => {
    const v0 = JSON.parse(JSON.stringify(createInitialState('9B01')));
    for (const field of [
      'supplyRatio',
      'protocols',
      'protocolSlots',
      'custodianCooldown',
      'materialReserve',
      'effects',
      'pending',
      'chronicle',
    ]) {
      delete v0[field];
    }
    v0.schemaVersion = 0;

    const result = parseSaveFile(JSON.stringify({ schemaVersion: 0, savedAt: 1, state: v0 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.file.state.supplyRatio).toBe(1);
    expect(result.file.state.materialReserve).toBe(PROTOCOLS.defaultMaterialReserve);
  });

  it('lifts a version 2 save by giving it weather and a timeline', () => {
    const v2 = JSON.parse(JSON.stringify(createInitialState('4F2A')));
    for (const field of ['effects', 'pending', 'chronicle']) {
      delete v2[field];
    }
    v2.schemaVersion = 2;

    const result = parseSaveFile(JSON.stringify({ schemaVersion: 2, savedAt: 1, state: v2 }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.state.effects).toEqual({
      inflowFactor: 1,
      inflowTicks: 0,
      mouldId: null,
      mouldTicks: 0,
    });
    expect(result.file.state.pending).toEqual([]);
    expect(result.file.state.chronicle).toEqual([]);
  });

  it('leaves a current save alone', () => {
    const state = createInitialState('9B01');
    const result = parseSaveFile(JSON.stringify(fileFor(state)));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.state).toEqual(state);
    }
  });

  it('keeps the engine and the save format on the same version', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(SCHEMA_VERSION);
  });

});

describe('protocol rules in a save', () => {
  const withRules = (): ReturnType<typeof createInitialState> => {
    const state = createInitialState('4F2A');
    state.protocols = [
      {
        id: 'r1',
        condition: { kind: 'system-integrity-below', systemId: 'pumps', value: 40 },
        action: { type: 'repair', systemId: 'pumps' },
        enabled: true,
        firedCount: 7,
      },
      {
        id: 'r2',
        condition: { kind: 'humidity-above', floor: 2, value: 70 },
        action: { type: 'toggle', systemId: 'climate', on: true },
        enabled: false,
        firedCount: 0,
      },
    ];
    state.materialReserve = 25;
    return state;
  };

  it('survives a round trip with their order, counters and reserve', () => {
    const state = withRules();
    const result = decodeExport(encodeExport(fileFor(state)));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.state.protocols).toEqual(state.protocols);
    expect(result.file.state.materialReserve).toBe(25);
  });

  it('refuses rules that were tampered with', () => {
    const cases: unknown[] = [
      [{ id: 'r1' }],
      [{ id: '', condition: { kind: 'material-above', value: 1 }, action: { type: 'repair', systemId: 'pumps' }, enabled: true, firedCount: 0 }],
      [{ id: 'r1', condition: { kind: 'nope', value: 1 }, action: { type: 'repair', systemId: 'pumps' }, enabled: true, firedCount: 0 }],
      [{ id: 'r1', condition: { kind: 'material-above', value: 1 }, action: { type: 'dismantle', systemId: 'pumps' }, enabled: true, firedCount: 0 }],
      [{ id: 'r1', condition: { kind: 'material-above', value: 1 }, action: { type: 'repair', systemId: 'ghost' }, enabled: true, firedCount: 0 }],
      [{ id: 'r1', condition: { kind: 'humidity-above', floor: 9, value: 1 }, action: { type: 'repair', systemId: 'pumps' }, enabled: true, firedCount: 0 }],
      [{ id: 'r1', condition: { kind: 'material-above', value: Number.NaN }, action: { type: 'repair', systemId: 'pumps' }, enabled: true, firedCount: 0 }],
    ];
    for (const protocols of cases) {
      const broken = { ...JSON.parse(JSON.stringify(createInitialState('4F2A'))), protocols };
      expect(validateState(broken)).toBeNull();
    }
  });

  it('refuses duplicate rule ids and more rules than there are slots', () => {
    const duplicate = {
      id: 'r1',
      condition: { kind: 'material-above', value: 1 },
      action: { type: 'repair', systemId: 'pumps' },
      enabled: true,
      firedCount: 0,
    };
    const base = JSON.parse(JSON.stringify(createInitialState('4F2A')));
    expect(validateState({ ...base, protocols: [duplicate, { ...duplicate }] })).toBeNull();

    const tooMany = Array.from({ length: 9 }, (_, i) => ({ ...duplicate, id: `r${i}` }));
    expect(validateState({ ...base, protocols: tooMany })).toBeNull();
  });

  it('refuses a reserve outside its range', () => {
    const base = JSON.parse(JSON.stringify(createInitialState('4F2A')));
    expect(validateState({ ...base, materialReserve: -1 })).toBeNull();
    expect(validateState({ ...base, materialReserve: 10_000 })).toBeNull();
  });
});

describe('weather, announcements and the timeline in a save', () => {
  const base = () => JSON.parse(JSON.stringify(createInitialState('4F2A')));

  it('refuses an effect that would never expire', () => {
    // The engine only ever clears a factor when its countdown runs out. A save that
    // carries a factor with no countdown would switch off the rain, or the rot, for
    // good — which would quietly remove the decay the whole game rests on.
    expect(validateState({ ...base(), effects: { inflowFactor: 0, inflowTicks: 0, mouldId: null, mouldTicks: 0 } })).toBeNull();
    expect(validateState({ ...base(), effects: { inflowFactor: 1, inflowTicks: 0, mouldId: 'maps', mouldTicks: 0 } })).toBeNull();
    expect(validateState({ ...base(), effects: { inflowFactor: 1, inflowTicks: 0, mouldId: null, mouldTicks: 30 } })).toBeNull();

    // The shapes the engine really produces are accepted.
    expect(validateState({ ...base(), effects: { inflowFactor: 3, inflowTicks: 60, mouldId: null, mouldTicks: 0 } })).not.toBeNull();
    expect(validateState({ ...base(), effects: { inflowFactor: 1, inflowTicks: 0, mouldId: 'maps', mouldTicks: 60 } })).not.toBeNull();
  });

  it('refuses nonsense in the effects', () => {
    for (const effects of [
      null,
      {},
      { inflowFactor: 'fast', inflowTicks: 0, mouldId: null, mouldTicks: 0 },
      { inflowFactor: 1, inflowTicks: -1, mouldId: null, mouldTicks: 0 },
      { inflowFactor: 99, inflowTicks: 10, mouldId: null, mouldTicks: 0 },
      { inflowFactor: 1, inflowTicks: 0, mouldId: 'ghost', mouldTicks: 10 },
    ]) {
      expect(validateState({ ...base(), effects })).toBeNull();
    }
  });

  it('refuses nonsense in the announcements', () => {
    for (const pending of [
      null,
      [{ kind: 'weather', ticks: 5 }],
      [{ kind: 'storm-surge' }],
      [{ kind: 'storm-surge', ticks: -1 }],
      [{ kind: 'storm-surge', ticks: 10_000 }],
    ]) {
      expect(validateState({ ...base(), pending })).toBeNull();
    }
    expect(validateState({ ...base(), pending: [{ kind: 'cloudburst', ticks: 20 }] })).not.toBeNull();
  });

  it('refuses a timeline longer than the archive can produce', () => {
    // The bound comes from three checks together: each id must name something real,
    // no loss may repeat, and the length is capped. The first two already limit the
    // array to 18 entries, so the cap cannot be isolated in a test — it is the
    // belt to their braces, and this asserts the bound they produce together.
    const everyLoss = [
      ...SYSTEM_IDS.map((id, i) => ({ tick: i, kind: 'system-lost' as const, id })),
      ...COLLECTION_IDS.map((id, i) => ({ tick: 100 + i, kind: 'collection-lost' as const, id })),
      ...Array.from({ length: FLOOR_COUNT }, (_, i) => ({
        tick: 200 + i,
        kind: 'floor-flooded' as const,
        id: String(i),
      })),
    ];
    // Exactly what a run can produce is still accepted.
    expect(everyLoss.length).toBe(SYSTEM_IDS.length + COLLECTION_IDS.length + FLOOR_COUNT);
    expect(validateState({ ...base(), chronicle: everyLoss })).not.toBeNull();

    // One more than the archive contains is not.
    const tooLong = [...everyLoss, { tick: 999, kind: 'system-lost' as const, id: 'pumps' }];
    expect(validateState({ ...base(), chronicle: tooLong })).toBeNull();
  });

  it('refuses a timeline entry that names nothing in this archive', () => {
    for (const entry of [
      { tick: 1, kind: 'system-lost', id: 'banana' },
      { tick: 1, kind: 'collection-lost', id: 'pumps' },
      { tick: 1, kind: 'floor-flooded', id: '77' },
      { tick: 1, kind: 'floor-flooded', id: '-1' },
      { tick: 1, kind: 'floor-flooded', id: '2.0' },
    ]) {
      expect(validateState({ ...base(), chronicle: [entry] })).toBeNull();
    }
  });

  it('refuses a transmission the mast could not be carrying', () => {
    const lostMast = base();
    lostMast.systems.transmitter = { integrity: 0, on: false, repairs: 0, lost: true };
    lostMast.transmitting = 'maps';
    expect(validateState(lostMast)).toBeNull();

    const offMast = base();
    offMast.systems.transmitter.on = false;
    offMast.transmitting = 'maps';
    expect(validateState(offMast)).toBeNull();

    // On and intact is the only shape the engine can reach.
    const sending = base();
    sending.systems.transmitter.on = true;
    sending.transmitting = 'maps';
    expect(validateState(sending)).not.toBeNull();
  });

  it('refuses a lost collection that still holds units', () => {
    const broken = base();
    broken.collections.maps = { floor: 0, intact: 50, sent: 0, rotted: 50, lost: true };
    expect(validateState(broken)).toBeNull();

    const proper = base();
    proper.collections.maps = { floor: 0, intact: 0, sent: 0, rotted: 100, lost: true };
    expect(validateState(proper)).not.toBeNull();
  });

  it('refuses the same loss recorded twice', () => {
    // The engine records each floor's flooding once. A timeline that repeats one is
    // either corrupt or comes from a build whose invariant differed.
    const repeated = [
      { tick: 10, kind: 'floor-flooded', id: '0' },
      { tick: 90, kind: 'floor-flooded', id: '0' },
    ];
    expect(validateState({ ...base(), chronicle: repeated })).toBeNull();
  });

  it('accepts a timeline the engine really produced', () => {
    const played = simulate(createInitialState('4F2A'), 3000).state;
    expect(played.chronicle.length).toBeGreaterThan(0);
    expect(validateState(JSON.parse(JSON.stringify(played)))).not.toBeNull();
  });

  it('refuses nonsense in the timeline', () => {
    for (const chronicle of [
      null,
      [{ tick: 1, kind: 'something', id: 'x' }],
      [{ tick: -1, kind: 'system-lost', id: 'pumps' }],
      [{ tick: 1, kind: 'system-lost', id: 5 }],
    ]) {
      expect(validateState({ ...base(), chronicle })).toBeNull();
    }
  });
});
