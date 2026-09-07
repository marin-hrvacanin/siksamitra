import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * Shared config for every tier. The tiers themselves are in
 * `vitest.workspace.ts`; this file holds only what they all need.
 *
 * Tests import the workspace packages BY NAME, exactly as application code
 * does, so a test can never pass against a module layout the build does not
 * produce. The aliases resolve to source rather than `dist`, so a run needs no
 * prior build.
 */

const pkg = (name: string, entry = 'src/index.ts') =>
  resolve(import.meta.dirname, 'packages', name, entry);

const alias = {
  '@siksamitra/format': pkg('format'),
  '@siksamitra/engine': pkg('engine'),
  '@siksamitra/interop': pkg('interop'),
  '@siksamitra/storage': pkg('storage'),
  '@siksamitra/layout': pkg('layout'),
  '@siksamitra/edit': pkg('edit'),
  '@siksamitra/tokens/word': pkg('tokens', 'src/word.ts'),
  '@siksamitra/tokens/document-themes': pkg('tokens', 'src/document-themes.ts'),
  '@siksamitra/tokens/document-type': pkg('tokens', 'src/document-type.ts'),
  '@siksamitra/tokens': pkg('tokens', 'generated/tokens.ts'),
  '@siksamitra/render/theme': pkg('render', 'src/theme/marks.ts'),
  '@siksamitra/render': pkg('render'),
};

export default defineConfig({
  resolve: { alias },
  /*
   * The automatic JSX runtime, so a component test can write JSX without
   * importing React. Without it the classic runtime is used and every test
   * fails with "React is not defined" — which says nothing about the test.
   */
  esbuild: { jsx: 'automatic' },
});
