#!/usr/bin/env node
/**
 * Vendor the fonts into the repository.
 *
 * Run once, or when the manifest changes. The files it writes are COMMITTED:
 * a build must not depend on a CDN being up, and an installer has to contain
 * everything it needs. That is the difference between a program a non-technical
 * person can install and a program that works on the machine it was built on.
 *
 * It also does two things a plain download would not:
 *
 *   - **Verifies coverage before writing.** Each face's upstream unicode ranges
 *     are checked against `REQUIRED_IAST`. A text face that cannot write `ṣ` is
 *     refused rather than shipped, because the failure downstream is a silent
 *     glyph substitution that changes what a reader sees without telling them.
 *   - **Records the licences.** Shipping OFL fonts inside an installer requires
 *     the notices to travel with them, so `LICENSES.md` is generated from the
 *     manifest rather than remembered.
 *
 *   node tools/fonts/fetch.mjs            # download what is missing
 *   node tools/fonts/fetch.mjs --force    # re-download everything
 *   node tools/fonts/fetch.mjs --check    # verify, write nothing
 */

import { mkdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_SUBSETS, FAMILIES, FULL_FILES, REQUIRED_LETTERS, cdnUrl, fileName,
  fullName, fullUrl,
} from './manifest.mjs';

const OUT = 'assets/fonts';
const API = 'https://api.fontsource.org/v1/fonts';
const force = process.argv.includes('--force');
const checkOnly = process.argv.includes('--check');

/** Does a declared `unicode-range` list contain this codepoint? */
function covers(ranges, cp) {
  for (const part of ranges.replace(/U\+/g, '').split(',')) {
    const [a, b] = part.split('-');
    if (a === undefined || a === '') continue;
    const lo = parseInt(a, 16);
    const hi = b === undefined ? lo : parseInt(b, 16);
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

async function meta(id) {
  const r = await fetch(`${API}/${id}`);
  if (!r.ok) throw new Error(`${id}: metadata HTTP ${r.status}`);
  return r.json();
}

mkdirSync(OUT, { recursive: true });

let downloaded = 0;
let skipped = 0;
const problems = [];
const record = [];

for (const family of FAMILIES) {
  const info = await meta(family.id);

  if (info.license !== family.licence) {
    problems.push(`${family.id}: manifest says ${family.licence}, upstream says ${info.license}`);
  }

  const subsets = family.subsets ?? DEFAULT_SUBSETS;
  const missingSubsets = subsets.filter((s) => !info.subsets.includes(s));
  if (missingSubsets.length > 0) {
    problems.push(`${family.id}: no such subset ${missingSubsets.join(', ')}`);
    continue;
  }

  // Coverage of the LETTERS. Only a text face has to carry IAST; an Indic face
  // is judged by its own script, and demanding the retroflexes of it would
  // reject every one of them.
  //
  // The combining candrabindu is NOT checked here: it is absent from every
  // Latin subset, which is exactly why the text faces are also fetched whole
  // below. It is verified end-to-end in a browser by `verify.mjs`, which is the
  // only check that can actually see a glyph.
  if (family.role === 'text') {
    const all = subsets.map((x) => info.unicodeRange[x] ?? '').join(',');
    const gaps = Object.entries(REQUIRED_LETTERS)
      .filter(([, cp]) => !covers(all, cp))
      .map(([name]) => name);
    if (gaps.length > 0) {
      problems.push(`${family.id}: subsets cannot write ${gaps.join(' ')} — REFUSED`);
      continue;
    }
  }

  const styles = family.italics ? ['normal', 'italic'] : ['normal'];
  for (const subset of subsets) {
    for (const weight of family.weights) {
      for (const style of styles) {
        if (!info.weights.includes(weight)) {
          problems.push(`${family.id}: no weight ${weight}`);
          continue;
        }
        const name = fileName(family.id, subset, weight, style);
        const path = join(OUT, name);
        record.push({ family, subset, weight, style, name });
        if (!force && existsSync(path) && statSync(path).size > 1000) { skipped += 1; continue; }
        if (checkOnly) continue;
        const url = cdnUrl(family.id, subset, weight, style);
        const res = await fetch(url);
        if (!res.ok) {
          // An italic or a weight that does not exist for a subset is not fatal;
          // the stack simply has one fewer face and the browser synthesises.
          problems.push(`${name}: HTTP ${res.status}`);
          continue;
        }
        writeFileSync(path, new Uint8Array(await res.arrayBuffer()));
        downloaded += 1;
      }
    }
  }
}

// ── the complete text faces ────────────────────────────────────────────────
// Vendored whole so nothing this program emits can be missing. The subsets
// above are what the web app loads first; these are the guarantee behind them
// and what the desktop installer carries.
for (const [key, path] of Object.entries(FULL_FILES)) {
  const [id, variant = 'normal'] = key.split(':');
  const name = fullName(id, variant);
  const target = join(OUT, name);
  record.push({ family: { id, role: 'text' }, subset: 'full', weight: 0, style: variant, name });
  if (!force && existsSync(target) && statSync(target).size > 10_000) { skipped += 1; continue; }
  if (checkOnly) continue;
  const res = await fetch(fullUrl(path));
  if (!res.ok) { problems.push(`${name}: HTTP ${res.status}`); continue; }
  writeFileSync(target, new Uint8Array(await res.arrayBuffer()));
  downloaded += 1;
}

// ── the licence notices, generated so they cannot fall behind ──────────────
if (!checkOnly) {
  const byLicence = new Map();
  for (const f of FAMILIES) {
    if (!byLicence.has(f.licence)) byLicence.set(f.licence, []);
    byLicence.get(f.licence).push(f);
  }
  writeFileSync(join(OUT, 'LICENSES.md'), `# Bundled fonts

These files are redistributed with śikṣāmitra. Generated by
\`tools/fonts/fetch.mjs\` from \`tools/fonts/manifest.mjs\` — do not edit.

Shipping a font inside an installer is redistribution, so every family here is
under a licence that permits it, and the notice travels with the file.

${[...byLicence].map(([licence, families]) => `## ${licence}

${families.map((f) => `- **${f.name}** (\`${f.id}\`) — ${f.role}\n  ${f.why}`).join('\n')}

Full text: ${licence === 'OFL-1.1'
  ? 'https://openfontlicense.org/open-font-license-official-text/'
  : 'https://www.apache.org/licenses/LICENSE-2.0'}
`).join('\n')}
`);
}

console.log(`\n  ${downloaded} downloaded, ${skipped} already present, ` +
  `${record.length} files declared\n`);
for (const f of FAMILIES) {
  const n = record.filter((r) => r.family.id === f.id).length;
  console.log(`  ${f.role.padEnd(5)} ${f.name.padEnd(24)} ${String(n).padStart(2)} files  ${f.licence}`);
}
if (problems.length > 0) {
  console.log(`\n  ${problems.length} problem(s):`);
  for (const p of problems) console.log(`    ${p}`);
  const fatal = problems.filter((p) => p.includes('REFUSED') || p.includes('no such subset'));
  if (fatal.length > 0) process.exit(1);
}
console.log('');
