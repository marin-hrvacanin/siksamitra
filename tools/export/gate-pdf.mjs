#!/usr/bin/env node
/**
 * THE PDF EXPORT GATE — is the PDF lossless, and is it the Word file?
 *
 * OWNER'S REQUIREMENT: "The Word document and the PDF from it should be
 * identical", and "if there is even 0.001 % loss, then fix the logic".
 *
 * TWO QUESTIONS, and they are answered differently.
 *
 * LOSSLESS is answered the way the HTML and Word gates answer it: print all
 * eleven corpus documents, read each one back with `importPdf`, and compare the
 * recovered document with the ORIGINAL loaded from disk — not with the manifest
 * the exporter wrote and not with the hash it computed.
 *
 * IDENTICAL cannot be answered by asserting it. The two files are produced by
 * different programs from different inputs, so this MEASURES both and prints
 * the difference: the `.docx`'s styles are parsed back into points, the PDF's
 * text is read out of its content streams, and the two are compared on type
 * size, leading, indents, colour and where the lines break. The worst
 * divergence is reported as a number whether it passes or not, because a
 * tolerance nobody can see is a tolerance that quietly widens.
 *
 * THE THIRD MEASUREMENT NEEDS WORD and is therefore optional. Point
 * `WORD_PDF=<path>` at a PDF that Word itself printed from our `.docx` — see
 * `tools/export/word-survives.ps1 -Pdf` — and the same instrument measures it
 * and prints line-for-line deltas against ours. That is the calibration behind
 * the numbers in `docs/EXPORT-WORD-PDF.md`; the gate passes without it because a
 * build machine has no Office.
 *
 *   npm run check:export:pdf
 *   WORD_PDF=artifacts/export/pair-veda-union-word.pdf npm run check:export:pdf
 */
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { canonicalJson } from '@siksamitra/format';
import { importPdf, PDF_ATTACHMENT, WORD_PARTS } from '@siksamitra/interop';
import { DEFAULT_PAGE, pageGeometry } from '@siksamitra/layout';
import { EXPORT_STYLES } from '@siksamitra/tokens/export-styles';
import { loadDoc } from './page.mjs';
import { buildPdf } from './pdf.mjs';
import { buildWord } from './word.mjs';
import { withBrowser } from './raster.mjs';
import { linesOf as docxLines, stylesOf } from './docx-metrics.mjs';
import { linesOf, readPages } from './pdf-text.mjs';

const CORPUS = 'corpus/chants';
const OUT = 'artifacts/export';
const FIXED = '2026-01-01T00:00:00.000Z';
const SECTION = '#sec-1';

const problems = [];
const fail = (what, detail) => problems.push(`${what}: ${detail}`);

/** Where two documents first differ, as paths a person can look up. */
function differences(a, b, path = '', out = []) {
  if (out.length >= 4 || a === b) return out;
  const shape = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  if (shape(a) !== shape(b)) {
    out.push(`${path || '<root>'}: ${shape(a)} became ${shape(b)}`);
    return out;
  }
  if (shape(a) === 'array') {
    if (a.length !== b.length) out.push(`${path}: ${a.length} items became ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
      differences(a[i], b[i], `${path}[${i}]`, out);
    }
    return out;
  }
  if (shape(a) === 'object') {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      differences(a[key], b[key], path === '' ? key : `${path}.${key}`, out);
    }
    return out;
  }
  out.push(`${path}: ${JSON.stringify(a)} became ${JSON.stringify(b)}`);
  return out;
}

/**
 * A line reduced to the letters that can be compared between the two files.
 *
 * SPACES GO because Chrome positions words with a `TJ` array rather than by
 * showing a space character, so a line it printed comes back with no spaces in
 * it at all while the same line out of the `.docx` has them. Comparing the
 * spaces would only ever report on how each producer encodes a gap.
 *
 * COMBINING MARKS GO because the two media draw a svara by different means, and
 * this is a real difference rather than a measurement artefact. In the `.docx`
 * an accent is a CHARACTER — U+0331 in the `Svara` style, which is how his own
 * file writes it. On the page it is a DRAWN STROKE, positioned by
 * `MARK_GEOMETRY.svaraStroke`, so the PDF's text layer has nothing there at
 * all: the two pages look the same and only one of them can be searched for an
 * accented syllable. Named in `docs/EXPORT-WORD-PDF.md`; counted below.
 *
 * The SVARABHAKTI DOT, U+00B7, goes for the same reason: `MARK_GEOMETRY`'s
 * `sbhaktiDot` draws it, so it is a filled circle on the page and a character
 * in the `.docx`.
 */
const letters = (s) => s
  .replace(/\s+/g, '')
  .replace(/·/g, '')
  .normalize('NFD')
  .replace(/\p{Mn}/gu, '');

mkdirSync(OUT, { recursive: true });
const files = readdirSync(CORPUS).filter((f) => f.endsWith('.json')).sort();
const page = pageGeometry(DEFAULT_PAGE);

await withBrowser(async (browser) => {
  console.log(`\n── printing ${files.length} documents as PDF and reading them back\n`);
  for (const file of files) {
    const original = loadDoc(join(CORPUS, file));
    const out = await buildPdf(browser, original, { style: 'veda-union', savedAt: FIXED });
    const back = await importPdf(out.bytes);

    const before = canonicalJson(original);
    const after = canonicalJson(back.doc);
    if (before !== after) {
      fail(file, `the document changed (${before.length} vs ${after.length} canonical bytes)`);
      for (const d of differences(original, back.doc)) fail(`  ${file}`, d);
    }
    if (!back.intact) fail(file, `the recorded hash does not match: ${back.docHash}`);

    /* The bytes the browser produced are UNTOUCHED — that is what makes an
       incremental update safe, and it is checkable rather than assumed. */
    const head = out.bytes.subarray(0, out.printed.length);
    if (Buffer.compare(Buffer.from(head), Buffer.from(out.printed)) !== 0) {
      fail(file, 'embedding rewrote the printed bytes');
    }

    const pages = readPages(out.bytes);
    if (pages.length === 0) fail(file, 'no pages');
    const w = pages[0]?.box[2] ?? 0;
    if (Math.abs(w - page.width) > 1) fail(file, `the sheet is ${w.toFixed(2)} pt wide`);

    console.log(`  ${file.padEnd(32)} ${String(pages.length).padStart(3)} pp  `
      + `${(out.bytes.length / 1048576).toFixed(2)} MB  `
      + `${back.intact && before === after ? 'exact' : 'LOSSY'}`);
  }

  /* Every style prints, and the document survives every one of them. */
  console.log('');
  const sample = loadDoc(join(CORPUS, 'durga-suktam.json'));
  for (const style of EXPORT_STYLES) {
    const out = await buildPdf(browser, sample, {
      style: style.id, select: SECTION, savedAt: FIXED,
    });
    const back = await importPdf(out.bytes);
    const same = canonicalJson(back.doc) === canonicalJson(out.built.doc);
    if (!same) fail(style.id, 'the document did not survive this style');
    if (back.manifest.style !== style.id) fail(style.id, `the manifest says "${back.manifest.style}"`);
    const pages = readPages(out.bytes);
    const inked = linesOf(pages[0]).length;
    if (inked < 4) fail(style.id, `${inked} lines of text on the first page`);
    writeFileSync(join(OUT, `gate-${style.id}.pdf`), out.bytes);
    console.log(`  ${style.id.padEnd(16)} ${style.frame.padEnd(6)} `
      + `${String(pages.length).padStart(2)} pp  ${String(inked).padStart(3)} lines  `
      + `${(out.bytes.length / 1048576).toFixed(2)} MB  ${same ? 'exact' : 'LOSSY'}`);
  }

  /*
   * EMBEDDING TWICE. A file that has been through this once is a file with a
   * `/Names /EmbeddedFiles` already in its catalogue, and the second pass has
   * to supersede it rather than nest inside it. The reader must then find the
   * NEWER document, not the older one.
   */
  const first = await buildPdf(browser, sample, {
    style: 'veda-union', select: SECTION, savedAt: FIXED,
  });
  const { embedInPdf, embedded, PDF_FORMAT, PDF_VERSION } = await import('@siksamitra/interop');
  const other = loadDoc(join(CORPUS, 'vishnu-suktam.json'));
  const second = await embedded(PDF_FORMAT, PDF_VERSION, {
    doc: other, slug: 'vishnu.pdf', engine: 'gate', style: 'veda-union',
    script: 'iast', savedAt: FIXED,
  });
  const twice = embedInPdf(first.bytes, second.manifest, second.json);
  const readBack = await importPdf(twice);
  if (canonicalJson(readBack.doc) !== canonicalJson(other)) {
    fail('embed twice', 'the reader found the older document');
  }
  console.log(`\n  embedded twice   the newer document wins, `
    + `${(twice.length / 1048576).toFixed(2)} MB`);

  /* THE EMBEDDING IS DETERMINISTIC even though the printing is not: Chrome
     stamps a `/CreationDate` into every PDF it writes, so two prints of one
     document can never be byte-identical. What can be — and is — is the append:
     the same input bytes and the same manifest give the same output. */
  const again = embedInPdf(first.printed, first.manifest, second.json);
  const once = embedInPdf(first.printed, first.manifest, second.json);
  if (Buffer.compare(Buffer.from(again), Buffer.from(once)) !== 0) {
    fail('determinism', 'two embeddings of one document differ');
  }
  const dated = /\/CreationDate\s*\(([^)]*)\)/.exec(
    new TextDecoder('latin1').decode(first.printed),
  )?.[1] ?? null;
  console.log(`  determinism      the append is byte-stable; the browser stamps `
    + `${dated === null ? 'no date' : dated}`);

  /* A PDF printed from anything else has the page and not the document. */
  let refused = '';
  try {
    await importPdf(new Uint8Array(Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n')));
  } catch (e) {
    refused = e.message;
  }
  if (!refused.includes(PDF_ATTACHMENT.document) || !refused.includes('has the page but not')) {
    fail("someone else's PDF", `was not refused clearly — said "${refused}"`);
  }

  /* ── the Word file and the PDF, measured against each other ──────────── */
  console.log('\n── the .docx and the .pdf of one document, measured\n');
  const word = await buildWord(sample, { style: 'veda-union', select: SECTION, savedAt: FIXED });
  const printed = await buildPdf(browser, sample, {
    style: 'veda-union', select: SECTION, savedAt: FIXED,
  });
  writeFileSync(join(OUT, 'agree.docx'), word.bytes);
  writeFileSync(join(OUT, 'agree.pdf'), printed.bytes);

  const zip = unzipSync(word.bytes);
  const styles = stylesOf(strFromU8(zip[WORD_PARTS.styles]));
  const wordText = docxLines(strFromU8(zip[WORD_PARTS.document]));
  const pdfPages = readPages(printed.bytes);
  const pdfText = pdfPages.flatMap((p) => linesOf(p));

  const worst = [];
  const compare = (what, got, want, tol) => {
    worst.push({ what, delta: Math.abs(got - want) });
    if (Math.abs(got - want) > tol) fail(what, `${got.toFixed(2)} pt against ${want.toFixed(2)} pt`);
  };

  /* The mantra lines: the PDF rows set at the `Translit` size in the ink
     colour. Everything else on the page is a different size or a different
     grey, so no classification by content is needed. */
  const mantra = pdfText.filter((l) => Math.abs(l.size - styles.Translit.size) < 0.5
    && l.fill === '000000');
  const translation = pdfText.filter((l) => Math.abs(l.size - styles.Prijevod.size) < 0.5);
  if (mantra.length === 0) fail('agreement', 'no mantra lines found in the PDF');
  else {
    compare('mantra size', mantra[0].size, styles.Translit.size, 0.05);

    /* Leading: consecutive baselines inside one verse. Taken as the MODE
       rather than the mean, because the gap between the last line of one verse
       and the first of the next is a paragraph gap and not a leading. */
    const gaps = new Map();
    for (let i = 1; i < mantra.length; i += 1) {
      const d = Math.round((mantra[i - 1].y - mantra[i].y) * 100) / 100;
      if (d > 0) gaps.set(d, (gaps.get(d) ?? 0) + 1);
    }
    const [lead] = [...gaps].sort((a, b) => b[1] - a[1])[0] ?? [0];
    compare('mantra leading', lead, styles.Translit.leading, 0.05);

    /* The two indents. `Translit` is `left=284 hanging=284`: a verse's first
       line comes out to the margin and every line after it sits in. */
    const left = Math.min(...mantra.map((l) => l.x));
    const stepped = mantra.filter((l) => l.x > left + 1);
    compare('first-line indent', left - page.margins.left,
      styles.Translit.indent - styles.Translit.hanging, 0.5);
    if (stepped.length > 0) {
      compare('continuation indent', Math.min(...stepped.map((l) => l.x)) - page.margins.left,
        styles.Translit.indent, 0.5);
    }
    if (translation.length > 0) {
      compare('translation size', translation[0].size, styles.Prijevod.size, 0.1);
      compare('translation indent', Math.min(...translation.map((l) => l.x)) - page.margins.left,
        styles.Prijevod.indent - styles.Prijevod.hanging, 0.5);
      const grey = styles.Prijevod.color.toLowerCase();
      if (translation[0].fill !== grey) {
        fail('translation colour', `#${translation[0].fill} against #${grey}`);
      }
    }
  }

  /*
   * WHERE THE LINES BREAK. `Translit` carries `w:right="-276"`, a negative
   * right indent that lets a long pāda run into the margin rather than wrap, so
   * the `.docx`'s own line structure is what Word will lay out — one line per
   * `<w:br/>`. Comparing that sequence with the sequence the PDF actually
   * printed is the only way to say the two files break in the same places
   * without running Word.
   */
  const wordMantra = wordText.filter((l) => l.style === 'Translit').map((l) => letters(l.text));
  const pdfMantra = mantra.map((l) => letters(l.text));
  let firstDifferent = -1;
  for (let i = 0; i < Math.max(wordMantra.length, pdfMantra.length); i += 1) {
    if (wordMantra[i] !== pdfMantra[i]) { firstDifferent = i; break; }
  }
  if (wordMantra.length !== pdfMantra.length) {
    fail('line breaks', `${wordMantra.length} mantra lines in the .docx, ${pdfMantra.length} in the PDF`);
  }
  if (firstDifferent !== -1) {
    fail('line breaks', `line ${firstDifferent + 1} differs — `
      + `.docx "${(wordMantra[firstDifferent] ?? '').slice(0, 36)}" `
      + `vs PDF "${(pdfMantra[firstDifferent] ?? '').slice(0, 36)}"`);
  }

  worst.sort((a, b) => b.delta - a.delta);
  console.log(`  mantra        ${mantra[0]?.size.toFixed(2)} pt on `
    + `${styles.Translit.leading} pt, .docx says ${styles.Translit.size} pt`);
  console.log(`  indents       first ${(Math.min(...mantra.map((l) => l.x)) - page.margins.left).toFixed(2)} pt, `
    + `.docx says ${(styles.Translit.indent - styles.Translit.hanging).toFixed(2)} pt`);
  console.log(`  lines         ${pdfMantra.length} mantra lines, `
    + `${firstDifferent === -1 && wordMantra.length === pdfMantra.length ? 'every one identical' : 'DIFFER'}`);
  /* The accents the `.docx` writes as characters and the page draws as strokes.
     Not a failure — a difference in mechanism with a consequence worth stating:
     the PDF's text layer cannot be searched for an accented syllable. */
  const accents = wordText
    .filter((l) => l.style === 'Translit')
    .reduce((n, l) => n + (l.text.normalize('NFD').match(/\p{Mn}/gu) ?? []).length, 0);
  const inPdf = mantra
    .reduce((n, l) => n + (l.text.normalize('NFD').match(/\p{Mn}/gu) ?? []).length, 0);
  console.log(`  accents       ${accents} characters in the .docx, ${inPdf} in the PDF's `
    + 'text layer — the page draws them as strokes');
  console.log(`  worst gap     ${worst[0].delta.toFixed(3)} pt (${worst[0].what})`);

  /* ── against a PDF that Word itself printed ──────────────────────────── */
  const wordPdf = process.env.WORD_PDF;
  if (wordPdf === undefined || !existsSync(wordPdf)) {
    console.log('\n  WORD_PDF is not set — the comparison with a real Word print is skipped.');
    console.log('  powershell -File tools/export/word-survives.ps1 -In artifacts/export/agree.docx \\');
    console.log('    -Out artifacts/export/agree-resaved.docx -Pdf artifacts/export/agree-word.pdf');
  } else {
    console.log(`\n── against ${wordPdf}, printed by Word itself\n`);
    const theirs = readPages(new Uint8Array(readFileSync(wordPdf)));
    const isMantra = (l) => Math.abs(l.size - styles.Translit.size) < 0.5 && l.fill === '000000';
    /* PER PAGE, and the page each line landed on. Compared as one flat list the
       worst vertical gap came out as 652 pt, which is the height of a sheet:
       line 27 was the foot of our page 1 and the head of Word's page 2. Where a
       page BREAKS is the interesting comparison and it is made below. */
    const ourPages = pdfPages.map((pg) => linesOf(pg).filter(isMantra));
    const theirPages = theirs.map((pg) => linesOf(pg).filter(isMantra));
    const ourMantra = ourPages.flat();
    const theirMantra = theirPages.flat();
    console.log(`  pages         ${pdfPages.length} ours, ${theirs.length} Word's`);
    console.log(`  mantra lines  ${ourMantra.length} ours, ${theirMantra.length} Word's`);
    console.log(`  per page      [${ourPages.map((x) => x.length).join(', ')}] ours, `
      + `[${theirPages.map((x) => x.length).join(', ')}] Word's`);
    const n = Math.min(ourMantra.length, theirMantra.length);
    let dx = 0;
    let dsize = 0;
    let dlead = 0;
    let dwidth = 0;
    let differs = 0;
    for (let i = 0; i < n; i += 1) {
      dx = Math.max(dx, Math.abs(ourMantra[i].x - theirMantra[i].x));
      dsize = Math.max(dsize, Math.abs(ourMantra[i].size - theirMantra[i].size));
      /* HOW FAR THE LINE REACHES, which is the only measure of what happens
         INSIDE it. The letters are identical and the type is the same size, so
         a line that ends in a different place is one whose gaps differ — the
         page puts CSS margins around a pause and a daṇḍa where the Word file
         has the characters and nothing else. */
      dwidth = Math.max(dwidth, Math.abs(
        (ourMantra[i].right - ourMantra[i].x) - (theirMantra[i].right - theirMantra[i].x),
      ));
      if (letters(ourMantra[i].text) !== letters(theirMantra[i].text)) differs += 1;
    }
    /* The leading, which is what a reader sees rather than an absolute y. */
    for (const [pi, pg] of ourPages.entries()) {
      const other = theirPages[pi] ?? [];
      for (let i = 1; i < Math.min(pg.length, other.length); i += 1) {
        dlead = Math.max(dlead, Math.abs(
          (pg[i - 1].y - pg[i].y) - (other[i - 1].y - other[i].y),
        ));
      }
    }
    /* The FIRST baseline on each page: how far the whole block sits from the
       top. This is where the two layout models genuinely disagree — see
       docs/EXPORT-WORD-PDF.md on exact leading and where a baseline sits in it. */
    const dtop = ourPages.map((pg, pi) => (pg.length === 0 || (theirPages[pi] ?? []).length === 0
      ? 0 : pg[0].y - theirPages[pi][0].y));
    console.log(`  worst dx      ${dx.toFixed(2)} pt`);
    console.log(`  worst leading ${dlead.toFixed(3)} pt`);
    console.log(`  first baseline per page: `
      + `${dtop.map((d) => `${d >= 0 ? '+' : ''}${d.toFixed(2)}`).join(', ')} pt`);
    console.log(`  worst size    ${dsize.toFixed(3)} pt`);
    console.log(`  worst width   ${dwidth.toFixed(2)} pt over a ${page.width
      - page.margins.left - page.margins.right} pt column`);
    console.log(`  lines whose letters differ: ${differs} of ${n}`);
  }
});

console.log(`\n     the files are in ${OUT}/ — open agree.pdf and agree.docx side by side.`);

if (problems.length > 0) {
  console.log(`\n${problems.length} problem(s):\n`);
  for (const p of problems) console.log(`  ${p}`);
  console.log('');
  process.exit(1);
}
console.log('\nPDF EXPORT GATE PASSES — every document round-trips exactly\n');
