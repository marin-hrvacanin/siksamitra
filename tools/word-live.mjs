#!/usr/bin/env node
/**
 * THE WORD ADD-IN, AGAINST A REAL WORD.
 *
 *   npm run check:word:live
 *
 * `word/client.ts` says in its own header that none of it can be unit-tested:
 * there is no headless Word, and `office-addin-mock` does not mock collections
 * — `paragraphs` is one. So this is the tier that was missing, and it is the
 * same arrangement as the browser gates: not in `npm run check`, because it
 * needs Word installed, and loud about skipping when there is none.
 *
 * HOW THE HALVES DIVIDE. Node builds every payload with the add-in's OWN code
 * and decodes every answer with it; `tools/word-com/live.ps1` does nothing but
 * hand Word a file and ask for one back. Neither side reads or writes
 * WordprocessingML the other could have got wrong, and the expectations come
 * from the add-in's model rather than from the bytes being checked.
 *
 * WHAT IT ESTABLISHES that nothing else can:
 *
 *   1. A FRESH DOCUMENT HAS NONE OF OUR STYLES, so the pane's own detection is
 *      answering a real question.
 *   2. THE SPECIMEN PUTS ALL OF THEM IN. Word merges the styles an insertion
 *      USES, and Microsoft says nothing about the ones it does not.
 *   3. THEY SURVIVE THE TEXT BEING DELETED. This is the whole basis of
 *      "Add the styles", and there is no documentation for it either.
 *   4. A MARKED LINE COMES BACK AS ITSELF, out of Word's own OOXML — and Word
 *      resolved it to his mantra style, in his face, at his size. A style that
 *      failed to arrive leaves a paragraph in Word's 11 pt Calibri, and
 *      nothing about that looks wrong.
 *   5. HIS OWN DOCUMENT IS NOT DAMAGED. His real file, opened READ-ONLY in
 *      real Word, its mantra lines written back exactly as the add-in would,
 *      read out of Word again and compared letter for letter. This is the arm
 *      that would have caught the space a holding used to eat.
 *
 *   6. WORD AND THE READER AGREE ABOUT HOW MANY PARAGRAPHS THERE ARE, which
 *      `writeDocument` depends on: it addresses paragraphs by index from one
 *      read and writes them through another.
 *
 * NOTHING IS SAVED, which is what the add-in does: the pane inserts and reads,
 * and the person saves afterwards. `tools/word-com/live.ps1` records the other
 * half of that reason — a save cannot be driven from an invisible instance on
 * this machine at all.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { importDocx, mergeRuns, readParagraphs } from '@siksamitra/interop';
import { documentPartOf, flatPackage, restyle } from '../apps/word-addin/src/model/opc.js';
import {
  decodeRuns, isVerseParagraph, paragraphsXml,
} from '../apps/word-addin/src/model/paragraph.js';
import { styleSheet, styleSheetFor } from '../apps/word-addin/src/model/sheet.js';
import { missingStyles, styleIds } from '../apps/word-addin/src/model/setup.js';
import { specimenMarks } from '../apps/word-addin/src/model/specimen-text.js';
import { writePayloads } from './word-com/emit.mjs';

const DIR = 'artifacts/word-live';
const HIS = 'tools/chant/fixtures-sadhana.docx';
/** How many of his mantra lines to write back. Enough to be a corpus, not a wait. */
const HIS_LINES = 12;

const sheet = styleSheet();
const OURS = styleIds(sheet).filter((s) => s.id !== 'Normal').map((s) => s.id);

const results = [];
const check = (what, got, want, note = '') => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  results.push({ ok, what, got, want, note });
  return ok;
};

/* ── is there a Word at all ─────────────────────────────────────────────── */

function wordVersion() {
  try {
    return execFileSync('powershell', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      '$w = New-Object -ComObject Word.Application; $w.Version; $w.Quit()',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

if (process.platform !== 'win32' || wordVersion() === null) {
  /* SKIPPED LOUDLY, the way `check:edit:audio` is. A gate that quietly
     succeeds when it did not run is worse than no gate. */
  console.log('\n  WORD LIVE GATE SKIPPED — no Microsoft Word on this machine.');
  console.log('  It drives Word over COM, so it runs on Windows with Word installed.\n');
  process.exit(0);
}

/* ── the payloads, and what his document should come back as ────────────── */

rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });
const payloads = writePayloads(DIR);

/** His mantra paragraphs: what they say now, and what the add-in would write. */
function hisWrites() {
  if (!existsSync(HIS)) return { file: HIS, writes: [], expect: [], paragraphs: 0 };
  const bytes = new Uint8Array(readFileSync(HIS));
  const { paragraphs } = importDocx(bytes, 'his');
  const writes = [];
  const expect = [];
  for (const [index, p] of paragraphs.entries()) {
    if (!isVerseParagraph(p)) continue;
    const tm = decodeRuns(mergeRuns(p.runs));
    if (tm.text.trim() === '') continue;
    const file = `his-${index}.xml`;
    /* EXACTLY WHAT `writeParagraph` WOULD SEND, built by the same three
       functions the pane calls: the paragraph, restyled to keep its own
       style, in a package carrying the sheet. */
    const written = restyle(paragraphsXml(tm), p.pStyle);
    writeFileSync(
      join(DIR, file),
      /* `styleSheetFor`, not `sheet` — this is what `writeParagraph` sends,
         and the difference was five of his mantra lines coming back with a
         raised reading aid spliced into the recitation. */
      flatPackage(written, styleSheetFor(written)),
      'utf8',
    );
    writes.push({ index, file });
    expect.push({ index, text: tm.text, marks: marksOf(tm.marks) });
    if (writes.length >= HIS_LINES) break;
  }
  return { file: HIS, writes, expect, paragraphs: paragraphs.length };
}

/** Markings as comparable strings — provenance left out, it is not written. */
const marksOf = (marks) => [...marks]
  .map((m) => `${m.k}:${m.from}-${m.to}:${m.v ?? ''}`)
  .sort();

const his = hisWrites();
const job = {
  specimen: payloads.specimen.split('\\').join('/'),
  marked: payloads.marked.split('\\').join('/'),
  his: { file: his.file, writes: his.writes, mode: process.env.WORD_WRITE_MODE ?? 'content' },
};
const jobFile = join(DIR, 'live-job.json');
writeFileSync(jobFile, `${JSON.stringify(job, null, 1)}\n`, 'utf8');

/* ── ask Word ───────────────────────────────────────────────────────────── */

const outFile = join(DIR, 'live.json');
console.log('\n  driving Word — this opens it invisibly and closes it again…');
/*
 * A TIMEOUT, because a COM call into Word can block with no window and no
 * output. `ExportAsFixedFormat` on an invisible instance did, for eighteen
 * minutes at 100% of a core, and the only sign was a shell that never
 * returned. Word is killed rather than waited for; `live.ps1` announces every
 * step, so what is printed last is where it stopped.
 */
try {
  execFileSync('powershell', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'tools/word-com/live.ps1',
    '-Job', jobFile, '-Out', outFile,
  ], { encoding: 'utf8', stdio: ['ignore', 'inherit', 'inherit'], timeout: 8 * 60_000 });
} catch (e) {
  if (e.signal !== null && e.signal !== undefined) {
    console.error('\n  Word did not answer within eight minutes. The last step '
      + 'printed above is where it stopped.');
    try {
      execFileSync('powershell', ['-NoProfile', '-Command',
        'Stop-Process -Name WINWORD -Force -ErrorAction SilentlyContinue'], { stdio: 'ignore' });
    } catch { /* nothing to stop */ }
  }
  throw e;
}

const live = JSON.parse(readFileSync(outFile, 'utf8'));
const body = (name) => readFileSync(join(DIR, live[name]), 'utf8');

/**
 * A list, whatever PowerShell decided to call it.
 *
 * `ConvertTo-Json` serialises a ONE-element array as a bare object, so a
 * document with a single paragraph came back as `{style: …}` and `.find` was
 * not a function. Normalised here rather than fought over there: `@()` on the
 * PowerShell side does not prevent it.
 */
const list = (x) => (Array.isArray(x) ? x : x === undefined || x === null ? [] : [x]);

/* ── what it said ───────────────────────────────────────────────────────── */

console.log(`\n── Microsoft Word ${live.version}\n`);

/*
 * 1. A FRESH DOCUMENT HAS NONE OF THE CUSTOM ONES.
 *
 * Not none of the seventeen: seven of them are WORD'S OWN — `Normal`, the four
 * headings, `Header`, `Caption` — and a new document declares those already.
 * That is why the check is against the custom vocabulary, which is his
 * (`Translit`, `Prijevod`, the marks) plus ours, and why the built-ins are
 * listed here rather than counted: they are a fact about Word.
 */
const WORD_BUILT_IN = new Set([
  'Normal', 'Heading1', 'Heading2', 'Heading3', 'Heading4', 'Header', 'Caption',
]);
{
  const missing = new Set(missingStyles(body('freshBody'), sheet));
  const custom = OURS.filter((id) => !WORD_BUILT_IN.has(id));
  check('a fresh document has none of the custom styles',
    custom.filter((id) => !missing.has(id)), []);
  check('and there are some custom ones to check — the control',
    custom.length > 8, true);
  /* Which built-ins Word already had, for the record: it is why "sixteen
     missing" would have been the wrong expectation. */
  console.log(`  --   Word already had: ${
    OURS.filter((id) => !missing.has(id)).join(', ') || 'none'}
`);
}

/* 2. the specimen puts every one of them in. */
check('the specimen puts them all in',
  missingStyles(body('afterSpecimenBody'), sheet), []);

/* 3. and they survive the specimen being deleted — what `Add the styles` is. */
check('and they survive the text being deleted',
  missingStyles(body('afterDeleteBody'), sheet), [],
  'the whole basis of "Add the styles"');

/* 4. a marked line, out of Word's own OOXML. */
{
  const paragraphs = readParagraphs(documentPartOf(body('markedBody')))
    .filter(isVerseParagraph);
  const wanted = specimenMarks();
  const line = paragraphs
    .map((p) => decodeRuns(mergeRuns(p.runs)))
    .find((tm) => tm.text.replace(/\s+/g, '') === wanted.text.replace(/\s+/g, ''));
  check('a marked line comes back out of Word as itself', line?.text, wanted.text);
  /*
   * `syl` IS LEFT OUT OF THIS COMPARISON, and only this one. It is syllable
   * DIVISION rather than a marking anybody placed — `command.ts` calls it
   * "division, not an opinion" — and it is derived on the way back in, so a
   * line built by hand has none and a line read out of Word has one per
   * syllable. His lines below are compared WITH it, because both sides of
   * that comparison are derived and a change in syllabification would matter.
   */
  const placed = (marks) => marksOf(marks).filter((m) => !m.startsWith('syl:'));
  check('with every marking on it', line === undefined ? null : placed(line.marks),
    placed(wanted.marks));
  check('and Word did divide it into syllables — the control',
    line !== undefined && marksOf(line.marks).some((m) => m.startsWith('syl:')), true);
  /* AND WORD DREW IT IN HIS TYPE, which is Word's answer and not ours read
     back: `Translit` is 16 pt Arial with 24 pt exact leading in his template,
     and a style that never arrived would leave 11 pt Calibri here. */
  const drawn = list(live.markedParagraphs).find((p) => p.text.includes('agnim'));
  check('and Word resolved it to the mantra style', drawn?.style, 'Translit');
  /*
   * 9999999 IS WORD SAYING "MIXED", not a size. `Range.Font.Size` over a range
   * whose runs differ answers with that sentinel, and a marked mantra line
   * genuinely does differ: the letters are his 16 pt and a `Svara` is 18 pt.
   * So the paragraph's own size is asked of its FIRST LETTER, which is a
   * letter and not a mark.
   */
  check('and its first letter is his 16 pt', live.markedFirstLetterSize, 16);
  check('and the accents are a different size from the letters — the control',
    drawn?.size, 9999999,
    'a paragraph of one size would make the check above prove nothing');
}

/* 4b. the specimen, as Word drew it. */
{
  const drawn = list(live.specimenParagraphs);
  /* Every paragraph style in the specimen came out as itself. `Normal` is
     Word's own and is reported under its localised name, so it is left out. */
  const named = drawn.filter((p) => /^[A-Za-z0-9]+ —/.test(p.text.trim()));
  /*
   * SPACES REMOVED, because Word answers with the style's DISPLAY NAME and the
   * add-in addresses styles by ID: `Heading2` is shown as "Heading 2", and in
   * a localised Word it is shown in that language. The id is what `w:pStyle`
   * names and the only thing that has to match.
   */
  const bare = (s2) => String(s2).split(' ').join('');
  const wrong = named.filter((p) => bare(p.style) !== bare(p.text.trim().split(' —')[0]));
  check('every paragraph style in the specimen resolved to itself',
    wrong.map((p) => `${p.text.trim().split(' —')[0]} drew as ${p.style}`), []);
  check('and there were some to check — the control',
    named.length > 4, true);
}

/* 5. HIS DOCUMENT. */
if (his.writes.length === 0) {
  results.push({ ok: false, what: 'his document was not readable', got: HIS, want: 'a file' });
} else {
  check('Word and the reader agree how many paragraphs he has',
    live.hisParagraphsWord, his.paragraphs,
    'writeDocument addresses paragraphs by index across two reads');
  check('every mantra line offered was written', live.hisWritten, his.writes.length);
  /*
   * THE PARAGRAPH COUNT, WRITE BY WRITE.
   *
   * `insertOoxml` over a whole paragraph replaces its MARK as well, and when
   * the next paragraph was empty Word coalesced the two: one write took 872 to
   * 871, and from there every index in the run pointed at the wrong line.
   * Replacing the paragraph's CONTENT instead — `getRange('Content')`, which
   * stops before the mark — holds all twelve at 872. `WORD_WRITE_MODE=whole`
   * reproduces the fault.
   */
  const moved = list(live.hisCounts).filter((c) => c.was !== c.now);
  check('no write changed the number of paragraphs',
    moved.map((c) => `${c.index}: ${c.was} -> ${c.now}`), []);
  check('and writing them did not add or lose a paragraph',
    live.hisParagraphsAfter, live.hisParagraphsWord,
    'insertOoxml over a paragraph must replace it, not split it');

  const after = readParagraphs(documentPartOf(body('hisBodyAfter')));
  let same = 0;
  const wrong = [];
  for (const one of his.expect) {
    const p = after[one.index];
    if (p === undefined) { wrong.push(`${one.index}: gone`); continue; }
    const tm = decodeRuns(mergeRuns(p.runs));
    if (tm.text !== one.text) {
      wrong.push(`${one.index}: text\n      was  ${JSON.stringify(one.text)}\n      now  ${JSON.stringify(tm.text)}`);
      continue;
    }
    const got = marksOf(tm.marks);
    if (JSON.stringify(got) !== JSON.stringify(one.marks)) {
      wrong.push(`${one.index}: ${one.marks.length} markings became ${got.length}`);
      continue;
    }
    same += 1;
  }
  check('his mantra lines are byte-identical after the add-in writes them',
    same, his.expect.length,
    wrong.length === 0 ? '' : `\n    ${wrong.slice(0, 4).join('\n    ')}`);
}

/* ── the report ─────────────────────────────────────────────────────────── */

for (const r of results) {
  const mark = r.ok ? 'ok  ' : 'FAIL';
  const value = r.ok ? String(r.got) : `${JSON.stringify(r.got)} (want ${JSON.stringify(r.want)})`;
  console.log(`  ${mark} ${r.what.padEnd(56)} ${value}`);
  if (r.note !== '' && (!r.ok || r.note.startsWith('\n'))) console.log(`       ${r.note}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n  ${his.writes.length} of his mantra lines written back in real Word.`);
console.log(`  the files are in ${DIR}/ — each file is Word's own OOXML.\n`);
if (failed.length > 0) {
  console.error(`WORD LIVE GATE FAILS — ${failed.length} of ${results.length}\n`);
  process.exit(1);
}
console.log(`WORD LIVE GATE PASSES — ${results.length} checks against Word ${live.version}\n`);
