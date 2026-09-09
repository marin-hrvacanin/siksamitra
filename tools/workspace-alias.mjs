/**
 * THE WORKSPACE PACKAGES, RESOLVED TO SOURCE — derived, not retyped.
 *
 * Both apps resolve `@siksamitra/*` to `src` rather than `dist`, so `npm run
 * dev` needs no build step and a change in the engine is on screen at once.
 * Each app used to spell that out as a hand-written alias list, and the two
 * lists were copies of each other AND of the thing they were describing: every
 * package's own `exports` map already says which subpaths exist and where they
 * are. Three statements of one fact, so they drifted — the web app's list was
 * missing `@siksamitra/tokens/source`, which the add-in's had.
 *
 * WHAT THAT COST. A missing subpath does not fail loudly. The catch-all
 * `'@siksamitra/tokens'` alias matched it as a prefix and produced
 *
 *     packages/tokens/generated/tokens.ts/source
 *
 * — a path inside a file — so `vite build` died while `tsc` passed, because
 * TypeScript reads the `exports` map and the bundler was reading the copy.
 * The web bundle could not be built at all, and every browser gate went on
 * testing the last bundle that had built, hours earlier.
 *
 * So the map is the source of truth and this reads it. A subpath added to a
 * package is aliased in both apps with nothing else to edit, and one that is
 * absent cannot be silently swallowed by a shorter alias.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PACKAGES = resolve(import.meta.dirname, '../packages');

/**
 * Where an `exports` entry's source is.
 *
 * `development` is the condition the packages already carry for exactly this —
 * it points at `src` while `import` points at `dist`. A plain string entry
 * (the CSS files, and everything tokens exports) is the path itself.
 */
function sourceOf(entry) {
  if (typeof entry === 'string') return entry;
  if (entry === null || typeof entry !== 'object') return undefined;
  return entry.development ?? entry.import ?? entry.default;
}

/**
 * Every workspace package's exported subpaths, as vite aliases.
 *
 * SORTED LONGEST FIRST, because vite matches an alias as a prefix: with
 * `@siksamitra/render` ahead of `@siksamitra/render/chant.css`, a stylesheet
 * resolves to a path inside a `.ts` file. The old lists carried a comment
 * warning the reader to keep the order by hand. Sorting is the same rule,
 * enforced rather than remembered.
 */
export function workspaceAliases() {
  const alias = {};
  for (const dir of readdirSync(PACKAGES)) {
    const manifest = join(PACKAGES, dir, 'package.json');
    if (!existsSync(manifest)) continue;
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
    if (pkg.exports === undefined) continue;
    for (const [subpath, entry] of Object.entries(pkg.exports)) {
      const target = sourceOf(entry);
      if (target === undefined) continue;
      const file = resolve(PACKAGES, dir, target);
      /* A package that exports something it does not ship would otherwise
         alias to a path that is not there, which fails later and further
         away than here. */
      if (!existsSync(file)) continue;
      alias[subpath === '.' ? pkg.name : `${pkg.name}/${subpath.slice(2)}`] = file;
    }
  }
  return Object.fromEntries(
    Object.entries(alias).sort(([a], [b]) => b.length - a.length),
  );
}
