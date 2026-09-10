/**
 * The dev server and the bundle.
 *
 * VITE RATHER THAN WEBPACK, which is what `yo office` scaffolds. There is no
 * officially supported Vite template — the generator's own answer is its
 * "manifest only" project, for exactly this case: a different bundler in a
 * repository that already has one. This app is a workspace beside
 * `apps/web`, which is Vite, and a second bundler in one repository is a second
 * set of resolution rules to keep in step.
 *
 * HTTPS IS NOT OPTIONAL. Office refuses to load a task pane over http, in
 * development as much as in production, so the dev server runs on the
 * certificate `office-addin-dev-certs` installs. If it is not installed yet the
 * server still starts, over http, and Word will refuse it — which is a clearer
 * failure than a silent blank pane.
 *
 * PORT 3000 IS IN THE MANIFEST. `strictPort` so a busy port fails here instead
 * of moving the server somewhere the manifest does not point.
 */
import { defineConfig } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workspaceAliases } from '../../tools/workspace-alias.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The certificate `office-addin-dev-certs install` writes. */
function devCerts(): { key: Buffer; cert: Buffer } | undefined {
  const dir = join(homedir(), '.office-addin-dev-certs');
  const key = join(dir, 'localhost.key');
  const cert = join(dir, 'localhost.crt');
  if (!existsSync(key) || !existsSync(cert)) return undefined;
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

export default defineConfig({
  root: here,
  /*
   * RELATIVE ASSET PATHS, because the add-in is served from three places and
   * only one of them is a domain root. Vite's default writes
   * `src="/assets/taskpane-<hash>.js"`, which resolves to
   * `https://vedaunion.org/assets/…` when the pane is published at
   * `/siksamitra/word-extension/` — a 404, and Word reports a 404 in a task
   * pane as a blank white rectangle with no message anywhere. `./` makes every
   * reference relative to `taskpane.html`, so the same bundle works at
   * `localhost:3000`, under a GitHub Pages project path, and under any folder
   * on a shared host.
   */
  base: './',
  publicDir: join(here, 'assets'),
  /*
   * The workspace packages resolve to SOURCE, as they do for `apps/web` and
   * for the tests. A build against `dist` would need every package built first
   * and would drift from what the tests measured. The list is read from the
   * packages' own `exports` maps, so it cannot fall behind them the way the
   * hand-written copy in `apps/web` did.
   */
  resolve: { alias: workspaceAliases() },
  server: {
    port: 3000,
    strictPort: true,
    ...(devCerts() === undefined ? {} : { https: devCerts() }),
  },
  build: {
    outDir: join(here, 'dist'),
    emptyOutDir: true,
    rollupOptions: { input: join(here, 'taskpane.html') },
  },
});
