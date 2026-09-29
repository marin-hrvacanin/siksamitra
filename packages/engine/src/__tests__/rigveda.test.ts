/**
 * THE ṚGVEDA'S SVARITA, against the owner's own marked Ṛgveda.
 *
 * Every example is a word from the Veda Union sādhanā's ṚV 10.191 and 8.81
 * sections, typed the way a person types a Ṛgveda (the plain svarita on the
 * vowel) and marked the way HIS file marks it.
 */
import { describe, expect, it } from 'vitest';
import { derive, invertVerse, resolveProfile } from '../index.js';
import type { ChantToken } from '@siksamitra/format';

const SV: Record<string, string> = { anudatta: '̱', svarita: '̍', 'dirgha-svarita': '̎' };
const shown = (ts: readonly ChantToken[]): string => ts.map((t) => (t.t === 'syl'
  ? t.units.map((u) => u.c + (u.svara === undefined ? '' : SV[u.svara])).join('')
  : t.t === 'sp' ? ' ' : '')).join('').trim();

const plain = (accented: string): string => accented.replace(/[̱̍̎]/g, '');
const mark = (accented: string, patch: object = {}, preset = 'rigveda') => derive(
  { lines: [plain(accented)], accented: [accented] },
  resolveProfile([{ preset, patch } as never]),
  { trace: false },
).tokens;

describe('1. a svarita on a long vowel becomes a dīrgha-svarita', () => {
  for (const [typed, his] of [['tvā̍', 'tvā̎'], ['pūrve̍', 'pūrve̎'], ['martā̍so', 'martā̎so'], ['vo̍bhiḥ', 'vo̎bhiḥ']]) {
    it(`${typed} → ${his}`, () => expect(shown(mark(typed!))).toBe(his));
  }
});

describe('2. on a short vowel before a nasal that closes or ends, it moves to the nasal', () => {
  for (const [typed, his] of [['ditsa̍ntam', 'ditsan̎tam'], ['raya̍nte', 'rayan̎te'], ['svarāja̍mˎ', 'svarājam̎ˎ']]) {
    it(`${typed} → ${his}`, () => expect(shown(mark(typed!))).toBe(his));
  }
  it('but not onto a nasal that opens the next syllable: dakṣi̅̍ṇena', () => {
    expect(shown(mark('dakṣi̍ṇena'))).toBe('dakṣi̅̍ṇena');
  });
});

describe('3. on any other short vowel it takes the overline', () => {
  for (const [typed, his] of [['yu̍vase', 'yu̅̍vase'], ['bha̍ra', 'bha̅̍ra'], ['tuvīma̍ghamˎ', 'tuvīma̅̍ghamˎ']]) {
    it(`${typed} → ${his}`, () => expect(shown(mark(typed!))).toBe(his));
  }
  it('before a vowel too: na̅̍ indra', () => {
    expect(shown(mark('na̍ indra'))).toContain('na̅̍');
  });
  it('UNLESS the next cluster is held: sami̍[dh]yase takes none', () => {
    expect(shown(mark('sami̍dhyase'))).toBe('sami̍dhyase');
  });
});

describe('when it does not apply', () => {
  it('lengthening off — the anukramaṇī: the svarita is left as typed', () => {
    expect(shown(mark('tvā̍ yu̍vase', { svara: { lengthening: false } }))).toBe('tvā̍ yu̍vase');
  });
  it('another register, the Taittirīya: nothing is lengthened — the control', () => {
    expect(shown(mark('tvā̍ yu̍vase', {}, 'taittiriya'))).toBe('tvā̍ yu̍vase');
  });
  it('an anudātta is never touched', () => {
    expect(shown(mark('sa̱mi'))).toBe('sa̱mi');
  });
  it('a text with no accents is not given any', () => {
    expect(shown(derive({ lines: ['yuvase'] }, resolveProfile([{ preset: 'rigveda' } as never])).tokens)).toBe('yuvase');
  });
});

describe('reading a marked Ṛgveda back', () => {
  const verses = [
    'saṁsa̱midyu̍vase vṛṣa̱nna-gne̱ viśvā̍nya̱-rya ā |',
    'vi̱dmā hi tvā̍ tuvikū̱rmin tu̱vide̍ṣṇan tu̱vīma̍ghamˎ|',
    'ma̱hā̱ha̱stī dakṣi̍ṇena ||',
  ];
  for (const accented of verses) {
    it(`gives back what was typed: ${accented.slice(0, 24)}…`, () => {
      const inv = invertVerse(mark(accented), { recension: 'rigveda' });
      expect(inv.accented.join(' ').normalize('NFC')).toBe(accented.normalize('NFC'));
    });
    it(`and marking it again is idempotent: ${accented.slice(0, 24)}…`, () => {
      const once = mark(accented);
      const inv = invertVerse(once, { recension: 'rigveda' });
      const twice = derive({ lines: inv.lines, accented: inv.accented },
        resolveProfile([{ preset: 'rigveda' } as never]), { trace: false }).tokens;
      expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
    });
  }
  it('without the recension the marks are read as they stand — the control', () => {
    const inv = invertVerse(mark('tvā̍'));
    expect(inv.accented[0]).toContain('̎');
  });
});
