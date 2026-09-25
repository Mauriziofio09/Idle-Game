/**
 * A static server for the built archive — `npm run serve:dist`.
 *
 * The smoke test runs against this rather than against `ng serve`, because the things it
 * is meant to catch only exist in the shipped files: a wrong `<base href>`, a hashed
 * filename that never got written, an index.html that does not reference the stylesheet.
 * A dev server, even on the production configuration, rebuilds from source and papers over
 * all three.
 *
 * It serves under the same path prefix GitHub Pages will use, so the base href the deploy
 * workflow sets is exercised too.
 *
 * Forty lines and no dependency. A static file server is not worth one, and prompt.md
 * section 12 asks for restraint about what gets pulled in.
 */

import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

const ROOT = resolve(import.meta.dirname, '..', 'dist', 'entropie', 'browser');
const PORT = Number(process.env.PORT ?? 4300);
/** Matches the deploy workflow, which serves a project site from /<repository>/. */
const BASE = process.env.BASE_PATH ?? '/Idle-Game/';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${PORT}`);

  if (!url.pathname.startsWith(BASE)) {
    // Everything lives under the base path, exactly as it will on Pages.
    response.writeHead(302, { location: BASE }).end();
    return;
  }

  const relative = url.pathname.slice(BASE.length) || 'index.html';
  // normalize + the prefix check below keep a crafted path inside the output directory.
  const candidate = join(ROOT, normalize(relative));
  const file = candidate.startsWith(ROOT) ? candidate : join(ROOT, 'index.html');

  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    // Unknown path: hand back the app, which is what 404.html does on Pages.
    const body = await readFile(join(ROOT, 'index.html'));
    response.writeHead(200, { 'content-type': TYPES['.html'] }).end(body);
  }
}).listen(PORT, () => {
  process.stdout.write(`ENTROPIE · dist auf http://localhost:${PORT}${BASE}\n`);
});
