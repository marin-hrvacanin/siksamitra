/**
 * THE RULES OVER A SELECTION SEE THE WHOLE LINE — and change only the selection.
 *
 * A rule reads the letters around the one it marks: an anusvāra becomes the
 * gum because a sibilant FOLLOWS it, a visarga changes by the letter after
 * it, a holding by the vowel before. `rerunRange` derives exactly the range it
 * is given, so a selection of one letter was re-marked with nothing around
 * it: the owner selected the ṁ of `tryaśītita̍maṁ sū̱ktam`, chose Taittirīya,
 * pressed Auto-mark, and nothing happened — a ṁ followed by nothing stays ṁ.
 *
 * So the whole lines the selection touches are re-marked, for their context,
 * and of what that produced only the part inside the selection is taken:
 * every letter and marking outside it is left exactly as it was. A selection
 * that is already whole lines is re-marked as it always was.
 */
import type { Mark, TextAndMarks } from '@siksamitra/format';
import { assertMarks, markFaults, normalise, shiftForEdit, textEdits } from '@siksamitra/format';
import { rerunRange, type ReRun, type ReRunRequest } from './rerun.js';

const touches = (m: Mark, from: number, to: number): boolean =>
  (m.from === m.to ? m.from >= from && m.from <= to : m.to > from && m.from < to);

const delta = (e: { from: number; to: number; inserted: number }): number => e.inserted - (e.to - e.from);

export function rerun(tm: TextAndMarks, req: ReRunRequest): ReRun {
  let from = Math.max(0, Math.min(req.from, tm.text.length));
  let to = Math.max(from, Math.min(req.to, tm.text.length));
  const lineFrom = from === 0 ? 0 : tm.text.lastIndexOf('\n', from - 1) + 1;
  const end = tm.text.indexOf('\n', to);
  const lineTo = end === -1 ? tm.text.length : end;
  if (lineFrom === from && lineTo === to) return rerunRange(tm, req);

  const whole = rerunRange(tm, { ...req, from: lineFrom, to: lineTo });
  const edits = textEdits(tm.text, whole.text);
  /* A change of the rules that straddles an edge of the selection is part of
     it: half a substitution is not a letter. */
  for (const e of edits) {
    if (e.from < from && e.to > from) from = e.from;
    if (e.from < to && e.to > to) to = e.to;
  }
  const inside = edits.filter((e) => e.from >= from && e.to <= to);
  /* Where a position of the old text is in the rules' text. */
  const inWhole = (p: number): number => edits.filter((e) => e.to <= p).reduce((q, e) => q + delta(e), p);
  /* The result has only the changes inside, so a position of the rules' text
     inside the selection is moved back by the changes before it. */
  const shift = inWhole(from) - from;

  /* The letters: the old text, with only the changes inside the selection made. */
  let text = tm.text;
  let marks: Mark[] = tm.marks.filter((m) => !touches(m, from, to));
  for (const e of [...inside].reverse()) {
    const put = whole.text.slice(inWhole(e.from), inWhole(e.from) + e.inserted);
    text = text.slice(0, e.from) + put + text.slice(e.to);
    marks = shiftForEdit(marks, { from: e.from, to: e.to, inserted: e.inserted }).marks;
  }

  /* The markings inside the selection are the rules' — clipped to it. */
  const wFrom = inWhole(from);
  const wTo = inWhole(to);
  for (const m of whole.marks) {
    if (!touches(m, wFrom, wTo)) continue;
    const a = Math.max(m.from, wFrom);
    const b = m.from === m.to ? m.to : Math.min(m.to, wTo);
    if (m.from !== m.to && b <= a) continue;
    marks.push({ ...m, from: a - shift, to: b - shift });
  }
  const merged = normalise(marks).filter((m) => markFaults([m], text).length === 0);
  assertMarks(merged, text, 'after a re-run of a selection');

  return {
    text,
    marks: merged,
    lost: whole.lost.filter((m) => touches(m, from, to)),
    warnings: whole.warnings,
    note: whole.note,
  };
}
