/**
 * A MARKING, ON DISK. One encoder, one decoder, and nothing else may write one.
 *
 * The in-memory `Mark` is a readable object with six fields. Written out as it
 * stands it is enormous: 11,582 markings in Śrī Rudram, 376.7 kB of JSON, of
 * which `stage` is 205.1 kB and `by` 135.7 kB — two fields that carry the same
 * value on nearly every marking in the corpus. The document has to be
 * kilobytes and hold a book, so the stored form is a tuple:
 *
 *     ["hold", 12, 3]                   a holding over three letters
 *     ["svara", 4, 1, "anudatta"]       a value, when the kind carries one
 *     ["hold", 12, 3, "short", "rule"]  placed by a rule rather than by hand
 *
 * `[kind, from, span, value?, by?]`. SPAN, not `to`: it is almost always a
 * small number while `to` grows with the verse, so the digits stay short.
 *
 * WHAT IS NOT STORED, because it is derived — storing it would be a second
 * source of truth as much as a waste:
 *
 *   `stage`  is `STAGE_OF[kind]`, always. Checked against the corpus: the
 *            eight kinds in use produce exactly eight kind:stage pairs, so the
 *            field never carries information the kind does not.
 *   `by`     is written only when it is 'rule'. Every one of the 11,582
 *            markings in Śrī Rudram is 'hand' — the migration cannot tell
 *            which the engine would have placed, so it says hand, which is the
 *            answer that cannot lose someone's work. And once the engine
 *            reproduces what it can (`text-and-marks` §4.5), a rule-placed
 *            marking is not stored at all. Hand is the case that persists, so
 *            hand is the default.
 *   `rule`   is a trace for a human reading a diff, never behaviour. Nothing
 *            in the corpus carries one.
 *
 * Measured on Śrī Rudram, markings only, `syl` excluded:
 *
 *     as the object stands    376.7 kB raw   22.1 kB deflated
 *     object without stage/by 289.5 kB       20.5 kB
 *     these tuples            120.6 kB       13.7 kB
 *
 * The raw figure matters as much as the compressed one: it is what a parser
 * walks and what sits in memory when the whole Devī Māhātmyam is open.
 *
 * A TUPLE IS NOT LESS READABLE THAN IT LOOKS. `["hold",12,3]` in a diff says
 * what it is. The alternative that was measured — keys on eleven thousand
 * objects — buys a reader nothing they did not already know.
 */
import {
  STAGE_OF, compareMarks, mark, type Mark, type MarkKind,
} from './mark.js';

/** A marking as it is stored: `[kind, from, span, value?, by?]`. */
export type StoredMark =
  | readonly [MarkKind, number, number]
  | readonly [MarkKind, number, number, string]
  | readonly [MarkKind, number, number, string | null, 'rule'];

/**
 * One marking, out.
 *
 * `null` stands in for an absent value when `by` follows it, because a tuple
 * cannot have a hole. It never appears without something after it.
 */
export function encodeMark(m: Mark): StoredMark {
  const span = m.to - m.from;
  if (m.by === 'rule') return [m.k, m.from, span, m.v ?? null, 'rule'];
  if (m.v !== undefined) return [m.k, m.from, span, m.v];
  return [m.k, m.from, span];
}

/** One marking, back. */
export function decodeMark(t: StoredMark): Mark {
  const [k, from, span, v, by] = t as readonly [
    MarkKind, number, number, (string | null)?, ('rule' | undefined)?,
  ];
  return mark({
    k,
    from,
    to: from + span,
    ...(v === undefined || v === null ? {} : { v }),
    stage: STAGE_OF[k],
    by: by === 'rule' ? 'rule' : 'hand',
  });
}

/**
 * A verse's markings, out — sorted, so the bytes do not depend on edit history.
 *
 * A document's identity is its canonical bytes (docs/INTERCHANGE.md §9), and a
 * list emitted in whatever order the operations happened to be applied would
 * give one document two identities.
 */
export const encodeMarks = (marks: readonly Mark[]): StoredMark[] =>
  [...marks].sort(compareMarks).map(encodeMark);

/** A verse's markings, back. */
export const decodeMarks = (stored: readonly StoredMark[]): Mark[] =>
  stored.map(decodeMark);
