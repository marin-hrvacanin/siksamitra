/**
 * AN OPTIONAL VERSE, SET AS HIS PRASTĀVANĀ SETS ONE — his words (2026-10-02):
 * "when the verse is optional and there are multiple verified sources
 * authentic and all, and the source is known, then the particular shloka can
 * be in brackets (see how it is in our prastavana)". His sādhanā, page 5:
 *
 *   (optional verse) TS 1.8.22. ṚV 5.43.11 - bhaumo'trirṛṣiḥ, viśve devā devatāḥ, triṣṭup chandaḥ
 *   ( ā no̍ di̱vo bṛ̍ha̱taḥf parva̍tā̱dā sara̍svatī yaja̱tā ga̍ntu ya̱jñamˎ।
 *   hava̍n de̱vī ju̍juṣā̱ṇā ghṛ̱tācī̍ śa̱gmān no̱ vāca̍mu-śa̱tī śṛ̍ṇotu ॥ )
 */
import { describe, expect, it } from 'vitest';
import { recitationText } from '@siksamitra/format';
import { bracketed, documentOf, headingFault, type Outline } from '../build.js';

const NOTE = "TS 1.8.22. ṚV 5.43.11 - bhaumo'trirṛṣiḥ, viśve devā devatāḥ, triṣṭup chandaḥ";
const SARASVATI: Outline = {
  title: 'sarasvatī stuti', locus: 'taittirīya saṁhitā 1.8.22',
  sections: [{ verses: [
    { lines: ['pra ṇo̍ de̱vī sara̍svatī̱ vāje̍bhir vā̱jinī̍vatī ।', 'dhī̱nāma̍-vi̱trya̍-vatu ॥'] },
    { optional: true, note: NOTE, lines: ['ā no̍ di̱vo bṛ̍ha̱taḥ parva̍tā̱dā sara̍svatī yaja̱tā ga̍ntu ya̱jñam ।', 'hava̍n de̱vī ju̍juṣā̱ṇā ghṛ̱tācī̍ śa̱gmān no̱ vāca̍mu-śa̱tī śṛ̍ṇotu ॥'] },
    { lines: ['pā̱va̱kā na̱s sara̍svatī ।', 'ya̱jñaṁ va̍ṣṭu dhi̱yāva̍suḥ ॥'] },
  ] }],
};

describe('an optional verse', () => {
  const doc = documentOf(SARASVATI);
  const [first, optional, third] = doc.sections[0]!.verses;
  const text = recitationText(optional!.tokens, 'iast');

  it('is in his brackets: before its first line, after its ending', () => {
    expect(text.startsWith('( ā no')).toBe(true);
    expect(text.endsWith('śṛṇotu ॥ )')).toBe(true);
  });

  it('says so first, on its source line', () => {
    expect(optional!.source ?? '').toBe(`(optional verse) ${NOTE}`);
  });

  it('is not numbered, and does not take a number from the verses after it', () => {
    /* A verse's number is structure, not recitation: its own token. */
    const number = (v: typeof first) => v!.tokens.filter((t) => t.t === 'num').map((t) => (t as { s: string }).s);
    expect(number(first)).toEqual(['1']);
    expect(number(optional)).toEqual([]);
    expect(number(third)).toEqual(['2']);
  });

  it('is refused when its source is not known', () => {
    const unsourced: Outline = { ...SARASVATI, sections: [{ verses: [{ ...SARASVATI.sections[0]!.verses[1]!, note: 'optional' }] }] };
    expect(headingFault(unsourced)).toMatch(/names where it is from/);
  });

  it('a one-line verse is bracketed at both ends of its one line', () => {
    expect(bracketed(['oṁ namaḥ ॥'])).toEqual(['( oṁ namaḥ ॥ )']);
  });
});
