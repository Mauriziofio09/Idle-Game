# PLAN.md — ENTROPIE · Das letzte Archiv

Arbeitsplan zu `prompt.md`. Visuelle Quelle: `styles.md` (schreibgeschützt).
Status: **M0–M5 fertig · wartet auf Feedback vor M6.**

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
   der einzige Akzent. Kontrast gegen Weiß: 4.6:1 (AA für UI-Komponenten erfüllt).
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
`--checkbox-size` = `--space-4` für das Kästchen.

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
· `#0A8C3A` auf Weiß = 4.6:1 ✅ (AA für Grafik/UI) — Grün wird **nicht** für Fließtext benutzt.

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
- [ ] Umlagern (30 s unterwegs, max. 3 pro Etage)
- [ ] Verheizen (zweistufige Bestätigung, eigener Log-Eintrag, inszeniert)
- [x] Materialreserve für Protokolle
- [ ] Szenarien („Dürresommer", „Der Turm")
- [ ] Tagesarchiv (Seed aus Datum)

### M7 · Feel & Politur
- [ ] **`styles.md` erneut lesen**
- [ ] Progressive Enthüllung (Protokolle nach 1. Reparatur, Mast nach ~2 min, Entropie ab 1. Reparatur)
- [ ] Erste 60 s über das Log, erste sinnvolle Aktion dezent hervorgehoben
- [ ] Mikro-Feedback je Aktion, würdevoller Verlust-Moment
- [ ] `prefers-reduced-motion` überall
- [ ] Barrierefreiheit: Tastatur, Fokus, `role="meter"`, Kontraste
- [ ] Mobile 375 px
- [ ] Sound (KANN, Web Audio, standardmäßig aus)

### M8 · Balancing & Release
- [ ] `npm run sim` über 200 Seeds, Median/P10/P90
- [ ] `balance.spec.ts` gegen die Ziele aus Abschnitt 6 (mit Toleranz)
- [ ] Garantie-Test: jede Strategie endet < 72 h
- [ ] Performance + Bundle-Budget
- [ ] Playwright-Smoke: lädt · Reparatur · Reload behält Spielstand
- [ ] `README.md` als Portfolio-Stück, MIT-Lizenz
- [ ] GitHub-Actions-Workflow für Pages (korrekter `base-href`)
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
