#!/usr/bin/env node
/**
 * WHAT IS THE 6.41 MB, AND WHAT WOULD THE NEW SHAPE COST?
 *
 * The owner's objection to the corpus size is the right one — a .docx holds far
 * more and is far smaller — and a format decision made on arithmetic is a
 * format decision made on a guess. So this builds the proposed shape out of the
 * real corpus and weighs it, four ways, against what is on disk today.
 *
 * It is a study, not a gate: it converts approximately (the real migration
 * verifies each verse by re-rendering) and reports.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { join } from 'node:path';
import { openChantDoc } from '../packages/engine/src/open-doc.ts';

const DIR = 'corpus/chants';

/** Where the bytes go today. */
function breakdown(doc) {
  const b = { scriptForms: 0, letters: 0, marks: 0, structure: 0, other: 0 };
  const walk = (ts) => {
    for (const t of ts) {
      if (t.t === 'syl') {
        /* The four written forms, stored per syllable. */
        b.scriptForms += JSON.stringify({
          iast: t.iast, deva: t.deva, ...(t.tel ? { tel: t.tel } : {}), ...(t.tam ? { tam: t.tam } : {}),
        }).length;
        for (const u of t.units) {
          b.letters += JSON.stringify({ c: u.c }).length;
          const { c: _c, ...rest } = u;
          if (Object.keys(rest).length > 0) b.marks += JSON.stringify(rest).length;
        }
        b.structure += 14; // {"t":"syl","units":[]}
      } else if (t.t === 'slot') { walk(t.tokens); b.structure += 20; } else {
        b.structure += JSON.stringify(t).length;
      }
    }
  };
  for (const s of doc.sections) for (const v of (s.items ?? s.verses)) if (v.tokens) walk(v.tokens);
  return b;
}

/** The guess table `invert.ts` uses, so the study matches the real migration. */
const NASALS = new Set(['ṅ', 'ñ', 'ṇ', 'n', 'm']);
const SIBILANTS = new Set(['ś', 'ṣ', 's', 'r']);
const original = (u) => (u.change !== true ? u.c
  : NASALS.has(u.c) ? 'ṁ' : SIBILANTS.has(u.c) ? 'ḥ' : u.c);

/** tokens -> { text, marks } for one verse, approximately. */
function convert(verse) {
  let text = '';
  const marks = [];
  /** An open run per kind, so equal adjacent values become ONE mark. */
  const open = new Map();
  const close = (k) => {
    const run = open.get(k);
    if (run === undefined) return;
    marks.push(run);
    open.delete(k);
  };
  const put = (k, v, from, to) => {
    const run = open.get(k);
    if (run !== undefined && run.v === v && run.to === from) { run.to = to; return; }
    close(k);
    open.set(k, { k, from, to, ...(v === undefined ? {} : { v }) });
  };

  const walk = (ts) => {
    for (const t of ts) {
      if (t.t === 'syl') {
        for (const u of t.units) {
          const at = text.length;
          const src = original(u);
          text += src;
          const to = text.length;
          if (src !== u.c) marks.push({ k: 'show', from: at, to, v: u.c });
          if (u.hold !== undefined) put('hold', u.hold, at, to); else close('hold');
          if (u.svara !== undefined) put('svara', u.svara, at, to); else close('svara');
          if (u.candra === true) put('candra', undefined, at, to); else close('candra');
          if (u.sbhakti === true) marks.push({ k: 'sbhakti', from: at, to: at });
          if (u.sup !== undefined) marks.push({ k: 'sup', from: at, to, v: u.sup });
          if (u.cj !== undefined) marks.push({ k: 'cj', from: at, to, v: u.cj });
        }
        continue;
      }
      for (const k of [...open.keys()]) close(k);
      if (t.t === 'sp') text += ' ';
      else if (t.t === 'br') text += '\n';
      else if (t.t === 'danda' || t.t === 'num') text += t.s;
      else if (t.t === 'bar') text += '¦';
      else if (t.t === 'text') text += t.s;
      else if (t.t === 'pause') marks.push({ k: 'pause', from: text.length, to: text.length, v: t.len });
      else if (t.t === 'slot') walk(t.tokens);
    }
  };
  walk(verse.tokens);
  for (const k of [...open.keys()]) close(k);
  marks.sort((a, b) => a.from - b.from || a.k.localeCompare(b.k));
  return { text, marks };
}

/**
 * The compact wire form: a mark is a tuple, its offset a DELTA from the one
 * before it, and its length omitted when it is one character.
 *
 *   ["h", 12, 3, "s"]  →  hold, 12 after the previous mark, 3 long, short
 */
const KIND = { show: 'w', hold: 'h', svara: 'v', candra: 'c', sbhakti: 'b', sup: 'u', pause: 'p', cj: 'j' };
const VAL = { short: 's', long: 'l', none: 'n', anudatta: 'a', svarita: 'v', 'dirgha-svarita': 'd' };
function compact(marks) {
  let at = 0;
  return marks.map((m) => {
    const row = [KIND[m.k] ?? m.k, m.from - at];
    at = m.from;
    const len = m.to - m.from;
    const v = m.v === undefined ? undefined : (VAL[m.v] ?? m.v);
    if (len !== 1 || v !== undefined) row.push(len);
    if (v !== undefined) row.push(v);
    return row;
  });
}

const size = (s) => Buffer.byteLength(typeof s === 'string' ? s : JSON.stringify(s), 'utf8');
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

let now = 0; let verbose = 0; let tight = 0; let gz = 0; let br = 0;
let textBytes = 0; let markCount = 0;
const totals = { scriptForms: 0, letters: 0, marks: 0, structure: 0, other: 0 };
const rows = [];

for (const f of (await readdir(DIR)).filter((x) => x.endsWith('.json')).sort()) {
  const onDisk = (await stat(join(DIR, f))).size;
  const doc = openChantDoc(JSON.parse(await readFile(join(DIR, f), 'utf8')));
  const b = breakdown(doc);
  for (const k of Object.keys(totals)) totals[k] += b[k];

  const outVerbose = [];
  const outTight = [];
  for (const s of doc.sections) {
    for (const v of (s.items ?? s.verses)) {
      if (!v.tokens) continue;
      const { text, marks } = convert(v);
      textBytes += size(text);
      markCount += marks.length;
      outVerbose.push({ id: v.id, text, marks });
      outTight.push({ id: v.id, t: text, m: compact(marks) });
    }
  }
  const vJson = JSON.stringify(outVerbose);
  const tJson = JSON.stringify(outTight);
  now += onDisk; verbose += size(vJson); tight += size(tJson);
  const g = gzipSync(tJson, { level: 9 }).length;
  const bb = brotliCompressSync(Buffer.from(tJson), {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length;
  gz += g; br += bb;
  rows.push(`  ${f.replace('.json', '').padEnd(26)}${kb(onDisk).padStart(10)}`
    + `${kb(size(tJson)).padStart(10)}${kb(g).padStart(9)}${kb(bb).padStart(9)}`);
}

console.log('\n  WHERE THE CORPUS BYTES GO TODAY\n');
const all = Object.values(totals).reduce((a, x) => a + x, 0);
for (const [k, v] of Object.entries(totals)) {
  console.log(`    ${k.padEnd(14)} ${kb(v).padStart(10)}  ${((v / all) * 100).toFixed(1)}%`);
}

console.log('\n  PER DOCUMENT\n');
console.log(`  ${'document'.padEnd(26)}${'today'.padStart(10)}${'text+marks'.padStart(10)}${'gzip'.padStart(9)}${'brotli'.padStart(9)}`);
console.log(rows.join('\n'));

console.log(`\n  TOTAL   today ${kb(now)}`);
console.log(`          text+marks, readable JSON   ${kb(verbose)}`);
console.log(`          text+marks, compact tuples  ${kb(tight)}   (${(now / tight).toFixed(1)}x smaller)`);
console.log(`          the same, gzipped           ${kb(gz)}   (${(now / gz).toFixed(1)}x)`);
console.log(`          the same, brotli            ${kb(br)}   (${(now / br).toFixed(1)}x)`);
console.log(`\n          ${kb(textBytes)} of that is the text itself; ${markCount.toLocaleString()} markings\n`);
