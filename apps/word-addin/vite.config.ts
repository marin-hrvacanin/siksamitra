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

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..', '..');
const pkg = (name: string, entry = 'src/index.ts'): string =>
  join(root, 'packages', name, entry);

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
  publicDir: join(here, 'assets'),
  /*
   * The workspace packages resolve to SOURCE, as they do for `apps/web` and for
   * the tests. A build against `dist` would need every package built first and
   * would drift from what the tests measured.
   */
  resolve: {
    alias: {
      '@siksamitra/tokens/export-styles': pkg('tokens', 'src/export-styles.ts'),
      '@siksamitra/tokens/document-themes': pkg('tokens', 'src/document-themes.ts'),
      '@siksamitra/tokens/document-type': pkg('tokens', 'src/document-type.ts'),
      '@siksamitra/tokens/source': pkg('tokens', 'src/source.ts'),
      '@siksamitra/tokens/fonts': pkg('tokens', 'src/fonts.ts'),
      '@siksamitra/tokens/word': pkg('tokens', 'src/word.ts'),
      '@siksamitra/tokens/tokens.css': pkg('tokens', 'generated/tokens.css'),
      '@siksamitra/tokens': pkg('tokens', 'generated/tokens.ts'),
      '@siksamitra/format': pkg('format'),
      '@siksamitra/engine': pkg('engine'),
      '@siksamitra/layout': pkg('layout'),
      '@siksamitra/interop': pkg('interop'),
    },
  },
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
