/**
 * TOKENS ⇄ TEXT AND MARKINGS, on the cases the corpus does not contain.
 *
 * The corpus round trip is the real proof and it lives in
 * `tools/migrate-audit.mjs`: 573 of 573 verses, exactly. What it cannot do is
 * fail on purpose, so these are the shapes that broke the conversion while it
 * was being written, kept so they cannot break it again — each one a bug that
 * was found by running it, not a case somebody imagined.
 */
import { describe, expect, it } from 'vitest';
import { assertMarks, markFaults } from '../mark.js';
import { toTextAndMarks, toTokens } from '../migrate.js';
import type { ChantToken, ChantVerse } from '../chant.js';

const syl = (iast: string, units: ChantToken extends never ? never : object[]): ChantToken =>
  ({ t: 'syl', iast, deva: iast, units } as ChantToken);

const verse = (tokens: ChantToken[]): ChantVerse => ({ id: 'v-1', tokens } as ChantVerse);

/** The two things the caller supplies, since the engine sits above this package. */
const DIGRAPHS = ['kh', 'gh', 'ch', 'jh', 'ṭh', 'ḍh', 'th', 'dh', 'ph', 'bh', 'ai', 'au'];
const split = (text: string): string[] => {
  const out: string[] = [];
  for (let i = 0; i < text.length;) {
    const two = text.slice(i, i + 2);
    if (DIGRAPHS.includes(two)) { out.push(two); i += 2; } else { out.push(text[i]!); i += 1; }
  }
  return out;
};
const help = { spell: (iast: string) => ({ deva: iast }), split };

/** There and back, for comparing. */
const round = (v: ChantVerse): ChantToken[] => {
  const { text, marks } = toTextAndMarks(v);
  assertMarks(marks, text, 'round trip');
  return toTokens({ text, marks }, help);
};

describe('a letter is not a character', () => {
  it('an aspirate survives, because the split is by LETTER', () => {
    /* The first version walked characters, so every `bh` came back `b` — in
       573 of 573 verses. */
    const v = verse([syl('bha', [{ c: 'bh' }, { c: 'a' }])]);
    const back = round(v);
    expect(back).toHaveLength(1);
    expect((back[0] as { units: { c: string }[] }).units.map((u) => u.c)).toEqual(['bh', 'a']);
  });
});

describe('what sits between the letters', () => {
  it('a pause keeps its place between two spaces', () => {
    /*
     * `sp PAUSE sp` came back `sp sp syl(p) PAUSE` because the offset was only
     * advanced on the letter branches, so everything after the first space was
     * read at the wrong position.
     */
    const v = verse([
      syl('oṁ', [{ c: 'o' }, { c: 'ṁ' }]),
      { t: 'sp' }, { t: 'pause', len: 'short' }, { t: 'sp' },
      syl('na', [{ c: 'n' }, { c: 'a' }]),
    ] as ChantToken[]);
    expect(round(v).map((t) => t.t)).toEqual(['syl', 'sp', 'pause', 'sp', 'syl']);
  });

  it('a pause after the last letter is not dropped', () => {
    const v = verse([syl('na', [{ c: 'n' }, { c: 'a' }]), { t: 'pause', len: 'long' }] as ChantToken[]);
    expect(round(v).map((t) => t.t)).toEqual(['syl', 'pause']);
  });

  it('a verse number keeps its dot', () => {
    /* `1.2` is one number; matching a single digit split 37 of them apart. */
    const v = verse([{ t: 'num', s: '1.2' }] as ChantToken[]);
    expect(round(v)).toEqual([{ t: 'num', s: '1.2' }]);
  });
});

describe('substitutions', () => {
  it('a changed letter records what it was, and comes back changed', () => {
    /* `iast` is the SHOWN letters — the corpus stores `ndhun`, not `ndhuṁ` —
       which is the same direction the new model takes. */
    const v = verse([syl('nan', [{ c: 'n' }, { c: 'a' }, { c: 'n', change: true }])]);
    const { text, marks } = toTextAndMarks(v);
    /* The text holds what is SHOWN; the marking holds what it was. */
    expect(text).toBe('nan');
    expect(marks.filter((m) => m.k === 'was').map((m) => [m.from, m.to, m.v]))
      .toEqual([[2, 3, 'ṁ']]);
    expect(round(v)).toEqual(v.tokens);
  });

  it('two substituted letters side by side stay TWO substitutions', () => {
    /*
     * Śrī Rudram has three verses where consecutive letters were each a
     * visarga. Fusing the two markings — which the merge rule did — says the
     * pair of them was a single `ḥ`, and loses a letter.
     */
    const v = verse([syl('ss', [{ c: 's', change: true }, { c: 's', change: true }])]);
    const { text, marks } = toTextAndMarks(v);
    expect(markFaults(marks, text)).toEqual([]);
    expect(marks.filter((m) => m.k === 'was')).toHaveLength(2);
    expect(round(v)).toEqual(v.tokens);
  });
});

describe('holdings', () => {
  it('a run of one holding is one marking, and comes back one box', () => {
    const v = verse([
      syl('na', [{ c: 'n', hold: 'long', hg: 1 }, { c: 'a', hold: 'long', hg: 1 }]),
    ]);
    const { marks } = toTextAndMarks(v);
    expect(marks.filter((m) => m.k === 'hold')).toHaveLength(1);
    const back = round(v) as { units: { hg?: number }[] }[];
    expect(new Set(back[0]!.units.map((u) => u.hg)).size).toBe(1);
  });

  it('a holding does not run across a space it never covered', () => {
    const v = verse([
      syl('na', [{ c: 'n', hold: 'long', hg: 1 }, { c: 'a', hold: 'long', hg: 1 }]),
      { t: 'sp' },
      syl('ma', [{ c: 'm', hold: 'long', hg: 2 }, { c: 'a', hold: 'long', hg: 2 }]),
    ] as ChantToken[]);
    const { marks } = toTextAndMarks(v);
    expect(marks.filter((m) => m.k === 'hold')).toHaveLength(2);
  });
});

describe('the markings are always sound', () => {
  it('an empty verse converts to an empty text and no markings', () => {
    const { text, marks } = toTextAndMarks(verse([]));
    expect(text).toBe('');
    expect(marks).toEqual([]);
  });

  it('a line break becomes a newline and comes back a break', () => {
    const v = verse([
      syl('a', [{ c: 'a' }]), { t: 'br' }, syl('i', [{ c: 'i' }]),
    ] as ChantToken[]);
    expect(toTextAndMarks(v).text).toBe('a\ni');
    expect(round(v).map((t) => t.t)).toEqual(['syl', 'br', 'syl']);
  });
});
