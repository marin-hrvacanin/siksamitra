/**
 * WHOLE WORDS OF A SOURCE THAT ARE NO PART OF THE TEXT — left out, and listed.
 *
 * The source of a real run (2026-10-02) printed another edition's name after
 * a half-verse (`…तमोनुदः । कालाध्यक्षः`), a variant after a verse's number,
 * and the karanyāsa beside the hṛdayanyāsa as the columns of one table — and
 * the build allowed no change but spaces, so the PDF carried all three. Now
 * `spaced` may leave out whole words, in their order, and nothing else.
 */
import { describe, expect, it } from 'vitest';
import { Workspace, checkDocument, toolsFor, wordsLeftOut } from '../index.js';
import { testHost } from './fixtures.js';

const ZWJ = '\u{200D}';
const PAGE = [
  'श्रीसूर्याष्टोत्तरशतनामस्तोत्रम्',
  'लोकाध्यक्षः प्रजाध्यक्षो विश्वकर्मा तमोनुदः । कालाध्यक्षः',
  'वरुणः सागरोंऽशुश्च जीमूतो जीवनोऽरिहा ॥ ९॥',
  'ओं ह्रां अघोर श्रीसूर्यनारायणाय - अङ्गुष्ठाभ्यां नमः - हृदयायनमः',
  'वैशम्पायन उवाच ।',
  `श${ZWJ}ृणुष्वावहितो राजन् शुचिर्भूत्वा समाहितः ।`,
  'क्षणं च कुरु राजेन्द्र गुह्यं वक्ष्यामि ते हितम् ॥ १॥',
];

describe('which words a verse leaves out', () => {
  it('a name another edition hangs on a half-verse', () => {
    const said = wordsLeftOut(PAGE.slice(1, 3), ['lokādhyakṣaḥ prajādhyakṣo viśvakarmā tamonudaḥ ।', "varuṇaḥ sāgaro'ṁśuś ca jīmūto jīvano'rihā ॥"]);
    expect(said?.left).toEqual(['कालाध्यक्षः']);
    expect(said?.kept).toEqual(['लोकाध्यक्षः प्रजाध्यक्षो विश्वकर्मा तमोनुदः ।', 'वरुणः सागरोंऽशुश्च जीमूतो जीवनोऽरिहा ॥ ९॥']);
  });

  it('the two columns of one table, each a formula of its own', () => {
    const row = PAGE.slice(3, 4);
    expect(wordsLeftOut(row, ['oṁ hrāṁ aghora śrīsūryanārāyaṇāya aṅguṣṭhābhyāṁ namaḥ'])?.left).toEqual(['हृदयायनमः']);
    expect(wordsLeftOut(row, ['oṁ hrāṁ aghora śrīsūryanārāyaṇāya hṛdayāya namaḥ'])?.left).toEqual(['अङ्गुष्ठाभ्यां', 'नमः']);
  });

  it('nothing, when nothing is left out — and no way through when a letter is changed', () => {
    expect(wordsLeftOut(PAGE.slice(3, 4), ['oṁ hrāṁ aghora śrīsūryanārāyaṇāya aṅguṣṭhābhyāṁ namaḥ hṛdayāya namaḥ'])).toBeNull();
    expect(wordsLeftOut(PAGE.slice(1, 3), ['lokādhyakṣaḥ prajādhyakṣo viśvakarmā tamonudaḥ ।', "varuṇaḥ sāgaro'ṁśuś ca jīmūto jīvano'riho ॥"])).toBeNull();
  });
});

describe('built from a page, his way', () => {
  const host = testHost();
  const tools = toolsFor('deliver', host);
  const run = (ws: Workspace, name: string, args: Record<string, unknown>) =>
    tools.find((t) => t.spec.name === name)!.run(args, { ws, host, review: async () => 'VERDICT: clean' });
  const page = (): Workspace => { const ws = new Workspace(); ws.keep('https://sanskritdocuments.org/x', 'stotram', PAGE); return ws; };

  it('a verse without the word the source hung on it, the karanyāsa and the hṛdayanyāsa as two lists — said, and checked', async () => {
    const ws = page();
    const said = await run(ws, 'build_document', {
      title: 'sūryāṣṭottaraśatanāma stotram', source: 'smarta', locus: 'mahābhārata, āraṇyakaparvan 3.3',
      sections: [
        { title: 'karanyāsaḥ', verses: [{ witness: 'w1', at: '4', spaced: ['oṁ hrāṁ aghora śrīsūryanārāyaṇāya aṅguṣṭhābhyāṁ namaḥ'], numbered: false }] },
        { title: 'hṛdayādi nyāsaḥ', verses: [{ witness: 'w1', at: '4', spaced: ['oṁ hrāṁ aghora śrīsūryanārāyaṇāya hṛdayāya namaḥ'], numbered: false }] },
        { title: 'stotram', verses: [
          { witness: 'w1', at: '5-7', spaced: ['vaiśampāyana uvāca ।', 'śṛṇuṣvāvahito rājan śucir bhūtvā samāhitaḥ ।', 'kṣaṇaṁ ca kuru rājendra guhyaṁ vakṣyāmi te hitam ॥'] },
          { witness: 'w1', at: '2-3', spaced: ['lokādhyakṣaḥ prajādhyakṣo viśvakarmā tamonudaḥ ।', "varuṇaḥ sāgaro'ṁśuś ca jīmūto jīvano'rihā ॥"] },
        ] },
      ],
    });
    expect(said).toContain('left out, as no part of the text:');
    expect(said).toContain('s-1-v1 leaves out of w1 4-4: “हृदयायनमः”');
    expect(said).toContain('s-3-v2 leaves out of w1 2-3: “कालाध्यक्षः”');
    expect(ws.builtFrom.get('s-3-v2')?.left).toEqual(['कालाध्यक्षः']);
    /* The page's श‍ृ is the letters śṛ, and the check holds every verse to the words it kept. */
    expect(checkDocument(ws).filter((f) => f.severity === 'error')).toEqual([]);
  });

  it('a letter changed is still refused, and says where', async () => {
    await expect(run(page(), 'build_document', {
      title: 'x', source: 'smarta',
      sections: [{ verses: [{ witness: 'w1', at: '2-3', spaced: ['lokādhyakṣaḥ prajādhyakṣo viśvakarmā tamonudaḥ ।', "varuṇaḥ sāgaro'ṁśuś ca jīmūto jīvano'riho ॥"] }] }],
    })).rejects.toThrow(/spaced changes a letter/);
  });
});
