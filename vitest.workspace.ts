/**
 * The test tiers, as vitest projects. See tests/README.md for what each is for
 * and what it is not allowed to do.
 *
 * Separate projects rather than one suite because the tiers need different
 * environments and different speeds: unit tests must stay fast enough to run on
 * every save, and component tests need a DOM that would slow everything else
 * down if it were loaded globally.
 */
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'unit',
      /*
       * `apps/` as well as `packages/`, and the omission mattered: the shell's
       * own logic — which groups fit in the ribbon, which host we are running
       * in, what the document's outline is — lived where the fast tier could
       * not see it, so it had no unit tests at all and three fitting bugs
       * shipped. A unit test is defined by what would make it fail, not by
       * which workspace the file happens to sit in.
       */
      include: [
        'packages/*/src/**/__tests__/**/*.test.ts?(x)',
        'apps/*/src/**/__tests__/**/*.test.ts?(x)',
      ],
      environment: 'node',
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'integration',
      include: ['tests/integration/**/*.test.ts?(x)'],
      environment: 'node',
      testTimeout: 30_000,
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'component',
      include: ['tests/component/**/*.test.ts?(x)'],
      environment: 'jsdom',
      setupFiles: ['tests/helpers/dom-setup.ts'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'security',
      include: ['tests/security/**/*.test.ts?(x)'],
      environment: 'node',
      testTimeout: 60_000,
    },
  },
]);
