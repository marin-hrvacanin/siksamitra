/**
 * The accented witness — transcribing accents from a source that has them.
 *
 * The OTHER way a verse gets its svaras. `svara.ts` holds the positional
 * plans, which compute an accent from a metre; this holds the transcription,
 * which reads one off a witness. The two are mutually exclusive by register:
 * a positional preset may never be applied to genuinely Vedic text, and a
 * witness is the only thing that may (see `SvaraRegister`).
 *
 * Split out of `svara.ts` when that file passed 400 lines. They share the
 * mark table, which stays there, because a mark means the same thing to both.
 */
import type { ChantSvara } from '@siksamitra/format';
import { parseLetters } from '../alphabet.js';
import type { RuleCtx } from './types.js';
import { MARK_CHAR, PLAN_MARK } from './svara.js';

/**
 * What is NOT a letter in a witness line.
 *
 * Whitespace, the daṇḍa bars, the pāda bar, a verse number's digits and the
 * dot inside one, the two zero-width conjunct controls, and the orthographic
 * HYPHEN — the same things `lex` splits a part at, and none of which becomes a
 * letter element.
 *
 * The hyphen is the one that is easy to miss and the corpus carries 317 of
 * them: `lex` gives it its own element kind, so counting it here shifted every
 * accent after it and put 337 accents on letters that never had one.
 */
const STRUCTURE = /^[\s|¦.\-0-9०-९౦-౯௦-௯‌‍]+$/u;

/**
 * Carry accents from an accented witness onto the verse's own word-split.
 *
 * Transcribing combining marks by hand is the one step in the pipeline with no
 * safety net, so this matches NUCLEUS FOR NUCLEUS, per line, and refuses a
 * line whose counts disagree rather than sliding the accents along it. A
 * silent off-by-one here moves every accent in a verse, and the result still
 * looks like a marked text.
 *
 * WHAT THIS DOES AND DOES NOT PROVE. It used to compute the marks and then
 * assign none — a declared feature that nothing implemented, so an attested
 * verse could not be regenerated at all and had to stay frozen. It now
 * assigns them. What that buys is REGENERABILITY: a verse whose witness is
 * stored can be re-derived and get its accents back, so it can be edited. It
 * does not verify the transcription against a printed edition; only a reader
 * with the edition can do that, and `ChantVerseSource.departures` is where
 * such a decision is recorded.
 */
export function applyAttestedSvara(ctx: RuleCtx, accented: string[]): void {
  /**
   * Per line, the accent on each LETTER that carries one.
   *
   * PER LETTER, NOT PER NUCLEUS, and that correction matters: the witness
   * writes a mark immediately after the letter it belongs to, and this pass
   * used to walk vowels only and write the mark onto the preceding VOWEL. The
   * corpus carries 47 accents on non-vowels — 36 of them on `m` — and every
   * one of them moved a letter to the left on re-derivation. It was invisible
   * because the reconstruction that produced the witness and this pass that
   * reads it were both wrong in the same direction, and the difference was
   * then papered over by 51 override records.
   *
   * A mark before any letter is a transcription error, not an accent on
   * nothing, and is dropped here; the count check below is what then refuses
   * the line.
   */
  const perLine: (ChantSvara | null)[][] = accented.map((line) => {
    const slots: (ChantSvara | null)[] = [];
    for (const letter of parseLetters(line)) {
      const mark = PLAN_MARK.get(letter);
      if (mark !== undefined) {
        if (slots.length > 0) slots[slots.length - 1] = mark;
        continue;
      }
      // STRUCTURE TAKES NO SLOT. The element list this is matched against
      // holds letters only, so counting a space, a daṇḍa bar or a verse
      // number's digits here shifts every accent after it by one — measured
      // as 16 svaras landing a letter late in one document alone.
      if (!STRUCTURE.test(letter)) slots.push(null);
    }
    return slots;
  });

  /** Every letter of each line, in order — the same units the witness has. */
  const lettersByLine = new Map<number, number[]>();
  ctx.elems.forEach((e, i) => {
    if (e.kind !== 'letter') return;
    lettersByLine.set(e.line, [...(lettersByLine.get(e.line) ?? []), i]);
  });

  for (const [line, letters] of lettersByLine) {
    const marks = perLine[line];
    if (marks === undefined) continue;
    if (marks.length !== letters.length) {
      ctx.warn(
        'svara.witness-mismatch',
        `line ${line} of the witness has ${marks.length} letters but the text has `
        + `${letters.length} — every difference must be a declared decision, so no `
        + 'accent from this line is applied',
        letters[0],
      );
      continue;
    }
    letters.forEach((elemIndex, k) => {
      const mark = marks[k] ?? null;
      const e = ctx.elems[elemIndex]!;
      if (mark === null) {
        delete e.svara;
        return;
      }
      e.svara = mark;
      ctx.trace(elemIndex, `${mark} from the accented witness`, 'svara.attested');
    });
  }
}

/**
 * The accented witness for a verse, from the marks it already carries.
 *
 * The inverse of the pass above, and the reason a shipped document can be
 * given a source layer at all: its accents exist only on its units, so they
 * have to be written back out as text before the text can be the source.
 *
 * One implementation, used by `sm attach-src` and by the round-trip gate.
 */
export function witnessLine(letters: readonly { c: string; svara?: ChantSvara }[]): string {
  let out = '';
  for (const u of letters) {
    out += u.c;
    if (u.svara !== undefined) out += MARK_CHAR.get(u.svara) ?? '';
  }
  return out;
}
