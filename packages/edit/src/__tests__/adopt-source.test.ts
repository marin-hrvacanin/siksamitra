/**
 * MARKING A VERSE THAT CAME FROM A MARKED SOURCE.
 *
 * The owner's report, three times over, was that selecting letters and
 * pressing a holding button did nothing. The cause was rule zero enforced by
 * refusal: a verse with no `src` layer could not be addressed, could not be
 * marked, and said so in a paragraph about evidence.
 *
 * What these assert is the property that made it safe to stop refusing — that
 * adopting a source layer CANNOT CHANGE THE MARKS. Every one of them compares
 * the letters and marks after the operation against the letters and marks that
 * were there before it, which is a fact about the document rather than
 * anything the code under test reports about itself.
 */
import { describe, expect, it } from 'vitest';
import { adoptSource, unitsOf } from '../adopt-source.js';
import { markUnits } from '../mark-tokens.js';
import { tokenSrcMap } from '../token-src-map.js';
import { linesFromTokens } from '../sync.js';
import { holdingProblems } from '../holdings.js';
import { emptyHistory } from '../history.js';
import { apply, newState } from '../session.js';
import { attested, doc, handMarked, section, verse } from './fixture.js';
import { section1 } from './helpers.js';

/** Every letter with the marks an override can carry, as comparable data. */
const shape = (tokens: Parameters<typeof unitsOf>[0]) => unitsOf(tokens).map((u) => ({
  c: u.c,
  hold: u.hold ?? null,
  svara: u.svara ?? null,
  change: u.change ?? null,
  sup: u.sup ?? null,
  candra: u.candra ?? null,
  sbhakti: u.sbhakti ?? null,
}));

/** A transcribed verse: the same tokens, with the source layer taken away. */
const frozen = (id: string, lines: string[]) => attested(id, lines);

describe('adopting a source layer', () => {
  it('does nothing at all to a verse that already has one', () => {
    const v = verse('v-1', ['agnim īḷe purohitaṁ']);
    const r = adoptSource(v, undefined, undefined, []);
    expect(r.ok && r.changed).toBe(false);
    expect(r.ok && r.verse).toBe(v);
  });

  it('leaves the marks EXACTLY as they were, letter for letter', () => {
    const was = frozen('v-1', ['agnim īḷe purohitaṁ']);
    const before = shape(was.tokens);

    const r = adoptSource(was, undefined, undefined, []);
    expect(r.ok, r.ok ? '' : r.why).toBe(true);
    if (!r.ok || !r.changed) return;

    expect(shape(r.verse.tokens)).toEqual(before);
    /* And it is now derivable, which is the point of doing it. */
    expect(r.verse.src?.lines.length).toBeGreaterThan(0);
  });

  it('is idempotent: adopting an adopted verse writes no further override', () => {
    const was = frozen('v-1', ['agnim īḷe purohitaṁ']);
    const first = adoptSource(was, undefined, undefined, []);
    expect(first.ok).toBe(true);
    if (!first.ok || !first.changed) return;

    const again = adoptSource(first.verse, undefined, undefined, first.overrides);
    expect(again.ok && again.changed).toBe(false);
    expect(again.ok && again.overrides).toEqual(first.overrides);
  });

  it('WITNESSES a mark the engine would not have placed, and keeps it', () => {
    /*
     * THE MECHANISM, exercised at last. Every fixture here used to be a
     * derived verse with its source removed, so the engine reproduced all of
     * them and the witness loop never ran: deleting it left the whole suite
     * green. This verse carries two holdings the rules do not place.
     */
    const was = handMarked('v-1', ['agnim īḷe purohitaṁ'], [1, 9]);
    const before = shape(was.tokens);
    const plain = adoptSource(attested('v-1', ['agnim īḷe purohitaṁ']), undefined, undefined, []);
    expect(plain.ok && plain.changed && plain.witnessed).toBe(0);

    const r = adoptSource(was, undefined, undefined, []);
    expect(r.ok, r.ok ? '' : r.why).toBe(true);
    if (!r.ok || !r.changed) return;

    /* The engine had to be told about the two letters, and about nothing else. */
    expect(r.witnessed).toBe(2);
    expect(r.overrides).toHaveLength(2);
    expect(r.overrides.every((o) => o.why === 'source-witness')).toBe(true);
    /* And the verse still looks exactly as it did. */
    expect(shape(r.verse.tokens)).toEqual(before);
    expect(shape(r.verse.tokens).filter((u) => u.hold === 'long')).toHaveLength(2);
  });

  it('refuses when the verse is more than its letters', () => {
    /*
     * The check that step four is about the WHOLE stream. `unitsOf` walks past
     * every token that is not a syllable, so an earlier version compared the
     * letters and let the rest through: marking one letter of ganeśa-aṣṭottara
     * n-17 deleted the brackets around it, and moved or dropped the pauses of
     * 31 verses, reporting success each time.
     */
    const was = attested('v-1', ['agnim īḷe purohitaṁ']);
    const withText = {
      ...was,
      tokens: [{ t: 'text' as const, s: '[' }, ...was.tokens, { t: 'text' as const, s: ']' }],
    };
    const r = adoptSource(withText, undefined, undefined, []);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.why).toContain('more than its letters');
  });

  it('writes no override where the engine already agrees', () => {
    /*
     * The whole design rests on this: a verse the rules reproduce costs
     * nothing to adopt. If it cost one override per letter, every document
     * would double in size the first time anybody marked anything.
     */
    const derived = verse('v-1', ['agnim īḷe purohitaṁ']);
    const { src: _drop, ...same } = derived;
    const r = adoptSource(same, undefined, undefined, []);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.changed) return;
    expect(r.witnessed).toBe(0);
    expect(r.overrides).toHaveLength(0);
  });
});

describe('a transcribed verse can be pointed at', () => {
  it('every drawn letter has a place in the recited text', () => {
    const was = frozen('v-1', ['agnim īḷe purohitaṁ']);
    const map = tokenSrcMap(was)!;
    const units = unitsOf(was.tokens);
    expect(map.units).toHaveLength(units.length);

    /* The span names the letter it is the span OF — checked against the text,
       not against the arithmetic that produced the span. */
    for (const [i, span] of map.units.entries()) {
      const line = map.lines[span.line] ?? '';
      expect(line.slice(span.start, span.end)).toBe(units[i]!.c);
    }
  });

  /*
   * A VERSE WITH A SOURCE GETS ONE TOO, and this test used to assert the
   * opposite: `tokenSrcMap` refused such a verse "because it has a real one".
   *
   * That was true when `src` was the thing being edited. The caret edits the
   * text that is SHOWN now — `sourcesOf` returns `toTextAndMarks(v).text` for
   * every verse — so a map derived from the typed source addresses a different
   * string, and `src` does not change when the text does, so it went stale on
   * the first keystroke. Measured: Enter in the middle of a pāda painted the
   * caret a line below the text, because `{line: 1, column: 0}` resolved
   * through the pre-edit source.
   *
   * An override is still addressed through `verseSrcMap`, which IS a
   * derivation. This answers "which letter is that".
   */
  it('a verse WITH a source gets one as well, over the text that is shown', () => {
    const withSource = verse('v-1', ['agnim īḷe']);
    const map = tokenSrcMap(withSource);
    expect(map).not.toBeNull();
    const units = unitsOf(withSource.tokens);
    expect(map!.units).toHaveLength(units.length);
    /* And it is over the SHOWN letters: each span names the letter it spans,
       checked against the map's own lines rather than against the arithmetic
       that produced the span. */
    for (const [i, span] of map!.units.entries()) {
      const line = map!.lines[span.line] ?? '';
      expect(line.slice(span.start, span.end)).toBe(units[i]!.c);
    }
  });

  it('and its lines are the lines a person sees, not the lines that were typed', () => {
    /*
     * THE DISTINCTION THAT WAS COSTING THE CARET ITS PLACE. A source line and
     * a shown line are not the same string — the rules replace letters — so a
     * map of one cannot address the other. This asserts the map's lines are
     * the drawn ones.
     */
    const withSource = verse('v-1', ['agnim īḷe purohitaṁ']);
    const map = tokenSrcMap(withSource)!;
    expect(map.lines).toEqual(linesFromTokens(withSource));
  });
});

describe('marking straight onto a letter', () => {
  it('marks the letters named and no others', () => {
    const was = frozen('v-1', ['agnim īḷe purohitaṁ']);
    const before = shape(was.tokens);
    const { verse: now, marked } = markUnits(was, [2, 3], { hold: 'long' });
    expect(marked).toBe(2);

    const after = shape(now.tokens);
    for (const [i, letter] of after.entries()) {
      if (i === 2 || i === 3) expect(letter.hold).toBe('long');
      else expect(letter).toEqual(before[i]);
    }
    /* The verse is still frozen: marking one letter must not invent a source. */
    expect(now.src).toBeUndefined();
  });

  it('two adjacent letters become ONE box, not two touching ones', () => {
    const was = frozen('v-1', ['agnim īḷe purohitaṁ']);
    const { verse: now } = markUnits(was, [2, 3], { hold: 'long' });
    expect(holdingProblems(now.tokens)).toEqual([]);

    const units = unitsOf(now.tokens);
    expect(units[2]!.hg).toBeDefined();
    expect(units[3]!.hg).toBe(units[2]!.hg);
  });

  it('taking a holding off takes its group with it', () => {
    const was = frozen('v-1', ['agnim īḷe purohitaṁ']);
    const on = markUnits(was, [2], { hold: 'long' }).verse;
    const off = markUnits(on, [2], { hold: null }).verse;
    const u = unitsOf(off.tokens)[2]!;
    expect(u.hold).toBeUndefined();
    /* `hg` with no `hold` is a box around nothing, and the invariants say so. */
    expect(u.hg).toBeUndefined();
    expect(holdingProblems(off.tokens)).toEqual([]);
  });
});

describe('the session marks a transcribed verse', () => {
  const frozenDoc = () => doc([section('s1', [frozen('v-1', ['agnim īḷe purohitaṁ'])])]);

  it('the mark lands, and nothing is refused', () => {
    const start = newState(frozenDoc());
    const { state } = apply(start, emptyHistory(), {
      k: 'mark',
      sectionId: 's1',
      targets: [0, 1, 2].map((unit) => ({ verseId: 'v-1', unit })),
      patch: { hold: 'long' },
      why: 'owner-hand',
    });

    expect(state.refusals).toEqual([]);
    const units = unitsOf(section1(state).verses[0]!.tokens);
    expect(units.slice(0, 3).map((u) => u.hold)).toEqual(['long', 'long', 'long']);
    /*
     * The GROUPS are per syllable, and three adjacent letters spanning a
     * syllable boundary are legitimately more than one — a box is drawn per
     * syllable because half a conjunct cannot be boxed. What must hold here is
     * that every group is a legal one; that the boxes then read as a single
     * box is the renderer's half, and `hold-joins.test.ts` checks it.
     */
    expect(holdingProblems(section1(state).verses[0]!.tokens)).toEqual([]);
    expect(units.slice(0, 3).every((u) => u.hg !== undefined)).toBe(true);
  });

  it('the letters of the verse are otherwise untouched', () => {
    const start = newState(frozenDoc());
    const before = shape(start.doc.sections[0]!.verses[0]!.tokens);
    const { state } = apply(start, emptyHistory(), {
      k: 'mark',
      sectionId: 's1',
      targets: [{ verseId: 'v-1', unit: 0 }],
      patch: { hold: 'long' },
      why: 'owner-hand',
    });
    const after = shape(section1(state).verses[0]!.tokens);
    expect(after.map((u) => u.c)).toEqual(before.map((u) => u.c));
    expect(after.slice(1)).toEqual(before.slice(1));
  });
});
