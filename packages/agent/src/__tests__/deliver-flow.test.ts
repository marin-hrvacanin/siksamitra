/**
 * A REQUEST BECOMES A FILE — the whole of delivery mode, played by a model
 * that follows a script, against a host whose web is one page.
 *
 * What is asserted is what the program produced, never what the script said:
 * the document's letters against the page's, the rules' marks, the file
 * handed over and its format, what every call cost, and that every request
 * the provider was sent began with the same bytes — the prefix its cache keys
 * on.
 */
import { describe, expect, it } from 'vitest';
import { toTextAndMarks } from '@siksamitra/format';
import { Session, memoryLedger, verseLetters, type AgentEvent } from '../index.js';
import { scripted, testHost } from './fixtures.js';

const PRICE = { input: 0.28, cached: 0.028, output: 0.42 };

function deliverScript() {
  return scripted([
    { calls: [{ name: 'find_text', args: { query: 'puruṣa sūktam' } }] },
    { calls: [{ name: 'web_search', args: { query: 'purusha suktam taittiriya accented' } }] },
    { calls: [{ name: 'fetch_page', args: { url: 'https://sanskritdocuments.org/doc_veda/purusha.html' } }] },
    { calls: [{ name: 'read_witness', args: { witness: 'w1', from: 4, to: 8 } }] },
    { calls: [{ name: 'build_document', args: {
      title: 'puruṣa sūktam', subtitle: 'kṛṣṇa yajurvedīya', source: 'taittiriya',
      sections: [{ cite: 'Taittirīya Āraṇyaka 3.12', witness: 'w1', lines: '5-8' }],
    } }] },
    { calls: [{ name: 'check', args: {} }] },
    { calls: [{ name: 'review', args: { focus: 'the Taittirīya puruṣa sūktam, first two verses' } }] },
    /* The reviewer's own call — the same model, a separate conversation. */
    { say: 'no problems found — compared s-1 with w1 lines 5-8' },
    { calls: [{ name: 'deliver', args: {} }] },
    { say: 'Here is the puruṣa sūktam (Taittirīya Āraṇyaka 3.12), from sanskritdocuments.org, as a PDF.' },
  ]);
}

describe('delivery mode, end to end', () => {
  it('finds, builds from the page’s own lines, marks, checks, reviews and hands over a PDF', async () => {
    const model = deliverScript();
    const host = testHost();
    const ledger = memoryLedger();
    const events: AgentEvent[] = [];
    const session = new Session({ id: 'chat-1', user: 'marin', mode: 'deliver', model, price: PRICE, host, ledger, limits: { global: 5 }, onEvent: (e) => events.push(e) });

    const done = await session.ask('I want the puruṣa sūktam, the Taittirīya version, please');
    expect(done.text).toContain('puruṣa sūktam');

    /* The file: a PDF, because nobody asked for anything else. */
    expect(host.delivered.map((f) => [f.name, f.format, f.mime])).toEqual([['puruṣa sūktam.pdf', 'pdf', 'application/pdf']]);

    /* The document: the page's two verses, letter for letter, accents as marks. */
    const doc = session.ws.need();
    const verses = doc.sections[0]!.verses;
    /* Spaces collapsed: the rules widen one for the pause at a vowel hiatus (puru̍ṣa ¦ e̱vedaṁ). */
    expect(verses.map((v) => verseLetters(v).replace(/ +/g, ' '))).toEqual([
      'oṁ sa̱hasra̍śīrṣā̱ puru̍ṣaḥ । sa̱ha̱srā̱kṣaḥ sa̱hasra̍pāt ।\nsa bhūmi̍ṁ vi̱śvato̍ vṛ̱tvā । atya̍tiṣṭhaddaśāṅgu̱lam ॥ 1॥',
      'puru̍ṣa e̱vedaṁ sarvam̎ । yadbhū̱taṁ yacca̱ bhavyam̎ ।\nu̱tā̱mṛ̱ta̱tvasyeśā̍naḥ । ya̱danne̍nāti̱roha̍ti ॥ 2॥',
    ]);
    expect(doc.sections[0]!.source).toBe('Taittirīya Āraṇyaka 3.12');
    expect(doc.profile?.preset).toBe('taittiriya');
    /* The rules marked it: holdings, and the Taittirīya gum on e̱vedaṁ. */
    const marks = verses.flatMap((v) => toTextAndMarks(v).marks);
    expect(marks.some((m) => m.k === 'hold')).toBe(true);
    expect(marks.some((m) => m.k === 'pause')).toBe(true);
    expect(marks.some((m) => m.k === 'sup' && (m.v ?? '').startsWith('g'))).toBe(true);

    /* The check said so, before the file was made. */
    const checked = events.find((e) => e.kind === 'result' && e.name === 'check');
    expect(checked).toMatchObject({ failed: false });
    expect((checked as { text: string }).text).toMatch(/^OK — 1 section\(s\), 2 verse\(s\)/);

    /* Every call priced and recorded, the reviewer's too. */
    expect(ledger.entries).toHaveLength(10);
    expect(await ledger.spent('chat-1')).toBeCloseTo(done.cost + ledger.entries[7]!.cost, 10);

    /* THE CACHE PREFIX: every main request opens with the same system prompt
       and tools, and each is the last one plus what happened since. */
    const main = model.requests.filter((_, i) => i !== 7);
    const sys = main[0]!.messages[0];
    for (const r of main) {
      expect(r.messages[0]).toEqual(sys);
      expect(r.tools).toEqual(main[0]!.tools);
    }
    for (let i = 1; i < main.length; i += 1) {
      expect(main[i]!.messages.slice(0, main[i - 1]!.messages.length)).toEqual(main[i - 1]!.messages);
    }
    /* The reviewer could read and not write. */
    const reviewer = model.requests[7]!;
    expect(reviewer.tools).toContain('read_verses');
    expect(reviewer.tools).not.toContain('build_document');
    expect(reviewer.tools).not.toContain('deliver');
    expect(reviewer.messages[0]).not.toEqual(sys);
  });

  it('a Word file only when asked for one, and the VedaUnion upload by its name', async () => {
    const host = testHost();
    const steps = (format: string) => scripted([
      { calls: [{ name: 'fetch_page', args: { url: 'https://x' } }] },
      { calls: [{ name: 'build_document', args: { title: 'puruṣa sūktam', source: 'taittiriya', sections: [{ witness: 'w1', lines: '5-8' }] } }] },
      { calls: [{ name: 'deliver', args: { format } }] },
      { say: 'done' },
    ]);
    for (const f of ['docx', 'vedaunion']) {
      await new Session({ id: f, mode: 'deliver', model: steps(f), price: PRICE, host, ledger: memoryLedger(), limits: {} }).ask(`as ${f}`);
    }
    expect(host.delivered.map((d) => d.name)).toEqual(['puruṣa sūktam.docx', 'puruṣa sūktam.vuchant']);
  });
});
