/**
 * RUNNING THE RULES, ON REQUEST.
 *
 * The engine is never invoked by anything else — not by typing, not by opening
 * a document. It runs when a person presses a button, over the selection or
 * over the whole document, per stage, and says whether the markings placed by
 * hand are kept or replaced. That is the whole of
 * `openspec/changes/text-and-marks`' `recompute(range, stages, mode)`, and the
 * owner's words behind it were "why does the engine immediately write the
 * holdings and all that? Who said that?".
 *
 * THERE IS NO ENGINE HERE. `derive` in `@siksamitra/engine` is the marking
 * rules; this file feeds it and merges what it returns. It composes four things
 * that already exist and adds no rule of its own:
 *
 *   `typedText`  undo the substitutions, because the rules take what was TYPED
 *                — `ṁ` before a dental, not the `n` that is shown
 *   `derive`     the rules
 *   `toTextAndMarks`  the result, in the model's shape
 *   `removeMark` / `normalise`  the merge
 *
 * WHERE THIS BELONGS EVENTUALLY. In `@siksamitra/edit`, beside `apply`, so the
 * window's Re-apply rules and the add-in's are one function. `edit` has no
 * text-and-markings command yet; when it grows one this file becomes a call to
 * it, and the six exported names below are the shape it should have.
 */
import type { Mark, Stage, TextAndMarks } from '@siksamitra/format';
import {
  STAGE_OF, assertMarks, normalise, removeMark, shiftForEdit, toTextAndMarks,
} from '@siksamitra/format';
import type { ChantVerse } from '@siksamitra/format';
import type { Profile } from '@siksamitra/engine';
import { derive } from '@siksamitra/engine';

export type ReRunMode = 'keep-hand' | 'replace-all';

/** The stages a person can ask for, in the order they run. */
export const STAGES: readonly Stage[] = ['sandhi', 'change', 'holdings', 'svara', 'aids'];

export interface ReRunRequest {
  stages: readonly Stage[];
  mode: ReRunMode;
  /** The range of the text to re-run over. The whole of it, for a document. */
  from: number;
  to: number;
  profile: Profile;
}

export interface ReRun extends TextAndMarks {
  /** Markings placed by hand that the re-derivation could not carry. */
  lost: Mark[];
  /** What the engine complained about. */
  warnings: string[];
  note: string;
}

/**
 * The letters as they were typed.
 *
 * A `was` marking carries what its range replaced, so undoing them is a
 * replacement and not a guess — that is the whole reason the kind exists. The
 * rules must see `ṁ`; feeding them the `n` that is on the page makes the
 * anusvāra rule fire on a letter that is already its own output.
 */
export function typedText(text: string, marks: readonly Mark[]): string {
  const was = marks.filter((m) => m.k === 'was').sort((a, b) => b.from - a.from);
  let out = text;
  for (const m of was) out = out.slice(0, m.from) + (m.v ?? '') + out.slice(m.to);
  return out;
}

/** A produced marking, minus the ones the model recomputes at draw time. */
function produced(tokens: ChantVerse['tokens'], stages: readonly Stage[]): TextAndMarks {
  const { text, marks } = toTextAndMarks({ id: 'v', tokens } as ChantVerse);
  const want = new Set(stages);
  return {
    text,
    /* `syl` is division, which the renderer derives from the letters; carrying
       it would put 28 705 markings where 12 635 belong. `toTextAndMarks` labels
       everything `hand` because its usual input is a document that arrived
       marked — here the input is a derivation, so it is `rule`. */
    marks: marks
      .filter((m) => m.k !== 'syl' && want.has(STAGE_OF[m.k]))
      .map((m) => ({ ...m, by: 'rule' as const })),
  };
}

/** Cut out of `m` every part a hand marking of the same kind already covers. */
function yieldToHand(m: Mark, hand: readonly Mark[]): Mark[] {
  let pieces: Mark[] = [m];
  for (const h of hand) {
    if (h.k !== m.k) continue;
    pieces = pieces.flatMap((p) => removeMark([p], p.k, h.from, h.to));
  }
  return pieces;
}

export function rerun(tm: TextAndMarks, req: ReRunRequest): ReRun {
  const { from, to } = req;
  const slice = tm.text.slice(from, to);
  const inside = tm.marks
    .filter((m) => (m.from === m.to ? m.from >= from && m.from <= to : m.to > from && m.from < to))
    .map((m) => ({ ...m, from: m.from - from, to: m.to - from }));

  const source = typedText(slice, inside);
  const d = derive({ lines: source.split('\n') }, req.profile, { trace: false });
  const made = produced(d.tokens, req.stages);

  const changed = made.text !== slice;
  const lost: Mark[] = [];
  let kept: Mark[];

  if (changed) {
    /*
     * The rules rewrote the letters, so nothing addressed at the old ones can
     * follow. `shiftForEdit` moves what is outside the range and reports what
     * was inside; a hand marking among them is a decision that has just been
     * spent, and the caller is told rather than left to notice.
     */
    const moved = shiftForEdit(tm.marks, { from, to, inserted: made.text.length });
    kept = moved.marks;
    lost.push(...moved.dropped.filter((m) => m.by === 'hand'));
  } else {
    const drop = new Set(req.stages);
    kept = tm.marks.filter((m) => {
      const touches = m.from === m.to
        ? m.from >= from && m.from <= to
        : m.to > from && m.from < to;
      if (!touches) return true;
      if (!drop.has(STAGE_OF[m.k])) return true;
      return req.mode === 'keep-hand' && m.by === 'hand';
    });
  }

  const hand = kept.filter((m) => m.by === 'hand');
  const shifted = made.marks.map((m) => ({ ...m, from: m.from + from, to: m.to + from }));
  const admitted = req.mode === 'keep-hand'
    ? shifted.flatMap((m) => yieldToHand(m, hand))
    : shifted;

  const text = tm.text.slice(0, from) + made.text + tm.text.slice(to);
  const marks = normalise([...kept, ...admitted]);
  assertMarks(marks, text, 'after a re-run');

  return {
    text,
    marks,
    lost,
    warnings: d.warnings.map((w) => `${w.code}: ${w.message}`),
    note: `${admitted.length} marking(s) from ${req.stages.join(', ')}`
      + `${lost.length === 0 ? '' : `, ${lost.length} hand marking(s) could not be carried`}`
      + `${changed ? ' — the rules rewrote the letters' : ''}`,
  };
}
