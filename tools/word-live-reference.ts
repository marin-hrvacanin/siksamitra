#!/usr/bin/env node
/**
 * HIS DOCUMENTS, EVERY MANTRA LINE WRITTEN BACK — IN REAL WORD — AND DRAWN.
 *
 *   npm run check:word:live:reference
 *   npm run check:word:live:reference -- --only rudram    one document
 *   npm run check:word:live:reference -- --why            every kind of difference
 *
 * `check:word:reference` says what the add-in's writes WOULD look like, by
 * modelling how Word merges an inserted package's styles into a document.
 * This asks Word. Every mantra line of every file in `Library/reference/` is
 * built exactly as `writeLines` builds it — `lineXml`, the vocabulary, the
 * sheet for that body, `flatPackage` — and handed to Word's own `InsertXML`
 * over that paragraph's content (`tools/word-com/reference.ps1`). Word's own
 * OOXML comes back, and each paragraph Word now has is drawn with the style
 * table Word now has, and compared with his original drawn with his.
 *
 * WHAT IT ESTABLISHES that nothing else can:
 *   - Word keeps HIS definition of a style he has, and adds ours for one he
 *     lacks — the assumption `check:word:reference` makes;
 *   - no write adds or eats a paragraph, over thousands of writes;
 *   - and his lines, rewritten, draw as his lines did.
 *
 * Needs Windows and Word, and his files; SKIPS LOUDLY without them. Every
 * document is opened read-only and closed unsaved.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { hisStylesAsClean, lineNotes, mergeRuns, paragraphXml, readParagraphs } from '@siksamitra/interop';
import { packageFor } from '../apps/word-addin/src/model/package.js';
import { decodeRuns, isVerseParagraph } from '../apps/word-addin/src/model/paragraph.js';
import { blockedIn, lineXml } from '../apps/word-addin/src/model/line-xml.js';
import { styleSheetFor } from '../apps/word-addin/src/model/sheet.js';
import { documentPartOf } from '../apps/word-addin/src/model/opc.js';
import { asRuled, differences, drawn, styleTable } from '../packages/cli/src/word-look.js';

const REF = 'Library/reference';
const DIR = 'artifacts/word-live-reference';
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : process.argv[i + 1];
};
const only = arg('only');
const why = process.argv.includes('--why');

function hasWord(): boolean {
  try {
    execFileSync('powershell', ['-NoProfile', '-Command', '$w = New-Object -ComObject Word.Application; $w.Quit()'],
      { stdio: 'ignore', timeout: 120_000 });
    return true;
  } catch { return false; }
}
if (!existsSync(REF) || process.platform !== 'win32' || !hasWord()) {
  console.log('\n  WORD LIVE REFERENCE GATE SKIPPED — it needs Windows, Microsoft Word, and');
  console.log(`  his documents in ${REF}.\n`);
  process.exit(0);
}

rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });

interface Planned { name: string; file: string; count: number; writes: { index: number; file: string }[]; his: Map<number, string>; styles: string }
const planned: Planned[] = [];
let n = 0;
for (const name of readdirSync(REF).filter((f) => /\.docx$/i.test(f) && !f.startsWith('~$')).sort()) {
  if (only !== undefined && !name.includes(only)) continue;
  const zip = unzipSync(new Uint8Array(readFileSync(join(REF, name))));
  const doc = strFromU8(zip['word/document.xml']!);
  const styles = strFromU8(zip['word/styles.xml']!);
  const hisClean = hisStylesAsClean(styles);
  const paras = readParagraphs(doc, styles);
  const raws = paragraphXml(doc);
  const p: Planned = { name, file: join(REF, name), count: paras.length, writes: [], his: new Map(), styles };
  paras.forEach((para, index) => {
    if (!isVerseParagraph(para)) return;
    const runs = mergeRuns(para.runs);
    const tm = decodeRuns(runs);
    if (tm.text === '' || blockedIn(raws[index]!, runs, 'iast').length > 0) return;
    const body = lineXml({ tm, style: para.pStyle, script: 'iast', notes: lineNotes(runs).notes });
    n += 1;
    const file = `w${n}.xml`;
    /* `packageOf`, step for step: the clean names, his definitions. */
    writeFileSync(join(DIR, file), packageFor(body, styleSheetFor(body), hisClean), 'utf8');
    p.writes.push({ index, file });
    p.his.set(index, raws[index]!);
  });
  if (p.writes.length > 0) planned.push(p);
}

const job = join(DIR, 'job.json');
writeFileSync(job, JSON.stringify({ docs: planned.map(({ name, file, writes }) => ({ name, file, writes })) }), 'utf8');
const out = join(DIR, 'out.json');
console.log(`\n  driving Word: ${n} mantra lines in ${planned.length} document(s) — read-only, never saved…`);
execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'tools/word-com/reference.ps1', '-Job', job, '-Out', out],
  { stdio: ['ignore', 'inherit', 'inherit'], timeout: 90 * 60_000 });
const live = JSON.parse(readFileSync(out, 'utf8')) as {
  version: string;
  docs: { name: string; paragraphs: number; after: number; written: number; moved: unknown[] | unknown; refused?: unknown; body: string }[] | { name: string };
};
const docs = (Array.isArray(live.docs) ? live.docs : [live.docs]) as { name: string; paragraphs: number; after: number; written: number; moved: unknown; refused?: unknown; body: string }[];
/** PowerShell writes a one-element array as the element, and an empty one as null. */
const listOf = <T>(x: unknown): T[] => (Array.isArray(x) ? x : x === null || x === undefined ? [] : [x]) as T[];

/** A part of a flat OPC package, by name. */
const partOf = (pkg: string, name: string): string =>
  new RegExp(`<pkg:part pkg:name="${name.replace(/[/.]/g, '\\$&')}"[\\s\\S]*?<pkg:xmlData>([\\s\\S]*?)</pkg:xmlData>`).exec(pkg)?.[1] ?? '';

console.log(`\n── Microsoft Word ${live.version}: his lines, written by the add-in, drawn by Word\n`);
let failed = false;
const kinds = new Map<string, { n: number; ex: string[] }>();
for (const d of docs) {
  const p = planned.find((x) => x.name === d.name)!;
  const pkg = readFileSync(join(DIR, d.body), 'utf8');
  const after = paragraphXml(documentPartOf(pkg));
  const now = styleTable(partOf(pkg, '/word/styles.xml'));
  const his = styleTable(p.styles);
  const moved = Array.isArray(d.moved) ? d.moved.length : d.moved === null || d.moved === undefined ? 0 : 1;
  let same = 0;
  /* A write Word refused left his line as it was, which draws the same as his
     line trivially: it is NOT counted the same — it was never written. */
  const notWritten = new Set(listOf<{ index: number }>(d.refused).map((r) => r.index));
  for (const w of p.writes) {
    if (notWritten.has(w.index)) continue;
    const found = differences(asRuled(drawn(p.his.get(w.index)!, his)), asRuled(drawn(after[w.index] ?? '', now)));
    if (found.length === 0) { same += 1; continue; }
    for (const k of found) {
      const e = kinds.get(k) ?? { n: 0, ex: [] };
      e.n += 1;
      if (e.ex.length < 2) e.ex.push(`${d.name.slice(0, 20)} ¶${w.index}: ${drawn(p.his.get(w.index)!, his).map((x) => x.ch).join('').replace(/\n/g, '⏎').slice(0, 90)}`);
      kinds.set(k, e);
    }
  }
  /* Our reader and Word, counting the same paragraphs (hidden text shown). */
  const agree = d.paragraphs === p.count;
  const refused = listOf<{ index: number; error: string }>(d.refused);
  const ok = agree && moved === 0 && refused.length === 0 && d.after === d.paragraphs && d.written === p.writes.length;
  if (!ok) failed = true;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${d.name.slice(0, 44).padEnd(44)} ${String(same).padStart(5)}/${String(p.writes.length).padEnd(5)} drawn the same`
    + `   ¶ ${d.paragraphs}→${d.after}${agree ? '' : ` (the reader counts ${p.count})`}${moved === 0 ? '' : `, ${moved} write(s) moved the count`}`
    + (refused.length === 0 ? '' : `, ${refused.length} write(s) REFUSED by Word`));
  for (const r of refused) {
    console.log(`         refused ¶${r.index}: ${r.error.trim()} — ${drawn(p.his.get(r.index)!, his).map((x) => x.ch).join('').replace(/\n/g, '⏎').slice(0, 80)}`);
  }
}
if (why) {
  for (const [k, v] of [...kinds].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`\n  ${String(v.n).padStart(5)}  ${k}`);
    for (const e of v.ex) console.log(`         ${e}`);
  }
}
console.log(failed ? '\nWORD LIVE REFERENCE GATE FAILS — the counts disagree, or a write moved one\n'
  : `\nWORD LIVE REFERENCE GATE PASSES — ${n} lines written in real Word, no paragraph gained or lost\n`);
process.exit(failed ? 1 : 0);
