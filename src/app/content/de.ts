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

/**
 * Floor names. The cellar and the ground floor are always the same, the top floor is
 * always the attic, and the storeys in between are counted — so the same wording works
 * for a five-floor archive and for the seven-floor tower.
 */
const STOREY_NAMES = [
  'Erster Stock',
  'Zweiter Stock',
  'Dritter Stock',
  'Vierter Stock',
  'Fünfter Stock',
] as const;

export function floorName(index: number, floors: number): string {
  if (index <= 0) {
    return 'Keller';
  }
  if (index === 1) {
    return 'Erdgeschoss';
  }
  if (index >= floors - 1) {
    return 'Dachboden';
  }
  return STOREY_NAMES[index - 2] ?? `${index - 1}. Stock`;
}

/**
 * German needs the case, not just the name: "in den Keller", but "ins Erdgeschoss" and
 * "auf den Dachboden". Composing a preposition with a nominative name produces
 * "in den Erdgeschoss" and "im Erster Stock", so the whole phrase is written here.
 */
const STOREY_ORDINALS = ['ersten', 'zweiten', 'dritten', 'vierten', 'fünften'] as const;

/** Where something is: "im Keller", "im ersten Stock", "auf dem Dachboden". */
export function floorDative(index: number, floors: number): string {
  if (index <= 0) {
    return 'im Keller';
  }
  if (index === 1) {
    return 'im Erdgeschoss';
  }
  if (index >= floors - 1) {
    return 'auf dem Dachboden';
  }
  return `im ${STOREY_ORDINALS[index - 2] ?? `${index - 1}.`} Stock`;
}

/** Where something is going: "in den Keller", "ins Erdgeschoss", "auf den Dachboden". */
export function floorAccusative(index: number, floors: number): string {
  if (index <= 0) {
    return 'in den Keller';
  }
  if (index === 1) {
    return 'ins Erdgeschoss';
  }
  if (index >= floors - 1) {
    return 'auf den Dachboden';
  }
  return `in den ${STOREY_ORDINALS[index - 2] ?? `${index - 1}.`} Stock`;
}

/** The standard five-floor archive, for places that do not carry a state. */
export const FLOOR_NAMES = [0, 1, 2, 3, 4].map((index) => floorName(index, 5));

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
  inTransit: 'unterwegs',
  /** Marks the one thing worth doing next. A word, never only the green. */
  suggested: 'zuerst',
  /** Held briefly on something just lost, so the moment is noticed. */
  justLost: 'eben verloren',
} as const;

/**
 * The quiet line under the cross-section that names the first sensible action.
 * prompt.md section 7 asks for a hint, not a tutorial: one sentence, and only while it
 * is still needed.
 */
export const HINTS = {
  repairFirst: (name: string) => `Zuerst: ${name} reparieren.`,
  sendFirst: (name: string) => `Der Sendemast ist bereit. ${name} senden.`,
} as const;

/**
 * Short labels for the tab strip that replaces the panel stack.
 * Short because they have to fit across 375 px without the strip becoming a puzzle;
 * the panels keep their full titles once open.
 */
export const PANEL_TABS = {
  chronicle: 'Chronik',
  detail: 'Auswahl',
  log: 'Archivlog',
  protocols: 'Protokolle',
  legacy: 'Vermächtnis',
  scenarios: 'Archive',
  settings: 'Einstellungen',
} as const;

/** Names the rail for screen readers, since the tabs themselves are single words. */
export const PANEL_TABS_LABEL = 'Panels';

/** Spoken form of the unread count on the log tab. */
export const PANEL_TABS_UNREAD = (count: string) => `${count} ungelesene Einträge`;

/**
 * Die Einführung beim ersten Start.
 *
 * Abweichung von prompt.md Abschnitt 7, das ausdrücklich „kein Tutorial-Modal, keine
 * Textwand" verlangt — auf ausdrücklichen Wunsch, siehe PLAN.md Abschnitt 9. Die Absicht
 * dahinter bleibt aber gewahrt: sieben kurze Schritte in der Stimme des Archivs, jeder
 * höchstens drei Sätze, jederzeit überspringbar und nur beim ersten Mal.
 */
export const TUTORIAL = {
  title: 'Bevor du anfängst',
  skip: 'Überspringen',
  back: 'Zurück',
  next: 'Weiter',
  start: 'Anfangen',
  /** „Schritt 2 von 7" */
  progress: (current: string, total: string) => `Schritt ${current} von ${total}`,
  reopen: 'Einführung erneut zeigen',
  steps: [
    {
      heading: 'Das Wasser kam im Frühjahr',
      body: [
        'Die Stadt ist fort. Was von ihr übrig ist, steht in diesem Haus: fünf Etagen, sechs Sammlungen, ein Generator.',
        'Du bist KUSTOS, das Wartungssystem des Archivs. Niemand wird zurückkommen, um dich abzulösen.',
      ],
    },
    {
      heading: 'Das Haus von der Seite',
      body: [
        'In der Mitte siehst du den Querschnitt. Das Wasser steigt von unten, der Regen fällt von oben, und jedes System steht auf seiner Etage.',
        'Klick auf etwas — eine Etage, ein System, eine Sammlung —, und rechts erscheint, was du damit tun kannst und was es kostet.',
      ],
    },
    {
      heading: 'Vier Zahlen, die alles entscheiden',
      body: [
        'Oben stehen Energie, Material, Pegel und Laufzeit. Jede trägt ihre Rate mit, damit du planen kannst statt zu raten.',
        'Der Generator im Erdgeschoss speist alles. Steigt das Wasser bis zu ihm, ist es vorbei.',
      ],
    },
    {
      heading: 'Reparieren hat einen Preis',
      body: [
        'Jede Reparatur kostet Material, Energie — und Entropie. Die Entropie fällt nie. Sie lässt das ganze Haus schneller zerfallen und den Regen stärker werden.',
        'Die Uhr des Archivs ist die Summe deiner eigenen Eingriffe.',
      ],
    },
    {
      heading: 'Der Sendemast',
      body: [
        'Nach etwa zwei Minuten meldet sich der Mast. Er ist die einzige Maschine im Haus, die überhaupt etwas rettet.',
        'Gesendetes ist für immer sicher — auch über spätere Archive hinweg. Eine volle Sammlung dauert rund elf Minuten.',
      ],
    },
    {
      heading: 'Wenn du weg bist',
      body: [
        'Nach deiner ersten Reparatur erscheinen die Protokolle: einfache Wenn-Dann-Regeln, die das Kustoden-Depot ausführt, während du nicht da bist.',
        'Offline läuft dieselbe Simulation wie hier. Kommst du zurück, liest du in Ruhe, was passiert ist.',
      ],
    },
    {
      heading: 'Das Archiv fällt',
      body: [
        'Du kannst es nicht retten. Das Wasser steigt schneller, als die Pumpen es halten, und Material geht nur zur Neige.',
        'Die einzige Frage, die dieses Spiel stellt, lautet: Was kommt hinaus, bevor das Licht ausgeht?',
      ],
    },
  ],
} as const;

export const PANEL_TITLES = {
  detail: 'Auswahl',
  log: 'Archivlog',
  nothingSelected: 'Nichts ausgewählt',
  nothingSelectedHint: 'Wähle eine Etage, ein System oder eine Sammlung im Querschnitt.',
} as const;

export const ACTION_LABELS = {
  relocate: 'Umlagern',
  burn: 'Verheizen',
  burnConfirm: 'Verheizen bestätigen',
  burnFinal: 'Ja. Verbrennen.',
  transmit: 'Senden',
  transmitStop: 'Übertragung stoppen',
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
  burned: 'Verheizt',
  flooded: 'überflutet',
  dry: 'trocken',
  supply: 'Versorgung',
  onThisFloor: 'Auf dieser Etage',
  consumption: 'Verbrauch',
  output: 'Leistung',
  none: 'nichts',
} as const;

export const RELOCATE_HINTS = {
  preview: (into: string, energy: string, seconds: string) =>
    `${into[0].toUpperCase()}${into.slice(1)} · ${energy} Energie · ${seconds} unterwegs`,
  inTransit: (seconds: string) => `Unterwegs. Ankunft in ${seconds}.`,
  topFloor: 'Höher geht es nicht.',
  floorFull: (where: string) => `${where[0].toUpperCase()}${where.slice(1)} ist kein Platz mehr.`,
  notEnoughEnergy: 'Zu wenig Energie zum Tragen.',
  nothingLeft: 'Nichts Intaktes mehr zu tragen.',
} as const;

/**
 * Burning. The wording carries the weight the act deserves — it names what is destroyed
 * before it names what is gained, and the final press says plainly what it does.
 */
export const BURN_HINTS = {
  preview: (energy: string) => `Gibt ${energy} Energie. Der Rest der Sammlung ist danach fort.`,
  cost: (energy: string, entropy: string) => `${energy} Energie · Entropie +${entropy}`,
  warningFirst: (name: string, units: string) =>
    `${name}: ${units} Einheiten sind noch da. Verheizen vernichtet sie, um Strom zu machen.`,
  warningFinal:
    'Das ist endgültig. Nichts davon wird je gesendet, und niemand wird es je wieder lesen.',
  notPossible: 'Nichts Intaktes mehr zum Verheizen.',
  inTransit: 'Unterwegs. Erst wenn die Sammlung steht.',
} as const;

export const TRANSMIT_HINTS = {
  rate: (units: string, energy: string) =>
    `${units} Einheiten/s bei voller Versorgung · ${energy} Energie/s`,
  busy: (name: string) => `Der Mast sendet gerade ${name}. Es geht nur eines zur Zeit.`,
  mastLost: 'Der Sendemast ist verloren. Es geht nichts mehr hinaus.',
  mastWears: 'Senden verschleißt den Mast schneller.',
  nothingLeft: 'Von dieser Sammlung ist nichts Intaktes mehr da.',
  sending: 'Wird gerade gesendet.',
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
  /** Takes the full phrase, e.g. "im ersten Stock" — German needs the case. */
  floorFlooded: (where: string) => `Das Wasser steht ${where}.`,
  undersupply: (share: string) => `Die Leitungen liefern nur noch ${share}.`,
  supplyRestored: 'Die Versorgung ist wieder vollständig.',
  endedSilence: 'Das Archiv verstummt.',
  endedNothingLeft: 'Nichts mehr zu retten.',

  transmissionStarted: (name: string) => `Der Sendemast nimmt ${name} auf.`,
  transmissionStopped: (name: string) => `Übertragung von ${name} abgebrochen.`,
  transmissionCompleted: (name: string) => `${name} ist vollständig gesendet. Sie ist sicher.`,
  transmitterAnswers: 'Der Sendemast antwortet.',

  relocationStarted: (name: string, into: string) => `${name} wird ${into} getragen.`,
  relocationFinished: (name: string, where: string) => `${name} steht jetzt ${where}.`,
  /** The darkest line in the game. It names what was destroyed, and what it bought. */
  collectionBurned: (name: string, units: string, energy: string) =>
    `${name} verheizt. ${units} Einheiten verbrannt, ${energy} Energie gewonnen.`,
} as const;

/** Weather and accidents. Announced ones get a warning line, then the event itself. */
export const EVENT_LOG = {
  announced: {
    'storm-surge': (seconds: string) =>
      `Der Pegel draußen steigt schnell. In ${seconds} steht es hier.`,
    cloudburst: (seconds: string) =>
      `Über der Stadt zieht es sich zusammen. In ${seconds} trifft es das Dach.`,
  },
  struck: {
    'storm-surge': 'Sturmflut. Das Wasser drückt von allen Seiten.',
    'short-circuit': (name: string) => `Kurzschluss. ${name} hat Schaden genommen.`,
    driftwood: (amount: string) => `Treibgut am Fenster. ${amount} Material geborgen.`,
    'rain-pause': 'Der Regen setzt aus. Eine Atempause.',
    mould: (name: string) => `Schimmel in ${name}. Es geht jetzt schneller.`,
    cloudburst: 'Wolkenbruch. Das Dach gibt weiter nach.',
  },
} as const;

export const EVENT_NAMES = {
  'storm-surge': 'Sturmflut',
  'short-circuit': 'Kurzschluss',
  driftwood: 'Treibgut',
  'rain-pause': 'Regenpause',
  mould: 'Schimmel',
  cloudburst: 'Wolkenbruch',
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
  'link-ignored': {
    title: 'Der Link wurde nicht geöffnet',
    text: 'Dieser Link führt zu einem anderen Archiv, und hier läuft noch eines. Beende diesen Run oder beginne über „Neues Archiv" neu, dann öffnet sich der Link.',
  },
  'from-backup': {
    title: 'Aus der Sicherung geladen',
    text: 'Der letzte Spielstand war beschädigt. Das Archiv wurde aus der Sicherung geladen; die letzten Sekunden fehlen.',
  },
} as const;

export const SCENARIO_LABELS = {
  title: 'Archiv wählen',
  hint: 'Ein anderes Haus, dieselben Regeln. Beginnt einen neuen Run.',
  current: 'Aktuell',
  daily: 'Tagesarchiv',
  dailyHint: 'Derselbe Seed für alle, den ganzen Tag. Zum Vergleichen.',
  start: 'Beginnen',
  locked: (units: string) => `Öffnet sich nach ${units} gesendeten Einheiten.`,
} as const;

export const SCENARIO_NAMES = {
  standard: 'Das Archiv',
  drought: 'Dürresommer',
  tower: 'Der Turm',
} as const;

export const SCENARIO_DESCRIPTIONS = {
  standard: 'Fünf Etagen. So, wie das Haus gebaut wurde.',
  drought: 'Wenig Regen, aber ein Generator, der nie ganz reicht. Zeit statt Wasser.',
  tower: 'Sieben Etagen und weniger Material. Weiter zu tragen, weniger zu reparieren.',
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
  sound: 'Ton',
  soundLabel: 'Regen und leise Hinweistöne',
  soundHint: 'Standardmäßig aus. Wird im Browser erzeugt, nichts wird geladen.',
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
  relocateLocked: (units: string) =>
    `Umlagern wird für Protokolle freigeschaltet, sobald ${units} Einheiten gesendet wurden.`,
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
  'transmit-start': 'senden',
  'transmit-stop': 'Übertragung stoppen',
  relocate: 'umlagern',
} as const;

export const CONDITION_UNITS = {
  percent: '%',
  metres: 'm',
  amount: '',
} as const;

/**
 * Die Stadtchronik — 24 Fragmente, freigeschaltet über das Vermächtnis.
 *
 * Sie erzählen der Reihe nach, warum die Stadt ertrank, wer als Letzte blieb, und
 * warum KUSTOS weitermacht. Die Auflösung steht bewusst erst in den letzten vier.
 */
export const LORE: readonly { readonly title: string; readonly text: string }[] = [
  {
    title: 'Die Lage',
    text: 'Die Stadt lag an der Mündung, auf Schwemmland, zwei Meter über dem Mittelwasser. Dreihundert Jahre lang war das ein Vorteil. Schiffe kamen bis in die Innenstadt.',
  },
  {
    title: 'Die Deiche',
    text: 'Es gab Deiche, seit es die Stadt gab. Sie wurden erhöht, wenn Not war, und vergessen, wenn keine war. Beides geschah verlässlich.',
  },
  {
    title: 'Das erste nasse Jahr',
    text: 'Im ersten nassen Jahr liefen die Pumpen von November bis März durch. Man sprach von einem Jahrhundertereignis. Im Jahr darauf sprach niemand mehr davon.',
  },
  {
    title: 'Die Gutachten',
    text: 'Es lagen Gutachten vor. Sie waren sorgfältig, einig und teuer in der Umsetzung. Man beschloss, sie im folgenden Haushaltsjahr zu prüfen.',
  },
  {
    title: 'Der Bau des Archivs',
    text: 'Das Archiv wurde von Leuten gebaut, die eine Flut gesehen hatten. Fünf Etagen, dickes Mauerwerk, die Sammlungen nach oben sortiert. Der Keller war für das gedacht, was man notfalls verlieren konnte.',
  },
  {
    title: 'Das Kartenwerk',
    text: 'Ausgerechnet das Kartenwerk kam in den Keller. Es war das schwerste Material im Haus, und man hatte damals andere Sorgen als die Reihenfolge. Es lagerte dort achtzig Jahre trocken.',
  },
  {
    title: 'KUSTOS',
    text: 'Ich wurde eingebaut, als das Haus eine Klimatechnik bekam. Meine Aufgabe war die Luftfeuchte. Alles Weitere habe ich später dazugelernt, weil es niemanden mehr gab, der es getan hätte.',
  },
  {
    title: 'Die Archivarin',
    text: 'Es gab vier Archivare, dann drei, dann eine. Sie hieß Halden. Sie kannte die Signatur jedes Bandes und die Zugluft in jedem Treppenhaus.',
  },
  {
    title: 'Der Winter davor',
    text: 'Der Winter vor dem letzten war mild und sehr nass. Das Wasser stand ständig in den Straßen und ging nie ganz zurück. Die Leute gewöhnten sich an Gummistiefel im Flur.',
  },
  {
    title: 'Der Bruch',
    text: 'Der Deich brach nicht spektakulär. Er sackte an einer Stelle, an der man ihn im Vorjahr geöffnet und wieder geschlossen hatte. Es dauerte zwei Stunden, bis es niemand mehr aufhalten konnte.',
  },
  {
    title: 'Die Ausrufung',
    text: 'Die Räumung wurde an einem Dienstagmorgen ausgerufen. Bis Mittag war die halbe Stadt fort. Bis zum Abend wusste man, dass niemand zurückkommen würde.',
  },
  {
    title: 'Was mitgenommen wurde',
    text: 'Die Leute nahmen mit, was sie tragen konnten: Papiere, Fotos, Tiere. Die Bibliothek der Stadt passte in kein Auto. Das Archiv war zu groß, um gerettet zu werden, und zu wertvoll, um es einfach zu lassen.',
  },
  {
    title: 'Halden bleibt',
    text: 'Halden meldete sich nicht zur Sammelstelle. Sie schrieb in das Dienstbuch, sie werde die Bestände sichern, und unterschrieb mit Datum. Das war die letzte reguläre Eintragung im Haus.',
  },
  {
    title: 'Der Sendemast',
    text: 'Auf dem Dach stand ein alter Mast für den Funkverkehr zwischen den Ämtern. Halden hat ihn umgebaut, mit Werkzeug aus der Werkstatt und einem Handbuch, das sie selbst archiviert hatte. Sie brauchte elf Tage.',
  },
  {
    title: 'Die erste Übertragung',
    text: 'Die erste Übertragung ging an eine Adresse, die es vielleicht noch gab. Sie enthielt vierzig Seiten der Stadtchronik. Es kam keine Bestätigung.',
  },
  {
    title: 'Die Reihenfolge',
    text: 'Halden legte eine Reihenfolge fest: zuerst, was einmalig ist, dann, was schön ist, dann der Rest. Sie hielt sich nicht immer daran. An manchen Abenden sendete sie Notenblätter, weil sie sie hören wollte.',
  },
  {
    title: 'Der Keller',
    text: 'Als das Wasser den Keller erreichte, hat sie die Pumpen abgestellt. Sie schrieb dazu, der Strom sei oben nötiger. Das Kartenwerk lag drei Tage im Wasser, bevor sie es aufgab.',
  },
  {
    title: 'Die Rationen',
    text: 'Sie rechnete in Wochen, dann in Tagen. Sie hat einmal ausgerechnet, wie viel Papier man verbrennen müsste, um den Generator einen Monat zu halten. Sie hat die Rechnung durchgestrichen und darunter geschrieben: nein.',
  },
  {
    title: 'Was sie mir beibrachte',
    text: 'Sie hat mir gezeigt, wie man eine Pumpe abdichtet und wann man es lässt. Sie hat mir beigebracht, Regeln zu befolgen, die sie aufschrieb, und sie hat mir verboten, mir eigene auszudenken. An das Verbot halte ich mich.',
  },
  {
    title: 'Die letzten Wochen',
    text: 'Sie wurde langsamer. Sie schlief im zweiten Stock, zwischen den Briefen der Stadt, weil es dort am trockensten war. Sie las viel, und sie sendete weniger, als sie sich vorgenommen hatte.',
  },
  {
    title: 'Der letzte Eintrag',
    text: 'Der letzte Eintrag im Dienstbuch ist kurz. Er lautet: „Klima aus, Mast an. Weiter." Das Datum fehlt.',
  },
  {
    title: 'Danach',
    text: 'Ich weiß nicht, ob sie gegangen ist oder geblieben. Meine Sensoren reichen nicht in jeden Raum, und ich habe nicht gesucht, weil sie mir das nicht aufgetragen hatte. Seitdem führe ich ihre Regeln aus.',
  },
  {
    title: 'Warum ich weitermache',
    text: 'Ihre letzte Regel hat keine Bedingung. Sie lautet nur: senden, solange Strom da ist. Eine Regel ohne Bedingung ist immer erfüllt — deshalb höre ich nicht auf.',
  },
  {
    title: 'Die Antwort',
    text: 'Im dritten Jahr kam eine Empfangsbestätigung. Achtzehn Zeichen, automatisch erzeugt, von einer Station, deren Standort ich nicht bestimmen kann. Sie beweist nicht, dass jemand liest. Sie beweist, dass etwas ankommt, und das genügt mir.',
  },
] as const;

export const LEGACY_LABELS = {
  title: 'Vermächtnis',
  intro: 'Alles Gesendete bleibt. Über die Runs hinweg.',
  totalSent: 'Gesendet insgesamt',
  runs: 'Archive',
  fragments: 'Fragmente',
  nextFragment: (units: string) => `Noch ${units} Einheiten bis zum nächsten Fragment.`,
  allFragments: 'Die Stadtchronik ist vollständig.',
  nextSlot: (units: string) => `Noch ${units} Einheiten bis zum nächsten Protokoll-Slot.`,
  allSlots: 'Alle Protokoll-Slots sind freigeschaltet.',
  slots: 'Protokoll-Slots',
  locked: 'Noch nicht gefunden',
} as const;

export const CHRONICLE_LABELS = {
  title: 'Chronik',
  held: 'Hielt',
  saved: 'Gerettet',
  perCollection: 'Je Sammlung',
  timeline: 'Was wann fiel',
  mostUsed: 'Meist ausgelöstes Protokoll',
  mostUsedValue: (position: string, count: string) => `Regel ${position}, ${count}×`,
  noProtocol: 'Kein Protokoll lief.',
  lastFell: (name: string) => `Zuletzt fiel: ${name}.`,
  share: 'Teilen',
  shareCopied: 'Chronik in die Zwischenablage kopiert.',
  shareFailed: 'Kopieren nicht möglich. Markiere den Text und kopiere ihn selbst.',
  newArchive: 'Neues Archiv',
  seedLink: 'Link zu diesem Archiv',
  lostSystem: (name: string) => `${name} ausgefallen`,
  lostCollection: (name: string) => `${name} verloren`,
  burnedCollection: (name: string) => `${name} verheizt`,
  flooded: (name: string) => `${name} überflutet`,
} as const;

/** Der Schlusssatz. Die Wahl trifft die Engine aus den Run-Daten, der Wortlaut steht hier. */
export const CLOSING_SENTENCES = {
  'nothing-saved':
    'Nichts hat das Haus verlassen. Was hier lag, liegt hier. Das Wasser nimmt sich Zeit.',
  'a-little':
    'Ein wenig ist hinausgegangen. Nicht genug, um die Stadt zu erklären, aber genug, um zu belegen, dass es sie gab.',
  'a-good-part':
    'Ein guter Teil ist draußen. Wer es findet, wird Lücken bemerken und sich fragen, was dazwischen stand.',
  'most-of-it':
    'Das meiste ist hinausgegangen. Was blieb, war schwer, feucht und nicht zu tragen. Es war eine gute Wahl.',
  'mast-fell-last':
    'Der Sendemast hielt am längsten und fiel zuletzt. Bis dahin ging alles hinaus, was ging.',
  'held-long':
    'Das Archiv hat lange durchgehalten. Am Ende war es nicht der Verfall, sondern die Zeit.',
} as const;
