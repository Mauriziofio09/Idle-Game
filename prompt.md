# ENTROPIE — Das letzte Archiv
### Build-Spezifikation & Arbeitsauftrag für Claude Code

> **Lies dieses Dokument vollständig, bevor du irgendetwas tust.** Es ist Spezifikation, Designdokument und Arbeitsauftrag in einem. Wenn etwas unklar oder widersprüchlich ist: fragen statt raten.

---

## 0 · Deine Rolle

Du arbeitest in drei Rollen gleichzeitig:

- **Systems Designer** – du verstehst, warum eine Mechanik Spaß macht, und schützt die Design-Säulen (Abschnitt 3).
- **Senior Frontend Engineer (Angular)** – sauberer, getesteter, moderner Code.
- **Game-Feel-Handwerker** – jede Aktion fühlt sich spürbar an; das Spiel wirkt fertig, nicht wie ein Prototyp.

Ziel: ein vollständiges, poliertes, kostenloses Browser-Idle-Game, das man stolz auf GitHub, Reddit und LinkedIn zeigt. Keine Platzhalter, kein Lorem ipsum, keine halbfertigen Features in der finalen Version.

---

## 1 · Bevor du die erste Zeile Code schreibst

Arbeite in dieser Reihenfolge. Überspringe nichts.

1. **`styles.md` lesen – vollständig.** Sie liegt im Projekt-Root und ist die einzige Quelle für das visuelle Design (Details in Abschnitt 8).
   **IMPORTANT:** Existiert `styles.md` nicht oder ist sie leer → **STOPP**. Schreib keinen UI-Code und frag mich.
2. `CLAUDE.md` lesen, falls vorhanden.
3. Umgebung prüfen und das Ergebnis zeigen: `node -v` (Angular 22 braucht Node ≥ 22.12), `npm -v`, `git --version`, `npx ng version` (falls schon ein Projekt existiert).
4. Im **Plan-Modus** eine `PLAN.md` schreiben:
    - Architektur & Ordnerstruktur (angelehnt an Abschnitt 9)
    - Meilensteine aus Abschnitt 11 als Checkliste
    - Wie du `styles.md` in Design-Tokens übersetzt (Abschnitt 8)
    - Jede zusätzliche Dependency mit Begründung (Ziel: so wenige wie möglich)
    - Risiken & offene Fragen
5. Mir **maximal 5 gezielte Fragen** stellen – nur zu Dingen, die du nicht selbst sinnvoll entscheiden kannst. Alles andere entscheidest du selbst und dokumentierst die Entscheidung in `PLAN.md`.
6. Auf mein **OK** warten. Erst dann Meilenstein 1.

---

## 2 · Das Spiel in 30 Sekunden

Fast jedes Idle-Game folgt derselben DNA: Zahlen steigen von allein, du kaufst Upgrades, die sie schneller steigen lassen. **ENTROPIE dreht das um.**

Die Stadt ist ertrunken. Es regnet seit Monaten. Übrig ist das **Archiv** – ein fünfstöckiges Gebäude mit den letzten Sammlungen der Stadt. Du bist **KUSTOS**, das alte Wartungssystem des Hauses. Niemand ist mehr da.

Nichts wächst in diesem Spiel. **Alles zerfällt – automatisch, ständig, auch wenn du nicht hinsiehst.** Das Wasser steigt von unten, der Regen dringt durchs Dach, die Technik verschleißt, Papier verrottet. Du kannst nicht alles retten. Deine Aufgabe ist zu entscheiden, **was** du rettest, **wie lange** du durchhältst – und so viel wie möglich über den Sendemast in die Welt zu übertragen, bevor das Archiv verstummt.

Der Haken, der das Spiel trägt: **Jede Reparatur erhöht die Entropie.** Ordnung an einer Stelle kostet Unordnung an anderer (2. Hauptsatz der Thermodynamik). Wer panisch alles repariert, beschleunigt den Untergang.

Das Idle-Herz: **Protokolle.** Der Spieler programmiert KUSTOS mit einfachen Wenn-Dann-Regeln. Ist er weg, führt das Archiv seine Protokolle aus. Kommt er zurück, liest er, was passiert ist. Gute Protokolle bringen das Archiv durch die Nacht. Schlechte nicht.

---

## 3 · Design-Säulen (bei jeder Entscheidung prüfen)

1. **Verlust ist die Grundrichtung.** Kein Zustand darf dauerhaft stabil werden. Jeder Run endet – garantiert durch steigende Entropie. (Wird getestet, siehe Abschnitt 10.)
2. **Entscheidungen statt Klicks.** Kein Klick-Spam, keine Klick-Belohnung. Jede Aktion ist eine Abwägung mit Kosten.
3. **Weggehen ist Teil des Spiels.** Offline läuft dieselbe Simulation wie online – mit den Protokollen des Spielers. Der Rückkehr-Moment ist ein Höhepunkt.
4. **Lesbar & ehrlich.** Der Spieler sieht Raten (z. B. „−0,4 %/min"), kann planen und versteht, warum etwas verloren ging. Keine versteckten Würfel.
5. **Melancholisch, nicht deprimierend.** Ruhiger Ton, Würde im Scheitern, ein wenig Hoffnung im Vermächtnis.
6. **Respektvoll.** Keine Werbung, kein Tracking, keine Accounts, keine Push-Nachrichten, keine FOMO- oder Schuld-Mechaniken, kein Geld.
7. **Kleine Zahlen.** Alles bleibt menschlich lesbar (Prozente, max. 4 Stellen). Keine Exponential-Inflation, keine wissenschaftliche Notation.

---

## 4 · Setting, Ton & Texte

- **Ort:** Das Archiv mit 5 Etagen (Index → Name): `0 Keller`, `1 Erdgeschoss`, `2 Erster Stock`, `3 Zweiter Stock`, `4 Dachboden`.
- **Erzählerstimme:** das Archivlog. Knapp, sachlich, leise melancholisch. Zeitstempel + ein Satz. Beispiele für die Tonalität (nicht wörtlich übernehmen, eigene schreiben):
    - `00:12 — Pumpen laufen. 58 %.`
    - `14:37 — Das Wasser erreicht die Kartenregale.`
    - `41:02 — Das Kartenwerk ist verloren. 12 % wurden gesendet.`
- **Kein** Meme-Humor, keine Ausrufezeichen-Flut, keine Emojis in Spieltexten.
- **Lore:** 24 kurze Fragmente (2–4 Sätze) aus der „Stadtchronik", freigeschaltet über das Vermächtnis (5.12). Sie erzählen nach und nach, warum die Stadt ertrank, wer die letzte Archivarin war und warum KUSTOS weitermacht. Schreib sie selbst, im Ton oben, und halte die Auflösung bis zu den letzten Fragmenten zurück.
- **Sprache:** UI auf Deutsch. **Alle** Texte zentral in `src/app/content/de.ts` (i18n-fähig, damit Englisch später leicht dazukommt). Code, Kommentare und Bezeichner auf Englisch. Zahlen- und Zeitformatierung über eine zentrale Format-Funktion (`Intl.NumberFormat`).

---

## 5 · Spielsysteme

> Alle Zahlen hier sind **Startwerte**. Sie gehören ausschließlich in `src/app/engine/balance.ts` und werden in Meilenstein 8 per Simulation auf die Ziele in Abschnitt 6 getunt. Die Formeln sind Absicht, keine Heiligtümer – wenn eine Formel die Ziele nicht erreichen kann, schlag eine bessere vor und begründe sie.

### 5.1 Zeit
- Feste Simulationsschritte: `TICK_MS = 1000`. Die Engine kennt keine Uhr – sie bekommt Tick-Anzahlen.
- Angezeigt wird die Laufzeit des Runs (`hh:mm:ss`).

### 5.2 Entropie `S`
- Startet bei 0 und **sinkt nie**.
- Zuwachs: passiv `+0,02/s` · pro Reparatur `+3` · pro Rückbau `+6` · pro Verheizen `+10`.
- Verfallsmultiplikator für alles: `m(S) = 1 + S / 120`.
- Der Regen wird mit der Entropie stärker (5.4).
- Die UI zeigt S und den Multiplikator („Verfall ×1,6").

### 5.3 Systeme (die Technik des Hauses)

| System | Etage | Funktion | Verbrauch (E/s, nur wenn an) | Grundverfall (%/s) |
|---|---|---|---|---|
| Generator | 1 | erzeugt `3,0 × I/100` Energie/s | – | 0,06 |
| Pumpen | 0 | senken den Pegel um `pump_max × I/100` | 1,2 | 0,09 |
| Werkstatt | 1 | macht Reparaturen wirksamer | – | 0,03 |
| Klimatechnik | 2 | senkt die Luftfeuchte im ganzen Haus | 0,8 | 0,05 |
| Kustoden-Depot | 2 | führt Protokolle aus | 0,4 | 0,05 |
| Dach | 4 | hält Regen draußen (passiv) | – | 0,04 |
| Sendemast | 4 | überträgt Sammlungen | 1,5 (nur beim Senden) | 0,07 beim Senden / 0,03 sonst |

- Jedes System hat Integrität `I` (0–100 %), Zustand an/aus, einen Reparaturzähler `n` und kann **verloren** sein (endgültig).
- Verfall pro Sekunde: `ΔI = −grundverfall × m(S) × feuchteFaktor(Etage) × (an ? 1 : 0,3)`.
- **Ausschalten konserviert** (nur 30 % Verfall), liefert aber keine Funktion und verbraucht nichts.
- Start-Integritäten pro Run seed-basiert zwischen 55 und 85 %.
- `I = 0` → System verloren. Ein System auf einer komplett überfluteten Etage verliert zusätzlich schnell Integrität – Ausnahme: Pumpen arbeiten unter Wasser weiter.

### 5.4 Wasser & Etagen
- Pegel `W` in Etagen-Einheiten `0,0–5,0`. Etage `k` ist komplett überflutet bei `W ≥ k+1`, teilweise bei `k < W < k+1`. Anzeige in Metern (1 Etage = 3,5 m).
- `dW/dt = zufluss − abfluss`
    - `zufluss = regen_basis × (1 + S/200) × ereignisFaktor`, Startwert `regen_basis = 0,004 Etagen/s`
    - `abfluss = pump_max × I_Pumpen/100` (nur wenn an und versorgt), Startwert `pump_max = 0,005 Etagen/s`
    - `W` nie unter 0.
- Diese Konsequenz trägt das Pacing: Zuerst fällt der **Keller**, danach bedroht das Wasser das **Erdgeschoss mit dem Generator** (Endphase). Den Keller bewusst aufzugeben muss eine legitime Strategie sein.

### 5.5 Luftfeuchte
- Pro Etage `h_k` (0–100 %). Zielfeuchte = Grundfeuchte (steigt mit S) + Nähe zum Wasserspiegel + Dachleck (nur Etage 4: `(100 − I_Dach) × 0,6`) − Klimatechnik (wenn an: `I_Klima × 0,5`), begrenzt auf 0–100.
- `h_k` nähert sich dem Zielwert weich an (exponentielle Glättung) – keine Sprünge.
- `feuchteFaktor = 0,5 + h/50` (→ 0,5 bis 2,5).

### 5.6 Ressourcen
- **Energie `E`:** Akkubank, Kapazität 150, Start 80. Reicht die Produktion nicht und ist der Akku leer → **proportionale Unterversorgung**: Alle eingeschalteten Verbraucher laufen mit der Effizienz `Produktion / Bedarf`. Deterministisch, fair und in der UI sichtbar.
- **Material `M`:** Start 50. Quellen: Rückbau und Treibgut-Ereignisse. Knapp by design.

### 5.7 Aktionen
Spieler **und** Protokolle nutzen exakt denselben Code-Pfad (`applyAction`).

| Aktion | Wirkung | Kosten / Nebenwirkung |
|---|---|---|
| **Reparieren** (System) | `+30 × w × 0,8^n` Integrität (max. 100); `w = 0,4 + 0,6 × I_Werkstatt/100`, ohne Werkstatt `w = 0,4` | `8 × (1 + 0,25n)` Material, 10 Energie, **S +3**, `n++` |
| **Ein/Aus** (System) | siehe 5.3 | – |
| **Rückbau** (System) | System endgültig weg; liefert `10 + 40 × I/100` Material (früh zurückbauen = mehr Material, aber Funktion weg) | **S +6**, irreversibel, Bestätigung nötig |
| **Senden** (Sammlung) | Sendemast überträgt `0,2 × I_Mast/100` Einheiten/s; immer nur eine Sammlung gleichzeitig | 1,5 E/s, Mast verschleißt schneller |
| **Umlagern** (Sammlung → Etage darüber) · *SOLL* | dauert 30 s, Sammlung ist währenddessen „unterwegs"; max. 3 Sammlungen pro Etage | 15 Energie |
| **Verheizen** (Sammlung) · *SOLL* | Rest der Sammlung wird zu Energie (`intakt × 0,5`) – kauft Zeit | **S +10**, irreversibel, zweistufige Bestätigung, eigener Log-Eintrag. Die dunkelste Entscheidung im Spiel – mit Gewicht inszenieren. |

### 5.8 Sammlungen
Sechs Sammlungen à 100 Einheiten, so verteilt, dass früh Druck entsteht:

| Sammlung | Start-Etage |
|---|---|
| Kartenwerk | 0 Keller |
| Stadtchronik | 1 Erdgeschoss |
| Naturkunde | 2 Erster Stock |
| Notenarchiv | 2 Erster Stock |
| Briefe der Stadt | 3 Zweiter Stock |
| Sprachen der Welt | 4 Dachboden |

- Jede Sammlung hat `intakt` (verrottet) und `gesendet` (für immer sicher).
- Verfall von `intakt`: exponentiell, Startwert `0,01 %/s` des Rests `× m(S) × feuchteFaktor(Etage)`. Komplett überflutete Etage → schneller Totalverlust (≈ 5 % des Rests pro Sekunde).
- Senden verschiebt Einheiten von `intakt` nach `gesendet`.
- **Run-Score** = `Σ gesendet / Σ gesamt` → „Gerettet: 38 %".

### 5.9 Protokolle (das Idle-Herz · MUSS)
- Regel = `WENN <Bedingung> DANN <Aktion>`, als Liste in Prioritätsreihenfolge.
- **Bedingungen:** System-Integrität < X · Pegel > X · Energie < / > X · Feuchte einer Etage > X · Zustand einer Sammlung < X · Material > X.
- **Aktionen:** Reparieren · Ein/Aus · Senden starten/stoppen · Umlagern (sobald freigeschaltet).
- Das **Kustoden-Depot** führt pro Abklingzeit genau **eine** Aktion aus: `abklingzeit = 20 s / (I_Kustoden/100)`, mindestens 5 s. Aus, verloren oder unversorgt → keine Protokolle. **Die Automatisierung verfällt selbst** – das ist gewollt.
- Pro Tick: Die höchste passende Regel, deren Aktion bezahlbar ist, wird ausgeführt (falls das Depot bereit ist).
- Start mit **2 Protokoll-Slots**, weitere über das Vermächtnis (max. 8).
- *SOLL:* globale „Materialreserve" – Protokolle geben Material nie unter diesen Wert aus.
- UI: Regeln lesen sich als deutscher Satz („Wenn **Pumpen** unter **40 %** → **Pumpen reparieren**"), Bearbeitung per Dropdowns + Zahlenfeld, Reihenfolge per Hoch/Runter (tastaturbedienbar). Pro Regel ein Zähler „in diesem Run 14× ausgelöst".

### 5.10 Ereignisse (seed-basiert)
Wahrscheinlichkeit pro Minute `0,08 × m(S)`. Jedes Ereignis erzeugt einen Log-Eintrag; die mit (!) werden 20 s vorher angekündigt.

- **Sturmflut** (!) – Zufluss ×3 für 60 s
- **Kurzschluss** – ein eingeschaltetes System −15 Integrität
- **Treibgut** – Material +15 bis +30
- **Regenpause** – Zufluss ×0,3 für 90 s
- **Schimmel** – eine Sammlung verfällt 60 s lang ×3
- **Wolkenbruch** (!) – Dach −10

### 5.11 Run-Ende & Chronik
- **Ende**, wenn Energie = 0 **und** der Generator verloren oder überflutet ist („Das Archiv verstummt.") – **oder** wenn keine Sammlung mehr intakte Einheiten hat („Nichts mehr zu retten.").
- **Chronik-Bildschirm:** Laufzeit · Gerettet-% gesamt und je Sammlung · Zeitleiste der Verluste (was fiel wann) · meist ausgelöstes Protokoll · ein aus den Run-Daten generierter Schlusssatz.
- **Teilen:** Ein Button kopiert eine kompakte Text-Chronik (Clipboard API, zusätzlich Web Share API, wenn verfügbar), zum Beispiel:

  ```
  ENTROPIE · Archiv #4F2A
  Hielt 2 h 47 min · Gerettet 38 %
  Karten   ▰▱▱▱▱ 12 %
  Chronik  ▰▰▰▱▱ 61 %
  …
  Zuletzt fiel: der Sendemast.
  ```
- **Seeds:** Jeder Run hat einen Seed (4–6 Zeichen). Ein Link mit `?archiv=4F2A` startet exakt dasselbe Archiv → Vergleichbarkeit ganz ohne Backend.
- *SOLL:* **Tagesarchiv** – Seed aus dem Datum, für alle Spieler gleich.

### 5.12 Vermächtnis (Meta-Progression)
- Alles Gesendete aller Runs zählt dauerhaft zum Vermächtnis (pro Sammlung).
- Freischaltungen über Schwellen (Werte in `balance.ts`): Lore-Fragmente (alle 25 Einheiten) · Protokoll-Slots · neue Bedingungen/Aktionen (z. B. Umlagern) · *SOLL:* Szenarien mit anderen Startbedingungen (z. B. „Dürresommer": wenig Regen, schwacher Generator · „Der Turm": 7 Etagen, weniger Material).
- **Das Vermächtnis schaltet Optionen und Wissen frei – keine großen Multiplikatoren.** Höchstens kleine Boni (≤ 10 %). Der Untergang bleibt unausweichlich.

---

## 6 · Balancing-Ziele

Als Tests mit Toleranz in `balance.spec.ts` festhalten (über die Headless-Simulation, Abschnitt 10):

| Strategie | Ziel |
|---|---|
| Nichts tun | Archiv verstummt nach **8–15 min**, Gerettet ≈ 0 % |
| Naiv (immer das schwächste System reparieren) | **20–35 min**, 10–20 % |
| Gutes aktives Spiel, erster Run | **35–60 min**, 20–40 % |
| Beste Protokolle, 8 h offline | Das Archiv **kann** die Nacht überstehen, aber mit Verlusten |
| Jede beliebige Strategie | **endet garantiert innerhalb von 72 h** Simulationszeit (Säule 1) |

---

## 7 · UX & Game Feel

**Layout**
- **Herzstück ist der Querschnitt des Archivs** (SVG oder HTML/CSS): fünf Etagen übereinander, das Wasser steigt sichtbar von unten, oben Regen (Stärke = Zufluss), Dachschäden sichtbar, Sammlungen als Blöcke mit Zustand + Gesendet-Anteil, Systeme mit Integritätsbalken auf ihrer Etage.
- Klick/Enter auf Etage, System oder Sammlung → Detail-Panel mit Aktionen, Kosten und Vorschau („Reparatur: +21 % · kostet 12 Material · Entropie +3").
- Obere Leiste: Energie (mit Netto-Rate), Material, Entropie & Verfall-Multiplikator, Pegel, Laufzeit.
- Panels: Protokolle · Archivlog (neueste Einträge oben).
- Mobile: Querschnitt oben, Panels als Tabs darunter. Muss auf 375 px Breite gut spielbar sein.

**Die ersten 60 Sekunden** (kein Tutorial-Modal, keine Textwand)
- Das Log führt: Die ersten Zeilen erklären die Lage in drei Sätzen.
- **Progressive Enthüllung:** Anfangs nur Querschnitt, Energie, Material und die wichtigsten Systeme. Protokolle erscheinen nach der ersten Reparatur, der Sendemast nach ~2 Minuten („Der Sendemast antwortet."), die Entropie-Anzeige mit der ersten Reparatur.
- Die erste sinnvolle Aktion ist dezent hervorgehoben.

**Rückkehr („Während du fort warst")**
- Ab 2 min Abwesenheit: Zusammenfassung – Zeit weg, Pegeländerung, Energie, welche Protokolle wie oft liefen, was verloren ging (ruhig, chronologisch). Endete der Run offline → direkt die Chronik, mit genau diesem Rahmen.

**Feedback**
- Jede Aktion bekommt eine sofortige, sichtbare Reaktion (Balken springt, kurzer Puls, Log-Zeile).
- Kritische Zustände nie nur über Farbe – immer auch Symbol oder Text.
- Ein verlorenes System oder eine verlorene Sammlung bekommt einen kleinen, würdevollen Moment – nicht dramatisch, nicht nervig.
- Animationen respektieren `prefers-reduced-motion` (Wasser dann ohne Wellen, Übergänge sofort).

**Sound** (*KANN*): Regen-Ambience + sehr dezente Töne, per Web Audio API generiert (keine Audio-Dateien nötig), **standardmäßig aus**, Schalter in den Einstellungen.

**Barrierefreiheit**
- Alles per Tastatur bedienbar, sichtbarer Fokus (Stil aus `styles.md`).
- Balken als `role="meter"` bzw. `progressbar` mit Werten und Labels.
- Archivlog als `aria-live="polite"`.
- Kontraste gemäß `styles.md`; falls dort nicht definiert: mindestens WCAG AA.

---

## 8 · Styling – `styles.md` ist Gesetz

1. `styles.md` ist die **einzige** Quelle für Farben, Typografie, Abstände, Radien, Schatten, Bewegung und Komponenten-Stil. Dieses Dokument definiert Mechanik und Stimmung, **nicht** das Aussehen.
2. Übersetze `styles.md` in Meilenstein 0 **einmal** in `src/styles/tokens.css` (CSS Custom Properties, Benennung möglichst 1:1 wie in `styles.md`). Danach nutzen alle Komponenten ausschließlich diese Tokens: **keine** hartkodierten Farbwerte, keine Abstände außerhalb der Skala, keine Schriften, die dort nicht stehen.
3. Definiert `styles.md` Komponenten (Buttons, Karten, Panels, Inputs …), baue sie exakt so als wiederverwendbare Angular-Komponenten.
4. Fehlt etwas, das das Spiel braucht (z. B. Wasserfarbe, Zustände „kritisch" und „verloren"), **leite es aus bestehenden Tokens ab** und dokumentiere jede Ableitung in `PLAN.md` unter „Ableitungen aus styles.md". Erfinde keine neue Ästhetik.
5. Bei Widerspruch: **Visuelles → `styles.md` gewinnt. Mechanik → dieses Dokument gewinnt.**
6. `styles.md` ist schreibgeschützt – nicht verändern, außer ich sage es ausdrücklich.
7. Lies `styles.md` **erneut**, bevor du Meilenstein 2 und Meilenstein 7 beginnst (dein Kontext kann inzwischen komprimiert worden sein).
8. Nach jedem UI-Meilenstein: Falls du einen Browser steuern kannst (z. B. Claude in Chrome oder Playwright), mach Screenshots bei 1440 px und 375 px Breite, vergleiche sie Regel für Regel mit `styles.md`, liste Abweichungen auf und behebe sie.

---

## 9 · Technische Architektur

**Stack**
- **Angular 22** (aktuelle stabile Version via `ng new`), Standalone Components, **Signals**, zoneless (Default), OnPush, neue Control-Flow-Syntax. Nutze die passenden `ng new`-Flags (siehe `ng new --help`), damit nichts interaktiv hängen bleibt.
- **TypeScript strict.** Tests mit **Vitest** (Angular-Default). Linting mit angular-eslint.
- **Keine** Game-Engine (kein Phaser o. ä.), **kein** State-Framework (kein NgRx) – Signals reichen. Jede weitere Dependency braucht eine Begründung in `PLAN.md`.
- Falls der Angular-CLI-MCP-Server verbunden ist: Nutze ihn für aktuelle Best Practices und die Doku.

**Ordnerstruktur (Vorschlag)**
```
src/app/
  engine/        ← reines TypeScript: KEIN Angular, KEIN DOM, KEIN Date.now(), KEIN Math.random()
    state.ts       Typen & initialer Zustand
    balance.ts     ALLE Zahlen & Schwellen
    step.ts        step(state, rng) → { state, events } – ein Tick
    actions.ts     applyAction(state, action) – einziger Weg, den Zustand zu ändern
    protocols.ts   Regel-Auswertung & -Ausführung
    events.ts      Zufallsereignisse
    rng.ts         seedbarer PRNG (z. B. mulberry32), dessen Zustand im Save liegt
    offline.ts     simulate(state, ticks) für Offline & Aufholen
    legacy.ts      Vermächtnis & Freischaltungen
  game/          ← Angular-Services: GameLoopService, SaveService, GameStore (Signals)
  ui/            ← Komponenten: cross-section, resource-bar, detail-panel, protocols,
                   archive-log, chronicle, return-summary, settings
  content/de.ts  ← alle Texte, Lore, Log-Vorlagen
src/styles/tokens.css
scripts/sim.ts   ← Headless-Balancing
```

**Engine-Regeln (nicht verhandelbar)**
- Deterministisch: gleicher Startzustand + gleicher Seed + gleiche Aktionen = exakt gleiches Ergebnis.
- Aktionen sind eine diskriminierte Union (`{ type: 'repair', systemId }` usw.). UI und Protokolle rufen **denselben** `applyAction` auf.
- Die Engine liefert pro Tick neben dem Zustand eine Liste von **Domain-Events** (für Log, Feedback, Rückkehr-Zusammenfassung). Texte entstehen erst in der UI-Schicht aus `content/de.ts`.

**Game Loop**
- `requestAnimationFrame` + Zeit-Akkumulator mit festen Ticks. Zeit **immer über Zeitstempel** messen, nie `setInterval`-Aufrufe zählen (Browser drosseln Hintergrund-Tabs).
- Tab versteckt → Loop pausiert. Tab wieder sichtbar → verstrichene Zeit über denselben Offline-Pfad aufholen (Zusammenfassung erst ab 2 min).
- Das Zustands-Signal wird pro Tick aktualisiert, nicht pro Frame. Balken animieren per CSS-Transition.

**Offline**
- Beim Laden: `dt = jetzt − lastSeen`, begrenzt auf `[0, 24 h]`. Negative Werte (verstellte Uhr) → 0.
- Exakt dieselbe `step`-Funktion wie online, in Chunks, damit die UI nicht einfriert (bei Bedarf kurze Fortschrittsanzeige „Das Archiv erinnert sich …").
- Mehr als 24 h weg: **Notfall-Stasis** – danach kein weiterer Verfall; im Log erklärt.
- Performance-Ziel: 24 h (86 400 Ticks) in **< 1,5 s** auf einem aktuellen Laptop.

**Speichern**
- `localStorage`, Key `entropie.save`, JSON mit `schemaVersion` + Migrationsfunktionen (Migration v0 → v1 als Test anlegen).
- Autosave alle 15 s + bei `visibilitychange` (hidden) + `pagehide`. Zwei Slots (aktuell + letzter gültiger) als Schutz gegen Korruption.
- Export/Import als Base64-String mit Prüfsumme. Import **streng validieren** (eigener kleiner Validator, kein `eval`); bei Fehlern eine freundliche Meldung, niemals ein Absturz.
- Harter Reset nur nach expliziter Bestätigung.
- Vermächtnis getrennt vom laufenden Run speichern.

---

## 10 · Qualität & Verifikation

**Tests (Vitest), mindestens:**
- Entropie sinkt nie; `m(S)` ist monoton.
- Reparatur: abnehmender Ertrag über `n`, Werkstatt-Faktor, Kosten, Obergrenze 100.
- Rückbau-Ertrag hängt von der Integrität ab; verlorene Systeme bleiben verloren.
- Unterversorgung verteilt proportional.
- Protokolle: Priorität, Abklingzeit, Bezahlbarkeit, keine Ausführung ohne Depot oder Strom.
- **Determinismus:** 10 000 Ticks am Stück == 10 000 Ticks in zufälligen Chunks == Offline-Simulation (gleicher Seed).
- Offline-Begrenzung auf 24 h, negative Zeit, Stasis.
- Save-Roundtrip, Migration, Import mit kaputten Daten.
- Run-Ende-Bedingungen.

**Headless-Simulation – `npm run sim`**
- Spielt Runs ohne UI mit den Strategien aus Abschnitt 6 über viele Seeds (z. B. 200) und gibt Verteilungen für Laufzeit und Gerettet-% aus (Median, P10, P90).
- `balance.spec.ts` prüft die Ziele aus Abschnitt 6 mit Toleranz.

**Definition of Done – pro Meilenstein**
1. `ng build` ohne Fehler und ohne Warnungen, die du verursacht hast.
2. `ng test` grün · `ng lint` sauber · ab M1: `npm run sim` läuft.
3. Keine Fehler in der Browser-Konsole.
4. **Belege zeigen, nicht behaupten:** Befehl + relevante Ausgabe, bei UI-Arbeit Screenshots.
5. Review durch einen **Subagent** in frischem Kontext: Diff gegen `PLAN.md` und dieses Dokument prüfen – nur Lücken melden, die Korrektheit oder Anforderungen betreffen, keine Stil-Vorlieben. Echte Lücken beheben.
6. `PLAN.md`-Checkliste aktualisieren · Commit im Conventional-Commits-Format.
7. Kurzer Bericht an mich: Was ist fertig · **So testest du es in 3–5 Schritten** · offene Fragen. Dann **stoppen und auf mein Feedback warten.**

---

## 11 · Meilensteine

- **M0 · Fundament** – `styles.md` gelesen, `PLAN.md` & Fragen (Abschnitt 1), `ng new`, Linting, Vitest läuft, `tokens.css` aus `styles.md`, Git initialisiert. Eine kurze `CLAUDE.md` anlegen (≤ 40 Zeilen: Befehle, Engine-Regeln, „Styling ausschließlich über `tokens.css` / `styles.md`", Verweis auf `PLAN.md`).
- **M1 · Engine-Kern** – Zustand, Tick, Systeme, Entropie, Wasser, Feuchte, Energie inkl. Unterversorgung, Sammlungen, Aktionen Reparieren / Ein-Aus / Rückbau, PRNG, Tests, `npm run sim` v1.
- **M2 · Erstes Spielbares** – Querschnitt, Ressourcenleiste, Detail-Panel mit Kosten-Vorschau, Archivlog, GameLoopService. Ein kompletter Run ist spielbar (noch ohne Senden).
- **M3 · Speichern & Offline** – Save-System, Aufholen, Rückkehr-Zusammenfassung, Stasis, Export/Import.
- **M4 · Protokolle** – Engine-Seite + UI-Editor, Kustoden-Abklingzeit, Zähler. Offline nutzt dieselbe Logik.
- **M5 · Ziel & Ende** – Sendemast & Senden, Ereignisse, Run-Ende, Chronik + Teilen + Seed-Links, Vermächtnis + Lore, „Neues Archiv"-Ablauf.
- **M6 · Tiefe** (*SOLL*) – Umlagern, Verheizen, Materialreserve, Szenarien, Tagesarchiv.
- **M7 · Feel & Politur** – Onboarding / progressive Enthüllung, Mikro-Feedback, Animationen mit Reduced-Motion, Sound (*KANN*), Barrierefreiheits-Durchgang, Mobile.
- **M8 · Balancing & Release** – Tuning per Simulation auf die Ziele in Abschnitt 6, Performance-Check (Offline-Ziel, Bundle-Budget), Playwright-Smoke-Test (App lädt · Reparatur funktioniert · Spielstand überlebt Reload), `README.md` als Portfolio-Stück (Pitch, Screenshot-Platzhalter, Spielanleitung, Design-Notizen, Tech-Stack), MIT-Lizenz, GitHub-Actions-Workflow für **GitHub Pages** (kostenlos, korrekter `base-href`). **Pushen und Deployen erst nach meiner Bestätigung.**

---

## 12 · Nicht tun

- Kein Backend, keine Datenbank, keine Accounts, keine kostenpflichtigen Dienste, keine API-Keys.
- Kein Tracking, keine Analytics, keine Werbung, keine Cookies, keine externen Requests (Schriften nur, wenn `styles.md` sie verlangt – dann lokal einbinden).
- Keine Klick-Belohnung, keine Exponential-Zahlen, keine Premium-Währung, keine Streak-/FOMO-Mechanik, keine Browser-Benachrichtigungen.
- Kein Scope-Creep: neue Ideen in `IDEAS.md` notieren, nicht bauen.
- `styles.md` nicht verändern. Keine Tests abschwächen oder löschen, um grün zu werden. Fehler beheben statt unterdrücken.
- Keine destruktiven Git-Befehle (`push --force`, `reset --hard`) und kein Push ohne mein OK.

---

## 13 · Arbeitsweise

- **Einfach vor clever.** Die einfachste Lösung, die die Anforderungen erfüllt.
- Scheiterst du zweimal am selben Problem: stopp, erkläre die Ursache und schlag 2–3 Wege vor.
- Macht dir eine Mechanik beim Testen keinen Spaß: sag es mir ehrlich und schlag eine Änderung vor – bau sie aber erst nach meinem OK.
- Nach längeren Pausen oder einer Kontext-Komprimierung: `PLAN.md`, `CLAUDE.md` und die betroffenen Abschnitte dieses Dokuments neu lesen, bevor du weitermachst.

---

## 14 · Fertig ist das Spiel, wenn …

… ein neuer Spieler den Link öffnet, ohne Erklärung in unter einer Minute versteht, was los ist, seinen ersten Run in 30–60 Minuten verliert, dabei mindestens eine schwere Entscheidung getroffen hat, Protokolle schreibt, den Tab schließt, am nächsten Tag zurückkommt, die Rückkehr-Zusammenfassung liest – und seine Chronik teilen will.

**Beginne jetzt mit Abschnitt 1.**
