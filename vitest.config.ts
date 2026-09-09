import { defineConfig } from 'vitest/config';
import { workspaceAliases } from './tools/workspace-alias.mjs';

/**
 * Shared config for every tier. The tiers themselves are in
 * `vitest.workspace.ts`; this file holds only what they all need.
 *
 * Tests import the workspace packages BY NAME, exactly as application code
 * does, so a test can never pass against a module layout the build does not
 * produce. The aliases resolve to source rather than `dist`, so a run needs no
 * prior build.
 */

/*
 * DERIVED FROM THE PACKAGES' OWN `exports` MAPS, not retyped.
 *
 * This was a fourth hand-written copy of a list the packages already publish,
 * and it drifted the moment a new subpath appeared: adding
 * `@siksamitra/tokens/figure` made nine test suites fail to load with "Cannot
 * find module", which says nothing at all about the tests. `tools/
 * workspace-alias.mjs` reads the maps and sorts longest-key-first, and the two
 * vite configs already use it — see its header for what the drift cost last
 * time.
 */
const alias = workspaceAliases();

export default defineConfig({
  resolve: { alias },
  /*
   * The automatic JSX runtime, so a component test can write JSX without
   * importing React. Without it the classic runtime is used and every test
   * fails with "React is not defined" — which says nothing about the test.
   */
  esbuild: { jsx: 'automatic' },
});
