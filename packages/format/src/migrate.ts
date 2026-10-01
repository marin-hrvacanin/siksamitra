/**
 * TOKENS ⇄ TEXT AND MARKINGS — the conversion, and the proof that it loses
 * nothing.
 *
 * The corpus is stored as a token stream: one object per letter, four script
 * spellings per syllable, marks as fields on units. It is becoming one text and
 * a list of markings over it (`openspec/changes/text-and-marks`). This file is
 * both directions of that conversion, together in one place, because the only
 * thing that makes the change safe is that they are inverses — and two
 * functions that must be inverses belong where a reader can see both.
 *
 * THE ROUND TRIP IS THE GATE. `tools/migrate-audit.mjs` runs every verse of
 * every document through `toTextAndMarks` and back through `toTokens`, and
 * compares the result with what it started from, field for field. The owner's
 * requirement is exact: "if there is even 0.001% loss, then fix the logic and
 * algorithms so that it's exactly 0%".
 *
 * WHAT IS DELIBERATELY NOT RECOMPUTED. Syllable division and the four script
 * spellings are derived — the lossless gate already proves the spellings are
 * recomputable at 15 881 of 15 881 — but this conversion does NOT recompute
 * them, because a conversion that also re-derives cannot tell a conversion
 * fault from a derivation fault. Boundaries are carried across as markings and
 * the spellings are recomputed by the renderer, at draw time, from the text.
 */
import type { ChantToken } from './chant-tokens.js';
import { CANDRA, structuralText, typedAs } from './typed-letter.js';

export { CANDRA } from './typed-letter.js';
import type { ChantVerse } from './chant-verse.js';
import { mark, type Mark } from './mark.js';
import { normalise } from './mark-ops.js';
import { trimLineEnds } from './trim-lines.js';

/** What a verse looks like in the new model. */
export interface TextAndMarks {
  text: string;
  marks: Mark[];
  /**
   * Where each LETTER of the verse sits in the text, in token order.
   *
   * A letter is a syllable's unit — the thing `UnitAddress.unit` counts and
   * the thing a marking button addresses. Spaces, daṇḍas and numbers are not
   * letters and take no place in this list, though they do take space in the
   * text, so the spans are not contiguous.
   *
   * Returned from HERE rather than computed by a second walk, because a second
   * walk is a second answer to "where is letter 12", and the first time the
   * two disagreed a holding would land one letter to the left.
   *
   * OPTIONAL on the type, present on everything `toTextAndMarks` returns. A
   * caller that builds a text and its markings from somewhere else — the
   * re-run, which gets them from the engine — has no letters to report and
   * should not have to invent an empty list.
   */
  units?: { from: number; to: number }[];
}

/**
 * A verse's tokens as one text and a list of markings.
 *
 * Every marking it produces is `by: 'hand'`. That is not a default, it is the
 * meaning: these are the markings the document arrived carrying, and nothing
 * may regenerate them without being asked. The one exception is a pause the
 * document itself says the rules placed (`rule` on the token) — his blue bar.
 */
export function toTextAndMarks(verse: ChantVerse): TextAndMarks {
  let text = '';
  const marks: Mark[] = [];
  const units: { from: number; to: number }[] = [];

  /** An open run per kind, so equal adjacent values become ONE marking. */
  const open = new Map<string, Mark>();
  const close = (k: string): void => {
    const run = open.get(k);
    if (run !== undefined) { marks.push(run); open.delete(k); }
  };
  const closeAll = (): void => { for (const k of [...open.keys()]) close(k); };
  const put = (k: Mark['k'], v: string | undefined, from: number, to: number): void => {
    const run = open.get(k);
    if (run !== undefined && run.v === v && run.to === from) { run.to = to; return; }
    close(k);
    open.set(k, mark({ k, from, to, ...(v === undefined ? {} : { v }) }));
  };

  /** The box number of the last held letter, while its holding is open. */
  let heldGroup: number | undefined;
  /**
   * Does the holding open before the space at `i` go on after it? Only when the
   * letters either side are in the same NUMBERED box: that is a person having
   * drawn one box over two words, which is what `hg` records — his `n n` in
   * `vipa̱n na̍rā`, one box in his file. Two boxes that merely touch have
   * different numbers, and stay two.
   */
  const spans = (tokens: readonly ChantToken[], i: number): boolean => {
    const run = open.get('hold');
    if (run === undefined || heldGroup === undefined) return false;
    for (let k = i + 1; k < tokens.length; k += 1) {
      const t = tokens[k]!;
      if (t.t === 'sp') continue;
      const u = t.t === 'syl' ? t.units[0] : undefined;
      return u !== undefined && u.hold === run.v && u.hg === heldGroup;
    }
    return false;
  };

  const walk = (tokens: readonly ChantToken[]): void => {
    for (const [i, t] of tokens.entries()) {
      if (t.t === 'sp' && spans(tokens, i)) {
        /* Everything else ends at the space; the box goes on over it. */
        for (const k of [...open.keys()]) if (k !== 'hold') close(k);
        text += structuralText(t) ?? ' ';
        open.get('hold')!.to = text.length;
        continue;
      }
      if (t.t === 'syl') {
        const start = text.length;
        for (const u of t.units) {
          const at = text.length;
          text += u.c;

          /*
           * A CANDRABINDU IS A CHARACTER, not a marking.
           *
           * The token shape stores it as a boolean on the letter, and the old
           * renderer put it back by appending U+0310 to the glyph. As a
           * marking it could not be drawn at all by the run renderer, whose
           * element holds one text node and no room for a combining mark laid
           * over it — the parity gate showed it simply absent. It belongs in
           * the text, which is also where an author types it, and
           * `splitsCharacter` already forbids a marking boundary falling
           * between a letter and its combining mark.
           */
          if (u.candra === true) text += CANDRA;
          const end = text.length;
          units.push({ from: at, to: end });

          if (u.change === true) marks.push(mark({ k: 'was', from: at, to: end, v: typedAs(u) }));
          if (u.hold !== undefined) put('hold', u.hold, at, end); else close('hold');
          heldGroup = u.hold === undefined ? undefined : u.hg;
          if (u.svara !== undefined) put('svara', u.svara, at, end); else close('svara');
          if (u.cj !== undefined) marks.push(mark({ k: 'cj', from: at, to: end, v: u.cj }));
          if (u.sbhakti === true) marks.push(mark({ k: 'sbhakti', from: at, to: at }));
          if (u.sup !== undefined) marks.push(mark({ k: 'sup', from: at, to: end, v: u.sup }));
        }
        /*
         * WHERE THE SYLLABLE ENDED. Carried rather than recomputed — see the
         * header. A boundary is a point marking, and the one at the very start
         * of the verse is implied, so only the ends are written.
         */
        marks.push(mark({ k: 'syl', from: text.length, to: text.length }));
        if (start === text.length) marks.pop();
        continue;
      }

      /* Any non-syllable token ends every open run: a holding does not span a
         space unless somebody drew it that way, and this is the OLD data. */
      closeAll();

      if (t.t === 'slot') {
        const at = text.length;
        walk(t.tokens);
        marks.push(mark({ k: 'slot', from: at, to: text.length, v: t.name }));
        continue;
      }
      if (t.t === 'pause') {
        /* The one marking a document can say the RULES placed: see the pause
           token. Every other one is the document's own, and `hand`. */
        marks.push(mark({ k: 'pause', from: text.length, to: text.length, v: t.len, ...(t.rule === true ? { by: 'rule' as const } : {}) }));
        continue;
      }
      const s = structuralText(t);
      if (s === null) continue;
      const at = text.length;
      text += s;
      /* A `text` token is prose inside a marked stream and has to come back as
         one; a daṇḍa and a number are recognisable from the characters alone. */
      if (t.t === 'text') {
        marks.push(mark({
          k: 'plain',
          from: at,
          to: text.length,
          ...(t.fill === true ? { v: 'fill' } : {}),
        }));
      }
    }
  };

  walk(verse.tokens);
  closeAll();
  return trimLineEnds({ text, marks: normalise(marks), units });
}

export { toTokens, type TokenHelp } from './to-tokens.js';
