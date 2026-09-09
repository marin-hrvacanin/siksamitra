#!/usr/bin/env node
/**
 * DOES TOKENS → TEXT+MARKINGS → TOKENS LOSE ANYTHING?
 *
 * The owner's requirement, in his words: "if there is even 0.001% loss, then
 * fix the logic and algorithms and everything in a clean and scalable way so
 * that it's exactly 0%". So this does not sample and it does not summarise: it
 * converts every verse of every document, converts it back, and compares the
 * result token for token and field for field with what it started from.
 *
 * A difference is REPORTED WITH ITS SHAPE — which token, which field, what it
 * was and what came back — because "97% match" tells nobody what to fix.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { toTextAndMarks, toTokens, normalizeChantDoc, assertMarks } from '@siksamitra/format';
import { DIGRAPHS } from '@siksamitra/engine';

/**
 * The text divided into LETTERS.
 *
 * A letter is not a character: `bh`, `ai` and their kin are two characters and
 * one letter, and the engine's `DIGRAPHS` is the list. Longest match first, so
 * `bha` is `bh` + `a` and never `b` + `h` + `a`.
 */
function splitLetters(text) {
  const out = [];
  for (let i = 0; i < text.length;) {
    const two = text.slice(i, i + 2);
    let letter;
    if (DIGRAPHS.includes(two)) { letter = two; i += 2; } else { letter = text[i]; i += 1; }
    /* A combining mark is not a letter of its own: U+0310 over an `m` is one
       character to a reader, and a marking may not begin between them. */
    while (i < text.length && /\p{Mn}|\p{Mc}/u.test(text[i])) { letter += text[i]; i += 1; }
    out.push(letter);
  }
  return out;
}

const DIR = 'corpus/chants';

/** The script spellings, taken from the ORIGINAL rather than recomputed. */
function speller(original) {
  const by = new Map();
  const walk = (ts) => {
    for (const t of ts) {
      if (t.t === 'syl') {
        const { t: _t, units: _u, iast, ...forms } = t;
        if (!by.has(iast)) by.set(iast, forms);
      } else if (t.t === 'slot') walk(t.tokens);
    }
  };
  walk(original);
  return (iast) => by.get(iast) ?? { deva: iast };
}

/**
 * A token as comparable data: undefined and absent alike, and KEYS SORTED.
 *
 * The first version compared `JSON.stringify` directly and reported all 573
 * verses as different, because the stored documents write `deva` before `t`
 * and a freshly built object writes `t` first. Key order is not information.
 */
const tidy = (v) => {
  if (Array.isArray(v)) return v.map(tidy);
  if (v === null || typeof v !== 'object') return v;
  const out = {};
  for (const k of Object.keys(v).sort()) {
    if (v[k] === undefined) continue;
    out[k] = tidy(v[k]);
  }
  return out;
};

/**
 * Group ids replaced by the BOX PARTITION they describe.
 *
 * `hg` is a private numbering: `holdings.ts` says it "only ever has to tell two
 * boxes apart that TOUCH", and the shipped corpus reuses an id in a later
 * syllable 537 times. So renumbering by first appearance is not enough — the
 * old generator gives two boxes at opposite ends of a verse the same id, and a
 * fresh conversion mints a new one for each. Both are correct; only the
 * partition is information.
 *
 * This assigns a new id per RUN: a held letter continues the box before it when
 * that letter was held the same way, carried the same id, and nothing came
 * between them. Two streams that box the same letters together compare equal;
 * one that joins two boxes, or splits one, still fails.
 */
function canonicalGroups(tokens) {
  let id = 0;
  let prev = null;
  const walk = (ts) => ts.map((t) => {
    if (t.t === 'slot') return { ...t, tokens: walk(t.tokens) };
    if (t.t !== 'syl') { prev = null; return t; }
    return {
      ...t,
      units: t.units.map((u) => {
        if (u.hold === undefined) { prev = null; return u; }
        const joins = prev !== null && prev.hold === u.hold && prev.hg === u.hg;
        if (!joins) id += 1;
        prev = { hold: u.hold, hg: u.hg };
        return { ...u, hg: id };
      }),
    };
  });
  return walk(tokens);
}

/** Where two token streams first differ, described. */
function firstDifference(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    const x = a[i];
    const y = b[i];
    if (x === undefined) return `token ${i}: nothing, expected ${y.t}`;
    if (y === undefined) return `token ${i}: ${x.t} vanished`;
    const sx = JSON.stringify(tidy(x));
    const sy = JSON.stringify(tidy(y));
    if (sx === sy) continue;
    if (x.t !== y.t) return `token ${i}: ${x.t} came back as ${y.t}`;
    if (x.t === 'syl') {
      if (x.iast !== y.iast) return `token ${i}: syllable "${x.iast}" came back "${y.iast}"`;
      for (let u = 0; u < Math.max(x.units.length, y.units.length); u += 1) {
        const ux = JSON.stringify(tidy(x.units[u]));
        const uy = JSON.stringify(tidy(y.units[u]));
        if (ux !== uy) return `token ${i} ("${x.iast}") letter ${u}: ${ux} -> ${uy}`;
      }
    }
    return `token ${i} (${x.t}): ${sx.slice(0, 90)} -> ${sy.slice(0, 90)}`;
  }
  return null;
}

let verses = 0;
let exact = 0;
let tokens = 0;
let markCount = 0;
let textChars = 0;
const faults = [];
const rows = [];

for (const file of (await readdir(DIR)).filter((f) => f.endsWith('.json')).sort()) {
  const doc = normalizeChantDoc(JSON.parse(await readFile(join(DIR, file), 'utf8')));
  let ok = 0;
  let bad = 0;
  for (const section of doc.sections) {
    for (const verse of section.verses) {
      if (verse.tokens === undefined) continue;
      verses += 1;
      tokens += verse.tokens.length;

      const { text, marks } = toTextAndMarks(verse);
      textChars += text.length;
      markCount += marks.length;
      /* The markings must be sound before anything is asked of them. */
      try {
        assertMarks(marks, text, `${file} ${verse.id}`);
      } catch (e) {
        bad += 1;
        faults.push(`${file} ${verse.id}: ${String(e).split('\n').slice(0, 2).join(' ')}`);
        continue;
      }

      const back = toTokens({ text, marks }, { spell: speller(verse.tokens), split: splitLetters });
      const diff = firstDifference(canonicalGroups(verse.tokens), canonicalGroups(back));
      if (diff === null) { ok += 1; exact += 1; } else {
        bad += 1;
        faults.push(`${file} ${verse.id}: ${diff}`);
      }
    }
  }
  rows.push(`  ${file.replace('.json', '').padEnd(28)}${String(ok).padStart(4)} exact`
    + (bad > 0 ? `, ${bad} NOT` : ''));
}

console.log('\n── tokens → text and markings → tokens\n');
console.log(rows.join('\n'));
const pct = ((exact / verses) * 100).toFixed(3);
console.log(`\n  ${exact} of ${verses} verses came back exactly (${pct}%)`);
console.log(`  ${textChars.toLocaleString()} characters of text, ${markCount.toLocaleString()} markings,`
  + ` from ${tokens.toLocaleString()} tokens`);

if (faults.length > 0) {
  console.log(`\n  ${faults.length} verse(s) did not:\n`);
  const seen = new Map();
  for (const f of faults) {
    const kind = f.replace(/^[^:]+: /, '').replace(/\d+/g, 'N').slice(0, 60);
    seen.set(kind, (seen.get(kind) ?? 0) + 1);
  }
  for (const [kind, n] of [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`    ${String(n).padStart(4)} x  ${kind}`);
  }
  console.log('\n  the first few, in full:\n');
  for (const f of faults.slice(0, 8)) console.log(`    ${f}`);
  console.log('');
  process.exit(1);
}
console.log('\n  NOTHING WAS LOST.\n');
