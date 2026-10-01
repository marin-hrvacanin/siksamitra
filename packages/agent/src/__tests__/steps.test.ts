/**
 * WHAT THE PERSON IS TOLD OF EACH STEP — its detail, and what came of it.
 */
import { describe, expect, it } from 'vitest';
import { stepResult, stepStarted } from '../index.js';

describe('a step, told', () => {
  it('as it starts: with its own detail, never a tool’s name', () => {
    expect(stepStarted('find_text', '{"query":"gāyatrī mantra"}')).toBe('Looking in the library for “gāyatrī mantra”');
    expect(stepStarted('fetch_page', '{"url":"https://www.sanskritdocuments.org/doc_veda/x.html"}')).toBe('Reading sanskritdocuments.org');
    expect(stepStarted('build_document', '{"title":"nāsadīya sūktam"}')).toBe('Building “nāsadīya sūktam” from the source’s own lines');
    expect(stepStarted('deliver', '{}')).toBe('Preparing the PDF');
    expect(stepStarted('deliver', '{"format":"docx"}')).toBe('Preparing the docx');
    expect(stepStarted('outline', 'not json')).toBe('Reading the document');
  });

  it('as it ends: what came of it, from its answer', () => {
    expect(stepResult('find_text', 'puja-vidhi#upa-14a-gayatri · Gāyatrī — in pūjā vidhi · verified', false)).toBe('found “Gāyatrī — in pūjā vidhi”');
    expect(stepResult('find_text', 'nothing in the library matches — search the web', false)).toBe('not in the library');
    expect(stepResult('web_search', '1. A\n   https://a\n2. B\n   https://b', false)).toBe('2 result(s)');
    expect(stepResult('check', 'OK — 1 section(s), 1 verse(s)', false)).toBe('all correct');
    expect(stepResult('deliver', 'delivered gāyatrī.pdf (77 KB)', false)).toBe('ready');
    expect(stepResult('fetch_page', 'anything', true)).toBe('did not work');
  });
});
