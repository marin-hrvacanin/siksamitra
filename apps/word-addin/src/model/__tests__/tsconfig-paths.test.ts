/**
 * THE ADD-IN'S TSCONFIG NAMES EVERY WORKSPACE PACKAGE IT CAN REACH.
 *
 * `paths` is a copy of what `tools/workspace-alias.mjs` computes, because
 * TypeScript cannot call a script — and a missing entry passes here, where the
 * packages are built, and fails a clean checkout. It did: the Pages build died
 * on "Cannot find module '@siksamitra/ui'" the day the pane first imported it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { workspaceAliases } from '../../../../../tools/workspace-alias.mjs';

const tsconfig = JSON.parse(readFileSync(new URL('../../../tsconfig.json', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')) as { compilerOptions: { paths: Record<string, string[]> } };

describe('tsconfig paths', () => {
  it('cover every package entry point the bundler aliases (stylesheets and data aside)', () => {
    const all = workspaceAliases() as Record<string, string> | { find: string }[];
    const aliases = (Array.isArray(all) ? all.map((a) => a.find) : Object.keys(all))
      .filter((f) => !/\.(css|json)$/.test(f));
    const missing = aliases.filter((f) => tsconfig.compilerOptions.paths[f] === undefined);
    expect(missing).toEqual([]);
  });
});
