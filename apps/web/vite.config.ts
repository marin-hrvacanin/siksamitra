import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * The web app.
 *
 * Workspace packages resolve to SOURCE, not `dist`, so `npm run dev` needs no
 * build step and a change in the engine is on screen immediately. The published
 * build resolves the same names through the packages' own `exports`.
 */
const pkg = (name: string, entry = 'src/index.ts') =>
  resolve(import.meta.dirname, '../../packages', name, entry);

export default defineConfig({
  plugins: [react()],
  resolve: {
    // ORDER MATTERS. Vite matches aliases as an ordered list, so the CSS
    // subpaths must come before the bare package names — otherwise
    // `@siksamitra/render/chant.css` resolves against the alias for
    // `@siksamitra/render` and looks for a stylesheet inside a .ts file.
    alias: {
      '@siksamitra/tokens/tokens.css': pkg('tokens', 'generated/tokens.css'),
      '@siksamitra/render/mark-geometry.css': pkg('render', 'src/generated/mark-geometry.css'),
      '@siksamitra/render/chant.css': pkg('render', 'src/chant.css'),
      '@siksamitra/render/print.css': pkg('render', 'src/print.css'),
      '@siksamitra/format': pkg('format'),
      '@siksamitra/engine': pkg('engine'),
      '@siksamitra/interop': pkg('interop'),
      '@siksamitra/storage': pkg('storage'),
      '@siksamitra/layout': pkg('layout'),
      '@siksamitra/tokens': pkg('tokens', 'generated/tokens.ts'),
      '@siksamitra/render/theme': pkg('render', 'src/theme/marks.ts'),
      '@siksamitra/render': pkg('render'),
    },
  },
  server: { port: 5273, strictPort: false },
  // The corpus is served as-is so the app can open a real document in dev.
  publicDir: resolve(import.meta.dirname, 'public'),
});
