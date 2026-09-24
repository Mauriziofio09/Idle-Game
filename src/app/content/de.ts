/**
 * Every string the player reads. Code and identifiers stay English; only this file
 * speaks German, so adding a second language later is a content change, not a
 * refactor. Milestone 2 adds the log templates, milestone 5 the lore fragments.
 */

import type { CollectionId, SystemId } from '../engine/state';

export const APP = {
  title: 'ENTROPIE',
  subtitle: 'Das letzte Archiv',
  /** Prefix for the run's seed, e.g. "Archiv #4F2A". */
  archivePrefix: 'Archiv #',
} as const;

export const PANEL_LABELS = {
  condition: 'Zustand',
  systems: 'Systeme',
} as const;

export const FLOOR_NAMES = [
  'Keller',
  'Erdgeschoss',
  'Erster Stock',
  'Zweiter Stock',
  'Dachboden',
] as const;

export const SYSTEM_NAMES: Record<SystemId, string> = {
  generator: 'Generator',
  pumps: 'Pumpen',
  workshop: 'Werkstatt',
  climate: 'Klimatechnik',
  custodian: 'Kustoden-Depot',
  roof: 'Dach',
  transmitter: 'Sendemast',
};

export const COLLECTION_NAMES: Record<CollectionId, string> = {
  maps: 'Kartenwerk',
  chronicle: 'Stadtchronik',
  naturalHistory: 'Naturkunde',
  music: 'Notenarchiv',
  letters: 'Briefe der Stadt',
  languages: 'Sprachen der Welt',
};

export const RESOURCE_LABELS = {
  energy: 'Energie',
  material: 'Material',
  entropy: 'Entropie',
  water: 'Pegel',
  runtime: 'Laufzeit',
} as const;

export const STATE_LABELS = {
  lost: 'VERLOREN',
  critical: 'kritisch',
  off: 'aus',
  on: 'an',
} as const;
