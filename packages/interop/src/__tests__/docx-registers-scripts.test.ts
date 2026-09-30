/**
 * A document's registers and scripts, through Word and back.
 *
 * A section marked by other rules than the rest goes out as a Word PART (a
 * content control, `word/rule-parts.ts`) and comes back as that section's
 * register; the register the add-in records for a whole document comes back
 * as the document's; and a verse written in Devanāgarī, Telugu or Tamil is
 * read as the IAST text and markings it is. The expectations are constants.
 */
import { describe, expect, it } from 'vitest';
import type { ChantDoc, ChantProfileKey } from '@siksamitra/format';
import { toTextAndMarks } from '@siksamitra/format';
import { mark } from '@siksamitra/engine';
import { documentXml } from '../word/body.js';
import { readParagraphs } from '../docx-read.js';
import { buildDocument } from '../build-document.js';
import { reportFor } from '../docx-report.js';
import { recordedRegisterIn } from '../word/rule-parts.js';

const section = (id: string, text: string, register?: ChantProfileKey) => ({
  id, title: id, verses: [{ id: `${id}-v`, tokens: mark(`${text} ॥ 1॥`) }],
  ...(register === undefined ? {} : { profile: { preset: register } }),
});

const read = (xml: string, register?: ChantProfileKey): ChantDoc => {
  const paragraphs = readParagraphs(xml);
  return buildDocument(paragraphs, {
    fallbackTitle: 'x', report: reportFor('docx', 0, paragraphs), ...(register === undefined ? {} : { register }),
  });
};
const registers = (d: ChantDoc) => d.sections.map((s) => s.profile?.preset ?? null);

describe('a register other than the default, as a Word part', () => {
  it('is one part around the sections it marks, and comes back as theirs', () => {
    const doc: ChantDoc = { title: 't', titleForms: {}, sections: [
      section('one', 'agnim īḷe'), section('two', 'yajñasya devam', 'rigveda'),
      section('three', 'hotāraṁ ratnadhātamam', 'rigveda'), section('four', 'agne naya'),
    ] };
    const xml = documentXml(doc);
    expect(xml.match(/<w:sdt>/g)).toHaveLength(1);
    expect(xml).toContain('<w:tag w:val="siksamitra:part:v1:rigveda"/>');
    const back = read(xml);
    expect(back.profile).toBeUndefined();
    expect(registers(back)).toEqual([null, 'rigveda', 'rigveda', null]);
  });

  it('writes no part for the default register, which is what marks a line outside every part', () => {
    const doc: ChantDoc = { title: 't', titleForms: {}, sections: [section('one', 'agnim īḷe', 'taittiriya')] };
    expect(documentXml(doc)).not.toContain('<w:sdt>');
  });

  it('around a whole document is the document’s register when it comes back', () => {
    const doc: ChantDoc = {
      title: 't', titleForms: {}, profile: { preset: 'smarta' },
      sections: [section('one', 'śuklāmbaradharaṁ viṣṇuṁ'), section('two', 'śaśivarṇaṁ caturbhujam')],
    };
    const back = read(documentXml(doc));
    expect(back.profile).toEqual({ preset: 'smarta' });
    expect(registers(back)).toEqual([null, null]);
  });

  it('two parts of different registers stay two', () => {
    const doc: ChantDoc = { title: 't', titleForms: {}, sections: [
      section('one', 'agnim īḷe', 'rigveda'), section('two', 'śuklāmbaradharaṁ', 'smarta'),
    ] };
    const xml = documentXml(doc);
    expect(xml.match(/<w:sdt>/g)).toHaveLength(2);
    expect(registers(read(xml))).toEqual(['rigveda', 'smarta']);
  });
});

describe('the register the add-in records for the whole document', () => {
  const part = (value: string): string => '<we:webextension xmlns:we="http://schemas.microsoft.com/office/webextensions/webextension/2010/11">'
    + `<we:properties><we:property name="other" value="&quot;x&quot;"/><we:property name="siksamitra.register" value="${value}"/></we:properties></we:webextension>`;

  it('is read from the file’s add-in settings', () => {
    expect(recordedRegisterIn(part('&quot;rigveda&quot;'))).toBe('rigveda');
  });

  it('is nothing when it names no register, or is not ours to read', () => {
    expect(recordedRegisterIn(part('&quot;nonsense&quot;'))).toBeNull();
    expect(recordedRegisterIn(part('not json'))).toBeNull();
    expect(recordedRegisterIn('<we:webextension/>')).toBeNull();
  });

  it('marks every verse outside a part, and a part keeps its own', () => {
    const doc: ChantDoc = { title: 't', titleForms: {}, sections: [
      section('one', 'agnim īḷe'), section('two', 'śuklāmbaradharaṁ', 'smarta'),
    ] };
    const back = read(documentXml(doc), 'rigveda');
    expect(registers(back)).toEqual(['rigveda', 'smarta']);
  });
});

describe('a verse written in another script', () => {
  it('is read as the IAST it is, and its number in the script’s digits still closes it', () => {
    const p = (text: string): string =>
      `<w:p><w:pPr><w:pStyle w:val="Translit"/></w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
    const back = read(`<w:body>${p('अग्निमीळे पुरोहितम्')}${p('यज्ञस्य देवमृत्विजम् ॥ १॥')}${p('होतारं रत्नधातमम् ॥ २॥')}</w:body>`);
    const verses = back.sections.flatMap((s) => s.verses);
    /* `ळ` is the Vedic `ḻ`, as the engine and the corpus write it. */
    expect(verses.map((v) => toTextAndMarks(v).text)).toEqual([
      'agnimīḻe purohitam\nyajñasya devamṛtvijam ॥ 1॥', 'hotāraṁ ratnadhātamam ॥ 2॥',
    ]);
  });

  it('is written in the script, and read back as the same verse with every mark', () => {
    const doc: ChantDoc = { title: 't', titleForms: {}, sections: [section('one', 'agnim īḷe purohitam')] };
    const iast = read(documentXml(doc)).sections[0]!.verses[0]!;
    for (const script of ['deva', 'tel', 'tam'] as const) {
      const back = read(documentXml(doc, '', undefined, script)).sections[0]!.verses[0]!;
      expect(toTextAndMarks(back), script).toEqual(toTextAndMarks(iast));
    }
  });
});
