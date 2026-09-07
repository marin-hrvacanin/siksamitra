#!/usr/bin/env node
/**
 * The token gate — nothing hardcoded, enforced.
 *
 * Scans the source for literal design values: colours, font families, and px /
 * rem sizes. Every one of them belongs in `packages/tokens/src/source.ts`, and
 * a component that carries its own is a value that will drift from the twenty
 * other places it also appears. v1 ended with a 169 KB stylesheet in exactly
 * that state.
 *
 * It is a RATCHET, not a wall. The stylesheet inherited from the platform
 * carries hundreds of literals, and failing the build on all of them today
 * would mean either a week of migration before anything else moves, or the gate
 * being switched off — which is how gates die. So the count per file is
 * recorded, and it may only go DOWN.
 *
 *   node tools/check-tokens.mjs           # check against the baseline
 *   node tools/check-tokens.mjs --write   # record a new baseline (must not rise)
 *   node tools/check-tokens.mjs --list    # show the offenders in a file
 *
 * An unavoidable literal is exempted in place, with its reason:
 *
 *   border: 1px solid var(--color-rule);  // token-exempt: hairline, not a scale step
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const BASELINE = 'tools/token-baseline.json';

/** Where design values are ALLOWED to be literal, because this is their home. */
const HOME = ['packages/tokens/'];
/** Generated output is the token source's own work; scanning it is circular. */
const GENERATED = [
  '/generated/', '.generated.', 'node_modules', '/dist/',
  // Vendored font stylesheets: 642 machine-written @font-face rules whose
  // literals are the font pipeline's business, not a design decision.
  '/public/fonts/', '/assets/fonts/',
];

const NAMED_COLOURS = [
  'white', 'black', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
  'gray', 'grey', 'silver', 'maroon', 'olive', 'lime', 'teal', 'navy',
  'fuchsia', 'aqua', 'crimson', 'gold', 'ivory', 'beige', 'tan', 'brown',
];

const RULES = [
  { id: 'hex-colour', re: /#[0-9a-fA-F]{3,8}\b/g,
    why: 'a literal colour' },
  {
    id: 'colour-fn',
    re: /\b(?:rgba?|hsla?|oklch|color-mix)\s*\(/g,
    why: 'a computed literal colour',
    /*
     * A colour function whose arguments are all tokens is not a literal: it is
     * DERIVED from the theme and follows it when the theme changes.
     * `color-mix(in srgb, var(--chrome-accent) 22%, transparent)` is the
     * selection wash; `rgba(0, 0, 0, .2)` is a decision made once in a
     * stylesheet. The test is whether a channel is written down here.
     */
    unless: (line) => line.includes('var(--')
      && !/#[0-9a-fA-F]{3,8}|\d{1,3}\s*,\s*\d{1,3}/.test(line),
  },
  {
    id: 'named-colour',
    re: new RegExp(`(?<![\\w-])(?:${NAMED_COLOURS.join('|')})(?![\\w-])`, 'g'),
    why: 'a named CSS colour',
    /*
     * CSS only. In a .ts file a bare `tan` is far likelier to be Sanskrit than
     * a colour — `tan no rudra` is a real line of the Taittirīya, and it was
     * flagged. Every genuine colour literal in code is still caught by the hex
     * and colour-function rules.
     */
    cssOnly: true,
  },
  {
    id: 'font-family',
    /*
     * The value must contain a `var()`. Written as a lookahead over the whole
     * declaration, because `\s*(?!var\()` BACKTRACKS: `\s*` matches nothing,
     * the lookahead then sees a space rather than `var(`, and it reports a
     * false positive — which it did, twice, in files that were doing the right
     * thing, and both were sitting inside the baseline as if they were debts.
     */
    re: /font-family\s*:(?![^;{}]*var\()/g,
    why: 'a font family that is not a role token',
  },
  { id: 'px', re: /(?<![\w.-])\d*\.?\d+px\b/g,
    why: 'a pixel size' },
  { id: 'rem', re: /(?<![\w.-])\d*\.?\d+rem\b/g,
    why: 'a rem size' },
];

const EXEMPT = /token-exempt\s*:/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (GENERATED.some((g) => path.replace(/\\/g, '/').includes(g))) continue;
    const st = statSync(path);
    if (st.isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|css)$/.test(entry)) out.push(path);
  }
  return out;
}

function scan(file) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (HOME.some((h) => rel.startsWith(h))) return null;
  const lines = readFileSync(file, 'utf8').split('\n');
  const hits = [];
  let inBlockComment = false;
  for (const [i, raw] of lines.entries()) {
    const line = raw;
    // Comments describe values; they do not set them.
    const trimmed = line.trim();
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('/*')) { if (!trimmed.includes('*/')) inBlockComment = true; continue; }
    if (trimmed.startsWith('*') || trimmed.startsWith('//')) continue;
    if (EXEMPT.test(line)) continue;
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    for (const rule of RULES) {
      if (rule.cssOnly === true && !rel.endsWith('.css')) continue;
      if (rule.unless?.(code) === true) continue;
      rule.re.lastIndex = 0;
      for (const m of code.matchAll(rule.re)) {
        hits.push({ line: i + 1, rule: rule.id, why: rule.why, text: m[0], src: trimmed.slice(0, 100) });
      }
    }
  }
  return { file: rel, hits };
}

/*
 * THE APP IS SCANNED TOO. It was not, for a while, and that was the gate's
 * blind spot: nearly every stylesheet in the program lives in `apps/web/src`,
 * so a gate that only walked `packages/` was checking the wrong tree for
 * exactly the rule the owner asked to be enforced.
 */
const files = ['packages', 'apps'].flatMap((d) => walk(join(ROOT, d)))
  .map(scan)
  .filter((r) => r !== null && r.hits.length > 0)
  .sort((a, b) => b.hits.length - a.hits.length);

const counts = Object.fromEntries(files.map((f) => [f.file, f.hits.length]));
const total = Object.values(counts).reduce((a, b) => a + b, 0);

if (process.argv.includes('--list')) {
  const want = process.argv[process.argv.indexOf('--list') + 1];
  for (const f of files) {
    if (want !== undefined && !f.file.includes(want)) continue;
    console.log(`\n${f.file}  (${f.hits.length})`);
    for (const h of f.hits.slice(0, 40)) {
      console.log(`  ${String(h.line).padStart(5)}  ${h.rule.padEnd(13)} ${h.text.padEnd(12)} ${h.src}`);
    }
  }
  process.exit(0);
}

if (process.argv.includes('--write')) {
  const prev = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { files: {} };
  const risen = Object.entries(counts).filter(([f, n]) => (prev.files[f] ?? Infinity) < n);
  if (risen.length > 0 && !process.argv.includes('--force')) {
    console.error('\nrefusing to raise the baseline:');
    for (const [f, n] of risen) console.error(`  ${f}: ${prev.files[f]} -> ${n}`);
    console.error('\nThe point of a ratchet is that it does not go backwards.\n');
    process.exit(1);
  }
  writeFileSync(BASELINE, JSON.stringify({
    note: 'Literal design values still to be moved into packages/tokens. This may only go DOWN. See tools/check-tokens.mjs.',
    total, files: counts,
  }, null, 2) + '\n');
  console.log(`\n  baseline recorded: ${total} literals across ${files.length} files\n`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(`no baseline — run: node tools/check-tokens.mjs --write`);
  process.exit(2);
}
const base = JSON.parse(readFileSync(BASELINE, 'utf8'));

let failed = 0;
console.log(`\n── literal design values (baseline ${base.total})\n`);
for (const [file, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  const was = base.files[file];
  if (was === undefined) {
    console.log(`  NEW  ${file.padEnd(52)} ${n}`);
    failed += 1;
  } else if (n > was) {
    console.log(`  UP   ${file.padEnd(52)} ${was} -> ${n}`);
    failed += 1;
  } else if (n < was) {
    console.log(`  down ${file.padEnd(52)} ${was} -> ${n}`);
  } else {
    console.log(`  ok   ${file.padEnd(52)} ${n}`);
  }
}
console.log(`\n     ${total} literals, baseline ${base.total}` +
  `${total < base.total ? `  (${base.total - total} removed)` : ''}`);

if (failed > 0) {
  console.log(`\n${failed} file(s) gained literal design values. Put them in ` +
    `packages/tokens/src/source.ts, or exempt one in place with a reason:\n` +
    `  // token-exempt: <why this cannot be a token>\n`);
  process.exit(1);
}
console.log('\nTOKEN GATE PASSES\n');
