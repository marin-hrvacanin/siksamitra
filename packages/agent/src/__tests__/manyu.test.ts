/**
 * THE MANYU SŪKTAM, AS A REAL REQUEST FOUND IT (2026-10-02).
 *
 * Built from sanskritdocuments' accented Devanāgarī of ṚV 10.83–84, the bot
 * fought a pluta for ten builds, called a Ṛgvedic verse wrong that had not one
 * letter wrong, printed "vignanam: abhī̎hi (with dīrgha svarita)" over a pāda,
 * and, its PDF sent, ended "Stopped after 40 steps without finishing". The
 * source lines here are that page's own.
 */
import { describe, expect, it } from 'vitest';
import { Workspace, checkDocument, memoryLedger, runTurn, toolsFor, type Host, type Message, type Model, type Reply } from '../index.js';
import { letterChange, withSourceSvaras } from '../letters.js';
import { hisJunctions } from '../junctions.js';

const VERSE_1 = ['यस्ते᳚ म॒न्योऽवि॑धद्वज्र सायक॒ सह॒ ओजः॑ पुष्यति॒ विश्व॑मानु॒षक् ।', 'सा॒ह्याम॒ दास॒मार्यं॒ त्वया᳚ यु॒जा सह॑स्कृतेन॒ सह॑सा॒ सह॑स्वता ॥ १०.०८३.०१'];
const PLUTA = ['वि॒जे॒ष॒कृदिन्द्र॑ इवानवब्र॒वो॒३॒॑ऽस्माकं᳚ मन्यो अधि॒पा भ॑वे॒ह ।', 'प्रि॒यं ते॒ नाम॑ सहुरे गृणीमसि वि॒द्मा तमुत्सं॒ यत॑ आब॒भूथ॑ ॥ १०.०८४.०५'];
const host: Host = { exporters: {} as never };
const build = toolsFor('deliver', host).find((t) => t.spec.name === 'build_document')!;
const run = (ws: Workspace, verse: Record<string, unknown>, source = 'rigveda') => build.run({
  title: 'manyu sūktam', source, sections: [{ verses: [{ witness: 'w1', at: '1-2', ...verse }] }],
}, { ws, host, review: async () => '' });

describe('a pluta', () => {
  it('its numeral and the svaras after it are its vowel’s: given without them, they are the source’s', () => {
    for (const spaced of [
      ["vijeṣakṛd indra ivānavabravo3'smākam manyo adhipā bhaveha", 'priyaṁ te nāma sahure gṛṇīmasi vidmā tam utsaṁ yata ābabhūtha'],
      ["vijeṣakṛd indra ivānavabravo'smākam manyo adhipā bhaveha", 'priyaṁ te nāma sahure gṛṇīmasi vidmā tam utsaṁ yata ābabhūtha'],
    ]) {
      const marked = withSourceSvaras(PLUTA, spaced.map(hisJunctions))!;
      expect(marked[0]).toContain("ivānavabra̱vo̱३̱̍'smāka̎ṁ");
      expect(letterChange(PLUTA, marked)).toBeNull();
    }
  });
});

describe('a Ṛgvedic verse given with his word breaks', () => {
  it('builds, and checks clean — the svara rules see his breaks on both sides', async () => {
    const ws = new Workspace();
    ws.keep('https://sanskritdocuments.org/doc_veda/manyusUktam.html', 'Manyu Suktam', VERSE_1);
    await run(ws, { spaced: ["yas te manyo'vidhad vajra sāyaka saha ojaḥ puṣyati viśvam ānuṣak", 'sāhyāma dāsam āryaṁ tvayā yujā sahaskṛtena sahasā sahasvatā'] });
    expect(checkDocument(ws).filter((f) => f.severity === 'error')).toEqual([]);
  });
});

describe('a note on the page', () => {
  it('that names a website or a witness is refused — his pages state one source and print no comparison', async () => {
    const ws = new Workspace();
    ws.keep('https://sanskritdocuments.org/x', 'Manyu Suktam', VERSE_1);
    await expect(run(ws, { lineNotes: ['vignanam: abhī̎hi (with dīrgha svarita)', ''] })).rejects.toThrow(/names a website or a witness/);
    await expect(run(ws, { note: 'the witness reads te᳚' })).rejects.toThrow(/names a website or a witness/);
  });
  it('but one of his kind is kept', async () => {
    const ws = new Workspace();
    ws.keep('https://sanskritdocuments.org/x', 'Manyu Suktam', VERSE_1);
    await run(ws, { note: 'Also in atharvaveda saṁhitā 4.32.1' });
    expect(ws.need().sections[0]!.verses).toHaveLength(1);
  });
});

describe('a turn that delivers, and runs out of steps', () => {
  it('says what it sent — not that it did not finish', async () => {
    const usage = { input: 1, cached: 0, output: 1 };
    let n = 0;
    const model: Model = {
      id: 'm',
      complete: async (): Promise<Reply> => {
        n += 1;
        /* Every step a call: the last of them, offered no tools, writes one anyway. */
        return { usage, finish: 'tool_calls', message: { role: 'assistant', content: null, toolCalls: [{ id: `c${n}`, name: 'deliver', arguments: '{}' }] } };
      },
    };
    const tools = [{ spec: { name: 'deliver', description: 'd', parameters: { type: 'object' } }, writes: false, run: async () => 'delivered manyu sūktam.pdf (349 KB)' }];
    const messages: Message[] = [];
    const done = await runTurn({
      model, price: { input: 0, cached: 0, output: 0 }, tools, system: 's', messages, maxSteps: 4,
      ctx: { ws: undefined as never, host: {}, review: async () => '' }, ledger: memoryLedger(),
      limits: { global: 9, session: 9, turn: 9 }, session: 't',
    }, 'the manyu sūktam, please');
    expect(done.text).toMatch(/^Sent: manyu sūktam\.pdf\./);
    expect(done.text).not.toMatch(/without finishing/);
    /* The call written at the last step was not run. */
    expect(messages.filter((m) => m.role === 'tool')).toHaveLength(3);
  });
});
