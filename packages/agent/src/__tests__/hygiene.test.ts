/**
 * A SOURCE'S LETTERS, AND THE MODEL'S, AS THE DOCUMENT HOLDS THEM.
 *
 * A page's श‍ृ — śa, a joiner, ṛ's sign — was read sign by sign as `śa‍ृ`,
 * and the letter check then held the bot to that broken word: it shipped it
 * because "the check requires the source's own letters" (2026-10-02). And a
 * correction typed in Devanāgarī stayed Devanāgarī in an IAST text. So a
 * witness is kept as letters, and what the model types is read into IAST by
 * the program's own reader.
 */
import { describe, expect, it } from 'vitest';
import { Workspace, asTyped, checkDocument, cleanWitnessLine, toolsFor, verseLetters } from '../index.js';
import { testHost } from './fixtures.js';

const ZWJ = '\u{200D}';
const ZWNJ = '\u{200C}';

describe('a witness kept as letters', () => {
  it('a joiner that is a hint to the font goes; one after a virāma is the conjunct choice and stays', () => {
    expect(cleanWitnessLine(`श${ZWJ}ृणुष्व`)).toBe('शृणुष्व');
    expect(cleanWitnessLine(`क्${ZWNJ}त`)).toBe(`क्${ZWNJ}त`);
  });

  it('a soft hyphen, a zero-width space and a byte-order mark go; a no-break space is a space', () => {
    expect(cleanWitnessLine('\u{FEFF}sa\u{AD}ha\u{200B}srā\u{A0}kṣaḥ')).toBe('sahasrā kṣaḥ');
  });

  it('read with iast, the page’s श‍ृ is śṛ', async () => {
    const host = testHost();
    const ws = new Workspace();
    ws.keep('https://sanskritdocuments.org/x', 'stotram', [`श${ZWJ}ृणुष्वावहितो राजन् शुचिर्भूत्वा समाहितः ।`]);
    const read = toolsFor('deliver', host).find((t) => t.spec.name === 'read_witness')!;
    expect(await read.run({ witness: 'w1', iast: true }, { ws, host, review: async () => '' })).toContain('śṛṇuṣvāvahito');
  });
});

describe('what the model types', () => {
  it('Devanāgarī is read into IAST; IAST is left as it is', () => {
    expect(asTyped(['अनन्तः कपिलो भानुः ।', 'ananta kapila'])).toEqual(['anantaḥ kapilo bhānuḥ ।', 'ananta kapila']);
  });

  it('two scripts in one line is refused', () => {
    expect(() => asTyped(['śaृṇuṣva'])).toThrow(/mixes IAST and another script/);
  });
});

describe('a correction', () => {
  const host = testHost();
  const run = (ws: Workspace, name: string, args: Record<string, unknown>) =>
    toolsFor('deliver', host).find((t) => t.spec.name === name)!.run(args, { ws, host, review: async () => '' });
  const page = async (): Promise<Workspace> => {
    const ws = new Workspace();
    ws.keep('https://a.org/x', 'base', ['सूर्योऽर्यमा भगस्त्वष्टा पूषार्कः सविता रविः ।', 'प्रोक्तमेतत्स्व्यम्भुवा ॥ १॥']);
    ws.keep('https://b.org/y', 'other', ['सूर्योऽर्यमा भगस्त्वष्टा पूषार्कः सविता रविः ।', 'प्रोक्तमेतत्स्वयम्भुवा ॥ १॥']);
    await run(ws, 'build_document', { title: 'x', source: 'smarta', sections: [{ verses: [{ witness: 'w1', at: '1-2' }] }] });
    return ws;
  };

  it('in Devanāgarī, typed, comes into the verse as IAST', async () => {
    const ws = await page();
    await run(ws, 'replace_text', { verse: 's-1-v1', text: 'सूर्योऽर्यमा भगस्त्वष्टा । प्रोक्तमेतत्स्वयम्भुवा', asked: true });
    expect(verseLetters(ws.need().sections[0]!.verses[0]!)).not.toMatch(/[\u{0900}-\u{0963}\u{0966}-\u{097F}]/u);
  });

  it('a typo of the base edition, taken from the other witness — and held to it', async () => {
    const ws = await page();
    const said = await run(ws, 'replace_text', { verse: 's-1-v1', witness: 'w2', at: '1-2' });
    expect(said).not.toMatch(/^error/);
    await run(ws, 'auto_mark', {});
    expect(ws.builtFrom.get('s-1-v1')).toMatchObject({ witness: 'w2', from: 1, to: 2 });
    expect(checkDocument(ws).filter((f) => f.severity === 'error')).toEqual([]);
  });

  it('typed, it is still held to its source — unless the person asked for these words', async () => {
    const ws = await page();
    await run(ws, 'replace_text', { verse: 's-1-v1', text: "sūryo'ryamā bhagas tvaṣṭā pūṣārkaḥ savitā raviḥ । proktam etat svayambhuvā" });
    await run(ws, 'auto_mark', {});
    expect(checkDocument(ws).find((f) => f.where === 's-1-v1')?.what).toMatch(/^differs from w1 lines 1-2.*replace_text with witness \+ at/);
    const asked = await page();
    await run(asked, 'replace_text', { verse: 's-1-v1', text: "sūryo'ryamā bhagas tvaṣṭā pūṣārkaḥ savitā raviḥ । proktam etat svayambhuvā", asked: true });
    await run(asked, 'auto_mark', {});
    expect(checkDocument(asked).filter((f) => f.severity === 'error')).toEqual([]);
  });
});
