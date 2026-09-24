import { COLLECTIONS, PROTOCOLS } from '../engine/balance';
import { createInitialState, SCHEMA_VERSION } from '../engine/state';
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
