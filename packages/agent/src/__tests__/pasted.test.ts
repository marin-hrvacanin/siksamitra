/**
 * WHAT THE PERSON PASTES IS BUILT FROM AS IT IS.
 *
 * In the Word panel there is no web to fetch from, and the person often has
 * the text already: they paste it. The session keeps those lines as a
 * witness and tells the model which, so the document is built from the
 * person's letters by number — and checked against them.
 */
import { describe, expect, it } from 'vitest';
import { Session, checkDocument, memoryLedger, verseLetters } from '../index.js';
import { scripted, testHost } from './fixtures.js';

const PRICE = { input: 0.3, cached: 0.006, output: 1.2 };

describe('a pasted text', () => {
  it('becomes a witness the model is told about, and the document is built from its lines', async () => {
    const model = scripted([
      { calls: [{ name: 'build_document', args: { title: 'gāyatrī', source: 'taittiriya', sections: [{ verses: [{ witness: 'w1', at: '2-3' }] }] } }] },
      { say: 'built' },
    ]);
    const s = new Session({ id: 'p', mode: 'deliver', model, price: PRICE, host: testHost(), ledger: memoryLedger(), limits: {} });
    await s.ask('Please mark this:\nॐ भूर्भुव॒स्सुवः॑ ।\nतत्स॑वि॒तुर्वरे॑ण्यं॒ भर्गो॑ दे॒वस्य॑ धीमहि ।\nthanks');
    const said = (model.requests[0]!.messages.at(-1) as { content: string }).content;
    expect(said).toContain('[kept as witness w1: lines 2-3 (Devanāgarī)');
    expect(s.ws.witnesses.get('w1')!.origin).toBe('the person’s message');
    expect(verseLetters(s.ws.need().sections[0]!.verses[0]!)).toContain('bhūrbhuva̱s');
    expect(checkDocument(s.ws)).toEqual([]);
  });

  it('a message with no Indic text is left as it is', async () => {
    const model = scripted([{ say: 'hello' }]);
    const s = new Session({ id: 'q', mode: 'deliver', model, price: PRICE, host: testHost(), ledger: memoryLedger(), limits: {} });
    await s.ask('Hello! What can you do?');
    expect((model.requests[0]!.messages.at(-1) as { content: string }).content).toBe('Hello! What can you do?');
    expect(s.ws.witnesses.size).toBe(0);
  });
});
