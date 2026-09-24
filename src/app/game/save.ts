/**
 * Persistence.
 *
 * Two slots: the current save and the last one that read back cleanly. If a write is
 * interrupted or a save turns out to be corrupt, the backup is still there, so a bad
 * moment costs minutes rather than a whole archive.
 *
 * The legacy lives under its own key. A hard reset ends the run and must not touch it.
 */

import { Injectable, inject } from '@angular/core';

import { emptyLegacy, LEGACY_SCHEMA_VERSION, type LegacyRecord } from '../engine/legacy';
import type { GameState } from '../engine/state';

export type { LegacyRecord };
import {
  CURRENT_SCHEMA_VERSION,
  decodeExport,
  encodeExport,
  parseSaveFile,
  type ReadResult,
  type SaveFile,
  type SaveProblem,
} from './save-format';
import { GAME_STORAGE } from './storage';

export const SAVE_KEY = 'entropie.save';
export const BACKUP_KEY = 'entropie.save.backup';
export const LEGACY_KEY = 'entropie.legacy';
/** Where an unreadable save is set aside, so a later build could still rescue it. */
export const BROKEN_KEY = 'entropie.save.broken';

export interface LoadedSave {
  file: SaveFile;
  /** True when the main slot was unusable and the backup had to be used. */
  fromBackup: boolean;
}

export type LoadOutcome =
  | { kind: 'loaded'; save: LoadedSave }
  | { kind: 'empty' }
  | { kind: 'broken'; problem: SaveProblem };

@Injectable({ providedIn: 'root' })
export class SaveService {
  private readonly storage = inject(GAME_STORAGE);

  /** False in private windows or when storage is blocked; the game then runs unsaved. */
  readonly available = this.storage !== null;

  write(state: GameState, now: number): void {
    if (!this.available) {
      return;
    }
    const file: SaveFile = { schemaVersion: CURRENT_SCHEMA_VERSION, savedAt: now, state };
    const json = JSON.stringify(file);

    // Rotate only a save that reads back cleanly, so the backup can never become the
    // corrupt one.
    const previous = this.readRaw(SAVE_KEY);
    if (previous !== null && parseSaveFile(previous).ok) {
      this.writeRaw(BACKUP_KEY, previous);
    }
    this.writeRaw(SAVE_KEY, json);
  }

  load(): LoadOutcome {
    if (!this.available) {
      return { kind: 'empty' };
    }

    const main = this.readRaw(SAVE_KEY);
    if (main !== null) {
      const result = parseSaveFile(main);
      if (result.ok) {
        return { kind: 'loaded', save: { file: result.file, fromBackup: false } };
      }
      const backup = this.readRaw(BACKUP_KEY);
      if (backup !== null) {
        const fallback = parseSaveFile(backup);
        if (fallback.ok) {
          return { kind: 'loaded', save: { file: fallback.file, fromBackup: true } };
        }
      }
      // Keep the unreadable data instead of letting the next autosave bury it.
      this.writeRaw(BROKEN_KEY, main);
      return { kind: 'broken', problem: result.problem };
    }

    const backup = this.readRaw(BACKUP_KEY);
    if (backup !== null) {
      const fallback = parseSaveFile(backup);
      if (fallback.ok) {
        return { kind: 'loaded', save: { file: fallback.file, fromBackup: true } };
      }
    }
    return { kind: 'empty' };
  }

  /** Ends the run. The legacy is deliberately left alone. */
  clearRun(): void {
    this.removeRaw(SAVE_KEY);
    this.removeRaw(BACKUP_KEY);
  }

  exportRun(state: GameState, now: number): string {
    return encodeExport({ schemaVersion: CURRENT_SCHEMA_VERSION, savedAt: now, state });
  }

  importRun(text: string): ReadResult {
    return decodeExport(text);
  }

  readLegacy(): LegacyRecord {
    const empty = emptyLegacy();
    const raw = this.readRaw(LEGACY_KEY);
    if (raw === null) {
      return empty;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return empty;
      }
      const record = parsed as Partial<LegacyRecord>;
      const sent: Record<string, number> = {};
      for (const [id, value] of Object.entries(record.sent ?? {})) {
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
          sent[id] = value;
        }
      }
      return {
        schemaVersion: LEGACY_SCHEMA_VERSION,
        sent,
        runs: typeof record.runs === 'number' && record.runs >= 0 ? record.runs : 0,
      };
    } catch {
      // A damaged legacy must not take the run down with it.
      return empty;
    }
  }

  writeLegacy(record: LegacyRecord): void {
    this.writeRaw(LEGACY_KEY, JSON.stringify(record));
  }

  private readRaw(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private writeRaw(key: string, value: string): void {
    try {
      this.storage?.setItem(key, value);
    } catch {
      // A full or blocked storage must never interrupt play.
    }
  }

  private removeRaw(key: string): void {
    try {
      this.storage?.removeItem(key);
    } catch {
      // Same: nothing here is worth an exception reaching the player.
    }
  }
}


