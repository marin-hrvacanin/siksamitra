/**
 * THE GUM WRITTEN OUT IN A SOURCE, FOLDED TO THE ANUSVĀRA IT STANDS FOR.
 *
 * An IAST source writes the Taittirīya gum as letters — `pratīcīmenāgm̐
 * haviṣā` — and the derivation keys on the anusvāra, so a line taken in
 * as written was marked bare once and with its reading aid the next time (bhū
 * sūktam 11, 2026-10-02). `normalize` folds it on the way in, with one pattern
 * (`WRITTEN_GUM`) that the agent's line preparation uses too; `norm`, which
 * every stored offset is into, never changes a line's length and does not.
 */
import { describe, expect, it } from 'vitest';
import { WRITTEN_GUM, derive, normalize, resolveProfile } from '../index.js';

const TS = resolveProfile([{ preset: 'taittiriya' } as never]);

describe('a gum written out in the source', () => {
  it('is folded to the anusvāra it stands for, and said so', () => {
    const got = normalize('pra̱tīcī̍menāgm̐ ha̱viṣā̍');
    expect(got.text).toContain('menāṁ ha');
    expect(got.changes.map((c) => c.rule)).toContain('anusvara.written-gum');
    expect(normalize('ya̱jñagṁ sami̱mam').text).toContain('ya̱jñaṁ sa');
    expect('puṇyaggm̐ śloka̱m'.replace(WRITTEN_GUM, 'ṁ')).toBe('puṇyaṁ śloka̱m');
  });

  it('written as gg alone, before the sibilant it comes before — vignanam’s bhū sūktam, `पुण्य॒ग्ग्॒ श्लोकं`', () => {
    expect(normalize('puṇya̱gg̱ śloka̱ṁ').text).toContain('puṇya̱ṁ̱ śloka̱ṁ');
    expect('puṇya̱gg̱ śloka̱ṁ'.replace(WRITTEN_GUM, 'ṁ')).toBe('puṇya̱ṁ̱ śloka̱ṁ');
    /* With the svara it bears between its letters, kept on the anusvāra — his `tri̱ṁ̱śad`. */
    expect(normalize('tri̠g̠ṃśaddhāma̠').text).toBe('tri̱ṁ̱śaddhāma̱');
    /* gg before anything else is the letters they are. */
    expect(normalize('sagga').text).toBe('sagga');
    expect(normalize('dig-gaja').text).toBe('dig-gaja');
  });

  it('and, folded, is derived as the gum with its reading aid', () => {
    const units = derive({ lines: [normalize('pra̱tīcī̍menāgm̐ ha̱viṣā̍ yajāmaḥ').text] }, TS, { trace: false }).tokens
      .flatMap((t) => (t.t === 'syl' ? t.units : []));
    const gum = units.find((u) => u.c === 'm' && u.candra === true);
    expect(gum?.sup).toBe('gṁ');
  });

  it('a Ṛgvedic anunāsika — a candrabindu with no g — is the text’s own and stays', () => {
    expect(normalize('sa de̱vām̐ eha va̍kṣati').text).toContain('vām̐ e');
  });
});
