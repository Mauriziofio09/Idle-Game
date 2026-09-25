import { defineConfig, devices } from '@playwright/test';

/**
 * The smoke test from prompt.md section 11: the app loads, a repair works, and a save
 * survives a reload.
 *
 * It builds the application and serves the files that come out, under the same path
 * prefix GitHub Pages will use. Not `ng serve`: the failures a release smoke test exists
 * to catch — a wrong base href, a hashed filename that never got written, a stylesheet
 * missing from index.html — are exactly the ones a dev server papers over by rebuilding
 * from source. An earlier version of this file used the dev server on its production
 * configuration and claimed to cover them; it did not.
 *
 * Port 4300 rather than Angular's usual 4200, so a dev server somebody already has open
 * is neither reused by accident nor killed.
 */
const PORT = 4300;
/** The path a project site is served from. The deploy workflow builds with the same one. */
const BASE = '/Idle-Game/';

export default defineConfig({
  testDir: './e2e',
  // A smoke test that needs a retry is not telling the truth about the release.
  retries: 0,
  fullyParallel: true,
  // The HTML report is what the CI workflow uploads when this fails; without it that
  // upload step has nothing to collect.
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}${BASE}`,
    // retries are 0 on purpose, so the trace has to be kept on the first failure or there
    // is nothing to look at when CI goes red.
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build -- --base-href "${BASE}" && npm run serve:dist`,
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
