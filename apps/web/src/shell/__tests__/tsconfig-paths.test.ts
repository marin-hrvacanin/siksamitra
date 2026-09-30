/**
 * EVERY WORKSPACE PACKAGE THE APP IMPORTS BY ITS BARE NAME IS IN `paths`.
 *
 * A package with no `dist` resolves here only through `paths`, and a checkout
 * that has built its packages hides a missing entry — so it passed on this
 * machine and failed every clean one. It did: CI's typecheck died on "Cannot
 * find module '@siksamitra/ui'" in 28 files, the same fault the add-in had
 * the day before.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const web = new URL('../../../', import.meta.url);
const tsconfig = JSON.parse(readFileSync(new URL('tsconfig.json', web), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')) as { compilerOptions: { paths: Record<string, string[]> } };

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe('tsconfig paths', () => {
  it('name every workspace package the source imports by its bare name', () => {
    const imported = new Set<string>();
    for (const f of sources(new URL('src', web).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
      for (const m of readFileSync(f, 'utf8').matchAll(/from '(@siksamitra\/[a-z-]+)'/g)) {
        imported.add(m[1]!);
      }
    }
    expect(imported.size).toBeGreaterThan(5);
    const missing = [...imported].filter((p) => tsconfig.compilerOptions.paths[p] === undefined);
    expect(missing).toEqual([]);
  });
});
