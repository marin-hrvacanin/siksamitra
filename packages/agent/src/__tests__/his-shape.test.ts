/**
 * A DOCUMENT THE AGENT MAKES IS LAID OUT AS HIS ARE.
 *
 * His krimi saṁhāraka sūktam opens: Heading 2 "krimi saṁhāraka sūktam",
 * Heading 3 "taittirīya āraṇyaka 4.36-37", then each mantra line in
 * Translit with its Prijevod after it. The agent's outline is written as
 * those paragraphs and read back by the importers' builder, so the document
 * it makes — and the Word file made from that — has his shape. Read out of
 * the exported file itself.
 */
import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { exportWord, readParagraphs } from '@siksamitra/interop';
import { exportStyle, styleStacks } from '@siksamitra/tokens/export-styles';
import { documentOf } from '../index.js';

const KRIMI = {
  title: 'krimi saṁhāraka sūktam',
  locus: 'taittirīya āraṇyaka 4.36-37',
  description: 'The germ-destroying mantra',
  sections: [{
    verses: [
      { lines: ['atri̍ṇā tvā krime hanmi । kaṇve̍na ja̱mada̍gninā ।'], translation: 'By the power of Atri, o germ, I kill you.' },
      { lines: ['oṁ śānti̱ś śānti̱ś śānti̍ḥ ॥'], translation: 'Peace, peace, peace.' },
    ],
  }],
};

const PURUSHA = {
  title: 'puruṣa sūktam',
  locus: 'ṛgveda 10.90 · taittirīya āraṇyaka 3.12',
  sections: [
    { title: 'prathamo’nuvākaḥ', cite: 'taittirīya āraṇyaka 3.12', verses: [{ lines: ['sa̱hasra̍śīrṣā̱ puru̍ṣaḥ ।'] }] },
    { title: 'dvitīyo’nuvākaḥ', cite: 'uttara-nārāyaṇa', verses: [{ lines: ['a̱dbhyas sambhū̍taḥ pṛthi̱vyai rasā̎cca ।'] }] },
  ],
};

async function paragraphs(doc: ReturnType<typeof documentOf>): Promise<{ style: string; text: string }[]> {
  const style = exportStyle('veda-union');
  const stacks = styleStacks(style);
  const bytes = await exportWord({ doc, style, textStack: stacks.text, uiStack: stacks.ui, engine: 'test', slug: 'x.docx', script: 'iast' });
  const xml = strFromU8(unzipSync(bytes)['word/document.xml']!);
  return readParagraphs(xml)
    .map((p) => ({ style: p.pStyle ?? 'Normal', text: p.runs.filter((r) => r.hidden !== true).map((r) => r.text).join('').trim() }))
    .filter((p) => p.text !== '');
}

describe('a document the agent builds', () => {
  it('has his single document’s parts: the name, the locus, the lines', () => {
    const doc = documentOf(KRIMI);
    expect(doc.title).toBe('krimi saṁhāraka sūktam');
    expect(doc.sections.map((s) => s.part)).toEqual(['taittirīya āraṇyaka 4.36-37']);
    expect(doc.sections[0]!.verses).toHaveLength(2);
    expect(doc.sections[0]!.verses[0]!.translation?.en).toBe('By the power of Atri, o germ, I kill you.');
    /* Kept for the website beside the name. */
    expect(doc.subtitle).toBe('The germ-destroying mantra');
    expect(doc.source).toBe('taittirīya āraṇyaka 4.36-37');
  });

  it('exports to Word as his file opens: Heading 2 the name, Heading 3 the locus, then mantra and translation', async () => {
    const ps = await paragraphs(documentOf(KRIMI));
    expect(ps.slice(0, 2)).toEqual([
      { style: 'Heading2', text: 'krimi saṁhāraka sūktam' },
      { style: 'Heading3', text: 'taittirīya āraṇyaka 4.36-37' },
    ]);
    const roles = ps.slice(2).map((p) => p.style);
    expect(roles[0]).toMatch(/^(Translit|Mantra)$/);
    expect(roles[1]).toMatch(/^(Prijevod|Translation)$/);
  });

  it('a text with sections: each its own title (his Heading 4) and its source line under it', async () => {
    const doc = documentOf(PURUSHA);
    expect(doc.sections.map((s) => [s.title, s.source, s.part])).toEqual([
      ['prathamo’nuvākaḥ', 'taittirīya āraṇyaka 3.12', 'ṛgveda 10.90 · taittirīya āraṇyaka 3.12'],
      ['dvitīyo’nuvākaḥ', 'uttara-nārāyaṇa', 'ṛgveda 10.90 · taittirīya āraṇyaka 3.12'],
    ]);
    const ps = await paragraphs(doc);
    const at = (text: string) => ps.findIndex((p) => p.text === text);
    expect(ps[at('prathamo’nuvākaḥ')]!.style).toBe('Heading4');
    expect(at('taittirīya āraṇyaka 3.12')).toBe(at('prathamo’nuvākaḥ') + 1);
  });

  it('several sections without titles are refused — they would run together', () => {
    expect(() => documentOf({ title: 'x', sections: [{ verses: [{ lines: ['a'] }] }, { verses: [{ lines: ['b'] }] }] }))
      .toThrow(/needs a title for each/);
  });
});
