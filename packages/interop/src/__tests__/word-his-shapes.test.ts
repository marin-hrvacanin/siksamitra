/**
 * HIS LINES, READ AND WRITTEN — every shape `check:word:reference` found a
 * rewrite getting wrong, as a unit case.
 *
 * Each comes out of his own reference documents and is typed here by hand: a
 * no-break space, a double space, the tab that indents a pāda, the space
 * around a pause, a daṇḍa's face, the Ṛgvedic overline, a raised aid, his
 * candrabindu glyph, a box drawn over a space. The expectation is always the
 * OOXML his file has, not what our writer produces.
 */
import { describe, expect, it } from 'vitest';
import type { ChantToken } from '@siksamitra/format';
import { toTextAndMarks, toTokens } from '@siksamitra/format';
import { splitLetters } from '@siksamitra/engine';
import { tokensFromRuns } from '../docx-runs.js';
import { mergeRuns, readParagraphs, wordRun as run } from '../docx-read.js';
import { documentThemeOf, exportStyle, styleStacks } from '@siksamitra/tokens/export-styles';
import { documentXml } from '../word/body.js';
import { inVocabulary } from '../word/vocabulary.js';
import { stylesXml } from '../word/styles.js';
import { blank } from './runs-helpers.js';

const help = { spell: (s: string) => ({ deva: s } as never), split: splitLetters };
const read = (...runs: ReturnType<typeof run>[]): ChantToken[] => tokensFromRuns(runs, blank(), 'x');
/** Read the runs, go through text + markings, and write the paragraph. */
const rewrite = (...runs: ReturnType<typeof run>[]): string => {
  const tm = toTextAndMarks({ id: 'v', tokens: read(...runs) });
  const doc = { title: '', titleForms: {}, sections: [{ id: 's', verses: [{ id: 'v', tokens: toTokens(tm, help) }] }] };
  return /<w:body>([\s\S]*)<\/w:body>/.exec(documentXml(doc as never))![1]!;
};
/** The written runs as `style:text`, the way his file would be read. */
const cells = (xml: string): string[] => mergeRuns(readParagraphs(xml).flatMap((p) => p.runs))
  .map((r) => `${r.rStyle ?? '-'}${r.superscript ? '^' : ''}:${r.text}`);

describe('whitespace, exactly as he typed it', () => {
  it('a no-break space is read as one', () => {
    expect(read(run('tat savitur')).filter((t) => t.t === 'sp')).toEqual([{ t: 'sp', nb: true }]);
  });
  it('and written back as one', () => {
    expect(rewrite(run('tat savitur'))).toContain('<w:t xml:space="preserve"> </w:t>');
  });
  it('two spaces are two', () => {
    expect(read(run('aṁ  aiṁ')).filter((t) => t.t === 'sp')).toHaveLength(2);
  });
  it('the tab that indents a pāda after a line break is kept, as `<w:tab/>`', () => {
    const tokens = read(run('rujā'), run(' \n\tcakr'));
    expect(tokens.map((t) => t.t)).toEqual(['syl', 'syl', 'br', 'sp', 'syl']);
    expect(rewrite(run('rujā'), run(' \n\tcakr'))).toContain('<w:r><w:br/></w:r><w:r><w:tab/></w:r>');
  });
  it('a space the paragraph STARTS with is still dropped — nothing is before it', () => {
    expect(read(run('  agne'))[0]!.t).toBe('syl');
  });
  it('a no-break space inside a box is still a no-break space', () => {
    expect(read(run('n n', 'Holding')).filter((t) => t.t === 'sp')).toEqual([{ t: 'sp', nb: true }]);
  });
});

describe('a pause keeps the spaces he gave it, and no others', () => {
  it('`…ˎ|` — no space before the pause, none invented', () => {
    const tokens = read(run('ma'), run('ˎ', 'Virama'), run('|', 'Pause'), run(' va'));
    const i = tokens.findIndex((t) => t.t === 'pause');
    expect(tokens[i - 1]!.t).not.toBe('sp');
    expect(tokens[i + 1]).toEqual({ t: 'sp' });
  });
  it('a pause run with its spaces inside it: ` | `', () => {
    const tokens = read(run('oṁ'), run(' | ', 'Pause'), run('sa'));
    expect(tokens.map((t) => t.t)).toEqual(['syl', 'sp', 'pause', 'sp', 'syl']);
  });
  it('letters typed after a pause, in its run, keep the space between', () => {
    const tokens = read(run('oṁ '), run('| sa', 'Pause'));
    expect(tokens.map((t) => t.t)).toEqual(['syl', 'sp', 'pause', 'sp', 'syl']);
  });
  it('the space before a pause that ends a line is written back', () => {
    const xml = rewrite(run('ṇyam '), run('|', 'Pause'), run('\nbha'));
    expect(cells(xml).join('|')).toContain('-:ṇyam |Pause:|');
  });
});

describe('his faces and colours', () => {
  it('a daṇḍa is set in Mangal, as every one of his is', () => {
    expect(rewrite(run('namaḥ ।'))).toContain('<w:rFonts w:ascii="Mangal" w:hAnsi="Mangal" w:cs="Mangal" w:hint="cs"/></w:rPr><w:t xml:space="preserve">।</w:t>');
  });
  it('a raised aid is his: blue, italic, raised', () => {
    const style = exportStyle('veda-union');
    const stacks = styleStacks(style);
    const sheet = stylesXml({
      theme: documentThemeOf(style), mode: style.mode, textStack: stacks.text, uiStack: stacks.ui,
      usedStyles: new Set(['Reference']),
    });
    const def = /<w:style [^>]*w:styleId="Reference"[\s\S]*?<\/w:style>/.exec(sheet)?.[0] ?? '';
    expect(def).toContain('<w:i/>');
    expect(def).toContain('<w:vertAlign w:val="superscript"/>');
    expect(def).toMatch(/<w:color w:val="0070C0"\/>/);
  });
});

describe('the Ṛgvedic overline', () => {
  it('rides in its letter, and is written in `Long`, after the letter and before the accent', () => {
    const cellsOf = cells(rewrite(run('yu'), run('̅', 'Long'), run('̍', 'Svara'), run('vase')));
    const at = cellsOf.indexOf('Long:̅');
    expect(at).toBeGreaterThan(0);
    expect(cellsOf[at + 1]).toBe('Svara:̍');
    /* Once — it used to be twice, the overline read as a letter of its own. */
    expect(cellsOf.filter((c) => c.startsWith('Svara:'))).toHaveLength(1);
    expect(cellsOf.join('')).not.toContain('-:̅');
  });
});

describe('his candrabindu, in his document', () => {
  const written = rewrite(run('ti'), run('m̐', 'Anusvara'), run('gṁ', 'Anusvara', true), run(' ha'));
  it('is U+F141 in `VedicAnusvara` when the document speaks his vocabulary', () => {
    expect(inVocabulary(written, 'legacy')).toContain('<w:rStyle w:val="VedicAnusvara"/></w:rPr><w:t xml:space="preserve"></w:t>');
  });
  it('and the portable pair in a new one — U+F141 is drawn by one font only', () => {
    const clean = inVocabulary(written, 'clean');
    expect(clean).not.toContain('');
    expect(clean).toContain('m̐');
  });
  it('his glyph reads back as the same letter', () => {
    const units = read(run('ti'), run('', 'VedicAnusvara'), run('gṁ', 'Anusvara', true))
      .flatMap((t) => (t.t === 'syl' ? t.units : []));
    expect(units.at(-1)).toMatchObject({ c: 'm', candra: true, sup: 'gṁ' });
  });
});

describe('a box over a space', () => {
  it('his one box over `n n` is written as one box — the space in it', () => {
    const c = cells(rewrite(run('vipa'), run('n n', 'Holding'), run('arā')));
    expect(c).toContain('Holding:n n');
  });
});

describe('the virāma style', () => {
  it('a tick for each tick, and none for another character in the style', () => {
    const units = read(run('kvacit'), run('ˎ', 'Virama'), run('।'), run('*', 'Virama'), run(')'))
      .flatMap((t) => (t.t === 'syl' ? t.units : []));
    expect(units.filter((u) => u.c === 'ˎ')).toHaveLength(1);
    expect(units.map((u) => u.c)).toContain('*');
  });
});
