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

export const RETURN_LABELS = {
  title: 'Während du fort warst',
  away: 'Fort',
  simulated: 'Simuliert',
  waterRose: 'Der Pegel stieg um',
  waterFell: 'Der Pegel sank um',
  waterHeld: 'Der Pegel hielt.',
  energy: 'Energie',
  entropy: 'Entropie',
  lost: 'Verloren',
  nothingLost: 'Nichts ging verloren.',
  flooded: 'Überflutet',
  dismiss: 'Weiter',
  endedWhileAway: 'Das Archiv verstummte, während du fort warst.',
  protocols: 'Protokolle',
  noProtocols: 'Kein Protokoll lief.',
  /** One entry per rule that fired, e.g. "Regel 1: 8×". */
  protocolRun: (position: string, count: string) => `Regel ${position}: ${count}×`,
  /** Shown when the absence exceeded the offline window. */
  stasis: (hours: string) =>
    `Länger als ${hours} fort. Das Archiv ging in Notfall-Stasis — darüber hinaus ist nichts weiter verfallen.`,
  restoredFromBackup:
    'Der letzte Spielstand war beschädigt. Das Archiv wurde aus der Sicherung geladen.',
} as const;

export const STARTUP_NOTICE_DISMISS = 'Verstanden';

export const STARTUP_NOTICES = {
  broken: {
    title: 'Der Spielstand war nicht lesbar',
    text: 'Beide Speicherplätze sind beschädigt. Ein neues Archiv beginnt. Der alte Stand wurde beiseitegelegt und nicht überschrieben.',
  },
  'from-backup': {
    title: 'Aus der Sicherung geladen',
    text: 'Der letzte Spielstand war beschädigt. Das Archiv wurde aus der Sicherung geladen; die letzten Sekunden fehlen.',
  },
} as const;

export const SETTINGS_LABELS = {
  title: 'Spielstand',
  export: 'Exportieren',
  exportHint: 'Kopiert das Archiv als Textzeile in die Zwischenablage.',
  exportDone: 'In die Zwischenablage kopiert.',
  exportFailed: 'Kopieren nicht möglich. Markiere den Text und kopiere ihn selbst.',
  import: 'Importieren',
  importHint: 'Füge eine exportierte Zeile ein. Der laufende Run wird ersetzt.',
  importPlaceholder: 'Exportierte Zeile einfügen',
  importDone: 'Archiv geladen.',
  reset: 'Neues Archiv',
  resetHint: 'Beendet diesen Run und beginnt von vorn. Das Vermächtnis bleibt.',
  resetConfirm: 'Wirklich neu beginnen?',
  resetWarning: 'Dieser Run ist danach fort. Das lässt sich nicht rückgängig machen.',
  cancel: 'Abbrechen',
  storageUnavailable:
    'Dieser Browser erlaubt kein Speichern. Der Run läuft, geht beim Schließen aber verloren.',
} as const;

/** Why an import was refused. Friendly, never a stack trace. */
export const IMPORT_PROBLEMS = {
  'not-readable': 'Das ist keine gültige Zeile. Hast du sie vollständig kopiert?',
  'not-json': 'Die Zeile ist beschädigt.',
  'wrong-format': 'Diese Zeile stammt nicht aus ENTROPIE.',
  'checksum-mismatch': 'Die Zeile ist unvollständig oder verändert worden.',
  'unsupported-version': 'Dieser Spielstand stammt aus einer neueren Fassung des Spiels.',
  'invalid-data': 'Der Spielstand ergibt keinen sinnvollen Zustand.',
} as const;

export const LOG_SESSION = {
  resumed: 'Das Archiv erinnert sich.',
  stasis: 'Notfall-Stasis beendet. Der Verfall läuft weiter.',
  newArchive: 'Ein neues Archiv. Die Zählung beginnt von vorn.',
} as const;

/** The protocol editor. Rules read as German sentences, not as configuration. */
export const PROTOCOL_LABELS = {
  title: 'Protokolle',
  intro:
    'KUSTOS führt diese Regeln aus, wenn du nicht da bist — die oberste passende zuerst.',
  ifWord: 'Wenn',
  thenWord: 'dann',
  add: 'Regel hinzufügen',
  remove: 'Entfernen',
  moveUp: 'Höher',
  moveDown: 'Tiefer',
  /** Accessible names carry the rule's position, or every row sounds identical. */
  ruleName: (position: string) => `Regel ${position}`,
  moveUpFor: (position: string) => `Regel ${position} höher`,
  moveDownFor: (position: string) => `Regel ${position} tiefer`,
  removeFor: (position: string) => `Regel ${position} entfernen`,
  enabledFor: (position: string) => `Regel ${position} aktiv`,
  conditionFor: (position: string) => `Regel ${position}: Bedingung`,
  conditionTargetFor: (position: string) => `Regel ${position}: Bezug`,
  thresholdFor: (position: string, unit: string) =>
    unit ? `Regel ${position}: Schwelle in ${unit}` : `Regel ${position}: Schwelle`,
  actionFor: (position: string) => `Regel ${position}: Aktion`,
  actionTargetFor: (position: string) => `Regel ${position}: System`,
  enabled: 'Aktiv',
  empty: 'Noch keine Regel. KUSTOS wartet auf Anweisungen.',
  condition: 'Bedingung',
  conditionTarget: 'Bezug',
  threshold: 'Schwelle',
  action: 'Aktion',
  actionTarget: 'System',
  fired: (count: string) => `in diesem Run ${count}× ausgelöst`,
  slots: (used: string, total: string) => `${used} von ${total} Slots belegt`,
  reserve: 'Materialreserve',
  reserveHint: 'Protokolle geben Material nie unter diesen Wert aus.',
  depotOff:
    'Das Kustoden-Depot läuft nicht. Ohne Depot führt niemand Protokolle aus.',
  depotRate: (seconds: string) => `Eine Aktion alle ${seconds}.`,
} as const;

export const CONDITION_LABELS = {
  'system-integrity-below': 'System unter',
  'water-above': 'Pegel über',
  'energy-below': 'Energie unter',
  'energy-above': 'Energie über',
  'humidity-above': 'Feuchte über',
  'collection-below': 'Sammlung unter',
  'material-above': 'Material über',
} as const;

export const PROTOCOL_ACTION_LABELS = {
  repair: 'reparieren',
  'toggle-on': 'einschalten',
  'toggle-off': 'ausschalten',
} as const;

export const CONDITION_UNITS = {
  percent: '%',
  metres: 'm',
  amount: '',
} as const;
