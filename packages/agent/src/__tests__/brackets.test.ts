/**
 * WHAT THE AUTHENTIC EDITIONS HAVE BOTH WITH AND WITHOUT, IN BRACKETS — his
 * words (2026-10-02): "with an optional verse that is authentic with and
 * without, use brackets … see the sadhana document". His sādhanā sets a word
 * so in its line — `(atha) eka navatyu-ttara śatata̍maṁ sū̱ktamˎ।`,
 * `śrī̱ sāmba sadāśiva (parameśvara)`, `sarveśva̱rāya̍ sadāśi̱vāya̍ (śaṅka̱rāya̍)` —
 * and a whole verse as its prastāvanā's sarasvatī verse.
 *
 * And a verse is not one word: the bot made `गृणाहि` a verse of the nīla
 * sūktam, where TITUS opens TS 4.4.12.5 with it.
 */
import { describe, expect, it } from 'vitest';
import { recitationText } from '@siksamitra/format';
import { documentOf, headingFault, type Outline } from '../build.js';
import { letterChange } from '../letters.js';

describe('a word in brackets', () => {
  const SOURCE = ['श्री साम्ब सदाशिव परमेश्वर प्रसाद सिद्ध्यर्थे जपे विनियोगः ॥'];

  it('is no change to the source’s letters — the brackets are his, not the text’s', () => {
    expect(letterChange(SOURCE, ['śrī sāmba sadāśiva (parameśvara) prasāda siddhyarthe jape viniyogaḥ ॥'])).toBeNull();
  });

  it('but a letter changed inside them still is', () => {
    expect(letterChange(SOURCE, ['śrī sāmba sadāśiva (parameśvarā) prasāda siddhyarthe jape viniyogaḥ ॥'])).toMatch(/changes a letter/);
  });

  it('and is built as his sādhanā sets it, the brackets in the line', () => {
    const doc = documentOf({ title: 'śrī rudram', locus: 'taittirīya saṁhitā 4.5', sections: [{ verses: [
      { lines: ['(atha) eka navatyu-ttara śatatamaṁ sūktam ।', 'śrī sāmba sadāśiva (parameśvara) ॥'] },
    ] }] });
    const text = recitationText(doc.sections[0]!.verses[0]!.tokens, 'iast');
    expect(text.startsWith('(atha) eka')).toBe(true);
    expect(text).toContain('sadāśiva (parameśvara)');
  });
});

describe('a verse of one word', () => {
  const nila = (first: string): Outline => ({
    title: 'nīla sūktam', locus: 'taittirīya saṁhitā 4.4.12', sections: [{ verses: [
      { lines: [first] },
      { lines: ['ghṛtavatī savitar ādhipatyaiḥ payasvatī rantir āśā no astu ।', 'dhruvā diśāṁ viṣṇupatny aghorā ॥'] },
    ] }],
  });

  it('is refused, and told it is the opening sentence of a verse, and what ३७ is', () => {
    const fault = headingFault(nila('गृणाहि ।'));
    expect(fault).toMatch(/a verse of one word \("गृणाहि"\)/);
    expect(fault).toMatch(/३७, fifty words a pañcāśat/);
  });

  it('but an oṁ standing alone is one', () => {
    expect(headingFault(nila('oṁ ॥'))).toBeUndefined();
  });

  it('and the verse it opens, with it, is built', () => {
    const fixed: Outline = { ...nila(''), sections: [{ verses: [
      { lines: ['gṛṇāhi । ghṛtavatī savitar ādhipatyaiḥ payasvatī rantir āśā no astu ।', 'dhruvā diśāṁ viṣṇupatny aghorā ॥'] },
    ] }] };
    expect(headingFault(fixed)).toBeUndefined();
  });
});
