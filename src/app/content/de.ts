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

export const RESOURCE_NOTES = {
  /** Shown under the entropy figure, e.g. "Verfall ×1,6". */
  decay: (multiplier: string) => `Verfall ${multiplier}`,
  /** Net rate and battery size, e.g. "+0,60 /s · Akku 150". */
  energyRate: (rate: string, capacity: string) => `${rate} · Akku ${capacity}`,
  /** While rationing, the share each consumer actually gets. */
  energyShare: (share: string) => `Versorgung ${share}`,
} as const;

export const STATE_LABELS = {
  lost: 'VERLOREN',
  critical: 'kritisch',
  off: 'aus',
  on: 'an',
} as const;

export const PANEL_TITLES = {
  detail: 'Auswahl',
  log: 'Archivlog',
  nothingSelected: 'Nichts ausgewählt',
  nothingSelectedHint: 'Wähle eine Etage, ein System oder eine Sammlung im Querschnitt.',
} as const;

export const ACTION_LABELS = {
  repair: 'Reparieren',
  switchOn: 'Einschalten',
  switchOff: 'Ausschalten',
  dismantle: 'Rückbau',
  dismantleConfirm: 'Rückbau bestätigen',
  cancel: 'Abbrechen',
} as const;

export const DETAIL_LABELS = {
  integrity: 'Integrität',
  humidity: 'Luftfeuchte',
  floor: 'Etage',
  state: 'Zustand',
  intact: 'Intakt',
  sent: 'Gesendet',
  rotted: 'Verrottet',
  flooded: 'überflutet',
  dry: 'trocken',
  supply: 'Versorgung',
  onThisFloor: 'Auf dieser Etage',
  consumption: 'Verbrauch',
  output: 'Leistung',
  none: 'nichts',
} as const;

export const ACTION_HINTS = {
  /** Shown on the repair button, e.g. "+21 % · 12 Material · 10 Energie · Entropie +3". */
  repairPreview: (gain: string, material: string, energy: string, entropy: string) =>
    `+${gain} · ${material} Material · ${energy} Energie · Entropie +${entropy}`,
  dismantlePreview: (material: string, entropy: string) =>
    `${material} Material · Entropie +${entropy} · endgültig`,
  dismantleWarning: (name: string) =>
    `${name} ist danach für immer fort. Das lässt sich nicht rückgängig machen.`,
  notEnoughMaterial: 'Zu wenig Material.',
  notEnoughEnergy: 'Zu wenig Energie.',
  alreadyFull: 'Bereits bei 100 %.',
  lost: 'Verloren. Keine Aktion mehr möglich.',
  offConserves: 'Ausgeschaltet verfällt es langsamer, liefert aber nichts.',
} as const;

/**
 * The archive log. Short, factual, quietly melancholic: a timestamp and one sentence.
 * The engine hands over facts; the sentences are written here.
 */
export const LOG = {
  /** The first three lines carry the whole situation. No tutorial, no modal. */
  opening: [
    'Das Wasser steht seit dem Frühjahr in der Stadt. Niemand ist zurückgekommen.',
    'Fünf Etagen, sechs Sammlungen, ein Generator. Mehr ist nicht geblieben.',
    'Ich bin KUSTOS. Ich halte, was sich halten lässt.',
  ],
  systemRepaired: (name: string, integrity: string) => `${name} repariert. ${integrity}.`,
  systemSwitchedOn: (name: string) => `${name} läuft wieder.`,
  systemSwitchedOff: (name: string) => `${name} abgeschaltet. Verfällt langsamer.`,
  systemDismantled: (name: string, material: string) =>
    `${name} zurückgebaut. ${material} Material geborgen.`,
  systemLost: (name: string) => `${name} ist ausgefallen. Endgültig.`,
  collectionLost: (name: string, sent: string) =>
    `${name} ist verloren. ${sent} wurden gesendet.`,
  floorFlooded: (floor: string) => `Das Wasser steht im ${floor}.`,
  undersupply: (share: string) => `Die Leitungen liefern nur noch ${share}.`,
  supplyRestored: 'Die Versorgung ist wieder vollständig.',
  endedSilence: 'Das Archiv verstummt.',
  endedNothingLeft: 'Nichts mehr zu retten.',
} as const;

export const END_LABELS = {
  silence: 'Das Archiv verstummt.',
  nothingLeft: 'Nichts mehr zu retten.',
  runtime: 'Das Archiv hielt',
  saved: 'Gerettet',
} as const;
