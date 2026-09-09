#!/usr/bin/env node
/**
 * Drive the spike with a real pointer and a real keyboard, and report.
 *
 * The four questions from `spike.tsx`, each answered by the browser rather than
 * by the spike's own arithmetic: what markup survived, where a click landed
 * according to LEXICAL's model, what the document says after typing, and how
 * many boxes the Devanāgarī cluster shaped into.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import puppeteer from 'puppeteer-core';

const DIR = 'tools/spike-lexical';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };

const server = createServer(async (req, res) => {
  const name = req.url === '/' ? '/index.html' : (req.url ?? '/');
  try {
    const body = await readFile(join(DIR, name.replace(/^\//, '')));
    res.writeHead(200, { 'content-type': TYPES[extname(name)] ?? 'text/plain' });
    res.end(body);
  } catch { res.writeHead(404); res.end('no'); }
});
await new Promise((r) => server.listen(5399, r));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME,
  headless: 'shell',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
await page.goto('http://localhost:5399/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.spike !== undefined, { timeout: 10000 });
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 300));

const say = (label, value) => console.log(`  ${label.padEnd(46)} ${value}`);
let bad = 0;
const check = (label, ok, detail) => {
  if (!ok) bad += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(52)} ${detail ?? ''}`);
};

console.log('\n── can Lexical drive our markup?\n');

/* 1. One element per marked run, with the text flat inside it. */
const runs0 = await page.evaluate(() => window.spike.runs());
check('a marked range is ONE run, not one box per syllable',
  runs0.length === 4 && runs0[1].text === 'navā' && runs0[1].cls.includes('hold-long'),
  runs0.map((r) => `${JSON.stringify(r.text)}`).join(' '));

/* 2. Does a click land on the right offset, according to Lexical? */
const click = await page.evaluate(() => {
  /* The sixth character of the paragraph — inside the marked run. */
  const run = document.querySelectorAll('#editor .run')[1];
  const t = run.firstChild;
  const r = document.createRange();
  r.setStart(t, 2); r.setEnd(t, 3);
  const box = r.getBoundingClientRect();
  return { x: box.left + 1, y: box.top + box.height / 2, glyph: t.data[2] };
});
await page.mouse.click(click.x, click.y);
await new Promise((r) => setTimeout(r, 150));
const sel = await page.evaluate(() => window.spike.selection());
check('a click maps to the right offset in the model',
  sel !== null && sel.offset === 2 && sel.marked,
  `clicked "${click.glyph}" in the marked run; the model says offset ${sel?.offset ?? '—'}, marked=${sel?.marked}`);

/* 3. Does typing reach the model AND come back to the DOM? */
await page.keyboard.type('XY');
await new Promise((r) => setTimeout(r, 250));
const typed = await page.evaluate(() => ({
  text: window.spike.text(),
  shown: document.querySelector('#editor').textContent,
}));
check('typing reaches the model', typed.text.startsWith('sunaXYvā'), JSON.stringify(typed.text));
check('and the model reaches the page', typed.shown.startsWith('sunaXYvā'), JSON.stringify(typed.shown));

/* 4. Applying a holding to a selection splits the runs, the way bold does. */
await page.evaluate(() => {
  const run = document.querySelectorAll('#editor .run')[0];
  const t = run.firstChild;
  const r = document.createRange();
  r.setStart(t, 0); r.setEnd(t, 2);
  const s = window.getSelection();
  s.removeAllRanges(); s.addRange(r);
});
await new Promise((r) => setTimeout(r, 120));
await page.evaluate(() => window.spike.hold('short'));
await new Promise((r) => setTimeout(r, 200));
const runs1 = await page.evaluate(() => window.spike.runs());
check('applying a holding to a selection splits the run',
  runs1.some((r) => r.text === 'su' && r.cls.includes('hold-short')),
  runs1.map((r) => `${JSON.stringify(r.text)}:${r.cls.replace('run ', '')}`).join(' '));

/* 5. Is the Devanāgarī conjunct still ONE shaped cluster inside a marked run?
 *
 * Two oracles were tried and both were useless. A `Range` over one code point
 * INSIDE a cluster does not report zero width — the browser apportions the
 * cluster's advance across it. And laying the code points out in separate
 * spans barely differs, because a lone virāma has almost no advance of its own.
 *
 * What discriminates is turning the conjunct-forming OpenType features off.
 * `akhn`, `half`, `vatu`, `cjct` and their neighbours are what join क + ् + ष
 * into one glyph; without them the same string sets as separate letters and is
 * measurably wider. Same text, same font, same size — only the shaping differs.
 */
const indic = await page.evaluate(() => {
  const run = [...document.querySelectorAll('#editor .run')].find((e) => /[ऀ-ॿ]/.test(e.textContent));
  const text = run.firstChild.data;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:inherit';
  document.body.append(probe);
  const measure = (features) => {
    const s = document.createElement('span');
    s.textContent = text;
    s.style.fontFeatureSettings = features;
    probe.append(s);
    const w = s.getBoundingClientRect().width;
    s.remove();
    return Math.round(w * 10) / 10;
  };
  const shaped = measure('normal');
  const plain = measure('"akhn" 0, "half" 0, "vatu" 0, "cjct" 0, "blwf" 0, "pstf" 0, "rphf" 0');
  probe.remove();
  return { text, shaped, plain, boxes: run.getClientRects().length };
});
say('the Devanagari run', `${JSON.stringify(indic.text)} shaped ${indic.shaped}px, conjuncts off ${indic.plain}px`);
check('the conjunct shapes into one cluster', indic.shaped < indic.plain,
  `${Math.round((1 - indic.shaped / indic.plain) * 100)}% narrower than the same text unjoined`);
check('and the marked run draws as one box', indic.boxes === 1, `${indic.boxes} client rect(s)`);

/* The favicon is not part of the question. */
const real = consoleErrors.filter((e) => !e.includes('favicon') && !e.includes('404'));
check('no errors from Lexical', real.length === 0, real[0] ?? '');

console.log(`\n  ${bad === 0 ? 'THE SPIKE ANSWERS YES' : `${bad} question(s) answered NO`}\n`);

await browser.close();
server.close();
process.exit(bad > 0 ? 1 : 0);
