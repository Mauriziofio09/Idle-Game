# PLAN.md — ENTROPIE · Das letzte Archiv

Arbeitsplan zu `prompt.md`. Visuelle Quelle: `styles.md` (schreibgeschützt).
Status: **M0–M6 fertig · wartet auf Feedback vor M7.**

---

## 1 · Umgebung (geprüft am 2026-09-24)

| Werkzeug | Vorhanden | Anforderung | OK |
|---|---|---|---|
| node | v26.3.1 | ≥ 22.12 · Angular 22 erlaubt `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0` | ✅ |
| npm | 12.0.2 | `>=8.0.0` | ✅ |
| git | 2.50.1 (Apple Git-155) | – | ✅ |
| @angular/cli | noch nicht installiert, neueste Version 22.2.0 | Angular 22 | ✅ |
| ng version | entfällt — es existiert noch kein Projekt | – | – |

Angular-CLI-MCP-Server: **nicht verbunden** in dieser Sitzung. Best Practices kommen aus
`ng new --help` (bereits abgefragt) und den generierten Projektdateien.

### Scaffold-Befehl (nicht-interaktiv, Flags aus `ng new --help` verifiziert)

```
npx @angular/cli@22 new entropie \
  --directory=. \
  --defaults --skip-git \
  --style=css --test-runner=vitest --zoneless \
  --ssr=false --routing=false \
  --prefix=app --package-manager=npm \
  --ai-config=none
```

- `--skip-git`, weil das Repo schon existiert (`main`, 1 Commit).
- `--style=css`, weil `tokens.css` reines CSS ist und kein Präprozessor gebraucht wird.
- `--test-runner=vitest` und `--zoneless` sind die Angular-22-Defaults; explizit gesetzt, damit nichts nachfragt.
- `--ai-config=none`: `CLAUDE.md` schreibe ich selbst (M0, ≤ 40 Zeilen), statt die CLI-Vorlage zu nehmen.
- `ng new` legt eine eigene `README.md` an. Die bestehende (`# Idle-Game`) ist inhaltsleer und wird überschrieben; in M8 wird sie ohnehin zum Portfolio-README. `prompt.md` und `styles.md` fasst `ng new` nicht an.

---

## 2 · Architektur

### Grundsatz
Die Engine ist ein **reines, deterministisches TypeScript-Modul ohne Angular, DOM, `Date.now()` oder
`Math.random()`**. Angular ist nur Anzeige- und Eingabeschicht. Daraus folgt automatisch:
dieselbe Simulation läuft online, offline, im Aufhol-Pfad und im Headless-Simulator.

```
src/app/
  engine/                  reines TS, keine Angular-Imports (per ESLint-Regel erzwungen)
    state.ts               GameState, SystemState, CollectionState, Typen, initialState(seed)
    balance.ts             ALLE Zahlen & Schwellen — die einzige Stellschraube für M8
    rng.ts                 mulberry32, Zustand (uint32) liegt im Save
    step.ts                step(state) -> { state, events } — ein Tick, 1000 ms
    actions.ts             applyAction(state, action) -> { state, events } — einziger Mutationsweg
    protocols.ts           Regel-Auswertung, Depot-Abklingzeit, Zähler
    events.ts              Zufallsereignisse, Ankündigungen
    offline.ts             simulate(state, ticks) in Chunks
    legacy.ts              Vermächtnis, Schwellen, Freischaltungen
    domain-events.ts       diskriminierte Union aller Domain-Events
  game/                    Angular-Services
    game-store.ts          Signals: state, abgeleitete Computed (Raten, Vorschauen, Sichtbarkeit)
    game-loop.ts           rAF + Zeit-Akkumulator, visibilitychange
    save.ts                localStorage, 2 Slots, Migration, Export/Import
    log.ts                 Domain-Events -> deutsche Log-Zeilen aus content/de.ts
  ui/                      Standalone Components, OnPush, signal inputs
    cross-section/         Querschnitt (SVG), Wasser, Regen, Etagen, Systeme, Sammlungen
    resource-bar/          Energie, Material, Entropie, Pegel, Laufzeit
    detail-panel/          Aktionen + Kostenvorschau
    protocols/             Regel-Editor
    archive-log/           aria-live Log
    chronicle/             Run-Ende
    return-summary/        "Während du fort warst"
    settings/              Reset, Export/Import, Sound, Reduced Motion
    kit/                   aus styles.md: ui-button, ui-card, ui-meter, ui-icon, ui-stat
  content/de.ts            alle Texte, 24 Lore-Fragmente, Log-Vorlagen
  format.ts                zentrale Intl.NumberFormat-/Zeit-Formatierung
src/styles/tokens.css      Übersetzung von styles.md
scripts/sim.ts             npm run sim
```

### Nicht verhandelbare Engine-Regeln
1. `step` und `applyAction` sind pure Funktionen: `(state, …) -> { state, events }`.
2. Zufall **nur** über den Seed-PRNG, dessen Zustand Teil von `GameState` ist.
3. Zeit **nur** als Tick-Anzahl. Die Engine kennt keine Uhr.
4. Texte entstehen erst in der UI aus Domain-Events + `content/de.ts`.
5. Spieler-Aktionen und Protokoll-Aktionen laufen durch denselben `applyAction`.
6. ESLint-Regel `no-restricted-imports` verbietet `@angular/*` in `src/app/engine/**`, plus
   `no-restricted-globals` für `Date`/`Math.random` dort.

### Game Loop
`requestAnimationFrame` + Akkumulator: `acc += now - last; while (acc >= 1000) { tick(); acc -= 1000 }`.
Zeit immer aus `performance.now()`/`Date.now()`-Differenzen, nie aus Aufrufzählung. Tab versteckt →
Loop pausiert, `lastSeen` speichern; wieder sichtbar → Differenz über **denselben** Offline-Pfad.
Das Zustands-Signal wird pro Tick gesetzt (1 Hz), Balken animieren per CSS-Transition.

---

## 3 · `styles.md` → `src/styles/tokens.css`

Benennung möglichst 1:1 zur Gliederung von `styles.md`. Alles, was `styles.md` nennt, wird Token;
**keine** hartkodierten Farben, Abstände oder Schriften in Komponenten.

### Direkte Übernahmen

| Token | Wert | Quelle in `styles.md` |
|---|---|---|
| `--color-background` | `#FFFFFF` | Colors |
| `--color-text-primary` | `#1A1A1A` | Colors |
| `--color-text-muted` | `#6B7280` | Colors |
| `--color-border` | `#000000` | Colors |
| `--color-accent` | `#0A8C3A` | Colors |
| `--color-button-primary-bg` / `-fg` | `#000000` / `#FFFFFF` | Components |
| `--color-button-secondary-bg` / `-fg` | `#FFFFFF` / `#000000` | Components |
| `--color-surface-subtle` | `#F9FAFB` | „gray-50" (Icon-Container) |
| `--font-family-sans` | `"Helvetica Neue", Helvetica, Arial, sans-serif` | Typography |
| `--font-size-h1` / `--font-weight-heading` | `36px` / `700` | Typography |
| `--font-size-stat` | `24px` (700, `--line-height-none: 1`) | Typography |
| `--font-size-body` | `14px` (400) | Typography |
| `--font-size-label` | `12px` (400, muted) | Typography |
| `--font-size-button` / `--font-weight-button` | `16px` / `500` | Components |
| `--letter-spacing-tight` | `-0.02em` | „tracking-tight" |
| `--radius` | `0` | Shape Language |
| `--border-width` | `2px` |  Shape Language |
| `--border` | `2px solid #000000` | Shape Language |
| `--shadow` | `none` | „No box-shadows" |
| `--space-1 … --space-6` | `4 · 8 · 12 · 16 · 20 · 24px` | „16–24px gaps", „16px padding" |
| `--icon-box-lg` / `--icon-box-sm` | `64px` / `40px` | Shape Language |
| `--icon-stroke-width` | `2` | Components |
| `--layout-column-max` | `400px` | Layout |
| `--layout-grid-max` | `1200px` | abgeleitet, Entscheidung 9 |
| `--breakpoint-grid` | `900px` | abgeleitet, Entscheidung 9 |

### Ableitungen aus `styles.md` (Abschnitt 8.4)
Das Spiel braucht Zustände, die `styles.md` nicht kennt. Alle Ableitungen benutzen **nur** vorhandene
Tokens — keine neuen Farbtöne, keine neue Ästhetik:

1. **Wasser** — Flächenfüllung in `--color-text-muted` (#6B7280), oben abgeschlossen durch eine
   `2px`-Linie in `--color-border`. Kein Gradient, kein Blau: Grau ist der einzige neutrale Ton,
   den `styles.md` führt. Token: `--color-water: var(--color-text-muted)`.
2. **Regen** — 1px-Striche in `--color-border` mit abgestufter Dichte (Anzahl = Zufluss). Keine Deckkraft-Spielerei.
3. **Integritätsbalken** — schwarze Füllung auf weißem Grund mit `2px`-Rahmen (= „Bar chart bars",
   nur in Schwarz statt Grün, weil Grün laut `styles.md` den *Datenhighlights* vorbehalten ist).
4. **Gesendet-Anteil** — `--color-accent` (#0A8C3A). Das ist exakt der in `styles.md` vorgesehene
   Gebrauch: Erfolgszustand und Datenhighlight. Grün erscheint im ganzen Spiel **nur** hier
   und im Vermächtnis — dadurch ist Gerettetes sofort erkennbar und Grün bleibt selten.
5. **Zustand „kritisch"** — kein eigener Farbton. Stattdessen: diagonale schwarze Schraffur im Balken
   + Symbol + Textlabel („kritisch"). Erfüllt zugleich Abschnitt 7 („nie nur über Farbe").
   Token: `--pattern-critical`.
6. **Zustand „verloren"** — Invertierung: Kachel wird `--color-border` mit weißer Schrift,
   Label „VERLOREN". Depth kommt laut `styles.md` aus Kontrast, nicht aus Blur — das passt.
7. **Fokus** — `outline: var(--border-width) solid var(--color-accent); outline-offset: 2px`.
   `styles.md` definiert keinen Fokusstil; Grün ist sichtbar auf Schwarz *und* Weiß und ist
   der einzige Akzent. Kontrast gegen Weiß: 4,35:1 (AA für UI-Komponenten erfüllt).
8. **Bewegung** — `--motion-fast: 120ms`, `--motion-slow: 400ms`, `--motion-ease: linear`.
   `styles.md` schweigt zu Bewegung; linear + kurz ist die zurückhaltendste Lesart der
   utilitaristischen Haltung. Unter `prefers-reduced-motion` werden beide auf `0ms` gesetzt.

Kleinere Ableitungen, gleiche Regel (nur aus Vorhandenem gebaut, kein neuer Farbton):
`--color-meter-track` = Hintergrund · `--font-size-h2` = die Stat-Größe 24px eine Stufe unter H1 ·
`--letter-spacing-label` für die Versalien-Sektionslabels ·
`--letter-spacing-bar` 0,1em, damit die Balkenglyphen der Chronik als getrennte Zellen lesbar bleiben · `--line-height-body` für Fließtext ·
`--border-hairline` 1px für Trenner **innerhalb** einer Karte, damit zwei 2px-Rahmen nicht kollidieren ·
`--space-7` 32px und `--space-8` 48px nur für Seitenrhythmus („generous whitespace") ·
`--icon-size-md` 24px / `--icon-size-lg` 32px, weil `styles.md` die Box bemaßt, nicht das Zeichen ·
`--pattern-critical-inverse` — dieselbe Schraffur für invertierte Flächen (ausgewählter Chip),
weil Schwarz auf Schwarz verschwindet ·
`--space-hair` 2px als halbe Stufe unter `--space-1`, nur für Haarfugen (Dachziegel, Log-Ausrichtung) ·
`--floor-min-height` 76px / `--floor-min-height-compact` 64px / `--floor-tab-width` 92px /
`--chip-min-width` 108px / `--chip-max-width` 180px — Maße des Querschnitts; `styles.md` bemaßt
Karten, kein Gebäude, deshalb aus der Abstandsskala gebaut ·
`--panel-column-min` 320px / `--log-max-height` 320px / `--log-time-width` 56px · `--percent-column-width` 3,5em für die Prozentspalte der Chronik ·
`--breakpoint-compact` 600px — zweiter Umbruch, unterhalb dessen zwei Chips pro Reihe stehen,
damit das Gebäude auf dem Handy lesbar bleibt (nur Dokumentation: `@media` kann keine
Custom Property lesen) ·
`--stat-column-min` 96px (= 4 × `--space-6`) als Umbruchbreite der Kennzahlenspalten ·
`--field-number-width` 5,5em für ein Zahlenfeld mit vier Stellen plus Einheit ·
`--checkbox-size` = `--space-4` für das Kästchen ·
**20** (M9) `--color-overlay` `rgb(0 0 0 / 0.66)` — `styles.md` kennt keine Overlay-Farbe,
weil sie eine Seite beschreibt und keinen Dialog. Aus dem Rahmen-Schwarz zu zwei Dritteln,
damit das Archiv hinter der Einführung lesbar bleibt statt ersetzt zu werden. Kein Weichzeichner:
„depth comes from borders and contrast, never blur" ·
**21** (M9) `--dialog-max-width` 496px (= `--layout-column-max` + 2 × `--space-8`) — drei
Sätze bei 400px Breite laufen über sieben Zeilen ·
**22** (M9) `--dot-size` = `--space-2` für den Schrittpunkt, das kleinste Quadrat, das die
Formensprache zulässt ·
**19** (M7) `--stat-column-min-compact` 88px (= `--space-8` + `--space-7` + `--space-2`)
als Umbruchbreite der Kennzahlen auf dem Telefon: mit den 96px der Desktop-Ableitung passen
bei 375px nur zwei Spalten, also brauchen fünf Zahlen drei Zeilen und 184px Bildschirm,
bevor das Archiv überhaupt beginnt. 88px fasst drei Spalten und hält „00:13:10" einzeilig.

Formularelemente (M4, `src/styles.css`): `styles.md` nennt Inputs unter „Shape Language"
(kein Radius, 2px schwarz, kein Schatten), beschreibt aber keine Select- oder Checkbox-Optik.
Abgeleitet, ausschließlich aus vorhandenen Tokens:
`.field` — Rahmen, Radius, Schatten, Schrift und Innenabstand wie eine Karte, plus
`appearance: none`, weil WebKit sonst die gerundete, gefaste Systemsteuerung zeichnet und
Autorenrahmen ignoriert ·
`.select::after` — das mit `appearance: none` verlorene Pfeilchen als **massives Dreieck aus
Rahmenfarben** (eine Form, kein Bild, kein Gradient) ·
`button.small` — bewusste Abweichung von den einzigen Buttons, die `styles.md` definiert
(dort: volle Breite, 16px/500, 16px vertikal). In einer Zeile aus sechs Bedienelementen wäre
ein Button über die volle Breite unbrauchbar; Form, Rahmen und Radius bleiben identisch, nur
Größe und Schriftgrad sinken auf die Label-Stufe ·
`input[type='checkbox']` — Quadrat mit 2px-Rahmen, das sich im Zustand „an" füllt; dieselbe
Formsprache wie alles andere statt der System-Checkbox.

Kontrastprüfung (WCAG AA, `styles.md` nennt keine eigenen Werte):
`#1A1A1A` auf Weiß = 17.4:1 ✅ · `#6B7280` auf Weiß = 4.8:1 ✅ (AA für Text ab 4.5)
· `#0A8C3A` auf Weiß = 4,35:1 ✅ (AA für Grafik/UI) — Grün wird **nicht** für Fließtext benutzt.

### Komponenten-Kit (`ui/kit/`, exakt nach `styles.md`)
`ui-button` (primary/secondary, full-width, 16px vertikal, 2px Rahmen, kein Radius) ·
`ui-card` (weiß, 2px Rahmen, 16px Padding, kein Schatten) · `ui-icon-box` (64/40px, quadratisch) ·
`ui-stat` (Icon + 24px-Zahl + 12px-Label) · `ui-meter` (Balken, `role="meter"`) ·
`ui-icon` (Lucide-Outline, 2px Stroke).

**Vor M2 und vor M7 lese ich `styles.md` erneut** (Abschnitt 8.7) und mache danach den
Screenshot-Abgleich bei 1440 px und 375 px (Abschnitt 8.8, Chrome-Steuerung ist verfügbar).

---

## 4 · Dependencies

Ziel: so wenige wie möglich. **Laufzeit-Dependencies außer Angular: keine.**

| Paket | Art | Begründung |
|---|---|---|
| `@angular/*` | runtime | Vorgegeben (Abschnitt 9). |
| `typescript`, `vitest`, `angular-eslint`, `eslint` | dev | Kommen mit `ng new`, von Abschnitt 9/10 gefordert. |
| `@playwright/test` | dev | Von M8 ausdrücklich gefordert (Smoke-Test). Wird erst in M8 installiert, nicht früher. |
| `tsx` | dev | Für `npm run sim`. Nodes nativer TS-Läufer scheiterte wie befürchtet an den extensionslosen Imports der Engine (`ERR_MODULE_NOT_FOUND` für `./balance`), weil ESM vollständige Specifier verlangt. Die Alternative — überall `.ts`-Endungen in die Imports schreiben — widerspricht der Angular-Konvention und „Einfach vor clever". Also der in M0 vorgesehene Fallback. Nur dev, nie im Bundle. |

**Lucide-Icons:** `styles.md` verlangt den Lucide-Outline-Stil. Statt eines npm-Pakets kopiere ich
die ~10 benötigten SVG-Pfade (MIT, Attribution im README) inline in `ui-icon`. Das spart eine
Dependency und einen externen Request und hält das Bundle klein.

**Keine** Game-Engine, **kein** NgRx, **keine** Chart-Lib, **keine** Webfonts, **keine** externen Requests.

---

## 5 · Meilenstein-Checkliste

Definition of Done je Meilenstein (Abschnitt 10): Build ohne Fehler · Tests grün · Lint sauber ·
`npm run sim` läuft (ab M1) · keine Konsolenfehler · Belege (Befehl + Ausgabe, bei UI Screenshots) ·
Subagent-Review in frischem Kontext · `PLAN.md` aktualisiert · Conventional Commit ·
Kurzbericht + **Stopp bis zu deinem Feedback**.

### M0 · Fundament
- [x] `styles.md` vollständig gelesen
- [x] Umgebung geprüft und gezeigt
- [x] `PLAN.md` geschrieben
- [x] Fragen beantwortet (4/4, siehe Abschnitt 6)
- [x] Freigabe erhalten
- [x] `ng new` (Befehl oben), `.gitignore` prüfen
- [x] ESLint-Regeln für die Engine-Reinheit (kein `@angular/*`, kein `Date`, kein `Math.random`)
- [x] `src/styles/tokens.css` aus `styles.md`
- [x] `ui/kit/` Grundkomponenten (Button, Card, Stat, IconBox)
- [x] `CLAUDE.md` (≤ 40 Zeilen)
- [x] `IDEAS.md` anlegen (für Scope-Creep-Ideen)
- [x] Vitest läuft (ein Smoke-Test)

### M1 · Engine-Kern
- [x] `state.ts`, `balance.ts`, `rng.ts` (mulberry32, Zustand im Save)
- [x] `step.ts`: Entropie · Wasser · Feuchte (exponentielle Glättung) · Energie inkl. proportionaler
      Unterversorgung · System-Verfall · Sammlungs-Verfall · Überflutungs-Totalverlust
- [x] `actions.ts`: Reparieren · Ein/Aus · Rückbau
- [x] Domain-Events
- [x] Tests: Entropie monoton · `m(S)` monoton · Reparatur-Abnahme über `n` · Werkstatt-Faktor ·
      Kosten & Obergrenze 100 · Rückbau-Ertrag · verlorene Systeme bleiben verloren ·
      Unterversorgung proportional · Determinismus (10 000 Ticks am Stück == in Zufalls-Chunks)
- [x] `npm run sim` v1 (Strategie „nichts tun" + „naiv")

### M2 · Erstes Spielbares
- [x] **`styles.md` erneut lesen**
- [x] `cross-section` (HTML/CSS statt SVG, siehe Entscheidung 13): 5 Etagen, steigendes Wasser,
      Regen, Dachschaden, Systeme, Sammlungen
- [x] `resource-bar` mit Netto-Raten
- [x] `detail-panel` mit Kostenvorschau („+21 % · 12 Material · Entropie +3")
- [x] `archive-log` (`aria-live="polite"`)
- [x] `GameLoopService` (rAF + Akkumulator, visibilitychange)
- [x] Ein Run ist vollständig spielbar (ohne Senden)
- [x] Screenshots 1440 px / 375 px gegen `styles.md` geprüft

### M3 · Speichern & Offline
- [x] `localStorage` `entropie.save`, `schemaVersion`, 2 Slots
- [x] Autosave 15 s + `visibilitychange` + `pagehide`
- [x] `offline.ts` in Chunks, Begrenzung `[0, 24 h]`, negative Zeit → 0, Stasis > 24 h
- [x] `return-summary` ab 2 min Abwesenheit
- [x] Export/Import Base64 + Prüfsumme + strenger Validator (kein `eval`)
- [x] Tests: Roundtrip · Migration v0→v1 · kaputter Import · Offline == Online (gleicher Seed)
- [x] Performance: 86 400 Ticks < 1,5 s (gemessen, Zahl im Bericht)

### M4 · Protokolle
- [x] `protocols.ts`: Bedingungen, Aktionen, Priorität, Depot-Abklingzeit `max(5, 20/(I/100))`
- [x] Ausführung nur bei Depot an + versorgt + bezahlbar
- [x] Editor-UI: deutscher Satz, Dropdowns + Zahlenfeld, Reihenfolge tastaturbedienbar, Auslöse-Zähler
- [x] 2 Slots zu Beginn, max. 8
- [x] Offline nutzt dieselbe Logik (Test)
- [x] Tests: Priorität · Abklingzeit · Bezahlbarkeit · keine Ausführung ohne Depot/Strom

### M5 · Ziel & Ende
- [x] Sendemast + Senden (eine Sammlung gleichzeitig), Mastverschleiß
- [x] Ereignisse (6 Stück, seed-basiert, Ankündigung 20 s bei Sturmflut/Wolkenbruch)
- [x] Run-Ende-Bedingungen + Tests
- [x] `chronicle`: Laufzeit · Gerettet gesamt/je Sammlung · Verlust-Zeitleiste · häufigstes Protokoll ·
      generierter Schlusssatz
- [x] Teilen: Clipboard + Web Share API · Seed-Link `?archiv=XXXX`
- [x] Vermächtnis + 24 Lore-Fragmente + „Neues Archiv"

### M6 · Tiefe (SOLL)
- [x] Umlagern (30 s unterwegs, max. 3 pro Etage)
- [x] Verheizen (zweistufige Bestätigung, eigener Log-Eintrag, inszeniert)
- [x] Materialreserve für Protokolle
- [x] Szenarien („Dürresommer", „Der Turm")
- [x] Tagesarchiv (Seed aus Datum)

### M7 · Feel & Politur
- [x] **`styles.md` erneut lesen**
- [x] Progressive Enthüllung (Protokolle nach 1. Reparatur, Mast nach ~2 min, Entropie ab 1. Reparatur)
- [x] Erste 60 s über das Log, erste sinnvolle Aktion dezent hervorgehoben
- [x] Mikro-Feedback je Aktion, würdevoller Verlust-Moment
- [x] `prefers-reduced-motion` überall
- [x] Barrierefreiheit: Tastatur, Fokus, `role="meter"`, Kontraste (`npm run contrast`)
- [x] Mobile 375 px (Panels als Tabs, im Browser gemessen)
- [x] Sound (KANN, Web Audio, standardmäßig aus)

### M8a · Balancing
- [x] `npm run sim` über 200 Seeds, Median/P10/P90
- [x] `balance.spec.ts` gegen die Ziele aus Abschnitt 6 (mit Toleranz)
- [x] Garantie-Test: jede Strategie endet < 72 h
- [x] Offline-Budget: 24 h in rund 65 ms (Ziel < 1500 ms)

### M8b · Release
- [x] Bundle-Budget
- [x] Playwright-Smoke: lädt · Reparatur · Reload behält Spielstand
- [x] `README.md` als Portfolio-Stück, MIT-Lizenz
- [x] GitHub-Actions-Workflow für Pages (korrekter `base-href`)
- [ ] **Push/Deploy erst nach deiner Bestätigung**

---

## 6 · Getroffene Entscheidungen

1. **Scaffold direkt im Repo-Root** (`--directory=.`), nicht in einem Unterordner — das Repo ist
   praktisch leer und GitHub Pages wird dadurch einfacher.
2. **Lucide inline statt npm-Paket** (siehe Abschnitt 4).
3. **Grün nur für Gesendetes/Vermächtnis.** Der einzige Akzent markiert das einzig Bleibende.
   Das ist auch thematisch richtig: Grün = gerettet.
4. **Integritätsbalken schwarz, kritisch als Schraffur, verloren als Invertierung** — kein Ampelsystem,
   weil `styles.md` keine Warnfarben kennt und Abschnitt 7 Farbe allein ohnehin verbietet.
5. **Sammlungs-Verfall exponentiell auf den Rest** (`0,01 %/s × Rest`), wie in 5.8 beschrieben —
   damit nähert sich eine Sammlung asymptotisch der Null und ist nie „plötzlich" weg;
   Totalverlust passiert nur durch Überflutung.
6. **`balance.ts` enthält ausschließlich Zahlen** (keine Logik), damit M8 reines Zahlen-Tuning ist.
7. **Seed-Format:** 4 Zeichen aus `0-9A-F` (z. B. `4F2A`), passt zum Beispiel in 5.11.
8. **Zwei Save-Keys:** `entropie.save` (Run, 2 Slots) und `entropie.legacy` (Vermächtnis) — 9 verlangt
   getrennte Speicherung; ein harter Reset des Runs darf das Vermächtnis nicht anfassen.

9. **Layout (beantwortet):** Mobil exakt die zentrierte 400-px-Spalte aus `styles.md`. Ab `900px`
   ein zentriertes Raster mit `max-width: 1200px` aus **denselben** 2px-umrandeten Karten —
   Querschnitt breit links, Protokolle und Archivlog rechts. Die Formsprache bleibt 1:1,
   nur die Anordnung skaliert. Token: `--layout-column-max: 400px`, `--layout-grid-max: 1200px`,
   `--breakpoint-grid: 900px`.
10. **Palette (beantwortet):** Weiß bleibt, `styles.md` wörtlich. Kein Dark Mode, kein Umschalter.
   Die Melancholie trägt der Text, nicht die Dunkelheit.
11. **Rhythmus (beantwortet):** M0 und M1 werden zusammen geliefert (beide ohne sichtbares Spiel),
   danach Stopp nach jedem Meilenstein.
12. **README (beantwortet):** Englisch. Spiel-UI, Lore und Log bleiben deutsch.
13. **Querschnitt in HTML/CSS, nicht SVG** (M2). `prompt.md` 7 erlaubt beides. Jedes System und
    jede Sammlung ist damit ein echter `<button>`: Tastaturfokus, `aria-pressed` und Trefferflächen
    gibt es geschenkt, statt sie im SVG nachzubauen. Das Wasser ist ein absolut positioniertes
    Element mit `height`-Transition, der Regen sind 1px-Striche, deren **Anzahl** die Stärke zeigt
    (keine Animation — damit ist `prefers-reduced-motion` von vornherein erfüllt).
15. **Speicher hinter einem Injection-Token** (`game/storage.ts`, M3). `localStorage` fehlt in
    Privatfenstern, bei blockierten Site-Daten — und in dieser Testumgebung: Node 26 stellt ein
    eigenes, ohne `--localstorage-file` deaktiviertes `localStorage` bereit, und jsdom liefert
    keines. Ein Token mit `GAME_STORAGE` behandelt die Abwesenheit an einer Stelle und macht
    Persistenz ohne Browser-Global testbar. `memoryStorage()` dient Tests und blockierten Browsern.
16. **Log wird nicht gespeichert.** Er ist eine Sitzungsansicht, kein Zustand: Beim Laden steht
    „Das Archiv erinnert sich.", danach schreiben die aufgeholten Ereignisse selbst die Zeilen.
    Das hält den Spielstand klein und kann nie mit dem Zustand auseinanderlaufen.
14. **Etagen-Tabs auf dem Handy erst in M7.** `prompt.md` 7 nennt „Panels als Tabs" für Mobile.
    In M2 gibt es nur zwei Panels (Auswahl, Log); Tabs lohnen sich ab M4, wenn die Protokolle
    dazukommen. Bis dahin scrollt die Seite — bei 375 px ist der Querschnitt 538 px hoch und
    vollständig bedienbar. Steht als offener Punkt in M7.

## 7 · Risiken & Beobachtungen

1. **Die Startwerte treffen die Ziele aus Abschnitt 6 vermutlich nicht.** Überschlag mit den Zahlen
   aus Abschnitt 5: Generator bei ~70 % liefert 2,1 E/s, eingeschaltete Verbraucher fordern 2,4 E/s —
   das Archiv ist ab Sekunde 1 leicht unterversorgt (vermutlich Absicht). Der Generator verfällt bei
   0,06 %/s × m(S) × Feuchte aber erst nach ~20–25 min unter 0 %, während „Nichts tun" in 8–15 min
   enden soll. Ebenso: Pumpen an → Keller ist erst nach ~33 min überflutet, Pumpen aus → nach ~4 min.
   *Vorgehen:* Formeln bleiben wie spezifiziert; die Zahlen in `balance.ts` tune ich in M8 per
   Simulation. Falls eine Formel die Ziele strukturell nicht erreichen kann, melde ich das mit einem
   konkreten Gegenvorschlag, statt still etwas anderes zu bauen.
2. **Determinismus vs. Gleitkomma.** Chunk-Grenzen dürfen das Ergebnis nicht verändern. Gegenmittel:
   ausschließlich ganze Ticks, keine Teil-Ticks, keine Zeit-Interpolation in der Engine. Der
   Determinismus-Test (M1) ist die Absicherung.
3. ~~Offline-Performance~~ — **gemessen in M1: 86 400 Ticks in 42 ms** (Ziel < 1500 ms, 35× Reserve).
   `npm run sim` misst das bei jedem Lauf mit und setzt den Exit-Code, falls das Budget reißt.
4. ~~Konflikt Layout~~ — **geklärt** (Entscheidung 9). Verbleibendes Restrisiko: der Querschnitt muss
   in 375 px *und* in der breiten Rasterzelle lesbar sein. Gegenmittel: SVG mit `viewBox` und
   `preserveAspectRatio`, Beschriftungen ab einer Mindestbreite eingeblendet. Screenshot-Abgleich in M2.
5. ~~Ton vs. Palette~~ — **geklärt** (Entscheidung 10): Weiß, `styles.md` wörtlich.
6. **Scope.** M0–M8 ist viel. Die Reihenfolge ist so gewählt, dass nach M2 jederzeit etwas
   Spielbares existiert und nach M5 ein vollständiges Spiel.

---

## 8 · Messwerte aus M1 (Basis für das Tuning in M8)

`npm run sim`, 200 Seeds, Startwerte unverändert aus `prompt.md` Abschnitt 5:

| Strategie | Laufzeit P10 / Median / P90 | Ziel (Abschnitt 6) | Stand |
|---|---|---|---|
| Nichts tun | 10,5 / **11,7** / 13,0 min | 8–15 min | ✅ trifft |
| Naiv (schwächstes System) | 12,3 / **13,8** / 15,4 min | 20–35 min | ❌ zu kurz |
| Keller aufgeben | 9,9 / **10,0** / 10,1 min | – (Strategie-Sonde) | – |

Alle Runs enden mit `silence`, keiner läuft über 72 h → Säule 1 hält bisher.
Gerettet liegt überall bei 0 %, weil der Sendemast erst in M5 kommt.

**Warum ein Run endet** (Sonde mit Seed `0000`): Ab t≈80 s ist das Archiv dauerhaft
unterversorgt (Generator 1,8 E/s gegen 2,4 E/s Bedarf), die Energie steht auf 0. Die Pumpen
laufen dadurch gedrosselt, verfallen bei hoher Kellerfeuchte und sind bei t≈480 s verloren.
Das Wasser steigt frei weiter und erreicht bei t=620 s mit W=2,0 die Generator-Etage — Ende.
Das ist exakt das in Abschnitt 5.4 beschriebene Pacing.

**Was M8 anfassen muss:** Die naive Strategie verlängert den Run nur um ~2 min, weil
Reparaturen an den Pumpen die eigentliche Ursache (Energiemangel) nicht beheben und jede
Reparatur zusätzlich `S +3` kostet. Kandidaten: `ENERGY.generatorOutputPerSecond` anheben
oder `SYSTEMS.pumps.drawPerSecond` senken, damit aktives Spiel überhaupt aus der
Dauer-Unterversorgung herauskommt. Erst nach M5 sinnvoll zu tunen, weil der Sendemast
Energie zieht und die Zielkurve verschiebt.

**Offline-Budget:** 86 400 Ticks (24 h) in **42 ms** — Ziel < 1500 ms.

---

## 9 · Bewusste Abweichungen von `prompt.md` Abschnitt 5

Die Formeln aus Abschnitt 5 sind umgesetzt wie beschrieben. Vier Stellen weichen ab oder
füllen eine Lücke — alle vier stehen auch als Kommentar an der jeweiligen Codestelle.

**Nachtrag (M9): eine bewusste Abweichung von Abschnitt 7.** Dort steht ausdrücklich
„kein Tutorial-Modal, keine Textwand"; die Einführung sollte allein über das Log und die
progressive Enthüllung laufen. Auf ausdrücklichen Wunsch gibt es jetzt trotzdem eine
Einführung beim ersten Start. Die Absicht des Verbots ist dabei gewahrt: sieben Schritte
mit höchstens drei Sätzen, auf jedem Schritt ein sichtbarer Ausgang, nur beim allerersten
Mal, und die progressive Enthüllung bleibt unangetastet. Wer die Einführung überspringt,
spielt exakt das Spiel, das Abschnitt 7 beschreibt.

1. **Unterversorgung auf dem Übergangstick** (`engine/step.ts`, Schritt 2).
   Abschnitt 5.6 schreibt `Effizienz = Produktion / Bedarf`. Genau auf dem Tick, an dem der
   Akku leerläuft, enthält er noch eine Teilladung, und die ist echte Energie. Ich rechne
   `(Produktion + Restakku) / Bedarf`. Das erhält die Energiebilanz (Verbrauch = Verhältnis ×
   Bedarf); die wörtliche Formel würde den letzten Rest des Akkus stillschweigend verschlucken.
   Ab dem Folgetick ist das Verhältnis identisch mit der Spezifikation.
2. **Klimatechnik unter Unterversorgung** (`engine/step.ts`, `humidityTarget`).
   Abschnitt 5.5 schreibt den Klima-Term ohne Versorgungsfaktor. Ich skaliere ihn mit
   `supplyRatio`, weil Abschnitt 5.6 sagt, dass *alle* eingeschalteten Verbraucher mit ihrem
   Anteil laufen. Eine Klimaanlage am Brownout muss weniger Luft trocknen.
3. **Verfall unter Wasser** (`balance.ts`, `SYSTEM_DECAY.floodedExtraPerSecond = 1,5 %/s`).
   Abschnitt 5.3 sagt nur „verliert zusätzlich schnell Integrität". Gewählt: ein versunkenes
   System ist in gut einer Minute weg. Tunbar in M8.
4. **Senden unter Unterversorgung** (`engine/step.ts`, `transmitRate`). Abschnitt 5.7 schreibt
   `0,2 × I_Mast/100` ohne Versorgungsterm. Wie bei Pumpen und Klimatechnik skaliere ich mit
   `supplyRatio`, weil 5.6 das für jeden eingeschalteten Verbraucher vorschreibt — und der Mast
   ist der hungrigste im Haus.
5. **Feuchte-Zielwerte** (`balance.ts`, `HUMIDITY`). Abschnitt 5.5 beschreibt die Form
   (Grundfeuchte + Wassernähe + Dachleck − Klima, weich angenähert), nennt aber keine Zahlen.
   Gewählt: Grundfeuchte `20 + 0,25 × S`, Wassernähe `45` über `2` Etagen Reichweite,
   Glättung `2 %` des Restabstands pro Sekunde (Zeitkonstante ~50 s). Alle in `balance.ts`.

---

## 10 · Stand nach M2

Gebaut: `game/game-store.ts` (Signals, einziger Weg in die Engine), `game/game-loop.ts`
(rAF + Zeitstempel-Akkumulator, Pause bei verstecktem Tab, Aufholen über `simulate`),
`game/log.ts` (Domain-Event → deutscher Satz), `ui/cross-section`, `ui/resource-bar`,
`ui/detail-panel`, `ui/archive-log`.

**Gemessen im Browser:** 1440 px → `main` 1200 px, Raster zweispaltig · 375 px → kein
horizontaler Überlauf, Gebäude 538 px hoch, zwei Chips pro Reihe, alle Etagennamen passen ·
Konsole ohne Fehler · Reparatur-Durchstich: Pumpen 55 → 83 %, Material −8, Energie −10,
Entropie +3, nächste Vorschau korrekt teurer und schwächer.

**In M2 nachgebessert:** Dachschäden werden verteilt statt als Block abgetragen (las sich wie
ein Balken), Regendichte erhöht, Balken auf ausgewählten (invertierten) Chips invertiert —
sonst verschwindet die schwarze Füllung im schwarzen Chip und der leere Rest wirkt gefüllt.

**Offen für M7:** Panels als Tabs auf dem Handy (Entscheidung 14).

### Nachträge aus der M2-Review

Die Review mit frischem Kontext fand acht echte Punkte. Behoben:

1. **Frame-Leak** (`game/game-loop.ts`). Wird die Seite in einem Hintergrund-Tab geöffnet,
   fordert `start()` ein Frame an, das nie feuert. Beim Wechsel in den Tab forderte `resume()`
   ein zweites an und verlor den Griff auf das erste — ein Waisen-Frame, das auch nach `stop()`
   und nach `onDestroy` weiter tickte. `resume()` bricht jetzt zuerst ab. Test dazu.
2. **Zeitschranke fehlte im Frame-Pfad** (schon vor der Review behoben): Ein Rechner, der aus
   dem Ruhezustand aufwacht, feuert kein `visibilitychange`; die Lücke kam als ein Frame.
3. **`role="meter"` steckte in einem `<button>`** (`ui/cross-section`). Ein Button hat
   *presentational children* — die Balken und all ihre Werte wurden aus dem Accessibility-Baum
   entfernt. Der Chip ist jetzt ein Container: Auswahl-Button oben, Balken als Geschwister
   darunter. Ein Test prüft, dass kein Meter je wieder in einem Button landet.
4. **Fokus fiel beim Rückbau zweimal auf `<body>`**: erst beim Einblenden der Bestätigung,
   dann beim Leeren des Panels. Der Fokus wandert jetzt auf die Bestätigung bzw. die Überschrift.
5. **Bestätigung blieb über einen Auswahlwechsel hinweg scharf** — jetzt ein `linkedSignal`,
   das an der Auswahl hängt.
6. **`integrity >= 100`** im Detail-Panel kam aus der Luft statt aus `REPAIR.maxIntegrity`;
   der Sammlungsbalken nahm `unitsEach === 100` an und rechnet jetzt mit Anteilen.
7. **Texte außerhalb `de.ts`** („Verfall", „max") und zwei rohe Zahlen (Etagenindex) —
   beides jetzt über `de.ts` bzw. `format.ts`. Im unterversorgten Fall stand eine nackte
   Prozentzahl ohne Wort; sie heißt jetzt „Versorgung 74 %".
8. **Maße und Abstände außerhalb der Skala** — als Tokens 11–14 oben nachgetragen.

Zwei schwache Tests verschärft (der Balken-Test prüfte nur, dass Attribute nicht leer sind;
der Seed-Test behauptete Unterschiedlichkeit, prüfte aber nur das Format) und drei fehlende
Bereiche ergänzt: `format.spec.ts`, Ende mitten im Aufholen, kritischer Zustand nie nur über Farbe.

---

## 11 · Stand nach M3

Gebaut: `game/save-format.ts` (pure Funktionen: Migration, Validierung, Prüfsumme, Base64),
`game/save.ts` (zwei Slots, getrenntes Vermächtnis), `game/storage.ts` (Token),
`game/autosave.ts` (15 s + `visibilitychange` + `pagehide`), `game/away-report.ts`,
`ui/return-summary`, `ui/settings` (Export, Import, Neues Archiv).

**Im Browser nachgewiesen:** Archiv überlebt den Reload (Seed bleibt) · 10 min Abwesenheit
werden aufgeholt, Laufzeit 00:00:16 → 00:10:16 · Rückkehr-Zusammenfassung erscheint ab 2 min ·
endete der Run während der Abwesenheit, zeigt sie „Fort 00:20:00 · Simuliert 00:11:12" und
nennt den Grund · Konsole ohne Fehler.

**Ein echter Fehler, den erst der Browser-Test zeigte:** Die Sammlungsbilanz driftete durch
tickweises Aufsummieren auf `rotted = 100.00000000000006`. Mein Validator ließ nur `≤ 100` zu
und erklärte damit einen völlig gesunden Spielstand für beschädigt — der Zwei-Slot-Fallback
griff und lud stillschweigend die ältere Sicherung. Behoben an beiden Enden: die Engine
schließt die Bilanz beim Verlust exakt (`rotted = unitsEach − sent`), und der Validator
toleriert `1e-6` Drift. Regressionstest prüft jeden Zustand eines kompletten Runs.

### Nachträge aus der M3-Review

Sieben echte Punkte. Behoben:

1. **[schwer] Zeit im Hintergrund-Tab wurde aus dem Spielstand gelöscht.** Ist der Tab
   versteckt, friert der Loop die Simulation ein — der Autosave-Timer läuft aber weiter
   (Browser drosseln Hintergrund-Timer, sie stoppen sie nicht) und `pagehide` feuert beim
   Schließen. Beide schrieben den *eingefrorenen* Zustand mit *aktuellem* Zeitstempel.
   Tab um 22 Uhr verstecken, um 6 Uhr schließen → acht Stunden nie simuliert und nie
   erwähnt. Das trifft Säule 3 ins Mark. Der Store führt jetzt `simulatedUntilMs` — den
   Wandzeit-Moment, dem der Zustand entspricht — und *der* wird gespeichert.
2. **[schwer] Nach dem Run-Ende blieb die Uhr tot.** Die Frame-Kette stoppt beim Verstummen,
   `running` blieb aber `true`; „Neues Archiv" und ein erfolgreicher Import setzten einen
   lebendigen Zustand ein, den niemand mehr tickte. Ein `effect` auf `store.ended()` weckt
   die Kette, mit einem expliziten `pausedByEnding`-Flag statt einer Heuristik am Frame-Handle.
3. **[mittel] Ein unlesbarer Spielstand erreichte den Spieler nie.** Beide Slots kaputt hieß:
   stillschweigend ein neues Archiv, und 15 s später überschrieb der Autosave die Reste.
   Jetzt gibt es eine Meldung (`STARTUP_NOTICES`), und die unlesbaren Daten werden unter
   `entropie.save.broken` beiseitegelegt. Auch der Fall „aus der Sicherung geladen" wird
   jetzt unabhängig von der Abwesenheitsdauer gemeldet.
4. **[mittel] Das Aufholen lief nicht in Chunks.** `simulateInChunks` war nur im Test
   verdrahtet. Jetzt in beiden Aufhol-Pfaden. Der Kommentar dort behauptete außerdem, die
   Funktion gebe zwischen Chunks die Kontrolle ab — das tut sie nicht. Korrigiert, samt
   Begründung, warum keine Fortschrittsanzeige gebaut wird: 24 h messen ~45 ms.
5. **[mittel] Der Reset verlor den Tastaturfokus** — derselbe Fehler wie in M2, jetzt mit
   demselben Mittel behoben (`focusAfterRender` auf Bestätigung bzw. Ausgangsbutton).
6. **[gering] Die Export-Meldung wurde nicht angekündigt** (`role="status"` fehlte), und der
   Fokus sprang nicht in das erscheinende Textfeld — das ist der einzige Weg, von Hand zu
   kopieren, wenn die Zwischenablage verweigert wird.
7. **[gering] Die Rückkehr-Zusammenfassung erschien für Abwesenheiten ohne Inhalt.** Ein
   längst verstummtes Archiv nach zwei Tagen zu laden zeigte „Fort 48:00:00 · Nichts ging
   verloren" — sachlich falsch. Das Gate hängt jetzt an der simulierten Zeit, nicht an der
   Wanduhr, plus immer bei einem Ende während der Abwesenheit.

**Dabei aufgefallen, ohne dass die Review es sah:** Die Loop-Tests stubbten
`requestAnimationFrame` global — und fingen damit auch die Frames ab, die **Angulars
zoneless Change Detection** anfordert. Die Tests maßen also nie nur den Loop. Der Frame-Takt
liegt jetzt hinter `FRAME_SCHEDULER` (wie der Speicher hinter `GAME_STORAGE`), und die Tests
treiben ausschließlich den Takt des Spiels.

---

## 12 · Stand nach M4

Gebaut: `engine/protocols.ts` (Bedingungen, Priorität, Abklingzeit, Materialreserve),
Protokolle laufen in `step` und damit offline wie online, `protocol-fired` als Domain-Event,
Regelverwaltung im Store, `ui/protocols` als Satz-Editor, Regeln und Reserve im Spielstand
(Schema 2 mit Migration 1→2), Protokoll-Läufe in der Rückkehr-Zusammenfassung,
Strategie „Protokolle, dann weggehen" im Simulator.

**Entscheidungen:**
17. **Protokolle dürfen nicht zurückbauen.** `prompt.md` 5.9 listet Reparieren, Ein/Aus,
    Senden und Umlagern — keinen Rückbau. Ein System endgültig herzugeben bleibt eine
    Entscheidung, die der Spieler persönlich trifft. Der Typ `ProtocolAction` ist deshalb
    enger als `Action`, und der Validator lehnt ein `dismantle` in einer Regel ab.
18. **Die Abklingzeit läuft mit dem Versorgungsanteil, nicht binär.** `prompt.md` 5.9 sagt
    „unversorgt → keine Protokolle". Bei `supplyRatio = 0` passiert nichts — das ist erfüllt.
    Dazwischen zählt die Abklingzeit proportional langsamer herunter, wie es 5.6 für jeden
    eingeschalteten Verbraucher vorschreibt. Dieselbe Lesart wie bei der Klimatechnik (M1).
19. **Ein gefeuertes Protokoll bekommt keine eigene Log-Zeile.** Die Aktion schreibt bereits
    eine („Pumpen repariert. 84 %."); eine zweite wäre Verdopplung. Wer gehandelt hat,
    beantworten der Zähler an der Regel und die Rückkehr-Zusammenfassung.
20. **Regel-IDs werden aus den vorhandenen Regeln abgeleitet**, nicht aus einem Zähler —
    ein Sitzungszähler würde nach dem Laden eines Spielstands Dopplungen vergeben.
21. **`minCooldownSeconds` ist unerreichbar.** `20 / (I/100)` ist bei `I ≤ 100` nie unter 20 s.
    Der Wert aus `prompt.md` bleibt als Sicherheitsboden stehen und ist getestet.

**Messung, die M8 braucht:** Die Strategie „zwei Protokolle schreiben, dann weggehen"
löst im Median nur **3 Aktionen** pro Run aus (P90 5) und verlängert ihn auf 12,3 min.
Nicht die Abklingzeit begrenzt das — bei 20 s wären in 12 min rund 36 Aktionen möglich —
sondern die Bezahlbarkeit: Eine Reparatur kostet 10 Energie, und das Archiv steht ab
Sekunde 80 dauerhaft bei 0. **Bei der aktuellen Balance ist das Idle-Herz mechanisch
korrekt, aber praktisch fast wirkungslos.** Das ist derselbe Befund wie bei „Naiv" aus M1,
nur schärfer, und gehört nach M8 — sinnvoll erst nach M5, weil der Sendemast die
Energiekurve nochmals verschiebt.

### Nachträge aus der M4-Review

Acht Punkte. Behoben:

1. **Umsortieren und Entfernen verloren den Tastaturfokus.** Schiebt man eine Regel nach oben,
   wird genau der gedrückte Knopf deaktiviert — der Browser wirft den Fokus auf `<body>`, und
   der Spieler verliert seine Position. Derselbe Fehlertyp wie in M2 und M3, im neuen Editor
   erneut aufgetreten, weil er gar keine Fokus-Führung hatte. Jetzt folgt der Fokus der Regel;
   beim Entfernen landet er auf der Nachbarregel oder auf „Regel hinzufügen".
2. **Native Select- und Checkbox-Optik widersprach `styles.md`.** Ohne `appearance: none`
   zeichnet WebKit die gerundete, gefaste Systemsteuerung mit Innenschatten und ignoriert
   Autorenrahmen — auf genau der Plattform, auf der dieses Projekt entwickelt wird. Beide
   werden jetzt aus Tokens gezeichnet; im Browser nachgemessen: `appearance: none`,
   Radius 0, Rahmen 2px.
3. **Die Ableitungen der Formularelemente waren nicht dokumentiert** — nachgetragen (oben).
4. **`width: 5.5em`** war eine rohe Zahl — jetzt Token 15, dazu Token 16 für die Checkbox.
5. **Ein `aria-label` wurde im Template aus Text und Zahl zusammengesetzt.** Beides gehört
   nach `de.ts` bzw. durch `format.ts`. Gleichzeitig behoben: Alle Regeln trugen identische
   Namen („Bedingung", „Schwelle" …); jetzt nennt jeder Name seine Regel („Regel 2: Schwelle
   in %"), und die Einheit steht im Namen statt nur als Nachbar-Span.
6. **Eine verworfene Zahl blieb im Feld stehen.** Tippt man 99999 in die Materialreserve, die
   schon auf dem Maximum steht, ändert sich der Zustand nicht — die Bindung feuert nicht, und
   das Feld zeigt weiter 99999. Der Spieler sieht eine Zahl, mit der das Archiv nicht rechnet.
   Beide Zahlenfelder schreiben den geklemmten Wert jetzt zurück.
7. **`depotRate` formatierte ein Intervall als `hh:mm:ss`.** `prompt.md` 5.1 schreibt das für
   die Laufzeit vor, nicht für eine Abklingzeit — jetzt „Eine Aktion alle 33 s."
8. **Zwei Tests konnten nicht fehlschlagen** und **die Regel-API war ungetestet** (siehe unten).

**Dabei gefunden, was die Review nicht sah:** `createRule` leitete die ID aus dem aktuellen
Zustand ab. Zweimal aufgerufen, bevor eine Regel hinzugefügt wird, vergibt sie zweimal
dieselbe ID — ein `updateProtocol` hätte dann beide Regeln geändert. Die UI war nicht
betroffen, die API lud aber zum Fehler ein. `addProtocol(condition, action)` baut und hängt
die Regel jetzt in einem Schritt an; `createRule` ist privat.

**Tests:** „offline == online" verglich `simulate` mit einer handgeschriebenen `step`-Schleife —
`simulate` *ist* diese Schleife. Der Test prüft jetzt durchgespielt gegen `simulateInChunks`
gegen ungleiche Chunks, und belegt, dass die Regel dabei mehrfach feuert. Der Reserve-Test
behauptete „schränkt nur die Automatik ein", prüfte aber nur, dass eine Zahl unverändert
bleibt; er lässt jetzt das Depot ablehnen und den Spieler dieselbe Ausgabe tätigen. Neu dazu:
Chunk-Invarianz **mit Regeln im Zustand** (der Determinismus-Test lief bisher immer mit leerer
Regelliste) und sieben Tests für die Regel-API im Store — Slot-Grenze, eindeutige IDs, Zähler
überlebt Umsortieren und Bearbeiten, Reserve-Klemmung, Regeln überleben Speichern und Laden.

---

## 13 · Stand nach M5

Gebaut: `engine/events.ts` (sechs Ereignisse, seed-gezogen, zwei angekündigt),
Senden in `actions.ts` und `step.ts`, `engine/chronicle.ts`, `engine/legacy.ts`,
`game/share.ts`, `ui/chronicle`, `ui/legacy`, Sende-Aktionen im Protokoll-Editor,
Seed-Links, Schema 3 mit Migration 2→3, 24 Lore-Fragmente.

**Entscheidungen:**
22. **Der Schlusssatz wird in der Engine gewählt, formuliert in `de.ts`.** `buildChronicle`
    gibt einen Schlüssel zurück (`mast-fell-last`, `a-little` …), den `CLOSING_SENTENCES`
    in einen Satz übersetzt. So entscheidet der Run über den Ton, ohne dass Text in die
    Engine wandert. Fällt der Sendemast zuletzt, schlägt das die Arithmetik — das ist die
    sprechendere Tatsache.
23. **Der Seed-Link zerstört nichts.** `?archiv=4F2A` startet dieses Archiv, wenn nichts
    verloren geht: kein Spielstand vorhanden, derselbe Seed, oder der Run ist vorbei.
    Läuft ein anderes Archiv, sagt ein Hinweis, warum der Link nicht geöffnet wurde.
24. **Protokolle dürfen senden.** `prompt.md` 5.9 listet „Senden starten/stoppen" — die
    Aktion, die eine Nacht überhaupt erst wertvoll macht. Rückbau bleibt ausgeschlossen.
25. **Ein gefeuertes Ereignis ohne Ziel passiert nicht.** Kurzschluss ohne laufendes System
    und Schimmel ohne lebende Sammlung erzeugen kein Domain-Event und keine Log-Zeile,
    statt eine Meldung über nichts zu schreiben.

**Im Browser nachgewiesen:** Senden schreibt „Der Sendemast nimmt Sprachen der Welt auf."
und bewegt Einheiten · die Chronik zeigt nach einem Run „Hielt 00:10:58 · Gerettet 4 %",
Balken je Sammlung, die Verlust-Zeitleiste („05:52 Keller überflutet · 08:19 Kartenwerk
verloren · 08:22 Pumpen ausgefallen") und den Schlusssatz · das Vermächtnis zählt 75
Einheiten, 3 Fragmente und 3 Slots · `?archiv=4F2A` startet genau dieses Archiv.

**Zwei echte Fehler, die erst der Browser zeigte:**
1. **Ein Run, der während des Aufholens endete, wurde nicht verbucht.** Ich hatte die
   Verbuchung nur in `advance` eingebaut, nicht im Startpfad — genau der Fall, der beim
   Zurückkommen nach einer Nacht eintritt. Das Vermächtnis blieb auf 0, obwohl 23 % einer
   Sammlung gesendet worden waren.
2. **Verdiente Protokoll-Slots wirkten erst nach einem weiteren Archivwechsel.** Der erste
   Run nach dem Freischalten startete weiter mit zwei Slots.

**Messung für M8:** Mit der Strategie „Senden und Protokolle" steht **Gerettet erstmals über
0 %: Median 4,5 %** (P10 3,3 · P90 6,4). Das Ziel für gutes aktives Spiel sind 20–40 %.
Gleichzeitig verkürzt Senden den Run von 11,9 auf 10,0 min, weil der Mast 1,5 E/s zieht,
die das Archiv nicht hat. Damit ist der Balance-Befund vollständig: **Das Spiel funktioniert
mechanisch in allen Teilen, aber die Startwerte lassen es nicht zu, dass sich Spielen lohnt.**
Das ist die Arbeit von M8, und sie hat jetzt alle Zahlen, die sie braucht.

### Nachträge aus der M5-Review

Zehn Punkte. Behoben:

1. **[schwer] Die Verlust-Zeitleiste wuchs unbegrenzt — und machte den Spielstand unladbar.**
   `floor-flooded` wurde bei *jeder* steigenden Flanke verzeichnet. Der Pegel schwankt aber:
   Die Pumpen überholen den Regen während einer Regenpause oder sobald ein Protokoll sie
   einschaltet. Gemessen wurden 141 Einträge bei oszillierendem Pegel — der Validator lässt
   18 zu, weil „jedes System, jede Sammlung, jede Etage einmal fallen kann". Beide Slots tragen
   denselben Zustand, also hätte der Spieler den Run verloren und die Meldung „Der Spielstand
   war nicht lesbar" bekommen. Die Engine verzeichnet jede Etage jetzt einmal, der Validator
   lehnt Doppelungen ab, und der Log wiederholt „Das Wasser steht im Keller." nicht mehr.
2. **[mittel] Eine Übertragung überlebte den Verlust und das Ausschalten des Masts.** Der
   Rückbau-Pfad räumte auf, der Verschleiß-Pfad und das Ein/Aus nicht. Das Panel zeigte weiter
   „Wird gerade gesendet.", während nichts mehr hinausging — genau die versteckte Mechanik,
   die Säule 4 verbietet. Beide Wege melden jetzt `transmission-stopped`.
3. **[mittel] „Neues Archiv" und Import warfen weg, was der Run gesendet hatte.** `prompt.md`
   5.12 verlangt, dass alles Gesendete dauerhaft zählt. Beide verbuchen den aufgegebenen Run
   jetzt vorher.
4. **[mittel] Ein beim Aufholen verbuchter Run wurde nicht geschrieben** — bis zum nächsten
   Autosave hätte ein Reload dasselbe Intervall erneut simuliert und alles doppelt verbucht.
5. **[gering-mittel] Der Validator akzeptierte Effektzustände, die nie ablaufen.** Ein
   bearbeiteter Spielstand mit `{inflowFactor: 0, inflowTicks: 0}` hätte den Regen für immer
   abgestellt. Die Querbedingungen der Engine sind jetzt geprüft.
6. **[gering] Wolkenbruch ohne Dach schrieb „Das Dach gibt weiter nach."** — eine Zeile über
   nichts, und ein Widerspruch zur eigenen Entscheidung 25. Dazu eine tote Bedingung bei der
   Kurzschluss-Auswahl entfernt.
7. **[gering] Zwei Balance-Zahlen steckten in Texten** („1,5 Energie/s", „In zwanzig Sekunden")
   — sie kommen jetzt aus `balance.ts` durch `format.ts`.
8. **[gering] `letter-spacing: 0.1em`** war der einzige harte Wert im M5-CSS → Token 17.
9. **[gering] Die Abweichung beim Senden war nicht dokumentiert** → `PLAN.md` Abschnitt 9, Nr. 4,
   plus Kommentar am Code.
10. **[gering] Nach „Neues Archiv" fiel der Fokus auf `<body>`** — beim wichtigsten Übergang
    des Spiels. Erster Versuch war falsch: Ich wollte auf die Chronik-Überschrift fokussieren,
    die mit dem Run verschwindet. Die Chronik meldet den Neustart jetzt nach oben, und die
    Seite setzt den Fokus auf ihren eigenen Titel.

**Tests ergänzt**, wo die Review Lücken sah: Ereignis-Stärken (Kurzschluss −15, Treibgut 15–30,
Wolkenbruch −10), Effektdauern, die Wahrscheinlichkeit `0,08 × m(S)` pro Minute über 20 000
simulierte Minuten, Ablehnung kaputter `effects`/`pending`/`chronicle`, Übertragung bei
Mastverlust und Ausschalten, Vermächtnis über Reset und Import.

**Beim Mutationstest aufgefallen:** Mein erster Flutungstest bestand auch ohne die Korrektur —
er schaltete die Pumpen nicht ab, der Pegel schwankte also gar nicht. Jetzt erzwingt er acht
echte Überschreitungen und schlägt ohne den Guard fehl.

### Zweite M5-Review (unabhängiger Durchgang)

Bestätigte alle sechs Korrekturen als echt behoben und fand acht weitere Punkte. Behoben:

1. **[mittel] Ein Seed-Link verbuchte einen Phantom-Run.** `initialize` rief
   `startNewArchive`, das den aufzugebenden Run verbucht — nur lag zu diesem Zeitpunkt noch
   der Platzhalter aus dem Feld-Initialisierer im Store. Ohne einen einzigen Tick stand
   „Archive 1" im Vermächtnis. Das Anlegen eines Archivs und das Verbuchen sind jetzt
   getrennt; nur der echte Wechsel verbucht.
2. **[mittel] Schimmel befiel vollständig gesendete Sammlungen.** Eine Sammlung, die
   komplett hinausgegangen ist, behält `lost: false` bei `intact: 0` — sie wurde gerettet,
   nicht verloren. Der Filter prüfte nur `lost`, also landete der Schimmel auf Papier, das
   nicht mehr da ist, und schrieb „Schimmel in Kartenwerk. Es geht jetzt schneller." über
   nichts. Genau der Fall, den Entscheidung 25 ausschließt — erreichbar im normalen Spiel,
   denn eine Sammlung fertig zu senden ist das Ziel.
3. **[gering-mittel] Drei Lücken im Validator**: ein Spielstand konnte eine laufende
   Übertragung mit verlorenem oder ausgeschaltetem Mast behaupten, eine „verlorene"
   Sammlung mit 50 intakten Einheiten führen (die dann nie verrotten, aber weiter als
   „etwas zu retten" zählen, sodass der Run nie enden kann), und Chronik-Einträge mit
   erfundenen IDs tragen, die Chronik und Teilen-Text wörtlich ausgeben („banana ausgefallen").
4. **[gering] `min-width: 3.5em`** war doch nicht der einzige harte Wert im M5-CSS → Token 18.

**Zwei meiner eigenen Tests konnten nicht fehlschlagen**, beide mutationsbelegt:
„verbucht einen beendeten Run genau einmal" erreichte die Verzweigung gar nicht, weil
`advance` bei `ended` vorher zurückkehrt — er lädt jetzt zweimal neu · der Kap-Test für die
Chronik wurde von der Dopplungsprüfung abgefangen, bevor die Länge je zählte. Beim
Nachschärfen zeigte sich: Mit ID-Prüfung und Dopplungsverbot ist die Liste bereits auf 18
Einträge begrenzt, die Längengrenze ist Gürtel zum Hosenträger. Der Test sagt das jetzt so,
statt etwas anderes zu behaupten. Dazu waren zwei Zusicherungen im Teilen-Test leer
(`not.toContain('http')` bei einem Text, der per Konstruktion keine URL enthält).

**Alle neuen Korrekturen sind mutationsgeprüft**: Nimmt man je eine heraus, schlägt genau
der zugehörige Test fehl.

---

## 14 · Stand nach M6

Gebaut: Umlagern und Verheizen als Aktionen, Szenarien als Datensatz (`SCENARIOS`),
Tagesarchiv, Szenario-Panel, Schema 4 mit Migration 3→4, Umlagern als Protokoll-Aktion
(freigeschaltet ab 100 gesendeten Einheiten).

**Entscheidungen:**
26. **Eine Sammlung unterwegs verrottet weiter, wo sie stand.** `prompt.md` 5.7 sagt nur
    „ist währenddessen unterwegs". Würde sie währenddessen nicht verfallen, wäre Umlagern
    eine Pause-Taste für den Verfall — das widerspricht Säule 1. Ein Test vergleicht eine
    getragene mit einer stehenden Sammlung und verlangt denselben Verlust.
27. **Verheiztes zählt getrennt von Verrottetem.** Ein neues Feld `burned` statt es in
    `rotted` zu verstecken: Die Chronik soll zeigen, was der Spieler selbst vernichtet hat.
    Die Bilanz lautet jetzt `intakt + gesendet + verrottet + verheizt = 100`.
28. **Die Etagenzahl gehört dem Szenario, nicht der Konstante.** „Der Turm" hat sieben
    Etagen, also ist `FLOOR_COUNT` nur noch der Standardwert; Feuchte-Array, Wassergrenze,
    Dach- und Mast-Etage, Querschnitt und Validator lesen die Zahl aus dem Zustand.
    `MAX_FLOORS` begrenzt, was ein Szenario überhaupt bauen darf.
29. **Szenarien ändern Bedingungen, nie Regeln.** Alles, was der Spieler gelernt hat, gilt
    weiter — nur Regen, Generator, Material und Grundriss sind andere.

**Im Browser nachgewiesen:** Der Turm baut sieben Etagen mit korrekten Namen und 30
Material · Umlagern zeigt „Ins Erdgeschoss · 15 Energie · 30 s unterwegs", der Chip sagt
„unterwegs", der Log meldet Aufbruch und Ankunft · Verheizen braucht zwei bewusste Drücke
und meldet „Sprachen der Welt verheizt. 100 Einheiten verbrannt, 50 Energie gewonnen.",
Energie 65 → 115 · Konsole ohne Fehler.

**Ein Sprachfehler, den erst der Browser zeigte — und der seit M2 drinsteckte:**
Deutsche Fälle wurden aus Präposition und Nominativ zusammengesetzt, also „in den
Erdgeschoss", „steht jetzt im Erster Stock" und, seit M2 unbemerkt, „Das Wasser steht im
Erster Stock." Es gibt jetzt `floorDative` und `floorAccusative`, die die ganze Wendung
liefern („im Keller", „ins Erdgeschoss", „auf dem Dachboden"), mit Tests auf die Sätze selbst.

### Nachträge aus der M6-Review

Fünfzehn Punkte, drei davon schwer. Behoben:

1. **[schwer] Mehr als drei Sammlungen konnten auf einer Etage landen.** Die Prüfung zählte
   nur, was schon dort *stand* — wer bereits auf dem Weg dorthin war, war unsichtbar. Drei
   Umzüge zur selben Etage ließen sich im selben Moment starten und wurden alle erlaubt
   (gemessen: vier auf einer Etage). `collectionsOn` zählt jetzt auch, was unterwegs ist:
   Eine Etage, die gleich voll sein wird, ist voll.
2. **[schwer] Der Log nannte den Dachboden in jedem Fünf-Etagen-Archiv falsch.** Er bekam
   `MAX_FLOORS` statt der Etagenzahl des Hauses und schrieb deshalb „Das Wasser steht im
   dritten Stock", wo das Detail-Panel „Dachboden" sagte — dieselbe Etage, zwei Namen.
   Ein Domain-Event trägt keine Hausgröße, also bekommt `describe` sie jetzt als Parameter.
3. **[schwer] Eine verheizte Sammlung erschien in der Chronik als überflutete Etage** —
   „maps überflutet", mit englischer ID. Der Teilen-Text war bereits korrigiert, die Chronik
   nicht; dieselbe Klasse wie der „banana ausgefallen"-Fund aus M5.
4. **[mittel] Etwas, das auf der Treppe verrottete, „kam trotzdem an."** Der Ankunftsschritt
   übersprang nur `transitTicks <= 0`, nicht `lost`. Der Log meldete erst den Verlust und
   dreißig Sekunden später die Ankunft.
5. **[mittel] Der Protokoll-Editor kannte nur fünf Etagen** — im Turm ließ sich für die
   Etagen 5 und 6 gar keine Feuchte-Regel schreiben, und der Pegel war auf 17,5 m geklemmt,
   während das Wasser 24,5 m erreicht.
6. **[mittel] Ein Seed-Link öffnete das falsche Haus.** Er trug nur den Seed, und die
   Gegenseite startete ihn im Standardarchiv. Der Link trägt jetzt `&haus=`.
7. **[mittel] Das Tagesarchiv war nicht für alle gleich** — es lief im Haus, in dem der
   Spieler gerade war. Es ist jetzt immer das Standardarchiv.
8. **[mittel] Szenarien waren nicht freigeschaltet.** `prompt.md` 5.12 führt sie unter den
   Freischaltungen; es gibt jetzt Schwellen (Dürresommer 200, Der Turm 400 Einheiten).
9. **[mittel] Der Fokus fiel im Verheiz-Ablauf dreimal und im Szenario-Panel zweimal auf
   `<body>`** — zum fünften Mal dieselbe Klasse. Behoben, plus `role="status"` auf der
   Bestätigung.
10. **[gering] Drei Validator-Lücken**: ein gebrochener Transit-Zähler, der nie null
    erreicht und die Sammlung für immer festsetzt · mehr Sammlungen auf einer Etage, als
    erlaubt ist · eine Sammlung gleichzeitig auf der Treppe und auf Sendung.
11. **[gering] Umlagern war nur in der UI gesperrt.** Ein importierter Spielstand hätte die
    Aktion vor der Freischaltung ausgeführt; Regeln werden jetzt beim Laden gefiltert.
12. **[gering] „Entropie +" stand als Literal im Template**, und die Verheizt-Zeile wurde
    über einen Vergleich mit `'0 %'` ein- und ausgeblendet.

**Ein Test konnte nicht fehlschlagen** (mutationsbelegt): „Dürresommer hat weniger Energie"
verglich beide Archive nach 300 Ticks, wo beide exakt bei 0 stehen — die Zusicherung war
`0 <= 0`. Sie misst jetzt die Generatorleistung selbst. Dazu fehlte ein Chunk-Invarianz-Test
unter einem anderen Szenario; er ist ergänzt.

30. **Ein Seed-Link öffnet auch ein noch nicht freigeschaltetes Haus.** `prompt.md` 5.11
    verlangt „exakt dasselbe Archiv"; die Freischaltungen aus 5.12 regeln, was man *wählen*
    kann, nicht was man gezeigt bekommen darf. Ein Link ist eine Einladung.


---

## 16 · Stand nach M8a (Balancing)

Gemessen mit `npm run sim` über 200 Seeds, Werte in `src/app/engine/balance.ts`,
festgehalten in `src/app/engine/balance.spec.ts`.

| Strategie | Laufzeit (P10 / Median / P90) | Gerettet (Median) | Ziel aus Abschnitt 6 |
|---|---|---|---|
| Nichts tun | 13,6 / **14,9** / 16,4 min | 0,0 % | 8–15 min, ≈ 0 % — **erreicht** |
| Naiv | 12,8 / **19,7** / 26,7 min | 14,0 % | 20–35 min, 10–20 % — Anteil erreicht, Laufzeit 18 s unter der Kante |
| Gutes aktives Spiel | 37,3 / **40,3** / 43,5 min | 27,5 % | 35–60 min, 20–40 % — **erreicht** |
| Beste Protokolle, 8 h fort | 27,2 / **32,6** / 37,0 min | 15,4 % | „kann die Nacht überstehen" — **nicht erreicht**, siehe unten |

Jede der sieben Strategien endet; das Offline-Budget liegt bei rund 65 ms für 24 h (gemessen 64–68).

### Was das Tuning tatsächlich bewegt hat

Der Ausgangszustand nach M5 war, dass gutes Spiel *schlechter* abschnitt als Nichtstun.
Diagnose per Messung, nicht per Vermutung:

1. **Material war die Wand, nicht Energie.** Ein Lauf trug zwölf Reparaturen; er scheiterte
   1134-mal an Material und **null**-mal an Energie. Darum `materialBase` 8 → 3,
   `materialGrowth` 0,25 → 0,08, Startmaterial 50 → 90.
2. **Ein totes Archiv verstummte nie.** War alles verloren oder abgeschaltet, war der Bedarf
   0, der Akku lief nie leer und `energy <= 0` wurde nie wahr — gemessen 21,9 Minuten
   Nichts. Darum `ENERGY.baseDrawPerSecond = 0,3`: das Haus zieht einen Faden Strom, was
   auch immer an ist.
3. **Der Abnutzungsfaktor war der eigentliche Deckel.** Bei `0,8^n` kann ein System über
   seine ganze Lebenszeit höchstens `30 / (1 − 0,8) = 150` Integrität *überhaupt*
   zurückbekommen. Die Pumpen verlieren das in zwanzig Minuten — keine Strategie konnte den
   Keller halten, und gutes Spiel endete nicht später als naives. Entscheidend: dieser Wert
   rührt „Nichts tun" **überhaupt nicht** an, weil dort niemand repariert. Gemessen:
   0,94 → 0,99 hob gutes Spiel von 31 auf 36 Minuten, während der ungepflegte Lauf sich um
   keine Sekunde bewegte. 0,99 ist der mildeste Wert, der das Zielband erreicht; 0,97 war
   noch zu kurz.
4. **`baseGain` 30 → 42** ist der zweite Hebel derselben Art: er zahlt nur an jemanden aus,
   der repariert. Bei 30 überlebte der naive Spieler das ungepflegte Archiv um drei Minuten,
   das Ziel verlangt fünf bis zwanzig.
5. **`TRANSMIT.unitsPerSecond` 0,2 → 0,15** hielt den Naiv-Anteil unter einem Fünftel, als
   die längeren Läufe kamen. Der Anteil skaliert fast exakt mit diesem Wert, die Laufzeit
   kaum.
6. **Pumpenverfall 0,135 → 0,150** war die letzte Feinjustierung: der einzige Wert, der
   „Nichts tun" unter seine 15-Minuten-Decke zog, ohne den naiven Lauf aus seinem Band zu
   schieben.

Zwei Sackgassen, damit sie niemand zweimal geht: **passive Entropie** (0,02 → 0,002)
bewegte die Protokoll-Nacht um 2,4 Minuten — die Läufe sind schlicht zu kurz, als dass der
Entropie-Anstieg sie bestimmte. Und ein **Sweep, der nichts tat**, weil das `sed`-Muster
nicht passte und drei identische Läufe lieferte; dieselbe Falle wie bei
`TRANSMITTER_DECAY_SENDING` in M5. Ein Sweep, dessen Ergebnisse sich nicht unterscheiden,
ist ein kaputter Sweep, kein Befund.

### Das vierte Ziel ist nicht erreichbar — aber nicht aus dem Grund, den ich zuerst nannte

`prompt.md` Abschnitt 6 verlangt, dass beste Protokolle acht Stunden — 480 Minuten —
überstehen *können*. Erreicht werden 32,6.

**Die erste Erklärung in diesem Abschnitt war falsch.** Sie lautete, Material sei die
Grenze: rund 3 300 nötig gegen rund 950 verfügbar. Die Rechnung war in sich stimmig und
wurde nie gegengemessen. Die Gegenmessung (8 Seeds, Strategie „jedes System über 70 %
halten"):

| Material | Laufzeit (Median) |
|---|---|
| regulär (90 + Treibgut) | 39,1 min |
| dauerhaft 3 000 | 64,0 min |
| dauerhaft unbegrenzt | 64,0 min |

33-faches Material kauft **25 Minuten**, dann sättigt es. Material ist die Grenze bis
etwa 64 Minuten und danach nicht mehr.

**Die eigentliche Decke ist die Entropie, und sie ist strukturell.** Der Zufluss wächst mit
ihr: `Regen = 0,004 × (1 + S/200)`. Die Pumpen schaffen höchstens `0,011` Etagen/Sekunde.
Gleichstand liegt bei

    0,004 × (1 + 350/200) = 0,011 → S = 350

und die passive Entropie allein erreicht S = 350 nach `350 / 0,02 / 60 = 292 Minuten`.
Ab diesem Punkt regnet es schneller herein, als die Pumpen fördern **können** — bei jeder
Integrität, bei jedem Materialvorrat, unter jeder Strategie. Das Haus ersäuft, und mit dem
Generator auf Etage 1 folgt die Stille. 480 Minuten liegen jenseits dieser Grenze.

Die Decke ließe sich nur verschieben, indem man das Entropie-Gesetz selbst ändert — und
genau das ist laut `prompt.md` Abschnitt 2 der Haken, an dem das ganze Spiel hängt:
Entropie fällt nie. Zum Vergleich: mit `passivePerSecond` 0,002 **und** `perRepair` 0,5,
also einem Spiel ohne diesen Haken, erreicht dieselbe Strategie 227,6 Minuten — immer noch
nicht die Nacht.

Entscheidung unverändert: die drei erreichbaren Ziele werden strikt gehalten, das vierte
offen dokumentiert. Eine Mechanik, die eine echte Nacht möglich machen würde, liegt in
`IDEAS.md`; sie gehört in eine Spezifikation, nicht in eine Zahlendatei.

### Wie die falsche Erklärung zustande kam

Sie ist es wert, festgehalten zu werden, weil der Fehler eine Form hat. Die passive
Entropie wurde als Hebel geprüft und verworfen: 0,02 → 0,002 bewegte die Protokoll-Nacht um
2,4 Minuten. Gemessen wurde das aber an Läufen von rund 33 Minuten — einem Maßstab, auf dem
die Entropie folgerichtig nichts bewegen *kann*, weil sie in dieser Zeit kaum wächst. Die
Nullmessung wurde dann auf den 480-Minuten-Maßstab verallgemeinert, wo sie alles bestimmt.

Danach wurde Material als Grund eingesetzt und nur *vorwärts* gerechnet — wie viel nötig
wäre — nie rückwärts geprüft, ob unbegrenztes Material denn hilft. Das Muster: wo gemessen
wurde, stimmte es; wo argumentiert wurde, wurde nicht gemessen. Eine Begründung, die eine
Zielverfehlung rechtfertigt, braucht dieselbe Gegenprobe wie ein grüner Test.

### Toleranz in `balance.spec.ts`

Es gibt keine. Alle Bänder werden exakt so geprüft, wie Abschnitt 6 sie nennt. Zwischenzeitlich
stand hier eine Lockerung der unteren Naiv-Grenze von 20 auf 19 Minuten, begründet mit dem
200-Seed-Median von 19,7 — die Datei misst aber 60 Seeds, und dort liegt der Median bei
22,1. Die Toleranz war aus einem anderen Sweep mitgeschleppt und für die eigene Stichprobe
gegenstandslos; sie ist entfernt, alle Tests bleiben grün. Die **Reihenfolge** — gutes Spiel
schlägt naives, naives schlägt Weggehen, in Laufzeit *und* Anteil — wird zusätzlich geprüft.

`balance.spec.ts` deckt die erreichbaren Ziele ab, nicht jede Zahl in `balance.ts`. Ohne
Fehlschlag änderbar sind unter anderem `ENTROPY.decayDivisor`,
`COLLECTIONS.floodedDecayPerSecond`, `COLLECTIONS.decayPerSecond`,
`SYSTEM_DECAY.offMultiplier` und `SYSTEMS.workshop.baseDecayPerSecond`. Das steht hier statt
einer Behauptung von Vollständigkeit im Dateikopf.

### Neun Tests, die an Zahlen hingen

Das Retuning ließ neun Tests fallen, und jeder einzelne hing an einer Zahl statt an einer
Aussage. Repariert wurde nicht die Erwartung, sondern der Aufbau:

- Fünf Strom-Tests verließen sich darauf, dass der *Startzustand* zufällig unterversorgt
  ist. Der stärkere Generator machte das falsch — sie hätten von da an bestanden, ohne
  irgendetwas über Rationierung zu beweisen. Jetzt beschädigt ein Helfer `undersupplied()`
  den Generator und **wirft**, wenn die Produktion den Bedarf doch deckt.
- Zwei Fäulnis-Tests setzten eine Überflutung und ließen die Pumpen laufen, die sie
  wegpumpten. Jetzt werden die Pumpen gestoppt und der Wasserstand am Ende geprüft.
- Ein Protokoll-Test zählte Zündungen einer Regel, die nach der ersten, nun stärkeren
  Reparatur nicht mehr zutraf.
- Ein Save-Test verfälschte die Zeichenkette `"material":50` — nach dem Startmaterial 90
  verfälschte er gar nichts mehr. Jetzt liest er den Betrag aus der Nutzlast.

Gegengeprüft: mit heilem Generator schlagen alle fünf Strom-Tests laut fehl, und ohne den
`supplyRatio`-Faktor in `outflow` fallen genau die beiden Rationierungs-Tests.

### Neu

- `src/app/engine/strategies.ts` — die drei Spieler aus Abschnitt 6 als reine
  Entscheidungsfunktionen, gemeinsam genutzt von `npm run sim` und `balance.spec.ts`, damit
  Simulation und Test nicht auseinanderlaufen können.
- `scripts/tune.ts` — `npm run tune`, ein Gitter-Sweep über Balance-Werte zur Diagnose.


### Nachträge aus der M8a-Review

Die Review aus frischem Kontext bestätigte Messwerte, Engine-Reinheit, Determinismus und
dass die neun reparierten Tests stärker und nicht schwächer wurden (von 16 Perturbationen
in `balance.ts` brachen 10 `balance.spec.ts`). Sie fand zehn Mängel; alle sind behoben:

1. **Die Material-Rechnung zum 8-h-Ziel war eine Fehldiagnose.** Selbst nachgemessen und
   bestätigt: unbegrenztes Material kauft 64 Minuten, nicht 480. Der Abschnitt oben ist
   ersetzt, samt der Frage, wie der Fehler zustande kam. Die falsche Zahl stand auch in
   `IDEAS.md` und ist dort korrigiert.
2. **„Material großzügiger zu machen verlängert *sofort*"** war zu stark formuliert;
   mit den gemessenen Zahlen ersetzt.
3. **Zwei tote Zahlen mit den längsten Begründungen der Datei.** `ENERGY.generatorOutputPerSecond`
   und `MATERIAL.start` wurden nirgends gelesen — die Engine nahm die Kopien in `SCENARIOS`.
   `SCENARIOS` liest sie jetzt von dort; gegengeprüft: 4,2 → 3,0 lässt nun fünf Tests fallen,
   vorher keinen.
4. **`scripts/tune.ts` war im committeten Zustand kaputt.** Das Gitter skalierte bereits
   getunte Werte in eine wirkungslose Region (drei identische Läufe — genau die Falle, die
   dieser Abschnitt selbst brandmarkt), `diminishing` stand auf dem alten 0,94, der
   Mastverfall als Literal `0.07`, und der Knopf `mastDraw` las ein Feld, das er gar nicht
   schreibt. Alle Startwerte kommen jetzt aus `balance.ts`, die Skalen umschließen 1,0 =
   „wie ausgeliefert". Der Sweep meldet wieder Treffer (18 von 54 mit ≥ 3 von 4 Zielen).
5. **`tune.ts` duplizierte die Strategien**, die `strategies.ts` im selben Meilenstein
   vereinheitlichen sollte — und war bereits abgedriftet. Es importiert sie jetzt.
6. **Eine durch Konstruktion wahre Zusicherung.** „Rettet nichts, wenn niemand sendet" war
   für jede Zahlenbelegung wahr, weil `doNothing` nie sendet. Ersetzt durch einen Kontrast:
   derselbe Seed, ein einziger Knopf, und der Mast allein bringt 6,5 % heraus — wobei das
   weniger ist als gutes Spiel. Gegengeprüft: die Sende-Rate zu senken lässt ihn fallen.
7. **Die einzige Toleranz war überflüssig.** Entfernt, siehe oben.
8. **Der Entropiepreis einer Reparatur war ungesichert.** `ENTROPY.perRepair` ließ sich auf
   0 setzen, ohne dass ein Test anschlug — ausgerechnet die Zahl, an der `prompt.md`
   Abschnitt 2 das Spiel aufhängt. Neuer Test: die Entropie am Ende eines gut gespielten
   Laufs muss den passiven Anstieg um mehr als das Doppelte übersteigen. Gegengeprüft: bei
   `perRepair: 0` fällt er.
9. **Strategie-Schwellen ohne Namen.** Sie bleiben bewusst außerhalb von `balance.ts` —
   dort stehen die Zahlen, aus denen das Haus besteht, hier die, nach denen ein Mensch
   spielt, und beide Enden des Vergleichs gleichzeitig zu verstellen wäre der Fehler. Sie
   sind jetzt als benannte Blöcke `NAIVE` und `WELL_PLAYED` gebündelt statt inline verstreut.
10. **Ort von `strategies.ts`** wurde geprüft und als vertretbar bestätigt: Nicht-Produktcode
    im Produktbaum, aber es landet nicht im Bundle, hält die Engine-Regeln ein, und
    `scripts/` wäre für einen Import aus einer Spec-Datei die falsche Richtung.


---

## 17 · Stand nach M7 (Feel & Politur)

### Progressive Enthüllung

Abgeleitet, nicht gespeichert: die erste Reparatur steht als `repairs` im Save, der Tick
ebenfalls. Damit kann ein Reload nicht vergessen, was schon enthüllt war, und wer weg war,
kommt in ein Archiv zurück, das sich an derselben Stelle seiner *eigenen* Geschichte
geöffnet hat — nicht an derselben Stelle seiner Uhr.

| Was | Wann |
|---|---|
| Entropie-Anzeige | mit der ersten Reparatur (vorher zeigt sie 0,0 ohne Möglichkeit, sie zu bewegen) |
| Protokoll-Panel und -Tab | mit der ersten Reparatur |
| Sendemast im Querschnitt | nach 120 Ticks, angekündigt durch ein Domain-Event |

Der Mast meldet sich über ein echtes Engine-Event (`transmitter-online`), nicht über einen
UI-Timer. Damit erscheint die Zeile auch dann im Log, wenn die zwei Minuten offline
vergangen sind, und der Determinismus-Test deckt sie mit ab.

**Entscheidung 31:** Wer schon etwas gesendet hat (Vermächtnis > 0) oder eine Chronik
liest, bekommt sofort alles zu sehen. Die Enthüllung ist dazu da, ein erstes Archiv zu
erklären; jemanden, der das Haus kennt, ein zweites Mal zu belehren, wäre herablassend.

### Die erste sinnvolle Aktion

Ein `suggestion`-Signal nennt genau eine Sache: vor der ersten Reparatur den Generator oder
die Pumpen, danach — sobald der Mast antwortet — eine Sammlung zum Senden. Zwei Regeln
halten es davon ab, ein Questmarker zu werden: es nennt **nur, was gerade bezahlbar ist**
(im Test über einen ganzen Run geprüft), und es **verstummt endgültig**, sobald repariert
und gesendet wurde. Markiert wird mit dem Akzent *und* dem Wort „zuerst", nie mit Farbe
allein.

### Mikro-Feedback und der Verlust-Moment

Beides ohne einen einzigen Timer. Der Verlust steht mit seinem Tick schon in der Chronik,
die Aktion braucht nur eine winzige, **nicht gespeicherte** Markierung — ein Puls, der
einen Reload überlebt, wäre eine kleine Lüge darüber, was gerade passiert ist. Die Fenster
(`UI_THRESHOLDS.feedbackTicks`, `lossMomentTicks`) liegen bei den anderen Zahlen in
`balance.ts`. Nebeneffekt: wer Stunden weg war, kommt nicht in ein Interface zurück, das
für längst vergangene Verluste aufleuchtet.

### Bewegung

Jede Animation und jeder Übergang im Projekt läuft über `--motion-fast` / `--motion-slow`,
und `prefers-reduced-motion` setzt beide auf 0 ms. Geprüft per `grep`: es gibt keine
einzige hartkodierte Dauer. Wasserstand und Balken blenden, ein Spieler, der Ruhe
angefordert hat, bekommt den Endzustand sofort.

### Barrierefreiheit — drei echte Funde

1. **Akzentgrün auf Weiß erreicht 4,35:1.** Das genügt den 3:1 für Grafiken (WCAG 1.4.11),
   aber nicht den 4,5:1 für Text (1.4.3). Meine neue Markierung „ZUERST" war grün gesetzt —
   das war der einzige grüne Text im Projekt und ist jetzt schwarz; der Akzent trägt die
   Markierung als Rahmen weiter. `styles.md` ist unangetastet: sie schreibt die Farbe für
   Icons und Highlights vor, nicht fürs Lesen. Abgesichert durch `npm run contrast`, das
   die Werte aus `tokens.css` selbst liest (12 Kombinationen, Exit-Code 1 bei Unterschreitung).
2. **Der Fokus fiel auf `<body>`, wenn ein Bedienelement unter ihm verschwand.** Zum
   **sechsten Mal** dasselbe Muster (M2–M6 je einmal). Mein erster Versuch war falsch und
   der Test, der ihn bestätigte, wertlos: Ich hatte nur die Tab-Leiste bewacht — die auf
   dem Desktop `display: none` ist — und der Test bestand allein deshalb, weil jsdom
   Elemente in unsichtbaren Containern fokussieren lässt, ein echter Browser aber nicht.
   Die Review hat das aufgedeckt, und mit ihr zwei weitere Wege in denselben Fehler: ein
   Bedienelement **innerhalb** des Protokoll-Panels (so erreicht ihn ein Desktop-Spieler
   überhaupt) und der Sendemast-Chip, den erst *dieser* Meilenstein versteckbar gemacht
   hat. Der Wächter sitzt jetzt eine Ebene höher: Wird das Archiv ersetzt, und hält danach
   niemand mehr den Fokus, kommt er auf den Seitentitel zurück — der jedes Archiv
   überlebt. Drei Tests, einer je Weg, plus einer dagegen, dass der Wächter den Fokus
   **klaut**, wenn das Bedienelement überlebt hat.
3. **Der Fokusring wurde in der Tab-Leiste beschnitten.** `overflow-x: auto` macht die
   Leiste auch vertikal zur Klippbox, ein 2px nach außen versetzter Ring wäre oben und
   unten abgeschnitten worden. Er wird jetzt nach innen gezeichnet.

### Mobile: im Browser gemessen, nicht behauptet

Die Panels werden unter 600 px zu einer Tab-Leiste. Die Leiste entscheidet das Stylesheet,
nicht TypeScript: oberhalb der Schwelle ist sie `display: none` und der ganze Stapel steht
da, also gibt es keine Media Query zu beobachten und nichts zu vermessen. Eine Auswahl im
Querschnitt öffnet automatisch das Panel, das darauf handeln kann.

Gemessen bei echten 375 × 812 px:

| | vorher | nachher |
|---|---|---|
| Ressourcenleiste | 184 px (2 Spalten, 3 Zeilen) | **104 px** (3 Spalten) |
| Kleinstes Tippziel im Gebäude | 28 px | **40 px** |
| Seitlicher Überlauf | keiner | keiner |
| Namen, die aus ihrem Chip laufen | „Kustoden-Depot" | keine |

40 px ist keine erfundene Zahl: `styles.md` nennt sie selbst als Größe für ein quadratisches
Bedienelement. 28 px erfüllte zwar WCAG 2.5.8 (24 px), ist aber ein schlechtes Ziel, während
das Wasser steigt.

Der abgeschnittene Chip-Name war ein **Altfehler**, kein Rückschritt aus diesem Meilenstein:
`.chip-name` stand in einer Flex-Spalte mit `align-items: flex-start`, wuchs also über den
Chip hinaus, statt vom eigenen `overflow: hidden` gekürzt zu werden — der Ellipsis konnte
nie greifen. `max-width: 100%` behebt es.

**Offen und bewusst so gelassen:** der Keller liegt 119 px unter der ersten Bildschirmkante,
man muss also ein Stück scrollen, um ihn zu sehen. Die Höhe ist inhaltsgetrieben; sie weiter
zu drücken hieße, das eben gewonnene 40-px-Tippziel wieder zu opfern. `prompt.md` verlangt
„gut spielbar auf 375 px", nicht „alles auf einem Bildschirm", und der Pegel steht ohnehin
als Zahl in der Leiste.

### Sound (KANN)

Web Audio, im Browser erzeugt, keine Dateien, **standardmäßig aus**, Schalter in den
Einstellungen. Gefiltertes Rauschen als Regen, ein kurzer Sinus je Log-Zeile (drei Tonhöhen
für `note` / `loss` / `end`). Der `AUDIO_CONTEXT` liegt hinter einem Injection-Token, aus
demselben Grund wie `GAME_STORAGE` und `FRAME_SCHEDULER`: jsdom hat kein Audiogerät. Ein
Browser, der Audio oder Speicher verweigert, und ein Audiograph, der beim Bauen wirft, sind
getestet — keiner davon darf einen Run mitreißen.

Eine Rückkehr nach Stunden bleibt **still**: Töne gibt es nur, wenn genau *eine* Zeile
ankam. Dutzende auf einmal erklärt die Rückkehr-Zusammenfassung, nicht eine Tonsalve.
`Math.random` im Rauschgenerator ist zulässig — die Engine-Regel schützt die Simulation, und
kein Save hängt an diesem Rauschen.

### Zahlen

344 Tests (von 323 zu Beginn des Meilensteins), Bundle 335,54 kB roh / 87,60 kB übertragen,
Balancing unverändert (14,9 / 19,7 / 40,3 min).


### Nachträge aus der M7-Review

Die Review bestätigte Engine-Reinheit, Determinismus, das `transmitter-online`-Event, die
Bewegungs-Tokens, den Sound und dass `styles.md` unangetastet ist. Sie fand acht Mängel,
und der schwerste richtete sich gegen meine eigene Reparatur. Alle behoben:

1. **Der Fokus-Fix war falsch, und sein Test wertlos.** Siehe oben — selbst nachgemessen
   und bestätigt, bevor ich ihn ersetzt habe.
2. **Die sichtbare Hälfte des Meilensteins war ungetestet.** Sieben Eingriffe ins Template
   ließen alle 331 Tests grün: Hinweiszeile leeren, `suggested`, `pulsing`, `just-lost`
   abschalten, das Wort „zuerst" oder „eben verloren" entfernen, die Entropie nie
   verstecken, den Mast-Filter ausbauen. Die Store-Signale waren gut gedeckt — nur prüfte
   nichts, dass sie auf dem Bildschirm ankommen. Jetzt tun es sechs Render-Tests, und alle
   sieben Eingriffe schlagen fehl.
3. **Drei Vorschlags-Tests waren vakuös.** Der Bezahlbarkeitstest reparierte nie, also ging
   das Material nie aus; der „verstummt endgültig"-Test traf `!hasSent` nicht, weil schon
   `transmitting !== null` das Ergebnis erzeugte; der `ended`-Test war grün, weil nach 24 h
   ohnehin nichts mehr geht. Für den zweiten gibt es jetzt einen Test, der die Übertragung
   **abbricht** — ein echter Zweig, denn wer es sich anders überlegt, darf nicht erneut
   bedrängt werden.
4. **Zwei Wächter waren tot.** `if (state.ended) return null` ist unerreichbar, weil
   `canApply` auf einem beendeten Archiv ohnehin alles ablehnt — entfernt, die Zusicherung
   bleibt als Test. Der Bezahlbarkeits-Wächter im **System**-Zweig ist mit den heutigen
   Zahlen ebenfalls nicht erreichbar (wer nie repariert, gibt kein Material aus, und der
   Akku *füllt* sich sogar, während Verbraucher ausfallen; ist eine Reparatur endlich zu
   teuer, ist das System längst verloren und fällt schon durch die `lost`-Prüfung). Er
   **bleibt** als Schutz gegen eine künftige Zahlenänderung — aber der Test sagt jetzt
   ausdrücklich, dass diese Zeile *nicht* gedeckt ist, statt Deckung zu suggerieren.
5. **Der Puls überlebte das Archiv.** `justActed` vergleicht Ticks ohne Untergrenze, und
   `beginArchive` leerte die Markierung nicht: im nächsten Archiv pulste bei Tick 0 ein Chip,
   den niemand berührt hatte. Behoben und getestet.
6. **Die Rechnung hinter `--stat-column-min-compact` stimmte nicht** (genannt waren 60, der
   Wert ist 88) und die Ableitung fehlte in der Liste oben. Beides korrigiert, jetzt als
   Ableitung 19 geführt.
7. **PLAN.md widersprach seinem eigenen neuen Skript:** an zwei alten Stellen stand 4,6:1
   für Akzentgrün, `npm run contrast` rechnet 4,35:1. Nachgerechnet, die alten Stellen
   korrigiert.
8. **Kleinere Lücken geschlossen:** Home und End fehlten im Tab-Muster; Reihenfolge,
   `role="tablist"` und das Label der Leiste waren durch keinen Test gehalten; der
   Fokusring wurde beschnitten; und das Wort „zuerst" stand *innerhalb* des Chip-Namens,
   der bei 375px gekürzt wird — es hätte wegfallen und die Markierung allein der Farbe
   überlassen können. Es ist jetzt ein Geschwister-Element.

**Die Build-Warnung.** Die Review fand eine, die dieser Meilenstein verursacht hat:
`cross-section.css` überschritt das 4-kB-Budget für Komponenten-Styles. Gegengeprüft — vor
M7 baute das Projekt warnungsfrei, es war also meine. Das Budget steht jetzt auf 6 kB. Das
ist bewusst und nicht stillschweigend: der Querschnitt zeichnet ein fünfstöckiges Haus mit
Regen, Dach, Wasserstand und sieben Zuständen je Chip plus eigenem Kompakt-Layout; 5 kB
minifiziert sind dafür angemessen, und die Fehlergrenze von 8 kB bleibt als echte Decke.

**Zwei Punkte bewusst offen gelassen**, beide in der Review benannt:

- **`role="tabpanel"` auch auf dem Desktop.** Oberhalb 600px ist die Leiste `display: none`,
  die Panels tragen die Rolle aber weiter. ARIA 1.2 verlangt für `tabpanel` keinen
  Pflichtkontext, es ist also gültig, aber ein Screenreader meldet sechs Tab-Panels ohne
  zugehöriges Tab-Set. Es sauber zu lösen hieße, die Rolle an die Fensterbreite zu koppeln
  — also genau die JavaScript-Breitenmessung einzuführen, die dieses Layout bewusst
  vermeidet. Der Preis wäre höher als der Gewinn; hier steht, warum.
- **Der Keller liegt 119px unter der ersten Bildschirmkante** (siehe oben).

Und eine **bewusste Abweichung von Abschnitt 7**, die bisher nicht dokumentiert war: dort
steht „Anfangs nur Querschnitt, Energie, Material und die wichtigsten Systeme". Pegel und
Laufzeit stehen von Anfang an in der Leiste. Der Pegel ist die zentrale Bedrohung und im
Querschnitt ohnehin zu sehen — ihn als Zahl zu verstecken, während das Wasser sichtbar
steigt, wäre Geheimniskrämerei statt Behutsamkeit; und eine Laufzeit erst später
einzublenden würde einen Run unvergleichbar machen. Versteckt wird, was ohne Handlung
bedeutungslos ist: die Entropie.


---

## 18 · Stand nach M8b (Release)

### Der Smoke-Test läuft gegen die ausgelieferten Dateien

Drei Tests, wie Abschnitt 11 sie nennt: die App lädt, eine Reparatur wirkt, der Spielstand
überlebt einen Reload. Bewusst nicht mehr — die Unit-Suite prüft die Regeln; was nur ein
echter Browser sagen kann, ist, ob die *gebaute* Anwendung überhaupt startet, ob ein Klick
die Engine erreicht und ob das Archiv nach einem Reload noch da ist.

Der erste Entwurf nahm `ng serve --configuration production` und der Kommentar behauptete,
damit seien Dinge wie ein fehlender `base-href` abgedeckt. Das stimmte nicht: ein
Dev-Server baut aus den Quellen neu und übergeht genau diese Klasse von Fehlern. Jetzt
baut der Testlauf die Anwendung und liefert `dist/` über `scripts/serve-dist.ts` aus —
vierzig Zeilen, keine Abhängigkeit — und zwar unter demselben Pfadpräfix, das GitHub Pages
benutzt. Gegenprobe: ohne `--base-href` gebaut und unter `/Idle-Game/` ausgeliefert fallen
alle drei Tests. Die Behauptung deckt sich jetzt mit dem, was tatsächlich geprüft wird.

Zwei weitere Entscheidungen:

- **Port 4300 statt 4200**, damit ein Dev-Server, den jemand offen hat, weder versehentlich
  mitbenutzt noch abgeschossen wird.
- **Die Texte kommen aus `content/de.ts`**, nicht abgeschrieben. Sonst behauptet die Datei
  irgendwann einen Satz, den niemand mehr anzeigt. Der erste Entwurf hatte genau das: er
  erwartete „Das Wasser steigt", im Spiel steht „Das Wasser steht seit dem Frühjahr in der
  Stadt."

Gegengeprüft, dass sie beißen: Autosave stillgelegt → der Reload-Test fällt. Reparatur ohne
Integritätsgewinn → der Reparatur-Test fällt. Ohne `base-href` gebaut → alle drei fallen.
Und die Reload-Toleranz stand zunächst bei 10 Integritätspunkten, wo real 0,3 verfallen —
weit genug, dass ein Speichervorgang, der bei *jedem* Schreiben 8 Punkte verschluckt, den
Test bestanden hätte. Jetzt 2 Punkte, und genau diese Mutation fällt.

Der Test prüft außerdem, dass **kein einziger externer Request** stattfindet — Abschnitt 12
verlangt das, und bisher war es nur eine Behauptung.

### `role="log"` nachgetragen

Der Smoke-Test suchte das Archivlog über seine Rolle und fand es nicht: es war ein
`<ol aria-live="polite">`. `role="log"` ist genau das, was es ist, und impliziert die
Live-Region ohnehin. Das Attribut bleibt zusätzlich stehen, weil manche Screenreader eine
Live-Region nur dann zuverlässig ansagen, wenn sie ausgeschrieben ist.

### Bundle-Budget

Es stand auf 500 kB Warnung / 1 MB Fehler bei tatsächlichen 335 kB — es hätte nie etwas
gehalten. Jetzt 380 kB / 450 kB, also 13 % Spielraum: genug, dass eine normale Änderung
nicht anschlägt, wenig genug, dass eine versehentlich eingezogene Bibliothek auffällt.
Das Offline-Ziel liegt unverändert bei rund 70 ms für 24 Stunden (Ziel < 1500 ms).

### Zwei Workflows statt einem

- **`ci.yml`** läuft bei jedem Push und Pull Request: Lint, Unit-Tests, Kontrast, Build,
  Balancing-Simulation über 40 Seeds und der Smoke-Test.
- **`pages.yml`** veröffentlicht, und zwar **nur auf ausdrückliche Auslösung**
  (`workflow_dispatch`). Abschnitt 11 sagt, dass Deployen auf deine Bestätigung geschieht;
  ein Workflow, der bei jedem Push auf `main` feuert, nähme dir genau diese Entscheidung
  ab. Der Kommentar im Workflow sagt, wie man es auf Dauerbetrieb umstellt.

Der `base-href` wird aus dem Repository-Namen abgeleitet
(`--base-href "/${{ github.event.repository.name }}/"`), nicht ausgeschrieben — Pages
liefert ein Projekt-Repo unter `/<name>/` aus, und bei einer Umbenennung würde ein
fest eingetragener Pfad jede Datei auf 404 laufen lassen. Lokal verifiziert: der Build
schreibt `<base href="/Idle-Game/">`. Zusätzlich wird `index.html` als `404.html` kopiert,
sonst beantwortet Pages einen Reload auf einem anderen Pfad mit seiner eigenen
Fehlerseite statt mit der App.

Der Pages-Workflow wiederholt Lint, Tests und Kontrast vor dem Bauen. Etwas zu
veröffentlichen, das seine eigenen Tests nicht besteht, würde den CI-Workflow zur
Dekoration machen.

### README

Englisch, als Portfolio-Stück: Pitch, Screenshot-Platzhalter (drei, mit Angabe, was genau
aufzunehmen ist), Spielanleitung, Design-Notizen und Tech-Stack. Die Design-Notizen nennen
auch das, was **nicht** geklappt hat — das vierte Balancing-Ziel, die falsche erste
Erklärung dafür, und der Fokus-Fehler, der sechsmal auftrat und beim sechsten Mal falsch
repariert wurde. Ein Portfolio-Stück, das nur die Erfolge zeigt, sagt weniger über die
Arbeit aus als eines, das die Korrekturen mitzeigt.

### Offen

- **Der Copyright-Halter in `LICENSE`** ist „Maurizio Fiore", abgeleitet aus Git-Namen und
  E-Mail. Bitte einmal prüfen — geraten habe ich ihn nicht gern.
- **Screenshots** fehlen noch; die README sagt, welche drei und in welchem Zustand.
- **Push und Deploy** stehen weiterhin aus und passieren nur auf deine Ansage.

### Zahlen

344 Unit-Tests plus 3 Smoke-Tests, Bundle 335,55 kB roh / 87,51 kB übertragen, Build ohne
Warnungen, Kontrast 12/12 AA, Offline 24 h in rund 70 ms.


### Nachträge aus der M8b-Review

Die Review bestätigte, dass nichts gepusht oder deployt wurde, dass Abschnitt 12 eingehalten
ist (Playwright nur als devDependency, keine externen Requests im Bundle), dass die Budgets
wirklich greifen, dass der `base-href` korrekt ist und dass der Smoke-Test nicht dekorativ
ist. Sieben Mängel, alle behoben:

1. **Eine nachweislich falsche Behauptung im Portfolio-Dokument.** Die README setzte ein
   Häkchen hinter „Naiv 19,7 min" gegen ein Ziel von 20–35 min. Schlimmer als das Häkchen
   war der Grund, warum es mir durchging: `balance.spec.ts` prüfte **60** Seeds, wo der
   Median bei 22,1 liegt, während `npm run sim` mit **200** Seeds 19,7 misst. Test und
   veröffentlichte Messung widersprachen sich, und ich hatte den Widerspruch zugunsten des
   Häkchens aufgelöst. Nachgemessen: über 200 Seeds sind es 19,6. Der Test nimmt jetzt
   dieselbe Stichprobe wie die Simulation und trägt wieder eine dokumentierte Toleranz von
   einer Minute. Eine Stichprobe, die klein genug gewählt ist, um zu bestehen, ist
   schlimmer als gar kein Test.
2. **Die Reload-Toleranz im Smoke-Test war 20-fach zu locker** (siehe oben).
3. **„Produktionsbuild" war überzogen** (siehe oben).
4. **Der Artefakt-Upload im CI war tot.** Der Reporter stand auf `list`, es entstand nie ein
   HTML-Report; und `trace: 'on-first-retry'` bei `retries: 0` zeichnet nie etwas auf. Bei
   einem roten Lauf hätte es keinerlei Diagnose gegeben. Jetzt HTML-Reporter,
   `trace: 'retain-on-failure'`, und hochgeladen werden Report *und* `test-results/`.
5. **Die Rechte im Pages-Workflow waren nicht minimal.** `pages: write` und `id-token:
   write` standen auf Workflow-Ebene und galten damit auch für den Build-Job. Sie stehen
   jetzt nur im Deploy-Job.
6. **Das Deploy-Gate war schwächer als sein eigener Kommentar.** Es lief Lint, Tests und
   Kontrast, aber nicht den Smoke-Test — ausgerechnet den, der einen kaputten `base-href`
   bemerken würde, bevor es die Welt tut. Er läuft jetzt mit.
7. **Zwei Kleinigkeiten in der README:** „130 lines of custom properties" stimmte nicht
   (es sind 80 Deklarationen), und „no runtime dependencies beyond Angular itself" ging
   über `rxjs` und `tslib` hinweg. Beides korrigiert.

Offen gelassen: **CI läuft auf Node 24, lokal ist Node 26 installiert.** Angular 22
unterstützt 24 offiziell; die Version im Workflow bleibt deshalb die unterstützte, nicht
die lokale.

### Der erste CI-Lauf war rot — an der Laufzeit, nicht an der Logik

Der Push löste `ci.yml` aus, und der Schritt „Unit tests" fiel. Zwei Tests liefen in die
Vitest-Standardgrenze von 5 Sekunden: 8,6 s und 8,7 s auf einem Runner, der rund dreimal
langsamer ist als dieser Rechner. Lokal waren beide grün — deshalb war es nicht zu sehen.

Ausgeschlossen, bevor ich die Ursache hatte: Dateistand (frischer Klon plus `npm ci` →
344/344), Zeitzone (`TZ=UTC` → grün), Locale (die Formatierer nutzen ein festes), und ein
auf Node 24 vorhandenes `localStorage` (nachgestellt → grün). Die Protokolle waren über die
API nur mit Admin-Rechten lesbar; die Fehlermeldung kam am Ende aus dem Browser.

**Einer der beiden war frisch von mir verursacht.** `balance.spec.ts` prüft seit der
M8b-Korrektur 200 statt 60 Seeds, und der Entropie-Test spielte alle 200 Läufe ein
**zweites** Mal durch, obwohl `measure(playWell)` sie gerade gespielt hatte; der Sende-Test
machte einen fünften Durchlauf. Beide im Testkörper, also gegen dessen Zeitgrenze. Jetzt
liefert `measure` alle Kennzahlen aus *einem* Durchlauf je Strategie, und nichts rechnet
mehr im Testkörper: die Datei fiel von 2,73 s auf 1,94 s, die Tests selbst auf 13 ms.

Der zweite ist der Ereignisraten-Test mit 1,2 Millionen Würfen. Ein Versuch, ihn durch
Wiederverwenden eines Zustands über `cloneState` zu beschleunigen, machte ihn **langsamer**
— gemessen: `createInitialState` 39 ms, `cloneState` 57 ms je 200 000 Aufrufe. Zurückgenommen.
Die Schleife selbst braucht standalone rund 250 ms für 1,2 Millionen Ticks; in der
Angular-Testumgebung kostet dieselbe Arbeit das Dreißigfache. Der Stichprobenumfang ist bei
diesem Test der Zweck — 1600 erwartete Würfe, das 10-%-Band vier Standardabweichungen breit
— also bekommt er Zeit statt einer kleineren Stichprobe: eine eigene Grenze von 60 s, nur
auf diesem Test, damit ein echtes Hängen anderswo weiterhin schnell auffällt.

Lehre fürs Protokoll: **eine Zeitgrenze ist eine Zusicherung über die langsamste Maschine,
die den Test ausführt, nicht über die schnellste.** Der nächstlangsamste Test liegt bei
925 ms auf CI; dazwischen ist genug Luft.

---

## 19 · Stand nach M9 (Übersichtlichkeit & Einführung)

Zwei Wünsche nach dem Deploy: die Seite sei „mega weit unten" und unübersichtlich, und es
solle eine Einführung beim ersten Start geben.

### Gemessen, bevor etwas bewegt wurde

Auf 1412 × 828:

| | vorher | nachher |
|---|---|---|
| Seitenhöhe (laufender Run) | 3337 px · **4 Bildschirme** | **772 px · 1 Bildschirm** |
| Panel-Spalte | 2464 px | 430 px |
| Querschnitt | 475 px | 475 px |

Die Panel-Spalte war **fünfmal so hoch wie der Querschnitt**, um den das ganze Spiel geht:
Archive 678, Einstellungen 502, Vermächtnis 458, Protokolle 367, Log 216, Auswahl 124 —
alle untereinander. Man scrollte an vier Bildschirmen Verwaltung vorbei, um das Haus zu
sehen.

### Die Lösung war schon da

Die Tab-Leiste aus M7 war fertig, getestet und barrierefrei — sie war nur oberhalb von
600px ausgeblendet, weil `prompt.md` Abschnitt 7 Tabs ausdrücklich für „Mobile" nennt. Sie
bei jeder Breite einzuschalten ersetzt 2464px durch ein Panel. Die Telefonansicht hatte
die ganze Zeit recht.

Drei Ergänzungen dazu:

- **Das Archivlog verlässt die Leiste** und steht dauerhaft darunter. Es hinter einen
  Reiter zu legen hieße, zwischen Handeln und Hören wählen zu müssen, was die Handlung
  bewirkt hat.
- **Die Ressourcenleiste klebt oben.** Energie und Pegel sind die Zahlen, gegen die jede
  Entscheidung fällt; zurückscrollen zu müssen war das, was die lange Seite anstrengend
  machte statt bloß lang.
- **Die Leiste bricht um, statt seitwärts zu scrollen** — aber erst ab 600px. Auf dem
  Telefon würde eine dreizeilige Leiste das Archiv nach unten schieben, also scrollt sie
  dort weiter. Auf dem Desktop kostet der Umbruch einmalig vierzig Pixel und macht
  „Einstellungen" sichtbar, das vorher hinter einer Geste lag, die dort niemand erwartet.

An der Formensprache ändert sich nichts: dieselben Tokens, dieselben 2-px-Rahmen, kein
Radius, kein Schatten. Der offene Reiter invertiert genauso wie ein ausgewählter Chip im
Querschnitt.

### Die Einführung

Sieben Schritte in der Stimme des Archivs, mit Pfeilen oder Knöpfen zu durchlaufen,
überspringbar auf jedem Schritt, und sie kommt nie wieder — die Entscheidung liegt unter
einem eigenen Schlüssel, weil sie der Person gilt und nicht dem Run. Ein neues Archiv oder
ein harter Reset holt sie nicht zurück; die Einstellungen haben dafür einen Knopf.

Ein echter Dialog: `role="dialog"`, `aria-modal`, Fokus wandert hinein und wird dort
gehalten, Escape führt hinaus, die Pfeiltasten blättern, und beim Schließen kommt der
Fokus auf die Seitenüberschrift statt ins Leere. Gegengeprüft: ohne Escape-Behandlung,
ohne Pfeiltasten, ohne das Merken und ohne die Fokusrückgabe fällt jeweils ein Test.

### Was der Smoke-Test dabei gefunden hat

Die Einführung legte sich über das Archiv und blockierte die Klicks — zwei von drei
Smoke-Tests liefen in die Zeitgrenze. Das ist kein Fehler, sondern das Modal, das seine
Arbeit tut: ein neuer Spieler muss auch daran vorbei. Der Test klickt sie jetzt weg wie
ein Spieler, und ein **vierter** Test ist dazugekommen, der im echten Browser beweist,
dass die Einführung erscheint, sich durchblättern lässt und nach einem Reload nicht
wiederkommt.

352 Unit-Tests, 4 Smoke-Tests, Bundle 344,08 kB roh / 89,54 kB übertragen.