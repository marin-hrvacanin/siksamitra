/**
 * THE MANYU SŪKTAM THE BOT SENT (2026-10-02), its two faults held:
 *
 *   - its anukramaṇī set a modern edition's metre list as a mantra line —
 *     `chandaḥ — 1 virāḍjagatī ।2 triṣṭupˎ।3।6 …` — where his samāna sūktam
 *     says a changing metre in Sanskrit;
 *   - its source's kampa came bare, `ivānavabravo३'smākaṁ`, and printed as a
 *     plain `3`, where his śikṣā writes `3̱̍`.
 */
import { describe, expect, it } from 'vitest';
import { headingFault, type Outline } from '../build.js';
import { withWholeKampas } from '../letters.js';

const B = String.fromCodePoint(0x0331);
const A = String.fromCodePoint(0x030d);
const withAnukramani = (line: string): Outline => ({
  title: 'manyu sūktam', locus: 'ṛgvedasaṁhitā 10.83', sections: [{ verses: [
    { lines: ['yaste manyo’vidhad iti saptarcasyāsya sūktasya ।', line], numbered: false },
    { lines: ['yas te manyo’vidhad vajra sāyaka saha ojaḥ ।', 'puṣyati viśvam ānuṣak ॥'] },
  ] }],
});

describe('an anukramaṇī line', () => {
  it('as the bot wrote it — numbers and a dash — is refused, and told his form', () => {
    const fault = headingFault(withAnukramani('chandaḥ — 1 virāḍjagatī ।2 triṣṭup ।3।6 virāṭtriṣṭup ॥'));
    expect(fault).toMatch(/no digits and no dashes/);
    expect(fault).toMatch(/prathamā dvitīyā caturthīnām ṛcām anuṣṭup/);
  });

  it('in his Sanskrit, as his samāna sūktam says it, is built', () => {
    expect(headingFault(withAnukramani('prathamā dvitīyā caturthīnām ṛcām anuṣṭup । tṛtīyāyāś ca triṣṭup chandasī ॥'))).toBeUndefined();
  });

  it('and a verse may still end with its source’s number, which the program renumbers', () => {
    expect(headingFault(withAnukramani('gāyatrī chandaḥ ॥ १०।०८३।०१'))).toBeUndefined();
  });
});

describe('a Ṛgveda kampa left bare', () => {
  it('is written whole, as his śikṣā writes it', () => {
    expect(withWholeKampas("ivānavabravo३'smākaṁ")).toBe(`ivānavabravo3${B}${A}'smākaṁ`);
    expect(withWholeKampas(`bravo3${B} 'smākam`)).toBe(`bravo3${B}${A} 'smākam`);
    expect(withWholeKampas('apsva१ntaḥ')).toBe(`apsva1${B}${A}ntaḥ`);
  });

  it('and a verse’s number, after its daṇḍa, is left alone', () => {
    expect(withWholeKampas('bhaveha ॥ 3॥')).toBe('bhaveha ॥ 3॥');
  });
});
