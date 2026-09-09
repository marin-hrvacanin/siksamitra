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
 * WHY IT LIVES IN THE ENGINE. It was written in the add-in and said it
 * belonged in `@siksamitra/edit`, beside `apply`, so that the window's
 * Re-apply rules and the add-in's would be one function. `edit` is the wrong
 * layer: the add-in has no editing session and would have to take one on to
 * press a button. This is the ONE entry point through which a rule may run —
 * `recompute(range, stages, mode)` in the change — and that is the engine's
 * own business. `edit`'s `recompute` command calls it; so does the task pane.
 */
import type { Mark, Stage, TextAndMarks } from '@siksamitra/format';
import {
  STAGE_OF, assertMarks, markFaults, normalise, removeMark, shiftForEdit, textEdits,
  toTextAndMarks,
} from '@siksamitra/format';
import type { ChantVerse } from '@siksamitra/format';
import type { Profile } from './profile.js';
import { derive } from './pipeline.js';

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
  /**
   * The verse's printed number, when the range is a whole verse.
   *
   * `derive` emits the number as a token, so a run that does not pass it
   * produces text WITHOUT it and one that does not know produces text with a
   * different one — either way `made.text !== slice`, the run decides the
   * rules rewrote the letters, and every hand marking in range is discarded.
   * Durgā Sūktam v-1 lost 75 of them to a single missing `1`.
   */
  verseN?: string | null;
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

/**
 * The markings that STAY when the rules are re-run over a range.
 *
 * Everything outside the range stays. Inside it, a marking of a stage nobody
 * asked for stays, and a marking placed by hand stays in `keep-hand` mode —
 * those two are the whole of the answer, and the mode is the only question.
 *
 * IT USED TO BE APPLIED ON ONE BRANCH ONLY. When the rules rewrote the letters
 * the code kept every old marking and then added the new ones on top, so in
 * `replace-all` two holdings covered the same letter and `assertMarks` threw —
 * a crash, on a button press. Both branches ask the same question now.
 */
function withoutRerunStages(
  marks: readonly Mark[],
  req: ReRunRequest,
  from: number,
  to: number,
): Mark[] {
  const drop = new Set(req.stages);
  return marks.filter((m) => {
    /*
     * A SYLLABLE BOUNDARY IS NEVER DROPPED.
     *
     * `syl` is division, not a rule's opinion, and `produced` deliberately
     * excludes it from what a re-run places — carrying it would put 28 705
     * markings where 12 635 belong. But it is filed under the `holdings`
     * stage, so asking for the holdings DELETED the syllabification and put
     * nothing back: Puruṣa Sūktam went from 973 syllables to 514, one whole
     * line becoming one enormous syllable.
     */
    if (m.k === 'syl') return true;
    const touches = m.from === m.to
      ? m.from >= from && m.from <= to
      : m.to > from && m.from < to;
    if (!touches) return true;
    if (!drop.has(STAGE_OF[m.k])) return true;
    return req.mode === 'keep-hand' && m.by === 'hand';
  });
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
     * THE MINIMAL CHANGE, not the whole range.
     *
     * This used to shift by `{ from, to, inserted: made.text.length }` — the
     * entire re-run range replaced — so every marking inside it was dropped
     * however little the rules had altered. Pressing Re-apply on Durgā Sūktam
     * threw away 75 of the owner's holdings, and the difference between the
     * old letters and the new was two spaces.
     *
     * The rules can change a letter here and a space three words away, so it
     * is not one replacement and cannot be treated as one: from the first
     * difference to the last covers the whole verse. `textEdits` finds each
     * change separately and they are applied right to left, so only markings
     * on letters that ACTUALLY moved are lost — and those are reported.
     */
    let moving = tm.marks;
    const dropped: Mark[] = [];
    for (const e of [...textEdits(slice, made.text)].reverse()) {
      const step = shiftForEdit(moving, {
        from: from + e.from, to: from + e.to, inserted: e.inserted,
      });
      moving = step.marks;
      dropped.push(...step.dropped);
    }
    const moved = { marks: moving, dropped };
    kept = withoutRerunStages(moved.marks, req, from, from + made.text.length);
    lost.push(...moved.dropped.filter((m) => m.by === 'hand'));
  } else {
    kept = withoutRerunStages(tm.marks, req, from, to);
  }

  const hand = kept.filter((m) => m.by === 'hand');
  const shifted = made.marks.map((m) => ({ ...m, from: m.from + from, to: m.to + from }));
  const admitted = req.mode === 'keep-hand'
    ? shifted.flatMap((m) => yieldToHand(m, hand))
    : shifted;

  const text = tm.text.slice(0, from) + made.text + tm.text.slice(to);
  /*
   * A MARKING THAT CANNOT LEGALLY EXIST IS DROPPED, NOT THROWN OVER.
   *
   * `assertMarks` refuses a list whose offsets fall inside a character, and it
   * threw — from a button press, which in the window means the action vanishes
   * and the person is told nothing. The rules can move letters so that an
   * offset which was between two characters is now inside one; that costs the
   * marking on it, and a cost is reported, not raised.
   */
  const merged = normalise([...kept, ...admitted]);
  const marks = merged.filter((m) => markFaults([m], text).length === 0);
  for (const m of merged) {
    if (!marks.includes(m) && m.by === 'hand') lost.push(m);
  }
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
