import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * Tests import the workspace packages by NAME, exactly as application code
 * does, so a test can never pass against a source layout the build does not
 * produce. The aliases point at source rather than `dist` so a run needs no
 * prior build.
 */
const pkg = (name: string, entry = 'src/index.ts') =>
  resolve(import.meta.dirname, 'packages', name, entry);

export default defineConfig({
  resolve: {
    alias: {
      '@siksamitra/format': pkg('format'),
      '@siksamitra/engine': pkg('engine'),
      '@siksamitra/interop': pkg('interop'),
      '@siksamitra/render/theme': pkg('render', 'src/theme/marks.ts'),
      '@siksamitra/render': pkg('render'),
    },
  },
  test: {
    include: ['packages/**/__tests__/**/*.test.ts', 'packages/**/*.test.ts'],
    environment: 'node',
  },
});
