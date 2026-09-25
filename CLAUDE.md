# ENTROPIE — Arbeitsanweisungen

Spezifikation: `prompt.md`. Plan und Checkliste: `PLAN.md`. Visuelles Gesetz: `styles.md` (nicht ändern).

## Befehle
- `npm start` — Dev-Server
- `npm run build` — Produktionsbuild
- `npm test` / `npm run test:run` — Vitest · `npm run lint` — ESLint
- `npm run sim` — Headless-Balancing über 200 Seeds (`SIM_SEEDS=20` für schnell)
- `npm run e2e` — Playwright-Smoke gegen den Produktionsbuild
- `npm run contrast` — Farbkontraste aus `tokens.css` gegen WCAG AA

## Engine-Regeln (nicht verhandelbar)
`src/app/engine/` ist reines TypeScript: kein Angular, kein RxJS, kein DOM, kein `Date`,
kein `Math.random`, kein `console`. ESLint erzwingt das — Verstöße sind Fehler, keine Warnungen.
- `step(state)` und `applyAction(state, action)` sind pur: sie kopieren, mutieren die Kopie
  und geben `{ state, events }` zurück. Die Eingabe bleibt unangetastet.
- Zufall nur über `engine/rng.ts`; der Generatorzustand liegt in `GameState` und damit im Save.
- Zeit nur als Tick-Anzahl (`TICK_MS = 1000`). Die Engine kennt keine Uhr.
- Spieler und Protokolle rufen denselben `applyAction`. Kein zweiter Mutationsweg.
- Domain-Events tragen Fakten; Sätze entstehen erst in der UI aus `content/de.ts`.
- Determinismus ist getestet: gleicher Seed + gleiche Aktionen = gleiches Ergebnis,
  am Stück wie in Chunks wie offline.

## Zahlen
Alle Spielzahlen stehen ausschließlich in `src/app/engine/balance.ts` — dort keine Logik.
Balancing per `npm run sim`, nicht durch verstreute Konstanten. `balance.spec.ts` hält die
Ziele aus `prompt.md` Abschnitt 6 fest.

## Styling
Ausschließlich über die Tokens in `src/styles/tokens.css`, die `styles.md` 1:1 übersetzen.
Keine hartkodierten Farben, Abstände, Schriften oder Radien. Fehlt ein Wert, leite ihn aus
bestehenden Tokens ab und dokumentiere ihn nummeriert in `PLAN.md`. Bausteine in
`src/app/ui/kit/`. Grün ist nie Textfarbe (4,35:1) — `npm run contrast` prüft das.

## Texte & Arbeitsweise
Alles, was der Spieler liest, steht in `src/app/content/de.ts`; Code und Bezeichner auf
Englisch, Zahlen über `src/app/format.ts`. Neue Ideen nach `IDEAS.md`, nicht bauen. Tests
nicht abschwächen, um grün zu werden. Kein Push ohne ausdrückliche Freigabe.
