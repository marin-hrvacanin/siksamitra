/**
 * EVERY LETTER CAN BE TRACED, OR IS SAID NOT TO BE.
 *
 * A document built verse by verse from a witness's lines — the way the model
 * chose to build the Nāsadīya Sūkta on its first real run — is checked verse
 * by verse; a verse typed by the model is named as typed; and the reviewer is
 * told where every part came from, so it spends its calls comparing.
 */
import { describe, expect, it } from 'vitest';
import { Workspace, checkDocument, toolsFor, verseLetters } from '../index.js';
import { PURUSHA_PAGE, testHost } from './fixtures.js';

const tool = (name: string) => toolsFor('deliver', testHost()).find((t) => t.spec.name === name)!;

async function verseByVerse(extra: { lines: string[] }[] = []) {
  const ws = new Workspace();
  const asked: string[] = [];
  const ctx = { ws, host: testHost(), review: async (task: string) => { asked.push(task); return 'no problems found'; } };
  ws.keep('https://sanskritdocuments.org/x', 'page', PURUSHA_PAGE.split('\n'));
  await tool('build_document').run({
    title: 'Puruṣa Sūktam', source: 'taittiriya',
    sections: [{ title: 'Puruṣa Sūktam', verses: [{ witness: 'w1', at: '5-6' }, { witness: 'w1', at: '7-8' }, ...extra] }],
  }, ctx);
  return { ws, ctx, asked };
}

describe('built verse by verse', () => {
  it('each verse records the lines it came from, and the document checks clean', async () => {
    const { ws } = await verseByVerse();
    expect([...ws.builtFrom.entries()]).toEqual([
      ['s-1-v1', { witness: 'w1', from: 5, to: 6 }],
      ['s-1-v2', { witness: 'w1', from: 7, to: 8 }],
    ]);
    expect(checkDocument(ws)).toEqual([]);
  });

  it('a verse changed since is found against ITS lines', async () => {
    const { ws, ctx } = await verseByVerse();
    await tool('replace_text').run({ verse: 's-1-v2', text: 'puruṣa evedaṁ sarvam / utāmṛtatvasyeśānaḥ' }, ctx);
    await tool('auto_mark').run({}, ctx);
    expect(checkDocument(ws)).toEqual([
      expect.objectContaining({ severity: 'error', where: 's-1-v2', what: expect.stringMatching(/^differs from w1 lines 7-8/) }),
    ]);
  });

  it('a verse the model typed is named as typed', async () => {
    const { ws } = await verseByVerse([{ lines: ['oṁ śāntiḥ śāntiḥ śāntiḥ'] }]);
    expect(checkDocument(ws)).toEqual([
      expect.objectContaining({ severity: 'warn', where: 's-1', what: 'typed, not taken from a source: s-1-v3' }),
    ]);
  });

  it('a verse given that the builder would split is refused, with the reason', async () => {
    const ws = new Workspace();
    ws.keep('https://x', 'page', PURUSHA_PAGE.split('\n'));
    await expect(tool('build_document').run({
      title: 'P', source: 'taittiriya', sections: [{ title: 'P', verses: [{ witness: 'w1', at: '5-8' }] }],
    }, { ws, host: testHost(), review: async () => '' })).rejects.toThrow(/1 verse\(s\) given, 2 made/);
  });

  it('the reviewer is told where every verse came from, and which witnesses there are', async () => {
    const { ctx, asked } = await verseByVerse();
    await tool('review').run({ focus: 'are both verses there?' }, ctx);
    expect(asked[0]).toContain('are both verses there?');
    expect(asked[0]).toContain('s-1-v1 ← w1 lines 5-6');
    expect(asked[0]).toContain('w1: https://sanskritdocuments.org/x');
  });
});

describe('a Ṛgveda text, whose rules transform its accents', () => {
  /* Two verses of the Nāsadīya Sūkta as sanskritdocuments.org prints them, an English gloss between. */
  const PAGE = [
    'नास॑दासी॒न्नो सदा॑सीत्त॒दानीं॒ नासी॒द्रजो॒ नो व्यो॑मा प॒रो यत् ।',
    'किमाव॑रीवः॒ कुह॒ कस्य॒ शर्म॒न्नम्भः॒ किमा॑सी॒द्गह॑नं गभी॒रम् ॥ १॥ ',
    'Then even nothingness was not, nor existence,',
    'न मृ॒त्युरा॑सीद॒मृतं॒ न तर्हि॒ न रात्र्या॒ अह्न॑ आसीत्प्रके॒तः ।',
    'आनी॑दवा॒तं स्व॒धया॒ तदेकं॒ तस्मा॑द्धा॒न्यन्न प॒रः किं च॒नास॑ ॥ २॥',
  ];
  it('checks clean: the rebuilt source is marked by the same rules before it is compared', async () => {
    const ws = new Workspace();
    const ctx = { ws, host: testHost(), review: async () => '' };
    ws.keep('https://sanskritdocuments.org/nasadiya', 'page', PAGE);
    await tool('build_document').run({
      title: 'nāsadīya sūktam', locus: 'ṛgvedasaṁhitā 10.129', source: 'rigveda',
      sections: [{ verses: [{ witness: 'w1', at: '1-2' }, { witness: 'w1', at: '4-5' }] }],
    }, ctx);
    /* The rules did transform them — the overline of the lengthened svarita is there. */
    expect(ws.need().sections[0]!.verses.map((v) => verseLetters(v)).join('')).toContain('̅');
    expect(checkDocument(ws)).toEqual([]);
  });
});
