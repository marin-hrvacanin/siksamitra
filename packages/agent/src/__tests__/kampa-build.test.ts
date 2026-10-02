/**
 * THE MANYU SŪKTAM'S KAMPA, BUILT — RV 10.84.4 `abravo३॒॑ऽस्माक॑म्`, as the bot
 * reads it (`asIast` keeps the Devanāgarī digit) and as his IAST writes it.
 * It came out `3̱` (2026-10-02): split mark by mark, the stroke above lost.
 */
import { describe, expect, it } from 'vitest';
import { recitationText } from '@siksamitra/format';
import { documentOf } from '../build.js';
import { asIast } from '../letters.js';

const B = String.fromCodePoint(0x0331);
const A = String.fromCodePoint(0x030d);
const LINE = `ivānavabravo3${B}${A}'smākam manyo ।`;
const built = (line: string) => documentOf({
  title: 'manyu sūktam', locus: 'ṛgvedasaṁhitā 10.84.4', sections: [{ verses: [{ lines: [line, 'adhipā bhaveha ॥'] }] }],
});
const kampas = (line: string) => built(line).sections[0]!.verses[0]!.tokens
  .flatMap((t) => (t.t === 'syl' ? t.units : [])).filter((u) => u.svara === 'kampa' || u.svara === 'dirgha-kampa');

describe('a kampa in a line the bot builds', () => {
  it('from his IAST, 3̱̍: one dīrgha kampa, on its vowel', () => {
    expect(kampas(LINE).map((u) => [u.c, u.svara])).toEqual([['o', 'dirgha-kampa']]);
  });

  it('from a Devanāgarī source, as the bot reads it: the same', () => {
    const iast = asIast('इ॒वान॑वब्रवो३॒॑ऽस्माकं॑ मन्यो ।');
    expect(iast).toContain('३');
    expect(kampas(iast).map((u) => u.svara)).toEqual(['dirgha-kampa']);
  });

  it('and its digit is no letter of the recitation', () => {
    const text = recitationText(built(LINE).sections[0]!.verses[0]!.tokens, 'iast');
    expect(text).not.toMatch(/[0-9३]/u);
    expect(text).toContain("bravo'smā");
  });
});
