/**
 * HIS LINES, WRITTEN BACK BY THE ADD-IN, DRAW THE SAME — with no file of his.
 *
 * `check:word:reference` measures this over his six documents, which are not
 * in the repository. This is the same measurement over lines typed here in
 * the exact OOXML shape his files use, against the style table of his own
 * template (`tools/chant/templates/vu-word-template.docx`), so it runs
 * everywhere and fails in CI.
 *
 * THE EXPECTATION IS HIS OOXML. Each line goes in as he wrote it; what comes
 * out is the add-in's own path (`decodeRuns`, `lineNotes`, `lineXml`,
 * `inVocabulary`); both are drawn by `word-look.ts`, which shares no code with
 * the writer. Every shape below is one a rewrite once got wrong.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { hisStylesAsClean, legacyStylesIn, lineNotes, mergeRuns, paragraphXml, readParagraphs } from '@siksamitra/interop';
import { packageFor, stylesPartOf } from '../../apps/word-addin/src/model/package.js';
import { documentPartOf } from '../../apps/word-addin/src/model/opc.js';
import { decodeRuns } from '../../apps/word-addin/src/model/paragraph.js';
import { lineXml } from '../../apps/word-addin/src/model/line-xml.js';
import { styleSheetFor } from '../../apps/word-addin/src/model/sheet.js';
import { asRuled, differences, drawn, inserted, styleTable } from '../../packages/cli/src/word-look.js';

const TEMPLATE = join(process.cwd(), 'tools', 'chant', 'templates', 'vu-word-template.docx');
const HIS_STYLES = strFromU8(unzipSync(new Uint8Array(readFileSync(TEMPLATE)))['word/styles.xml']!);
const his = styleTable(HIS_STYLES);
const hisClean = hisStylesAsClean(HIS_STYLES);

const P = (inner: string): string => `<w:p><w:pPr><w:pStyle w:val="Translit"/></w:pPr>${inner}</w:p>`;
const R = (text: string, style?: string, more = ''): string =>
  `<w:r>${style === undefined && more === '' ? '' : `<w:rPr>${style === undefined ? '' : `<w:rStyle w:val="${style}"/>`}${more}</w:rPr>`}`
  + `<w:t xml:space="preserve">${text}</w:t></w:r>`;
const BR = '<w:r><w:br/></w:r>';
const TAB = '<w:r><w:tab/></w:r>';
const DANDA = (d: string): string => `<w:r><w:rPr><w:rFonts w:ascii="Mangal" w:hAnsi="Mangal" w:cs="Mangal" w:hint="cs"/></w:rPr><w:t>${d}</w:t></w:r>`;
const RAISED = (t: string): string => R(t, 'Anusvara', '<w:vertAlign w:val="superscript"/>');

/**
 * His line, through the add-in, drawn: the differences, which must be none.
 *
 * THE CLEAN PATH — the owner's ruling of 2026-09-30: the add-in writes the
 * clean style names into every document, and in one of his the clean styles
 * take his definitions (`packageFor`). Word keeps a style the document already
 * has and adds one it lacks (`inserted`), so what is drawn is his template's
 * look under names his template does not have.
 */
function rewritten(line: string): string[] {
  const [p] = readParagraphs(line);
  const runs = mergeRuns(p!.runs);
  const body = lineXml({ tm: decodeRuns(runs), style: p!.pStyle, script: 'iast', notes: lineNotes(runs).notes });
  const pkg = packageFor(body, styleSheetFor(body), hisClean);
  const ours = paragraphXml(documentPartOf(pkg))[0]!;
  /* And it is IN the clean names: none of his older ids is left in the line. */
  expect(legacyStylesIn(ours)).toEqual([]);
  return differences(asRuled(drawn(line, his)), asRuled(drawn(ours, inserted(his, styleTable(stylesPartOf(pkg))))));
}

const LINES: [string, string][] = [
  ['a no-break space between two words', P(R('śuklā') + R('̍', 'Svara') + R('m bara') + R('̍', 'Svara') + R('dharaṁ'))],
  ['a double space before a pause', P(R('aṁ  ') + R('|', 'Pause') + R(' aiṁ'))],
  ['the tab that indents a pāda after `|⏎`', P(R('rujā ') + R('|', 'Anusvara') + R(' ') + BR + TAB + R('ca') + R('̱', 'Svara') + R('krā'))],
  ['a pause that ends a pāda, with its space', P(R('vare') + R('̎', 'Svara') + R('ṇya') + R('̱', 'Svara') + R('m ') + R('|', 'Pause') + BR + R('bhargo'))],
  ['no space before a pause after a virāma', P(R('ma') + R('ˎ', 'Virama') + R('|', 'Pause') + R(' ') + R('v', '2Holding') + R('a'))],
  ['daṇḍas in Mangal, and a verse number', P(R('namaḥ ') + DANDA('॥') + R(' 1') + DANDA('॥'))],
  ['a raised reading aid, blue and italic', P(R('sutā') + R('ṁ', 'Anusvara') + RAISED('u') + R(' vāṇī'))],
  ['a visarga recited as another letter, in his Anusvara', P(R('vi') + R('s', 'Anusvara') + R(' ') + R('s', 'Holding') + R('ta'))],
  ['his candrabindu glyph, with its reading aid', P(R('ti') + R('', 'VedicAnusvara') + RAISED('gṁ') + R(' ha'))],
  ['the Ṛgvedic overline, in Long, before the accent', P(R('yu') + R('̅', 'Long') + R('̍', 'Svara') + R('vase'))],
  ['one box over two words, the no-break space in it', P(R('vipa') + R('̱', 'Svara') + R('n n', 'Holding') + R('a') + R('̍', 'Svara') + R('rā'))],
  ['a long box and a short one', P(R('a') + R('g', '2Holding') + R('nim ī') + R('ḷ', 'Holding') + R('e'))],
  ['a note at the end of the line', P(R('ṛ') + R('̱', 'Svara') + R('ṣiḥ ') + DANDA('।') + R(' ') + R('svarabhakti', 'Comment'))],
  ['a note at the end of a pāda, before the break', P(R('agne ') + DANDA('।') + R(' ') + R('bramha', 'Comment') + BR + R('īḷe'))],
  ['a note with a raised part', P(R('sūktam') + R('ˎ', 'Virama') + DANDA('।') + R(' ') + R('83', 'Comment') + R('rd', 'Comment', '<w:vertAlign w:val="superscript"/>') + R(' sūkta', 'Comment'))],
];

describe('his lines, written back by the add-in, draw the same', () => {
  for (const [what, line] of LINES) {
    it(what, () => expect(rewritten(line)).toEqual([]));
  }
});

describe('the measurement can fail — the controls', () => {
  it('a daṇḍa written plain is a different drawing', () => {
    expect(differences(drawn(P(DANDA('।')), his), drawn(P(R('।')), his))).not.toEqual([]);
  });
  it('an ordinary space for a no-break one is a different drawing', () => {
    expect(differences(drawn(P(R('a b')), his), drawn(P(R('a b')), his))).not.toEqual([]);
  });
  it('a raised aid in grey is a different drawing', () => {
    expect(differences(drawn(P(RAISED('u')), his), drawn(P(R('u', undefined, '<w:color w:val="808080"/><w:vertAlign w:val="superscript"/>')), his))).not.toEqual([]);
  });
});
