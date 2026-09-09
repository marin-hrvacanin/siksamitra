/**
 * The stylesheets an exported page carries, in the app's own cascade order.
 *
 * THE ORDER IS READ, NOT RETYPED. `main.tsx` imports four sheets and then
 * `app.css`, which `@import`s twelve more, and that order is load-bearing —
 * `document.css` has to come after `chant.css` or the inherited platform sheet
 * wins and a mantra is set at 19.44 pt instead of 16. A second copy of that
 * list here would be a second thing to keep in step, and the first time it
 * drifted the export would look almost right, which is the worst way to be
 * wrong. So this walks the app's own two files and takes the order from them.
 *
 * A specifier this cannot resolve THROWS. That is the point: if someone adds a
 * stylesheet to the app under a name this does not understand, the export fails
 * loudly rather than quietly shipping a page missing a rule.
 *
 * The window does the same walk over `document.styleSheets` — the same sheets,
 * because `main.tsx` is where both lists come from.
 */
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

/** The app's entry point, whose CSS imports are the top of the cascade. */
const ENTRY = join(ROOT, 'apps/web/src/main.tsx');

/**
 * Turn a specifier into a path.
 *
 * A package subpath goes through that package's OWN `exports` map, so
 * `@siksamitra/render/chant.css` lands wherever the render package says it
 * lands. Reading the map rather than guessing the path is what keeps this from
 * becoming the hand-maintained alias table `vite.config.ts` already has to be.
 */
function resolveCss(spec, from) {
  if (spec.startsWith('.')) return resolve(dirname(from), spec);

  const parts = spec.split('/');
  const pkg = spec.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
  const sub = `./${spec.slice(pkg.length + 1)}`;
  const scope = pkg.startsWith('@siksamitra/') ? pkg.slice('@siksamitra/'.length) : null;
  if (scope === null) throw new Error(`cannot resolve stylesheet "${spec}" from ${from}`);

  const manifest = JSON.parse(readFileSync(join(ROOT, 'packages', scope, 'package.json'), 'utf8'));
  const target = manifest.exports?.[sub];
  if (typeof target !== 'string') {
    throw new Error(
      `"${pkg}" does not export "${sub}" — add it to packages/${scope}/package.json`,
    );
  }
  return join(ROOT, 'packages', scope, target);
}

const CSS_IMPORT = /^\s*import\s+['"]([^'"]+\.css)['"]\s*;?\s*$/gm;
const CSS_AT_IMPORT = /^\s*@import\s+['"]([^'"]+)['"]\s*;?\s*$/gm;

/** One stylesheet and everything it `@import`s, flattened depth-first. */
function readSheet(path, seen) {
  const real = isAbsolute(path) ? path : join(ROOT, path);
  if (seen.has(real)) return '';
  seen.add(real);

  const text = readFileSync(real, 'utf8');
  const before = [];
  for (const m of text.matchAll(CSS_AT_IMPORT)) {
    before.push(readSheet(resolveCss(m[1], real), seen));
  }
  /*
   * The `@import` lines are removed rather than left in place: an `@import`
   * pointing at a relative path is a network request the moment this file is
   * opened from somewhere else, and "no network" is the whole promise.
   */
  const body = text.replace(CSS_AT_IMPORT, '');
  return `${before.join('\n')}\n/* ${real.slice(ROOT.length + 1).replace(/\\/g, '/')} */\n${body}`;
}

/** Every rule the app applies, plus the export frames, as one string. */
export function appCss() {
  const entry = readFileSync(ENTRY, 'utf8');
  const specs = [...entry.matchAll(CSS_IMPORT)].map((m) => m[1]);
  if (specs.length === 0) {
    throw new Error(`no CSS imports found in ${ENTRY} — the app's entry has changed shape`);
  }
  const seen = new Set();
  const sheets = specs.map((s) => readSheet(resolveCss(s, ENTRY), seen));
  return sheets.join('\n');
}
