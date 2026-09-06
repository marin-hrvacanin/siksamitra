#!/usr/bin/env node
/**
 * Generate the design tokens for consumers that cannot read CSS.
 *
 * The single source of truth for every colour, radius, spacing step, font stack
 * and shadow is the `@theme` block in `client/src/index.css`, plus the
 * `:root[data-theme="dark"]` block that overrides it. Tailwind reads those
 * directly. Everything else — the PDF writer, the PowerPoint renderer, any
 * Python tooling — used to re-type the values, and they drifted (see
 * specs/chant-editor/06-SINGLE-SOURCE.md §1: three different svara colours).
 *
 * So: parse the CSS, emit
 *   shared/src/theme/tokens.generated.ts   (TypeScript consumers)
 *   tools/theme-tokens.json                (Python consumers)
 * and let CI fail if running this produces a diff.
 *
 *   node scripts/gen-tokens.mjs            # write
 *   node scripts/gen-tokens.mjs --check    # exit 1 if the output would change
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSS = resolve(ROOT, 'client/src/index.css');
const OUT_TS = resolve(ROOT, 'shared/src/theme/tokens.generated.ts');
const OUT_JSON = resolve(ROOT, 'tools/theme-tokens.json');
const OUT_CSS = resolve(ROOT, 'client/src/generated/mark-geometry.css');
const check = process.argv.includes('--check');

/** Extract a brace-balanced block that starts at `selector`. */
function block(css, selector) {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`gen-tokens: could not find ${selector} in index.css`);
  const open = css.indexOf('{', start);
  if (open < 0) throw new Error(`gen-tokens: ${selector} has no body`);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`gen-tokens: unbalanced braces after ${selector}`);
}

/**
 * Custom-property declarations in a block, in source order.
 *
 * Comments are stripped first so a commented-out declaration is not read as
 * live. Values keep their `var(--…)` references verbatim: an alias is a fact
 * about the design system and flattening it here would hide it.
 */
function declarations(body) {
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = {};
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(clean)) !== null) {
    out[m[1]] = m[2].replace(/\s+/g, ' ').trim();
  }
  return out;
}

const css = readFileSync(CSS, 'utf8');
const light = declarations(block(css, '@theme'));
const dark = declarations(block(css, ':root[data-theme="dark"]'));

/** Resolve `var(--x)` chains within a theme, so non-CSS consumers get a value. */
function flatten(tokens) {
  const seen = new Map();
  const resolve1 = (name, trail = []) => {
    if (seen.has(name)) return seen.get(name);
    if (trail.includes(name)) return tokens[name] ?? '';
    const raw = tokens[name];
    if (raw === undefined) return '';
    const done = raw.replace(/var\((--[a-z0-9-]+)\)/gi, (_, ref) =>
      resolve1(ref, [...trail, name]),
    );
    seen.set(name, done);
    return done;
  };
  const out = {};
  for (const name of Object.keys(tokens)) out[name] = resolve1(name);
  return out;
}

const lightFlat = flatten(light);
// Dark is a partial override: resolve it against light so a `var()` in the dark
// block that points at a light-only alias still yields a value.
const darkFlat = flatten({ ...light, ...dark });
const darkOnly = {};
for (const k of Object.keys(dark)) darkOnly[k] = darkFlat[k];

/**
 * Mark geometry lives in `shared/src/marking/geometry.ts` (TypeScript is the
 * source, because TS consumers are the many and Python is the one). Lift it out
 * for Python rather than letting `vupptx.py` keep its own copies of 0.94 / 0.22
 * / 0.032 / 0.075 / 0.668 — the drift recorded in 06-SINGLE-SOURCE §1.
 *
 * The extraction is deliberately strict: our own file, a known shape, comments
 * stripped, keys quoted, then `JSON.parse`. Anything unexpected throws rather
 * than silently emitting a wrong number.
 */
function markGeometry() {
  const src = readFileSync(resolve(ROOT, 'shared/src/marking/geometry.ts'), 'utf8');
  const start = src.indexOf('export const MARK_GEOMETRY = {');
  if (start < 0) throw new Error('gen-tokens: MARK_GEOMETRY not found');
  const open = src.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error('gen-tokens: MARK_GEOMETRY is unbalanced');
  const literal = src
    .slice(open, end + 1)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'([^']*)'/g, '"$1"')
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
    .replace(/,(\s*[}\]])/g, '$1');
  try {
    return JSON.parse(literal);
  } catch (e) {
    throw new Error(`gen-tokens: could not parse MARK_GEOMETRY — ${e.message}`);
  }
}

const geometry = markGeometry();

const payload = {
  generated: 'scripts/gen-tokens.mjs',
  source: 'client/src/index.css + shared/src/marking/geometry.ts',
  light: lightFlat,
  dark: darkOnly,
  markGeometry: geometry,
};

const HEADER = `/**
 * GENERATED — do not edit. Run: npm run gen:tokens
 *
 * Source of truth: the \`@theme\` block in client/src/index.css, plus the
 * \`:root[data-theme="dark"]\` overrides. See
 * specs/chant-editor/06-SINGLE-SOURCE.md §3.1.
 *
 * \`var(--…)\` references are resolved here so non-CSS consumers (the PDF
 * writer, PowerPoint, Python tooling) get concrete values. In CSS and TSX,
 * always use \`var(--token)\` directly — never import these.
 */`;

const ts = `${HEADER}

export const DESIGN_TOKENS = ${JSON.stringify({ light: lightFlat, dark: darkOnly }, null, 2)} as const;

export type DesignTokenName = keyof typeof DESIGN_TOKENS.light;

/** A token's value in a theme, falling back to light when dark omits it. */
export function token(name: string, theme: 'light' | 'dark' = 'light'): string {
  const d = DESIGN_TOKENS.dark as Record<string, string>;
  const l = DESIGN_TOKENS.light as Record<string, string>;
  if (theme === 'dark' && d[name] !== undefined) return d[name] as string;
  return (l[name] ?? '') as string;
}
`;

const json = `${JSON.stringify(payload, null, 2)}\n`;

/**
 * The same geometry as CSS custom properties, so `chant.css` reads the values
 * instead of re-typing them. This is the third consumer of one source: TS
 * imports `geometry.ts`, Python reads the JSON, CSS reads this file.
 *
 * Stroke weights carry the px floor via `max()`, which fixes the shipped
 * defect: `1px` / `1.7px` collapse to one hairline at `--fs: 1.8`, erasing the
 * only cue that distinguishes a short from a long stop (MARKING-RULES §2.4).
 */
function geometryCss(g) {
  const em = (n) => `${n}em`;
  const stroke = (k) => `max(${g.holdStroke.minPx}px, ${g.holdStroke[k]}em)`;
  return `/* GENERATED — do not edit. Run: npm run gen:tokens
 * Source: shared/src/marking/geometry.ts
 * See specs/chant-editor/06-SINGLE-SOURCE.md §3.2. */
:root {
  --mark-hold-pad: ${em(g.holdPad.top)} ${em(g.holdPad.x)} ${em(g.holdPad.bottom)};
  --mark-hold-margin: 0 ${em(g.holdMargin)};
  --mark-hold-stroke-short: ${stroke('short')};
  --mark-hold-stroke-long: ${stroke('long')};
  --mark-hold-radius: ${g.holdRadius};
  --mark-svara-width: ${g.svaraStroke.widthPx}px;
  --mark-svara-height: ${em(g.svaraStroke.height)};
  --mark-svara-top: ${em(g.svaraStroke.top)};
  --mark-svara-radius: ${g.svaraStroke.radiusPx}px;
  --mark-svara-dirgha-sep: ${g.svaraStroke.dirghaSepPx}px;
  --mark-anudatta-thickness: ${em(g.anudattaRule.thickness)};
  --mark-anudatta-drop: ${em(g.anudattaRule.drop)};
  --mark-sbhakti-r: ${em(g.sbhaktiDot.r)};
  --mark-sbhakti-gap: ${em(g.sbhaktiDot.gap)};
}
`;
}

/**
 * Line endings are not a value.
 *
 * The generator writes LF, git on Windows checks out CRLF (`core.autocrlf`),
 * and a byte comparison then reports every generated file as out of date on a
 * fresh clone - a gate that cries wolf is a gate people learn to skip. What
 * this checks is the TOKENS; `.gitattributes` pins the files to LF so the
 * bytes agree too, and this makes the check honest either way.
 */
const CRLF = /\r\n/g;
const sameContent = (a, b) => a.replace(CRLF, '\n') === b.replace(CRLF, '\n');

function emit(path, next) {
  let prev = null;
  try {
    prev = readFileSync(path, 'utf8');
  } catch {
    /* first run */
  }
  if (prev !== null && sameContent(prev, next)) return false;
  if (prev === next) return false;
  if (check) {
    console.error(`gen-tokens: ${path} is out of date. Run: npm run gen:tokens`);
    process.exitCode = 1;
    return true;
  }
  writeFileSync(path, next, 'utf8');
  return true;
}

const a = emit(OUT_TS, ts);
const b = emit(OUT_JSON, json);
const c = emit(OUT_CSS, geometryCss(geometry));
const n = Object.keys(lightFlat).length;
const nd = Object.keys(darkOnly).length;
if (check && !process.exitCode) console.log(`gen-tokens: up to date (${n} tokens, ${nd} dark overrides)`);
else if (!check) console.log(`gen-tokens: ${n} tokens, ${nd} dark overrides${a || b || c ? ' — written' : ' — unchanged'}`);
