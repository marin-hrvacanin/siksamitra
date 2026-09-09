#!/usr/bin/env node
/**
 * Verify the vendored fonts in a REAL browser.
 *
 * The only check that can see a glyph. Declared unicode ranges are metadata and
 * can be wrong; a file can be truncated; a `@font-face` can point at a path
 * that does not exist — and in every one of those cases the browser moves
 * quietly to the next face in the stack and renders the text in something else.
 * None of it is visible to a script that only reads the manifest.
 *
 * TWO MISTAKES THIS CHECK MADE BEFORE IT WORKED, both worth keeping written
 * down because both produced a confident wrong answer:
 *
 *   1. `setContent` gives the page no real origin, so the `file://` stylesheet
 *      was refused and NOTHING loaded. It then reported the one family that
 *      happens to be installed on this machine as passing 21/21 — a green tick
 *      for a file it had never read. A coverage gate satisfiable by a system
 *      font is worse than no gate.
 *   2. Fonts load lazily. Setting `style.font` and measuring in the same tick
 *      measures the fallback, so every face failed. The load has to be awaited
 *      per family, with text that actually contains the codepoints, or the
 *      right `unicode-range` slice is never fetched.
 *
 *   CHROME=<path to chrome/edge> node tools/fonts/verify.mjs
 */

import puppeteer from 'puppeteer-core';
import { browserPath } from '../_browser.mjs';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { unlinkSync, writeFileSync } from 'node:fs';
import {
  FAMILIES, REQUIRED_COMBINING, REQUIRED_LETTERS, TEXT_FALLBACK, textStack,
} from './manifest.mjs';


const need = { ...REQUIRED_LETTERS, ...REQUIRED_COMBINING };
const textFamilies = FAMILIES.filter((f) => f.role === 'text').map((f) => f.name);
const stacks = { __fallback: TEXT_FALLBACK };
for (const name of textFamilies) stacks[name] = textStack(name);

/* Written next to the fonts and navigated to, so the relative stylesheet loads
   over a real file:// origin. */
const probeFile = join('assets/fonts', '.verify-probe.html');
writeFileSync(probeFile, `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="./fonts.css">
<body><span id="p"></span></body>`);

const browser = await puppeteer.launch({
  executablePath: browserPath(), headless: 'shell', args: ['--no-sandbox'],
});
const page = await browser.newPage();
const missingFiles = [];
page.on('requestfailed', (r) => missingFiles.push(r.url().split('/').pop()));
page.on('response', (r) => {
  if (r.status() >= 400) missingFiles.push(`${r.status()} ${r.url().split('/').pop()}`);
});

await page.goto(pathToFileURL(resolve(probeFile)).href, { waitUntil: 'load' });

const declared = await page.evaluate(() => document.fonts.size);
if (declared === 0) {
  console.error('no @font-face rules reached the page — did gen-css.mjs run?');
  await browser.close();
  unlinkSync(probeFile);
  process.exit(2);
}

const results = await page.evaluate(async (families, chars, stacks) => {
  const probe = document.getElementById('p');
  const out = {};
  const all = Object.values(chars).map((cp) => String.fromCodePoint(cp)).join('');

  const measure = (text, font) => {
    probe.style.font = `40px ${font}`;
    probe.textContent = text;
    return probe.getBoundingClientRect().width;
  };

  for (const family of families) {
    // Await the load, with text containing every codepoint under test, so the
    // ranged faces that carry them are actually fetched.
    try {
      await document.fonts.load(`40px '${family}'`, `abcABC${all}`);
      // The backstop too, or a mark it is meant to supply is never fetched.
      await document.fonts.load(`40px '${stacks.__fallback}'`, `abcABC${all}`);
    } catch { /* surfaced below by the measurements */ }

    out[family] = {};
    for (const [label, cp] of Object.entries(chars)) {
      const ch = String.fromCodePoint(cp);
      // A combining mark has no advance of its own, so it is measured on a base
      // letter: a face that lacks it renders a dotted circle or nothing, and
      // the width differs from a face that has it.
      const combining = cp >= 0x0300 && cp <= 0x036f;
      const text = combining ? `n${ch}` : ch;
      out[family][label] = {
        // The face alone, for information.
        alone: Math.round(measure(text, `'${family}', monospace`) * 100) / 100,
        // The STACK the program actually uses. This is what must cover
        // everything; a face may lean on the backstop for a combining mark.
        stack: Math.round(measure(text, `${stacks[family]}, monospace`) * 100) / 100,
        bare: Math.round(measure(text, 'monospace') * 100) / 100,
      };
    }
  }
  return out;
}, textFamilies, need, stacks);

const loaded = await page.evaluate(
  () => [...document.fonts].filter((f) => f.status === 'loaded').length,
);

await browser.close();
unlinkSync(probeFile);

let bad = 0;
console.log('\n── glyph coverage, measured in a browser\n');
for (const [family, chars] of Object.entries(results)) {
  // The STACK must cover everything. A gap the backstop fills is reported, not
  // failed — that is what the backstop is for.
  const missing = Object.entries(chars)
    .filter(([, m]) => m.stack === m.bare)
    .map(([label]) => label);
  const borrowed = Object.entries(chars)
    .filter(([, m]) => m.alone === m.bare && m.stack !== m.bare)
    .map(([label]) => label);
  const ok = missing.length === 0;
  if (!ok) bad += 1;
  const total = Object.keys(chars).length;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${family.padEnd(22)} `
    + `${total - missing.length}/${total}`
    + `${borrowed.length > 0 ? `   (${borrowed.join(' ')} from ${TEXT_FALLBACK})` : ''}`
    + `${ok ? '' : `   MISSING: ${missing.join(' ')}`}`);
}

console.log(`\n     ${declared} faces declared, ${loaded} loaded for the probe`);
if (missingFiles.length > 0) {
  console.log(`\n     ${missingFiles.length} file(s) failed to fetch:`);
  for (const f of [...new Set(missingFiles)].slice(0, 10)) console.log(`       ${f}`);
}

if (bad > 0) {
  console.log(`\n${bad} face(s) cannot write something this program emits.\n`);
  process.exit(1);
}
console.log('\nFONT COVERAGE PASSES\n');
