/**
 * A TEXT EDIT, WITHOUT THE RULES.
 *
 * Typing used to re-derive the verse, and a derivation IS the marking rules —
 * so one keystroke put thirteen holdings back on a verse somebody had just
 * cleared. The owner's objection was direct: "why does the engine immediately
 * write the holdings and all that? Who said that?"
 *
 * IT COULD NOT BE FIXED WHILE THE CARET EDITED THE SOURCE. A verse used to
 * hold two texts: `src.lines`, the letters as typed (`sindhuṁ`), and the
 * tokens, the letters as shown (`sindhun`). The rules are what turn one into
 * the other, so an edit addressed at the source could not be displayed without
 * running them.
 *
 * The caret now edits the text that is SHOWN, and the owner said what that
 * means: "it should show anusvāra by default. Only when I mark it and re-run
 * the engine does it change and get the change style." So a typed `ṁ` stays a
 * `ṁ` on the page until somebody asks for the rules, and `recompute` is what
 * replaces it with `n` and a `was` marking that says what it was.
 *
 * WHAT THIS DOES. Takes the verse's new text, works out the one contiguous
 * change between it and the old, moves every marking across it with
 * `shiftForEdit`, and rebuilds the syllables from the result. Syllabification
 * and transliteration are not rules — they draw what is there — so the
 * rebuild places no marking of its own.
 */
import {
  encodeMarks, markFaults, shiftForEdit, textEdits, toTextAndMarks,
  type ChantVerse, type Mark,
} from '@siksamitra/format';
import { hydrateVerse } from '@siksamitra/engine';

export interface Retexted {
  verse: ChantVerse;
  /** Markings the edit ran over, which could not follow the letters. */
  dropped: Mark[];
}

/**
 * A verse with new text, its markings carried across.
 *
 * Returns the verse unchanged when the text has not moved, so a command that
 * touches a section does not rebuild every verse in it.
 */
export function retext(verse: ChantVerse, nextText: string): Retexted {
  const { text, marks } = toTextAndMarks(verse);
  if (nextText === text) return { verse, dropped: [] };

  /*
   * `textEdits`, not one replacement. A keystroke IS one, and that is the case
   * this takes; using the shared function anyway means a paste that happens to
   * change two places at once is carried correctly rather than losing every
   * marking between them — which is what a single span does.
   */
  let moving = marks;
  const ran: Mark[] = [];
  for (const e of [...textEdits(text, nextText)].reverse()) {
    const step = shiftForEdit(moving, e);
    moving = step.marks;
    ran.push(...step.dropped);
  }
  const moved = { marks: moving, dropped: ran };

  /*
   * A marking that would now start inside a character is dropped rather than
   * written. `assertMarks` would throw, which in an editor means the keystroke
   * disappears and the document is left as it was — a marking is not worth
   * that. It is reported, like every other one the edit could not carry.
   */
  const faults = markFaults(moved.marks, nextText);
  const legal = faults.length === 0
    ? moved.marks
    : moved.marks.filter((m) => markFaults([m], nextText).length === 0);
  const dropped = [...moved.dropped, ...moved.marks.filter((m) => !legal.includes(m))];

  return {
    verse: hydrateVerse({ ...verse, text: nextText, marks: encodeMarks(legal) }),
    dropped,
  };
}
