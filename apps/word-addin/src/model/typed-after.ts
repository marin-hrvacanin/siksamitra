/**
 * WHAT WAS TYPED AFTER A MARK — taken back out of the mark.
 *
 * Word gives a letter typed at the caret the character style of the letter
 * before it, the way bold carries on. So after Short boxed the `m` of `agnim`
 * at the end of a word, the next letter typed went into the box, and after
 * Svarita the next letter came out red and was read back as accent. The
 * add-in used to set the caret's style to Default Paragraph Font to stop it —
 * which is what Ctrl+Space does, and which Office.js CANNOT do: measured inside
 * the add-in's own runtime in real Word (`tools/_cdp.mjs`), setting `style` on
 * a bare caret changes nothing, `styleBuiltIn` refuses, and the letter typed
 * next was boxed every time.
 *
 * So Word types, and the add-in corrects: the line as it was written is
 * remembered, and when that paragraph changes by ONE insertion exactly at the
 * caret it left, the insertion is put in as plain letters. Anything else — a
 * deletion, an edit elsewhere, a new line — is not a continuation of the
 * typing, and is left alone.
 */
import type { TextAndMarks } from '@siksamitra/format';
import { shiftForEdit } from '@siksamitra/format';
import type { WordRun } from '@siksamitra/interop';
import { offsetMap, toModel } from './offsets.js';

/** A line as the add-in wrote it, with the caret it left. */
export interface Written {
  tm: TextAndMarks;
  /** The paragraph's text as Word reports it, right after the write. */
  wordText: string;
  /** The runs written — what Word counts in. */
  runs: readonly WordRun[];
  /** Where the caret was left, in WORD characters. */
  caretWord: number;
}

/**
 * The line with what was typed at the caret made plain, and where the caret
 * goes after it — or `null` when the change is not that.
 */
export function typedPlain(w: Written, nowWordText: string): { tm: TextAndMarks; caret: number } | null {
  const was = w.wordText;
  const c = w.caretWord;
  const n = nowWordText.length - was.length;
  if (n <= 0) return null;
  if (nowWordText.slice(0, c) !== was.slice(0, c) || nowWordText.slice(c + n) !== was.slice(c)) return null;
  const typed = nowWordText.slice(c, c + n);
  /* A new line is a new paragraph in Word; that is not typing on after a mark. */
  if (/[\r\n\v]/.test(typed)) return null;
  const m = toModel(offsetMap([...w.runs]), c);
  const text = w.tm.text.slice(0, m) + typed + w.tm.text.slice(m);
  /* A marking that ENDS at the caret does not grow over what was typed after
     it — bold's rule, and `shiftForEdit`'s. */
  const { marks } = shiftForEdit(w.tm.marks, { from: m, to: m, inserted: typed.length });
  return { tm: { text, marks }, caret: m + typed.length };
}
