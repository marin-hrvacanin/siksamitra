#!/usr/bin/env node
/**
 * HIS OWN DOCUMENTS, WRITTEN BACK BY THE ADD-IN — and do they look the same?
 *
 *   npm run check:word:reference            the ratchet
 *   npm run check:word:reference -- --why   every kind of difference, with examples
 *   npm run check:word:reference -- --write record the numbers
 *
 * A marking button rewrites the WHOLE paragraph it is pressed on, so every
 * line of his a person touches is replaced by what the add-in writes. The
 * question is whether that line, drawn by Word, is his line. It was not: of
 * 2 431 mantra lines of Devī Māhātmyam, 3 came back looking the same — his
 * no-break spaces, his tabs, his daṇḍas' face, his raised aids' colour, his
 * notes, his candrabindu glyph, his Ṛgvedic overline, each lost on a rewrite.
 *
 * FOR EVERY MANTRA LINE of every file in `Library/reference/` (his, not in the
 * repository — SKIPPED loudly when absent, like `check:reference`):
 *
 *   1. read it exactly as the add-in does (`readParagraphs`, `decodeRuns`,
 *      `lineNotes`) — or count it REFUSED where the add-in refuses it
 *      (`blockedIn`);
 *   2. write it exactly as the add-in does (`lineXml`, `inVocabulary`);
 *   3. resolve what Word would draw for every character of both, his style
 *      table first and the inserted sheet for a style he has not got
 *      (`packages/cli/src/word-look.ts` — a second implementation, sharing
 *      nothing with the writer);
 *   4. count the lines whose drawing is the same.
 *
 * The numbers ratchet in `corpus/word-reference-baseline.json` — counts only,
 * no text of his. More identical or fewer refused may be recorded; fewer
 * identical fails, naming the file.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import {
  hisStylesAsClean, legacyStylesIn, lineNotes, mergeRuns, paragraphXml, readParagraphs,
} from '@siksamitra/interop';
import { packageFor, stylesPartOf } from '../apps/word-addin/src/model/package.js';
import { documentPartOf } from '../apps/word-addin/src/model/opc.js';
import { decodeRuns, isVerseParagraph } from '../apps/word-addin/src/model/paragraph.js';
import { blockedIn, lineXml } from '../apps/word-addin/src/model/line-xml.js';
import { styleSheetFor } from '../apps/word-addin/src/model/sheet.js';
import { asRuled, differences, drawn, inserted, styleTable } from '../packages/cli/src/word-look.js';

const DIR = 'Library/reference';
const BASELINE = 'corpus/word-reference-baseline.json';
const why = process.argv.includes('--why');

if (!existsSync(DIR)) {
  console.log(`\n  SKIPPED — ${DIR} is not here. It holds the owner's own marked files,`);
  console.log('  which are not in the repository. Put them there to run this gate.\n');
  process.exit(0);
}

type Row = { lines: number; identical: number; refused: number };
const measured: Record<string, Row> = {};
const kinds = new Map<string, { n: number; ex: string[] }>();

console.log('\n── his mantra lines, written back by the add-in and drawn\n');
for (const file of readdirSync(DIR).filter((f) => /\.docx$/i.test(f) && !f.startsWith('~$')).sort()) {
  const zip = unzipSync(new Uint8Array(readFileSync(join(DIR, file))));
  const doc = strFromU8(zip['word/document.xml']!);
  const stylesXml = strFromU8(zip['word/styles.xml']!);
  const his = styleTable(stylesXml);
  const hisClean = hisStylesAsClean(stylesXml);
  const paras = readParagraphs(doc, stylesXml);
  const raws = paragraphXml(doc);
  if (paras.length !== raws.length) throw new Error(`${file}: ${paras.length} paragraphs read, ${raws.length} in the XML`);
  const row: Row = { lines: 0, identical: 0, refused: 0 };
  paras.forEach((p, i) => {
    if (!isVerseParagraph(p)) return;
    const runs = mergeRuns(p.runs);
    const tm = decodeRuns(runs);
    /* A line holding only a note has nothing to mark and is never written. */
    if (tm.text === '') return;
    row.lines += 1;
    const notes = lineNotes(runs);
    if (blockedIn(raws[i]!, runs, 'iast').length > 0) { row.refused += 1; return; }
    /* The clean path: the clean names, his definitions (`packageFor`). */
    const line = lineXml({ tm, style: p.pStyle, script: 'iast', notes: notes.notes });
    const pkg = packageFor(line, styleSheetFor(line), hisClean);
    const body = paragraphXml(documentPartOf(pkg))[0]!;
    if (legacyStylesIn(body).length > 0) throw new Error(`${file}: an older style id was written: ${legacyStylesIn(body).join(', ')}`);
    const theirs = drawn(raws[i]!, his);
    const ours = drawn(body, inserted(his, styleTable(stylesPartOf(pkg))));
    const found = differences(asRuled(theirs), asRuled(ours));
    if (found.length === 0) { row.identical += 1; return; }
    for (const k of found) {
      const e = kinds.get(k) ?? { n: 0, ex: [] };
      e.n += 1;
      if (e.ex.length < 3) {
        const show = (d: typeof theirs): string => d.map((x) => x.ch).join('').replace(/\n/g, '⏎').slice(0, 110);
        e.ex.push(`${file.slice(0, 20)}\n            his  ${show(theirs)}\n            ours ${show(ours)}`);
      }
      kinds.set(k, e);
    }
  });
  measured[file] = row;
  const pct = row.lines === 0 ? 100 : (100 * row.identical) / (row.lines - row.refused || 1);
  console.log(`  ${file.slice(0, 46).padEnd(46)} ${String(row.identical).padStart(5)}/${String(row.lines - row.refused).padEnd(5)}`
    + ` ${pct.toFixed(1).padStart(5)}%  look identical   ${row.refused} refused`);
}

if (why) {
  for (const [k, v] of [...kinds].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`\n  ${String(v.n).padStart(5)} line(s)  ${k}`);
    for (const e of v.ex) console.log(`         ${e}`);
  }
}

if (process.argv.includes('--write')) {
  writeFileSync(BASELINE, `${JSON.stringify(measured, null, 2)}\n`, 'utf8');
  console.log(`\n  recorded → ${BASELINE}\n`);
  process.exit(0);
}
const baseline: Record<string, Row> = existsSync(BASELINE)
  ? JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, Row> : {};
const fails: string[] = [];
for (const [file, now] of Object.entries(measured)) {
  const was = baseline[file];
  if (was === undefined) continue;
  if (now.identical < was.identical) fails.push(`${file}: ${was.identical} → ${now.identical} lines look identical`);
  if (now.refused > was.refused) fails.push(`${file}: ${was.refused} → ${now.refused} lines refused`);
}
if (fails.length > 0) {
  console.log('\nWORD REFERENCE GATE FAILS\n');
  for (const f of fails) console.log(`  ${f}`);
  console.log('');
  process.exit(1);
}
console.log(`\nWORD REFERENCE GATE PASSES — ${Object.keys(measured).length} documents at or above their baseline\n`);
