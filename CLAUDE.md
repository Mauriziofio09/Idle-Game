# ENTROPIE — Arbeitsanweisungen

Spezifikation: `prompt.md`. Plan und Checkliste: `PLAN.md`. Visuelles Gesetz: `styles.md` (nicht ändern).

## Befehle
- `npm start` — Dev-Server
- `npm run build` — Produktionsbuild
- `npm test` / `npm run test:run` — Vitest (watch / einmalig)
- `npm run lint` — ESLint über `src/` und `scripts/`
- `npm run sim` — Headless-Balancing über 200 Seeds + Offline-Performance-Budget
  (`SIM_SEEDS=20 npm run sim` für einen schnellen Durchlauf)

## Engine-Regeln (nicht verhandelbar)
`src/app/engine/` ist reines TypeScript: kein Angular, kein RxJS, kein DOM, kein `Date`,
kein `Math.random`, kein `console`. ESLint erzwingt das — Verstöße sind Fehler, keine Warnungen.
- `step(state)` und `applyAction(state, action)` sind pur: sie kopieren, mutieren die Kopie
  und geben `{ state, events }` zurück. Die Eingabe bleibt unangetastet.
- Zufall nur über `engine/rng.ts`; der Generatorzustand liegt in `GameState` und damit im Save.
- Zeit nur als Tick-Anzahl (`TICK_MS = 1000`). Die Engine kennt keine Uhr.
- Spieler und Protokolle rufen denselben `applyAction`. Kein zweiter Mutationsweg.
- Die Engine liefert Domain-Events mit Fakten; Sätze entstehen erst in der UI aus `content/de.ts`.
- Determinismus ist getestet: gleicher Seed + gleiche Aktionen = gleiches Ergebnis,
  am Stück wie in Chunks wie offline.

## Zahlen
Alle Spielzahlen stehen ausschließlich in `src/app/engine/balance.ts` — dort keine Logik.
Balancing passiert in Meilenstein 8 per `npm run sim`, nicht durch verstreute Konstanten.

## Styling
Ausschließlich über die Tokens in `src/styles/tokens.css`, die `styles.md` 1:1 übersetzen.
Keine hartkodierten Farben, Abstände, Schriften oder Radien in Komponenten. Fehlt ein Wert,
leite ihn aus bestehenden Tokens ab und dokumentiere die Ableitung in `PLAN.md`.
Wiederverwendbare Bausteine liegen in `src/app/ui/kit/`.

## Texte
Alles, was der Spieler liest, steht in `src/app/content/de.ts`. Code, Kommentare und
Bezeichner auf Englisch. Zahlen und Zeiten über `src/app/format.ts`.

## Arbeitsweise
Neue Ideen nach `IDEAS.md`, nicht bauen. Tests nicht abschwächen, um grün zu werden.
Kein Push ohne ausdrückliche Freigabe.
