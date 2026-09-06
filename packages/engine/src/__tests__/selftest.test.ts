/**
 * Gate 02 G1 — the holding / pause / reading-aid regression suite.
 *
 * The 37 cases ported verbatim from `tools/chant/gen_marks.py --selftest`,
 * which read them off the owner's own marked files. They pin, among other
 * things, the four ways cross-word holdings have been got wrong
 * (MARKING-RULES §2.1) and the rule that a pause ends a cluster — so
 * `oṁ | sumukhāya` takes NO holding while `upavītaṁ samarpayāmi` takes one on
 * the `s`.
 *
 * Run these before and after any change to host selection.
 */
import { describe, expect, it } from 'vitest';
import { derive, mark } from '../pipeline.js';
import { PROFILES } from '../profile.js';
import { RULES } from '../rules/index.js';
import type { Profile } from '../profile.js';
import type { ChantToken } from '@siksamitra/format';

/**
 * The profile that reproduces `gen_marks.py`'s own defaults, which is what its
 * selftest was written against: holdings + the COMMON anusvāra rule + visarga +
 * svarabhakti + the two reading aids, and NO gum.
 *
 * The gum is the Taittirīya layer and lived in `gen_vishnu.apply_vedic_anusvara`
 * as an opt-in pass, so it was never active in the selftest. Running these cases
 * with `PROFILES.taittiriya` (gum on) legitimately adds a `gṁ` aid to
 * `jaghnivāṁsam` — correct behaviour, wrong baseline.
 */
const LEGACY: Profile = {
  ...PROFILES.taittiriya,
  gum: false,
  svara: { register: 'prose' },
};

/** `(letter, short|long)` for every holding, in order. */
function holdingsOf(text: string): [string, string][] {
  const out: [string, string][] = [];
  for (const t of mark(text, LEGACY)) {
    if (t.t !== 'syl') continue;
    for (const u of t.units) if (u.hold !== undefined) out.push([u.c, u.hold]);
  }
  return out;
}

/** The break tokens, in order: a pause as `pause`, a daṇḍa as its own text. */
function breaksOf(text: string): string[] {
  const out: string[] = [];
  for (const t of mark(text, LEGACY) as ChantToken[]) {
    if (t.t === 'pause') out.push('pause');
    else if (t.t === 'danda') out.push(t.s === '॥' ? '||' : '|');
  }
  return out;
}

/** `(letter, aid)` for every superscript reading aid, in order. */
function aidsOf(text: string): [string, string][] {
  const out: [string, string][] = [];
  for (const t of mark(text, LEGACY)) {
    if (t.t !== 'syl') continue;
    for (const u of t.units) if (u.sup !== undefined) out.push([u.c, u.sup]);
  }
  return out;
}

describe('G1 · holdings — read off the owner’s own marked files', () => {
  const cases: [string, [string, string][]][] = [
    // MARKING-RULES §2.2 — the calibration pair
    ['parameṣṭhi', [['ṭh', 'long']]],
    ['gurubhyo', [['bh', 'short']]],
    // a sibilant beginning the second word of a cross-word cluster CAN host,
    // and the vowel is found back across the space
    ['upavītaṁ samarpayāmi', [['s', 'short'], ['p', 'short']]],
    // …but a pause ENDS the saṁyukta, so the identical ṁ + space + s forms no
    // cluster after the praṇava
    ['oṁ sumukhāya namaḥ', []],
    ['oṁ prāṇāya svāhā', [['p', 'long'], ['v', 'short']]],
    // dvivarcana → the FIRST of the pair
    ['tanno durgiḥ pracodayāt', [['n', 'short'], ['g', 'short'], ['p', 'short']]],
    // everything skipped → the LAST consonant of the cluster
    ['naḥ parṣadati', [['p', 'short'], ['ṣ', 'short']]],
    ['varṇāṁ tapasā', [['ṇ', 'short'], ['t', 'long']]],
    ['karma', [['m', 'short']]],
    // cross-word sibilant + the long vowel found back across the space
    ['durgāṁ devīṁ śaraṇam', [['g', 'short'], ['d', 'long'], ['ś', 'long']]],
    ['oṁ śāntiḥ śāntiḥ śāntiḥ', [
      ['t', 'long'], ['ś', 'short'], ['t', 'long'], ['ś', 'short'], ['t', 'long'],
    ]],
    ['asmān svastibhiḥ', [['m', 'short'], ['s', 'long'], ['t', 'short']]],
    // a lone consonant is never boxed
    ['namaḥ', []],
    ['jātavedase', []],
    // OWNER'S RULING: a verse/line-INITIAL cluster is never boxed
    ['tripādūrdhva udait puruṣaḥ', [['dh', 'long'], ['p', 'long']]],
    ['brāhmaṇo asya mukham', [['h', 'long'], ['y', 'short']]],
    ['namaḥ // prajāpataye svāhā', [['p', 'short'], ['v', 'long']]],
    // across a word join a SAME-POINT pair hosts on the first word's final
    ['tac chaṁ yoḥ', [['c', 'short'], ['y', 'short']]],
    ['śarad dhaviḥ', [['d', 'short']]],
    // …but VOICING is not part of the shipped rule, so these host on the
    // second word's initial like any other split cluster
    ['agnau tat dhāma', [['g', 'short'], ['dh', 'short']]],
    ['sa vāk ghoṣaḥ', [['gh', 'long']]],
    // a pair from DIFFERENT vargas still hosts on the second word's initial
    ['yat puruṣaṁ vyadadhuḥ', [['p', 'short'], ['v', 'short']]],
    ['sanāc ca hotā', [['c', 'long']]],
  ];
  for (const [text, want] of cases) {
    it(text, () => {
      expect(holdingsOf(text)).toEqual(want);
    });
  }
});

describe('G1 · the automatic pause after a praṇava or bīja', () => {
  const cases: [string, string[]][] = [
    // it OPENS something → the pause is added
    ['oṁ sumukhāya namaḥ', ['pause']],
    ['guṁ gurubhyo namaḥ |', ['pause', '|']],
    // it CLOSES the line → no pause, whichever daṇḍa is written
    ['bhūr bhuvas suvar oṁ ||', ['||']],
    ['harir oṁ |', ['|']],
    // a break is ALREADY there → the daṇḍa stands alone
    ['oṁ | aparādha sahasrāṇi', ['|']],
    ['oṁ || aparādha sahasrāṇi', ['||']],
  ];
  for (const [text, want] of cases) {
    it(text, () => {
      expect(breaksOf(text)).toEqual(want);
    });
  }
});

describe('G1 · reading aids, measured off the owner’s own files', () => {
  const cases: [string, [string, string][]][] = [
    ['brahma jajñānam', [['j', 'g']]],       // jñ → raised g
    ['yajñāt sarva hutaḥ', [['j', 'g']]],
    ['vāyavyān', [['v', 'u']]],              // vy → raised u
    ['yad bhavyam', [['v', 'u']]],
    ['svāhā', []],                           // sv takes NO aid
    ['jaghnivāṁsam', []],                    // nor does ghn
    ['yaj jyotiḥ', []],                      // `j` not before `ñ`
  ];
  for (const [text, want] of cases) {
    it(text, () => {
      expect(aidsOf(text)).toEqual(want);
    });
  }
});

describe('G9 · registry hygiene', () => {
  it('every rule cites a spec section', () => {
    const bad = RULES.filter((r) => r.spec.trim() === '');
    expect(bad.map((r) => r.id)).toEqual([]);
  });
  it('rule ids are unique', () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('G7 · determinism', () => {
  it('deriving twice gives deep-equal output', () => {
    const a = mark('oṁ tac chaṁ yor āvṛṇīmahe', LEGACY);
    const b = mark('oṁ tac chaṁ yor āvṛṇīmahe', LEGACY);
    expect(a).toEqual(b);
  });
});

describe('G11 · order of operations', () => {
  it('pre-sandhi and post-sandhi input mark DIFFERENTLY (ṛcaḥ sāmāni)', () => {
    // The engine is fed the letters AS WRITTEN. `ṛcaḥ sāmāni` is a cross-word
    // cluster `ḥ` + `s` whose host is the second word's sibilant — which can
    // host, by the boundary exception. Stored files hold the POST-substitution
    // letters (`ṛcas sāmāni`), and feeding those back in reads as a geminate
    // `s`+`s`, which takes dvivarcana's FIRST member instead. That is the trap
    // MARKING-RULES §2.3 warns about: a comparison must invert the
    // substitutions first, or it measures a different input and inflates the
    // disagreement count from 26 to 61.
    // Both land on a letter `s`, so the letter alone cannot tell them apart —
    // it is WHICH `s` that moves. Compare the syllable the box sits in.
    const at = (text: string): [number, string][] => {
      const out: [number, string][] = [];
      let syl = -1;
      for (const t of mark(text, LEGACY)) {
        if (t.t !== 'syl') continue;
        syl += 1;
        for (const u of t.units) if (u.hold !== undefined) out.push([syl, u.c]);
      }
      return out;
    };
    // pre-sandhi `ṛ·caḥ ␣ sā·mā·ni`: the cross-word cluster is `ḥ`+`s` and the
    // host is the second word's sibilant — syllable 2.
    expect(at('ṛcaḥ sāmāni')).toEqual([[2, 's']]);
    // post-sandhi `ṛ·cas ␣ sā·mā·ni`: `s`+`s` reads as a geminate, and
    // dvivarcana takes the FIRST of the pair — syllable 1, one letter left.
    expect(at('ṛcas sāmāni')).toEqual([[1, 's']]);
  });
  it('a reading aid does not break the cluster it sits inside (bhavyam)', () => {
    // His own data: `bhavyam` carries sup:"u" AND the holding on the same `v`.
    const t = mark('yad bhavyam', LEGACY);
    const v = t.flatMap((x) => (x.t === 'syl' ? x.units : [])).find((u) => u.c === 'v');
    expect(v?.sup).toBe('u');
    expect(v?.hold).toBeDefined();
  });
});

/* ===========================================================================
   The caret map — one span per emitted unit, in emitted order.

   This is what lets the editor map a caret in the rendered marked text back to
   an offset in the source. It broke silently once: the spans were built by
   filtering the element list for letters, and the hyphen became a unit that is
   not a letter, so every unit after a hyphen in `chaṁyorā-vṛṇīmahe` pointed at
   the wrong source offset and typing scattered the text across the line.
   =========================================================================== */
describe('srcMap · the editor caret map', () => {
  const CASES = [
    'agnim īḷe purohitaṁ yajñasya',
    // Hyphens: the case that broke it. Nineteen of these in durgā-sūktam.
    "duritā'tya-gniḥ svastira-stu naḥ",
    'oṁ tac chaṁyorā-vṛṇīmahe gātuṁ yajñāya',
    // A gum, a daṇḍa and a line break in one fragment.
    'namo rājāṁ siyo | agnaye ॥',
  ];

  for (const text of CASES) {
    it(`one span per unit — ${text}`, () => {
      const d = derive({ lines: text.split(' // ') }, PROFILES.taittiriya, { trace: false });
      const units = d.tokens.reduce((n, t) => n + (t.t === 'syl' ? t.units.length : 0), 0);
      expect(d.srcMap.units.length).toBe(units);

      // Every span must address real text, and the spans must not run backwards
      // within a line — a caret map that jumps is a caret map that drifts.
      let line = -1;
      let end = -1;
      for (const s of d.srcMap.units) {
        expect(s.end).toBeGreaterThanOrEqual(s.start);
        const source = d.srcMap.lines[s.line];
        expect(source).toBeDefined();
        expect(s.end).toBeLessThanOrEqual(source!.length);
        if (s.line !== line) { line = s.line; end = -1; }
        expect(s.start).toBeGreaterThanOrEqual(end === -1 ? 0 : end - 1);
        end = s.end;
      }
    });
  }

  it('a hyphen survives derivation and stays a coda', () => {
    const d = derive({ lines: ['chaṁyorā-vṛṇīmahe'] }, PROFILES.taittiriya, { trace: false });
    const syls = d.tokens.filter((t) => t.t === 'syl');
    const withHyphen = syls.filter((t) => t.units.some((u) => u.c === '-'));
    expect(withHyphen).toHaveLength(1);
    // A coda, never an onset: `rā-` and then `vṛ`.
    expect(withHyphen[0]!.iast).toBe('rā-');
    expect(withHyphen[0]!.deva).toBe('रा-');
    expect(withHyphen[0]!.units.at(-1)!.c).toBe('-');
  });

  it('an anusvāra closes its syllable, in every script', () => {
    const d = derive({ lines: ['chaṁyo rajāṁsi vairocanīṁ karma'] }, PROFILES.taittiriya, { trace: false });
    const iast = d.tokens.filter((t) => t.t === 'syl').map((t) => t.iast);
    expect(iast).toContain('chaṁ');
    // The gum keeps its `m` base and still closes.
    expect(iast).toContain('jām');
    // A homorganic nasal closes too, and is written with an explicit virāma.
    expect(iast).toContain('nīṅ');
    const nin = d.tokens.find((t) => t.t === 'syl' && t.iast === 'nīṅ');
    expect(nin && nin.t === 'syl' ? nin.deva : '').toBe('नीङ्');
  });
});
