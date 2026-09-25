# ENTROPIE — Das letzte Archiv

**An idle game about losing things well.**

A flooded city. A five-storey archive nobody is coming back to. You are KUSTOS, the
building's maintenance system, and you cannot save it — the water rises faster than the
pumps hold, every repair wears the thing it mends, and material only ever runs out.

What you can decide is **what gets out before the lights go off.** The transmitter sends
one collection at a time. Everything you spend on the pumps is a minute the mast does not
get. The archive always falls. The question the game asks is what you chose to carry.

> The game is played in German. This README is in English; so is every identifier,
> comment and commit in the repository. Only `src/app/content/de.ts` speaks German, so a
> second language would be a content change rather than a refactor.

---

## Screenshots

*Placeholders — to be captured before publishing.*

- **`docs/screenshot-desktop.png`** — the cross-section mid-run at about 1200px: five
  floors, water part-way up, one collection transmitting, a system marked critical.
- **`docs/screenshot-mobile.png`** — the same archive at 375px, with the panels collapsed
  into the tab strip.
- **`docs/screenshot-chronicle.png`** — the chronicle of a finished run, which is where
  the game makes its point.

PNG, no device frames, no annotations.

---

## How to play

The whole game is one screen: a cross-section of the building, a bar of figures, and a set
of panels.

1. **Keep the power on.** The generator feeds everything. When production falls short and
   the battery is empty, every consumer runs at the same fraction of its demand — you can
   watch the supply share drop in the top bar.
2. **Decide about the cellar.** The pumps hold the water back and decay faster than
   anything else in the house. Holding the cellar is expensive. Giving it up is a real
   option, and sometimes the right one.
3. **Repair, and pay for it.** A repair costs material and energy, and adds **entropy** —
   which never falls and makes everything decay faster. The archive's clock is the sum of
   your own repairs.
4. **Send something.** The mast answers about two minutes in. It transmits one collection
   at a time, slowly, and wears itself out doing it. Anything transmitted is safe forever,
   including across later runs.
5. **Write protocols and walk away.** Simple if-then rules the custodian depot executes
   while you are gone. The same simulation runs offline, so coming back is a real moment:
   the archive tells you what happened, chronologically and without drama.

When the archive falls silent you get a chronicle of the run, and whatever you transmitted
joins your **legacy** — which unlocks lore fragments, more protocol slots and new
scenarios, never a multiplier. Nothing in this game gets numerically easier.

### Things that are deliberately absent

No clicking for rewards. No exponential numbers. No premium currency, streaks, timers
nagging you back, or notifications. No accounts, no backend, no analytics, no cookies, and
**no external network requests at all** — there is a smoke test that asserts it.

---

## Running it

```bash
npm install
npm start          # dev server on http://localhost:4200
```

| Command | What it does |
|---|---|
| `npm run build` | production build |
| `npm run test:run` | the unit suite (344 tests) |
| `npm run e2e` | Playwright smoke test against the built application |
| `npm run lint` | ESLint over `src/` and `scripts/` |
| `npm run sim` | headless balancing over 200 seeds, plus the offline performance budget |
| `npm run tune` | sweeps balance values to find combinations that hit the targets |
| `npm run contrast` | checks every colour pair in `tokens.css` against WCAG AA |

`SIM_SEEDS=20 npm run sim` for a quick pass.

---

## Design notes

### The engine is pure TypeScript, and the rules enforce it

`src/app/engine/` contains no Angular, no RxJS, no DOM, no `Date`, no `Math.random` and no
`console`. ESLint enforces every one of those as an error rather than a convention.

`step(state)` and `applyAction(state, action)` copy, mutate the copy and return
`{ state, events }`. The input is never touched. Time exists only as a count of ticks;
randomness only through a seeded generator whose state lives in the save. The consequence
worth having: **the same seed and the same actions produce the same run** — in one go, in
random chunks, or simulated offline. That is a test, not an aspiration.

Players and automated protocols call the identical `applyAction`. There is no second way
to change the world.

### Events carry facts; sentences are built in the UI

The engine reports `{ type: 'system-lost', tick, systemId }`. It has never heard of the
word *verloren*. Every string the player reads lives in `content/de.ts`.

### Every number lives in one file

`engine/balance.ts` holds all of them and contains no logic. Balancing was done by
simulation, not by nudging constants around the codebase — and `balance.spec.ts` asserts
the targets so a later change to a number cannot quietly turn the archive into a place
where nothing matters.

### The balancing, and the target that could not be met

Measured over 200 seeds:

| Strategy | Runtime (median) | Saved | Target |
|---|---|---|---|
| Do nothing | 14.9 min | 0.0 % | 8–15 min, ≈0 % ✓ |
| Patch whatever looks worst | 19.7 min | 14.0 % | 20–35 min ✗ (0.3 short), 10–20 % ✓ |
| Play well | 40.3 min | 27.5 % | 35–60 min, 20–40 % ✓ |
| Best protocols, 8 h away | 32.6 min | 15.4 % | survive the night ✗ |

The second misses its runtime band by twenty seconds. Closing that means making repairs
pay more, which pushes the same player's saved share above the 20 % ceiling of the other
half of their own target — so the half that says something about the game is the half held
exactly. `balance.spec.ts` asserts it at 19 minutes and says why.

The fourth is **not met, and cannot be** without changing the law the game is built on.
Rain grows with entropy and overtakes the pumps' maximum output at entropy 350, which the
passive drift alone reaches after 292 minutes; past that the cellar floods at any
integrity, under any strategy. The interesting part is that the first explanation for this
was wrong — it blamed material scarcity — and the counter-measurement (unlimited material
buys 64 minutes, not 480) is what found the real cause. Both are written down in
`PLAN.md`, including how the wrong answer was arrived at.

### Swiss design, as a constraint rather than a theme

`styles.md` is treated as law and was never edited. Zero border radius anywhere, 2px solid
black borders, no shadows, Helvetica, and a single green accent. Components use only tokens
from `src/styles/tokens.css`; every derived value is numbered and justified in `PLAN.md`.

That accent is `#0A8C3A`, which is 4.35:1 against white — enough for a border or an icon
under WCAG 1.4.11, **not** enough for a word under 1.4.3. So no text in this interface is
green, and `npm run contrast` computes all twelve pairs from the token file itself and
fails the build if one slips below.

### Accessibility is checked, not claimed

Everything is reachable by keyboard with a visible focus ring. Bars are `role="meter"` with
values and labels, the archive log is a `role="log"` live region, and critical states are
never signalled by colour alone — there is always a word. Animations run entirely on two
motion tokens that `prefers-reduced-motion` sets to zero.

One bug is worth naming because it kept coming back: focus falling onto `<body>` when the
control it was standing on disappeared. It shipped in five milestones running, and the
sixth fix was itself wrong — it guarded only the mobile tab strip, and its test passed
only because jsdom will focus an element inside `display: none` where a browser will not.
The guard now sits above every control: when the archive is replaced and nobody holds
focus, it comes home to the page heading.

---

## Tech stack

- **Angular 22**, standalone components, signals, zoneless change detection, `OnPush`
  everywhere, and the new `@if` / `@for` control flow
- **TypeScript 6** in strict mode
- **Vitest** for unit tests, **Playwright** for the release smoke test
- **angular-eslint** with a flat config, including the rules that keep the engine pure
- No runtime dependencies beyond Angular and its own companions (`rxjs`, `tslib`). No CSS
  framework, no component library, no icon package — the icons are inline SVG and the
  design system is one file of 80 custom properties.

Untestable globals are behind injection tokens rather than mocked in place: `GAME_STORAGE`
for `localStorage`, `FRAME_SCHEDULER` for `requestAnimationFrame`, `AUDIO_CONTEXT` for Web
Audio. Each of those exists because a real test needed it, and the story is in `PLAN.md`.

---

## Repository map

```
src/app/engine/     the rules: pure, deterministic, framework-free
src/app/game/       the bridge: store, loop, saving, offline catch-up, sound
src/app/ui/         components, and a small kit of shared building blocks
src/app/content/    every German string the player reads
src/styles/         tokens.css — styles.md translated one to one
scripts/            sim, tune, contrast
e2e/                the release smoke test
PLAN.md             the working log: decisions, measurements, and what went wrong
IDEAS.md            things deliberately not built
```

## Licence

MIT — see [LICENSE](LICENSE).
