#!/usr/bin/env node
/**
 * THE ADD-IN, PRESSED IN REAL WORD — each scenario a person would try.
 *
 *   npm run check:word:ui
 *
 * Needs Word running with the śikṣāmitra tab (the local add-in sideloaded:
 * `npx office-addin-dev-settings sideload <manifest> desktop -a Word`),
 * started with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9229`
 * so its runtime can be reached, and works in the ACTIVE document — the
 * sideload's own, never one of the person's. `tools/word-ui/drive.ps1` runs
 * each command in the add-in's runtime, by the function its button calls
 * (`ALL_COMMANDS`); Word's OOXML afterwards is decoded here by the add-in's own
 * reader, and every expectation is something a person would check: the mark
 * landed on the letter, the rest of the line is as it was, the note is still
 * there, the selection came back.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { legacyStylesIn, mergeRuns, paragraphXml, readParagraphs } from '@siksamitra/interop';
import { STAGES, rerun, resolveProfile } from '@siksamitra/engine';
import { decodeRuns, isVerseParagraph } from '../apps/word-addin/src/model/paragraph.js';
import { documentPartOf } from '../apps/word-addin/src/model/opc.js';
import { stylesPartOf } from '../apps/word-addin/src/model/package.js';
import { asRuled, differences, drawn, styleTable } from '../packages/cli/src/word-look.js';
import { DIR, check, drive, freshDir, line, marks, results, type Read } from './word-ui/lib.js';

freshDir();

/* THE TEST DOCUMENT'S SETTINGS FROM LAST TIME, cleared: a run that ended with
   the conventions switched made the next one's "no raised u by default" fail. */
drive([{ closeDialogs: true }, { js: "const s = Office.context.document.settings; for (const k of ['siksamitra.register', 'siksamitra.conventions', "
  + "'siksamitra.conventions.markedWith', 'siksamitra.stages']) s.remove(k); await new Promise((r) => s.saveAsync(r));" }]);

const LINE = 'agnim īḷe purohitam';

/* 1–4: marking by hand, on a typed line. */
{
  const r = drive([
    { text: LINE },
    { select: [1, 2] }, { press: 'Short' }, { read: true },
    { select: [4, 4] }, { press: 'Svarita' }, { read: true },
    { select: [15, 15] }, { press: 'Short pause' }, { read: true },
    { select: [0, LINE.length] }, { press: 'Clear all' }, { read: true },
  ]);
  const failed = r.filter((x) => !x.ok);
  check('every step ran', failed.map((x) => x.error), []);
  const reads = r.filter((x) => x.body !== undefined);
  if (reads.length === 4) {
    const a = line(reads[0]!);
    check('Short on a selected letter: that letter boxed', marks(a.tm), ['hold:1-2:short']);
    check('and the letters are as typed', a.tm.text, LINE);
    check('and the selection is still those letters', reads[0]!.selection, [1, 2]);
    const b = line(reads[1]!);
    check('Svarita with the caret after a vowel: on that vowel', marks(b.tm).filter((m) => m.startsWith('svara')), ['svara:3-4:svarita']);
    check('and the box from before is still there', marks(b.tm).filter((m) => m.startsWith('hold')), ['hold:1-2:short']);
    const c = line(reads[2]!);
    /* Word offset 15 is model offset 14: Word counts the accent as a character. */
    check('a pause goes at the caret', marks(c.tm).filter((m) => m.startsWith('pause')), ['pause:14-14:short']);
    const d = line(reads[3]!);
    check('Clear all takes every marking off the selection', marks(d.tm), []);
    check('and leaves the letters', d.tm.text, LINE);
  }
}

/* 5: the rules, over a selected line — what the engine makes of it, exactly. */
{
  const r = drive([{ text: LINE }, { select: [0, LINE.length] }, { press: 'Re-apply rules', wait: 4000 }, { read: true }]);
  const read = r.find((x) => x.body !== undefined);
  check('Re-apply rules ran', r.filter((x) => !x.ok).map((x) => x.error), []);
  if (read !== undefined) {
    const got = line(read).tm;
    const want = rerun({ text: LINE, marks: [] }, {
      stages: STAGES, mode: 'keep-hand', from: 0, to: LINE.length, profile: resolveProfile([{ preset: 'taittiriya' }]),
    });
    check('and marked the line exactly as the engine does', { text: got.text, marks: marks(got) }, { text: want.text, marks: marks(want) });
  }
}

/* 6: one of HIS lines, with a note at its end, in his own styles. */
const REF = 'Library/reference/Veda Union sAdhanA v9.1.13 IAST.docx';
if (existsSync(REF)) {
  const zip = unzipSync(new Uint8Array(readFileSync(REF)));
  const doc = strFromU8(zip['word/document.xml']!);
  const styles = strFromU8(zip['word/styles.xml']!);
  const paras = readParagraphs(doc, styles);
  const raws = paragraphXml(doc);
  const i = paras.findIndex((p) => isVerseParagraph(p) && p.runs.at(-1)?.rStyle === 'Comment'
    && decodeRuns(mergeRuns(p.runs)).text.length > 12 && !raws[paras.indexOf(p)]!.includes('w:bookmarkStart'));
  const pkg = `<?xml version="1.0" standalone="yes"?><?mso-application progid="Word.Document"?>`
    + '<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">'
    + '<pkg:part pkg:name="/_rels/.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml"><pkg:xmlData>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships></pkg:xmlData></pkg:part>'
    + '<pkg:part pkg:name="/word/_rels/document.xml.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml"><pkg:xmlData>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships></pkg:xmlData></pkg:part>'
    + '<pkg:part pkg:name="/word/document.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"><pkg:xmlData>'
    + `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><w:body>${raws[i]!}</w:body></w:document></pkg:xmlData></pkg:part>`
    + '<pkg:part pkg:name="/word/styles.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"><pkg:xmlData>'
    + `${styles.replace(/^<\?xml[^>]*\?>/, '')}</pkg:xmlData></pkg:part></pkg:package>`;
  writeFileSync(join(DIR, 'his-line.xml'), pkg, 'utf8');
  const his = decodeRuns(mergeRuns(paras[i]!.runs));
  const note = paras[i]!.runs.at(-1)!.text;
  /* A plain consonant of his line, to box. */
  const at = [...his.text].findIndex((c, k) => /[kgcjtdpbmnyrlvs]/.test(c) && !his.marks.some((m) => m.from <= k && m.to > k));
  const r = drive([{ xml: 'his-line.xml' }, { read: true }, { select: [at, at + 1] }, { press: 'Short' }, { read: true }]);
  check('his line went in and was marked', r.filter((x) => !x.ok).map((x) => x.error), []);
  const reads = r.filter((x) => x.body !== undefined);
  if (reads.length === 2) {
    const before = line(reads[0]!);
    const after = line(reads[1]!);
    check('his line, read out of Word, is his line', before.tm.text, his.text);
    check('after Short: his letters are as they were', after.tm.text, before.tm.text);
    check('and every marking of his is still there, with the new box', marks(after.tm).filter((m) => !marks(before.tm).includes(m)).length, 1);
    check('and none of his is lost', marks(before.tm).filter((m) => !marks(after.tm).includes(m)), []);
    check('and his note is still at the end of the line, in his Comment', after.runs.filter((x) => x.rStyle === 'Comment').map((x) => x.text).join(''), note);
  }
}

/* 6a: one of HIS documents taken into the clean styles by Import styles —
   and LOOKING THE SAME, drawn by `word-look.ts` from what Word now holds. */
if (existsSync(join(DIR, 'his-line.xml'))) {
  const r = drive([
    { unstyle: true }, { xml: 'his-line.xml' }, { read: true },
    /* A fixed wait, not the first change: Import styles makes several, and the
       read once came before the conversion that is the point of it. */
    { press: 'Import styles', wait: 15000, still: true }, { read: true },
    { said: 'śikṣāmitra styles are in this document' },
  ]);
  check('Import styles over his line ran', r.filter((x) => !x.ok).map((x) => x.error), []);
  const reads = r.filter((x) => x.body !== undefined);
  if (reads.length === 2) {
    const pkgOf = (x: Read) => readFileSync(join(DIR, x.body!), 'utf8');
    const [before, after] = reads.map(pkgOf) as [string, string];
    const para = (pkg: string) => paragraphXml(documentPartOf(pkg))[0]!;
    check('after it, the line is in the clean names alone', legacyStylesIn(para(after)), []);
    check('and none of his older styles is left in the document', legacyStylesIn(stylesPartOf(after)), []);
    check('and it DRAWS the same, character by character',
      differences(asRuled(drawn(para(before), styleTable(stylesPartOf(before)))), asRuled(drawn(para(after), styleTable(stylesPartOf(after))))), []);
    const [b, a] = [line(reads[0]!), line(reads[1]!)];
    check('and its letters and markings are as they were', { text: a.tm.text, marks: marks(a.tm) }, { text: b.tm.text, marks: marks(b.tm) });
  }
}

/* 6b: a svara with the caret INSIDE a word keeps the word's other marks; at
   the END of a word, the next letter typed is plain. */
{
  const r = drive([
    { text: LINE }, { select: [1, 2] }, { press: 'Short' },
    { select: [4, 4] }, { press: 'Svarita' }, { read: true },
    { text: 'agnim' }, { select: [5, 5] }, { press: 'Short' }, { type: 'x' }, { select: null, wait: 3000 }, { read: true },
  ]);
  check('caret steps ran', r.filter((x) => !x.ok).map((x) => x.error), []);
  const reads = r.filter((x) => x.body !== undefined);
  if (reads.length === 2) {
    const a = line(reads[0]!);
    check('Svarita mid-word: the accent on its vowel, IN the accent style', marks(a.tm), ['hold:1-2:short', 'svara:3-4:svarita']);
    check('and the caret after it', reads[0]!.selection, [5, 5]);
    const b = line(reads[1]!);
    check('Short at a word’s end, then a letter typed: the letter is plain', marks(b.tm), ['hold:4-5:short']);
    check('and it is in the text', b.tm.text, 'agnimx');
  }
}

/* 6c: the whole document, which asks first. */
{
  /* In the Mantra style: a whole-document run marks MANTRA lines, and a line
     in Normal is rightly not one ("There are no mantra lines…"). The styles
     come from Import styles, which says what it did — answered with OK. */
  const r = drive([
    { text: LINE }, { press: 'Import styles', wait: 4000, still: true }, { dialog: 'OK', wait: 1000 },
    { text: LINE, style: 'Mantra' }, { select: [0, 0] },
    { press: 'Re-apply rules', wait: 2500, still: true }, { dialog: 'Re-apply', wait: 6000 }, { read: true },
    /* It says how many lines it re-marked; answered, as a person would. */
    { dialog: 'OK', wait: 800 },
  ]);
  check('Re-apply over the whole document asked, and Re-apply ran it', r.filter((x) => !x.ok).map((x) => x.error), []);
  const read = r.find((x) => x.body !== undefined);
  if (read !== undefined) {
    check('and the line is marked', marks(line(read).tm).length > 0, true);
  }
}

/* 6d: a register chosen over SELECTED lines outside every part makes them a
   part of their own in it — never "the document's" register. */
{
  const r = drive([
    { text: LINE, style: 'Mantra' }, { select: [0, LINE.length] },
    { press: 'Ṛgveda', wait: 2500, still: true }, { dialog: 'Mark them', wait: 6000 }, { read: true }, { dialog: 'OK', wait: 800 },
    /* And another register with the caret IN that one-line part re-marks the
       part — and the part survives its own re-mark (`word/line-target.ts`). */
    { select: [3, 3] }, { press: 'Smārta / purāṇic', wait: 2500, still: true }, { dialog: 'Re-mark it', wait: 6000 }, { read: true },
    { dialog: 'OK', wait: 800 },
  ]);
  check('Ṛgveda over a selection asked, and ran', r.filter((x) => !x.ok).map((x) => x.error), []);
  const read = r.find((x) => x.body !== undefined);
  if (read !== undefined) {
    const pkg = readFileSync(join(DIR, read.body!), 'utf8');
    check('and the lines are a part of their own, in Ṛgveda', /<w:sdt>[\s\S]*?<w:tag w:val="[^"]*rigveda[^"]*"/.test(documentPartOf(pkg)), true);
  }
  const again = r.filter((x) => x.body !== undefined)[1];
  if (again !== undefined) {
    const pkg = readFileSync(join(DIR, again.body!), 'utf8');
    check('re-marked in Smārta with the caret in it, the part is still there, now Smārta',
      /<w:sdt>[\s\S]*?<w:tag w:val="[^"]*smarta[^"]*"/.test(documentPartOf(pkg)), true);
  }
}

/* 7: the conventions — their defaults, used by the rules. */
{
  const r = drive([{ text: 'bhavyam' }, { select: [0, 7] }, { press: 'Re-apply rules', wait: 4000 }, { read: true }]);
  const read = r.find((x) => x.body !== undefined);
  /* And it RAN: a check on marks that are absent passes for a command that
     never ran just as well. */
  check('Re-apply over bhavyam ran, and marked it', [r.filter((x) => !x.ok).map((x) => x.error), read !== undefined && marks(line(read).tm).length > 0], [[], true]);
  if (read !== undefined) {
    check('by default the rules put no raised u on v before y', marks(line(read).tm).filter((m) => m.startsWith('sup')), []);
  }
}

/* And the same, used dirtily: `tools/word-ui/dirty.ts`. */
await import('./word-ui/dirty.js');
await import('./word-ui/dirty-more.js');
await import('./word-ui/dirty-scripts.js');

for (const x of results) console.log(`  ${x.ok ? 'ok  ' : 'FAIL'} ${x.what.padEnd(66)} ${x.ok ? '' : `${JSON.stringify(x.got)} (want ${JSON.stringify(x.want)})`}`);
const bad = results.filter((x) => !x.ok).length;
console.log(bad === 0 ? `\nWORD UI GATE PASSES — ${results.length} checks, pressed in real Word\n` : `\nWORD UI GATE FAILS — ${bad} of ${results.length}\n`);
process.exit(bad === 0 ? 0 : 1);
