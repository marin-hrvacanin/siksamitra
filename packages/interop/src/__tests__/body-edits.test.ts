/**
 * What was done to the page in Word is taken back into the document inside
 * the file (`word/body-edits.ts`) — and nothing else is touched.
 *
 * Each case writes a small document, does to its `document.xml` what a person
 * in Word would — edits a line, marks a letter, types a new verse, deletes one
 * — and asks what came back. The expectations are the letters the test itself
 * typed into the page, never anything computed by the code under test.
 */
import { describe, expect, it } from 'vitest';
import type { ChantDoc, ChantVerse } from '@siksamitra/format';
import { toTextAndMarks } from '@siksamitra/format';
import { mark } from '@siksamitra/engine';
import { documentXml } from '../word/body.js';
import { withBodyEdits } from '../word/body-edits.js';

const verse = (id: string, text: string, en?: string): ChantVerse =>
  ({ id, tokens: mark(text), ...(en === undefined ? {} : { translation: { en } }) });

const doc = (): ChantDoc => ({
  title: 't', titleForms: {},
  sections: [
    { id: 's1', title: 'One', verses: [verse('a', 'agnim īḷe purohitam', 'I praise Agni'), verse('b', 'yajñasya devam ṛtvijam')] },
    { id: 's2', title: 'Two', verses: [verse('c', 'hotāraṁ ratnadhātamam')] },
  ],
});

const textOf = (v: ChantVerse): string => toTextAndMarks(v).text;
const all = (d: ChantDoc): ChantVerse[] => d.sections.flatMap((s) => s.verses);

/** The mantra paragraph of one verse in the page, found by the first letters it shows. */
function paragraphWith(xml: string, first: string): string {
  const paras = xml.match(/<w:p>(?:(?!<w:p>)[\s\S])*?<\/w:p>/g) ?? [];
  const shown = (p: string): string => [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
  const found = paras.find((p) => p.includes('<w:pStyle w:val="Translit"/>') && shown(p).startsWith(first));
  if (found === undefined) throw new Error(`no line beginning ${first}`);
  return found;
}
const plainLine = (text: string): string =>
  `<w:p><w:pPr><w:pStyle w:val="Translit"/></w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

describe('a page nobody touched', () => {
  it('gives back the very document, in every script it can be written in', () => {
    for (const script of ['iast', 'deva', 'tel', 'tam'] as const) {
      const d = doc();
      const back = withBodyEdits(d, documentXml(d, '', undefined, script), undefined, script);
      expect(back, script).toEqual({ doc: d, edited: 0, added: 0, removed: 0 });
      expect(back.doc).toBe(d);
    }
  });
});

describe('a page edited in Word', () => {
  it('takes an edited line, and keeps the verse it was', () => {
    const d = doc();
    const xml = documentXml(d);
    const page = xml.replace(paragraphWith(xml, 'ya'), plainLine('yajñasya devam ṛtvijam hotāram'));
    const back = withBodyEdits(d, page, undefined, 'iast');
    expect([back.edited, back.added, back.removed]).toEqual([1, 0, 0]);
    const b = all(back.doc)[1]!;
    expect(b.id).toBe('b');
    expect(textOf(b)).toBe('yajñasya devam ṛtvijam hotāram');
    /* The verses around it are the very objects the file carried. */
    expect(all(back.doc)[0]).toBe(all(d)[0]);
    expect(all(back.doc)[2]).toBe(all(d)[2]);
  });

  it('takes a marking placed in Word', () => {
    const d = doc();
    const xml = documentXml(d);
    const boxed = '<w:p><w:pPr><w:pStyle w:val="Translit"/></w:pPr>'
      + '<w:r><w:t>ho</w:t></w:r><w:r><w:rPr><w:rStyle w:val="Holding"/></w:rPr><w:t>t</w:t></w:r>'
      + '<w:r><w:t xml:space="preserve">āraṁ ratnadhātamam</w:t></w:r></w:p>';
    const back = withBodyEdits(d, xml.replace(paragraphWith(xml, 'ho'), boxed), undefined, 'iast');
    expect(back.edited).toBe(1);
    const c = all(back.doc)[2]!;
    expect(textOf(c)).toBe('hotāraṁ ratnadhātamam');
    expect(toTextAndMarks(c).marks.filter((m) => m.k === 'hold').map((m) => [m.from, m.to, m.v])).toEqual([[2, 3, 'short']]);
  });

  it('takes a translation edited in Word', () => {
    const d = doc();
    const xml = documentXml(d);
    const back = withBodyEdits(d, xml.replace('I praise Agni', 'I praise Agni, the priest'), undefined, 'iast');
    expect(back.edited).toBe(1);
    expect(all(back.doc)[0]!.translation?.en).toBe('I praise Agni, the priest');
  });

  it('adds a verse typed in Word after the one before it, in its section', () => {
    const d = doc();
    const xml = documentXml(d);
    const line = paragraphWith(xml, 'ya');
    const back = withBodyEdits(d, xml.replace(line, line + plainLine('agne naya supathā')), undefined, 'iast');
    expect([back.edited, back.added, back.removed]).toEqual([0, 1, 0]);
    expect(back.doc.sections[0]!.verses.map(textOf)).toEqual([
      'agnim īḷe purohitam', 'yajñasya devam ṛtvijam', 'agne naya supathā',
    ]);
    expect(back.doc.sections[1]!.verses.map((v) => v.id)).toEqual(['c']);
    expect(new Set(all(back.doc).map((v) => v.id)).size).toBe(4);
  });

  it('removes a verse deleted in Word, and nothing else', () => {
    const d = doc();
    const xml = documentXml(d);
    const back = withBodyEdits(d, xml.replace(paragraphWith(xml, 'ya'), ''), undefined, 'iast');
    expect([back.edited, back.added, back.removed]).toEqual([0, 0, 1]);
    expect(all(back.doc).map((v) => v.id)).toEqual(['a', 'c']);
  });

  it('reads an edit made to a Devanāgarī page in Devanāgarī', () => {
    const d = doc();
    const xml = documentXml(d, '', undefined, 'deva');
    const page = xml.replace(paragraphWith(xml, 'य'), plainLine('यज्ञस्य देवम्'));
    const back = withBodyEdits(d, page, undefined, 'deva');
    expect(back.edited).toBe(1);
    expect(textOf(all(back.doc)[1]!)).toBe('yajñasya devam');
  });
});
