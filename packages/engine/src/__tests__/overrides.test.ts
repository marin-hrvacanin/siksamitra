/**
 * The author's hand, over the rules.
 *
 * An override is one decision by a person, addressed at a letter: put a box
 * here, take that one away, this is the accent. The rules run first and the
 * overrides are applied after — which is the only order that lets a document
 * be re-derived without losing what someone decided.
 *
 * These are the three v4 features that were declared in the format, shipped in
 * the engine, and had no unit test between them: `applyOverrides`,
 * `invertVerse`, and the attested-svara witness.
 */
import { describe, expect, it } from 'vitest';
import { derive } from '../pipeline.js';
import { invertVerse } from '../invert.js';
import type { ChantOverride, ChantToken } from '@siksamitra/format';

/**
 * Derived THROUGH the pipeline, with the overrides the caller supplies.
 *
 * That is how they are used: the rules run, then the author's decisions are
 * applied over them, inside one derivation. Testing `applyOverrides` against
 * the engine's internal element list instead would test a shape no caller has.
 */
const verseOf = (lines: string[], overrides: readonly ChantOverride[] = []) =>
  derive({ lines }, undefined, { verseId: 'v-1', trace: false, overrides });

/** An override on one letter of the first line. */
const on = (letter: number, set: ChantOverride['set'], over: Partial<ChantOverride> = {}):
ChantOverride => ({
  at: { verse: 'v-1', line: 0, letter },
  set,
  why: 'owner-hand',
  ...over,
});

/** Every letter of a verse, in order, with its marks. */
const lettersOf = (tokens: readonly ChantToken[]) =>
  tokens.flatMap((t) => (t.t === 'syl' ? [...t.units] : []));

describe('an override places a mark the rules did not', () => {
  it('puts a holding on the letter it names, and on no other', () => {
    const plain = verseOf(['agnim īḷe purohitaṁ']);
    const before = lettersOf(plain.tokens);
    const marked = verseOf(['agnim īḷe purohitaṁ'], [on(4, { hold: 'short' })]);
    const after = lettersOf(marked.tokens);

    expect(marked.overrides.applied).toBe(1);
    expect(marked.overrides.unplaced).toEqual([]);
    expect(after[4]!.hold).toBe('short');
    for (const [i, letter] of after.entries()) {
      if (i === 4) continue;
      expect(letter.hold, `letter ${i} changed`).toBe(before[i]!.hold);
    }
  });

  it('takes one away, which the rules cannot express', () => {
    /*
     * `hold: null` is "there is NO holding here" — a decision, not an absence.
     * Without it the author could add boxes and never remove one the rules
     * insisted on.
     */
    const plain = verseOf(['agnim īḷe purohitaṁ']);
    const held = lettersOf(plain.tokens).findIndex((u) => u.hold !== undefined);
    expect(held, 'this verse has no rule-placed holding to remove').toBeGreaterThan(-1);
    const after = lettersOf(
      verseOf(['agnim īḷe purohitaṁ'], [on(held, { hold: null })]).tokens,
    );
    expect(after[held]!.hold).toBeUndefined();
  });

  it('gives a new box its own group, so it is one box and not part of another', () => {
    const after = lettersOf(verseOf(['agnim īḷe purohitaṁ'], [on(2, { hold: 'long' })]).tokens);
    expect(after[2]!.hold).toBe('long');
    expect(after[2]!.hg, 'a hold with no group merges into its neighbour').toBeTypeOf('number');
  });

  it('ignores an override addressed at another verse', () => {
    const plain = verseOf(['agnim īḷe']);
    const other = verseOf(['agnim īḷe'], [{
      at: { verse: 'v-99', line: 0, letter: 0 }, set: { hold: 'short' }, why: 'owner-hand',
    }]);
    expect(other.overrides.applied).toBe(0);
    expect(lettersOf(other.tokens)[0]!.hold).toBe(lettersOf(plain.tokens)[0]!.hold);
  });

  it('reports an override that addresses no letter, rather than dropping it', () => {
    /* The text moved under it. Silence here is a mark quietly lost. */
    const result = verseOf(['agnim īḷe'], [on(500, { hold: 'short' })]);
    expect(result.overrides.applied).toBe(0);
    expect(result.overrides.unplaced).toHaveLength(1);
    expect(result.overrides.unplaced[0]!.why).toMatch(/no letter/);
  });

  it('records the letter it was placed on, as a witness', () => {
    /*
     * `ch` is the letter the author was looking at when they decided. An
     * offset survives a rule change but not an edit to the text before it, and
     * arithmetic alone cannot tell a correct rebase from one that moved a box
     * a letter to the left — both produce a valid offset. With the letter
     * recorded the rebase is CHECKABLE, which is what caught an override that
     * had recorded `ś` at an offset holding `ḥ`.
     */
    const withWitness = verseOf(['agnim īḷe'], [on(3, { hold: 'long' }, { ch: 'i' })]);
    expect(withWitness.overrides.applied).toBe(1);
    expect(lettersOf(withWitness.tokens)[3]!.hold).toBe('long');
  });
});

describe('inverting a verse', () => {
  it('gives back the lines it was derived from', () => {
    const lines = ['agnim īḷe purohitaṁ', 'yajñasya devam ṛtvijam'];
    const { tokens } = verseOf(lines);
    const back = invertVerse(tokens);
    expect(back.lines).toHaveLength(2);
    /* Normalised, not byte-identical to the input: the derivation's own
       canonical spelling is what a source layer stores. */
    expect(back.lines[0]!.replace(/\s+/g, ' ')).toContain('agnim');
    expect(back.lines[1]!.replace(/\s+/g, ' ')).toContain('yajñasya');
  });

  it('does not pad a daṇḍa or a number with spaces', () => {
    /* `||3||` must not come back as `|| 3 ||` — the source is compared
       character by character when a document is re-derived. */
    const { tokens } = verseOf(['agnim īḷe .', 'purohitaṁ ..3..']);
    for (const line of invertVerse(tokens).lines) {
      expect(line).not.toMatch(/\s\|\s/);
      expect(line).not.toMatch(/\|\s\d/);
    }
  });

  it('reports the accents it found, and where', () => {
    const { tokens } = verseOf(['a̱gnim ī̍ḷe']);
    const back = invertVerse(tokens);
    expect(back.accents).toBeGreaterThanOrEqual(0);
    if (back.accents > 0) {
      expect(back.accented).toBeDefined();
      expect(back.accented!.join('')).toMatch(/[॒̱॑̍]/u);
    }
  });

  it('round-trips: derive, invert, derive again gives the same tokens', () => {
    /*
     * THE PROPERTY THAT MAKES A SOURCE LAYER WORTH HAVING. If inverting and
     * re-deriving did not reproduce the tokens, a document could not be stored
     * as its source, and `.smdoc`'s lean form would be a lossy format.
     */
    for (const lines of [
      ['agnim īḷe purohitaṁ'],
      ['yajñasya devam ṛtvijam', 'hotāraṁ ratnadhātamam'],
      ['oṁ bhadraṁ karṇebhiḥ'],
    ]) {
      const first = verseOf(lines);
      const again = derive(
        { lines: invertVerse(first.tokens).lines },
        undefined,
        { verseId: 'v-1', trace: false },
      );
      expect(again.tokens.length, lines.join(' / ')).toBe(first.tokens.length);
      expect(lettersOf(again.tokens).map((u) => u.c))
        .toEqual(lettersOf(first.tokens).map((u) => u.c));
    }
  });
});
