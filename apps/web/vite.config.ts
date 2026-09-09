import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { corpus } from './vite-corpus.js';
import { resolve } from 'node:path';
import { workspaceAliases } from '../../tools/workspace-alias.mjs';

/**
 * The web app.
 *
 * Workspace packages resolve to SOURCE, not `dist`, so `npm run dev` needs no
 * build step and a change in the engine is on screen immediately. Which
 * subpaths exist and where they are is read from the packages' own `exports`
 * maps by `tools/workspace-alias.mjs` — this file used to retype that list,
 * fell one entry behind, and the bundle stopped building while `tsc` passed.
 */

export default defineConfig({
  plugins: [react(), corpus()],
  resolve: { alias: workspaceAliases() },
  server: { port: 5273, strictPort: false },
  // The fonts and the icon live here. The CORPUS does not — it is served from
  // `corpus/chants` by the plugin above, because a copy of it drifted.
  publicDir: resolve(import.meta.dirname, 'public'),
});
