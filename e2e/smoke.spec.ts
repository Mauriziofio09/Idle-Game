import { expect, test, type Page } from '@playwright/test';

import {
  ACTION_LABELS,
  APP,
  LOG,
  PANEL_TABS,
  RESOURCE_LABELS,
  SYSTEM_NAMES,
  TUTORIAL,
} from '../src/app/content/de';

/**
 * The release smoke test from prompt.md section 11: the app loads, a repair works, and a
 * save survives a reload.
 *
 * Deliberately three tests and no more. The unit suite covers the rules; what only a real
 * browser can tell us is whether the built application starts at all, whether a click
 * reaches the engine, and whether the archive is still there after a reload. Anything else
 * here would be a slower copy of a test that already exists.
 *
 * It reads the page the way a player does — visible text and roles — and takes the words
 * from `content/de.ts` rather than repeating them, so rewording the game cannot leave this
 * file quietly asserting a sentence nobody shows any more.
 */

/** The pumps: on the ground floor, damaged from the start, always repairable at tick 0. */
const SYSTEM = SYSTEM_NAMES.pumps;

/** Integrity points the pumps may lose between the repair and the reload. */
const MAX_DECAY_ACROSS_RELOAD = 2;

async function openArchive(page: Page) {
  // Relative, not '/': an absolute path resolves against the origin and would leave the
  // base path behind. Locally the dev server redirects and hides that; GitHub Pages does
  // not, and a run against the published site landed on the account's root page instead.
  await page.goto('./');
  await expect(page.getByRole('heading', { name: APP.title, level: 1 })).toBeVisible();

  // Every context starts with empty storage, so a first-timer's introduction is in the
  // way — exactly as it is for a real newcomer. Past it the way a player gets past it.
  const introduction = page.getByRole('dialog');
  await expect(introduction).toBeVisible();
  await introduction.getByRole('button', { name: TUTORIAL.skip }).click();
  await expect(introduction).toBeHidden();
}

/** Opens the archive log, which lives behind its own tab on the rail. */
async function openLog(page: Page) {
  await page.getByRole('tab', { name: PANEL_TABS.log }).click();
  await expect(page.getByRole('log')).toBeVisible();
}

/** A figure from the top bar, by its label. */
function stat(page: Page, label: string) {
  return page.locator('app-resource-bar app-stat').filter({ hasText: label });
}

/** The integrity the cross-section prints on a system's chip, as a number. */
async function integrityOf(page: Page, name: string): Promise<number> {
  const chip = page.locator('.chip', { hasText: name }).first();
  const text = (await chip.innerText()).replace(/\s+/g, ' ');
  const match = /(\d+(?:,\d+)?)\s*%/.exec(text);
  expect(match, `keine Integrität auf dem Chip "${name}": ${text}`).not.toBeNull();
  return Number(match![1].replace(',', '.'));
}

async function repairPumps(page: Page) {
  await page.locator('.chip', { hasText: SYSTEM }).first().getByRole('button').first().click();
  const panel = page.locator('app-detail-panel');
  await expect(panel).toContainText(SYSTEM);
  await panel.getByRole('button', { name: ACTION_LABELS.repair }).click();
}

test('the archive opens, and says where it is', async ({ page, baseURL }) => {
  // "External" means off-origin, not "not localhost". The first version hardcoded
  // localhost, which was right for the local server and wrong everywhere else: run
  // against the published site it flagged the game's own stylesheet and bundle.
  const origin = new URL(baseURL ?? 'http://localhost').origin;
  const external: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin) {
      external.push(request.url());
    }
  });

  await openArchive(page);

  // Its own seed, and the three lines that explain the situation.
  await expect(page.getByText(APP.archivePrefix)).toBeVisible();
  await openLog(page);
  for (const line of LOG.opening) {
    await expect(page.getByRole('log')).toContainText(line);
  }

  // The building is drawn, top floor to cellar, with things standing on it.
  await expect(page.getByRole('button', { name: /Dachboden/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Keller/ })).toBeVisible();
  await expect(page.locator('.chip')).not.toHaveCount(0);

  // prompt.md section 12: no external requests, ever. Not a font, not a favicon.
  expect(external).toEqual([]);
});

test('introduces the archive once, and then leaves the player alone', async ({ page }) => {
  await page.goto('./');
  const introduction = page.getByRole('dialog');
  await expect(introduction).toBeVisible();
  await expect(introduction).toContainText(TUTORIAL.steps[0].heading);

  // Forward to the last step and out through the front door rather than the skip.
  for (let step = 1; step < TUTORIAL.steps.length; step += 1) {
    await introduction.getByRole('button', { name: TUTORIAL.next }).click();
    await expect(introduction).toContainText(TUTORIAL.steps[step].heading);
  }
  await introduction.getByRole('button', { name: TUTORIAL.start }).click();
  await expect(introduction).toBeHidden();

  // And it does not come back. This is the part a unit test cannot prove: that the
  // choice survives a real reload in a real browser.
  await page.reload();
  await expect(page.getByRole('heading', { name: APP.title, level: 1 })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('repairing a system raises it, costs something and is written to the log', async ({
  page,
}) => {
  await openArchive(page);

  const before = await integrityOf(page, SYSTEM);
  const materialBefore = await stat(page, RESOURCE_LABELS.material).innerText();

  await repairPumps(page);

  // The bar moved.
  await expect.poll(() => integrityOf(page, SYSTEM)).toBeGreaterThan(before);
  // It was paid for.
  await expect(stat(page, RESOURCE_LABELS.material)).not.toHaveText(materialBefore);
  // The archive said so.
  await openLog(page);
  await expect(page.getByRole('log')).toContainText('repariert');
  // And the entropy readout, which a repair is what pays into, has appeared.
  await expect(stat(page, RESOURCE_LABELS.entropy)).toBeVisible();
});

test('the archive is still there after a reload', async ({ page }) => {
  await openArchive(page);
  await repairPumps(page);
  await openLog(page);
  await expect(page.getByRole('log')).toContainText('repariert');

  const seed = await page.getByText(APP.archivePrefix).innerText();
  const repaired = await integrityOf(page, SYSTEM);

  await page.reload();
  await expect(page.getByRole('heading', { name: APP.title, level: 1 })).toBeVisible();

  // The same archive, not a new one.
  await expect(page.getByText(APP.archivePrefix)).toHaveText(seed);
  // The repair survived. A second or two passes between the repair and the reload and the
  // pumps decay at 0.150/s, so about a third of a point is expected; two is a ceiling with
  // room, not a licence. It was ten once, which is wide enough that a save losing eight
  // points on every write would still have passed.
  const afterReload = await integrityOf(page, SYSTEM);
  expect(afterReload).toBeGreaterThan(repaired - MAX_DECAY_ACROSS_RELOAD);
  expect(afterReload).toBeLessThanOrEqual(repaired);
  // A reload is not a fresh start: the entropy readout is only shown after a repair.
  await expect(stat(page, RESOURCE_LABELS.entropy)).toBeVisible();
});


