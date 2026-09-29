/**
 * TWO THINGS HIS WORD FILES WRITE THAT THE READER GOT WRONG, found by
 * re-deriving the whole Veda Union sādhanā (v9.1.4) against the engine: until
 * both were fixed, 91 of its 512 verses re-derived to themselves.
 *
 *   1. A HYPHEN is the coda of the syllable before it (`[ma-][vā]`), as the
 *      engine writes it and as 315 of the corpus's 317 hyphens are stored.
 *      The reader put it at the head of the next one (`[ma][-vā]`).
 *   2. A LONE BAR IN THE BLUE STYLE is a pause the rules placed — the bīja
 *      pause of `guṁ | gurubhyo` — and was read as a syllable `[|]`.
 */
import { describe, expect, it } from 'vitest';
import { tokensFromRuns } from '../docx.js';
import { blank, cells, run } from './runs-helpers.js';

const read = (...runs: Parameters<typeof tokensFromRuns>[0]) => cells(tokensFromRuns(runs, blank(), 'p'));

describe('a hyphen', () => {
  it('closes the syllable before it', () => {
    expect(read(run('dvandvama-vāṅmanasa'))).toBe('[dva][ndva][ma-][vā][ṅma][na][sa]');
  });
  it('several in one word, each closing its own syllable', () => {
    expect(read(run('a-gni-mī'))).toBe('[a-][gni-][mī]');
  });
  it('and in every script, not only IAST', () => {
    const t = tokensFromRuns([run('ma-vā')], blank(), 'p');
    const first = t.find((x) => x.t === 'syl');
    expect(first?.t === 'syl' && first.iast).toBe('ma-');
    expect(first?.t === 'syl' && first.deva.endsWith('-')).toBe(true);
    expect(first?.t === 'syl' && first.units.map((u) => u.c).join('')).toBe('ma-');
  });
  it('across a style boundary: the hyphen in its own run still joins the letter before', () => {
    expect(read(run('ma'), run('-'), run('vā'))).toBe('[ma-][vā]');
  });
  it('a word that is only a hyphen does not throw and loses nothing', () => {
    expect(() => read(run('-'))).not.toThrow();
  });
  it('the control: a word with no hyphen is syllabified as before', () => {
    expect(read(run('dvandvamavāṅ'))).toBe('[dva][ndva][ma][vāṅ]');
  });
});

describe('a bar in the blue style', () => {
  it('between words, one bar, is a short pause', () => {
    expect(read(run('guṁ '), run('|', 'Anusvara'), run(' gurubhyo'))).toBe('[guṁ]␣<pause>␣[gu][ru][bhyo]');
  });
  it('two bars is a long pause', () => {
    const t = tokensFromRuns([run('a '), run('||', 'Anusvara'), run(' ā')], blank(), 'p');
    expect(t.find((x) => x.t === 'pause')).toMatchObject({ t: 'pause', len: 'long' });
  });
  it('with spaces inside the run it is still the pause', () => {
    expect(read(run('oṁ'), run(' | ', 'Anusvara'), run('bhūr'))).toContain('<pause>');
  });
  it('and it is counted as a pause, not a change', () => {
    const report = blank();
    tokensFromRuns([run('guṁ '), run('|', 'Anusvara'), run(' gu')], report, 'p');
    expect(report.marks.pause).toBe(1);
    expect(report.marks.change ?? 0).toBe(0);
  });
  it('the control: a blue LETTER is still a change, not a pause', () => {
    const t = tokensFromRuns([run('ta'), run('n', 'Anusvara')], blank(), 'p');
    expect(t.some((x) => x.t === 'pause')).toBe(false);
  });
});

describe('a hyphen that OPENS a word', () => {
  it('stays at the head of its syllable, as the corpus stores it (`[-bha]`)', () => {
    expect(read(run('namo -bhavāya'))).toBe('[na][mo]␣[-bha][vā][ya]');
  });
  it('and never joins the word before it across the space', () => {
    const out = read(run('namo -bha'));
    expect(out).not.toContain('[mo-]');
  });
  it('a hyphen that opens a word AND one inside it', () => {
    expect(read(run('-a-gni'))).toBe('[-a-][gni]');
  });
});

describe('the Ṛgvedic overline (his `Long` style)', () => {
  it('rides on the vowel before it — the syllables are not joined', () => {
    expect(read(run('yu'), run('̅', 'Long'), run('vase'))).toBe('[yu̅][va][se]');
  });
  it('and the svarita after it lands on the vowel, not on the overline', () => {
    const t = tokensFromRuns([run('yu'), run('̅', 'Long'), run('̍', 'Svara'), run('vase')], blank(), 'p');
    const first = t.find((x) => x.t === 'syl' && x.iast.startsWith('yu'));
    expect(first?.t === 'syl' && first.units.find((u) => u.c.startsWith('u'))?.svara).toBe('svarita');
  });
  it('its Devanāgarī is the engine\'s form, the mark after the syllable', () => {
    const t = tokensFromRuns([run('na'), run('̅', 'Long')], blank(), 'p');
    const s = t.find((x) => x.t === 'syl');
    expect(s?.t === 'syl' && s.deva).toBe('न̅');
  });
  it('another letter in the style is ordinary text', () => {
    expect(read(run('(', 'Long'), run('agne'))).toContain('(');
  });
  it('and nothing is reported as having no home', () => {
    const report = blank();
    tokensFromRuns([run('bha'), run('̅', 'Long'), run('ra')], report, 'p');
    expect(report.unresolved.filter((u) => u.what.includes('no home'))).toEqual([]);
  });
});
