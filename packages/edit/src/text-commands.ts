/**
 * THE MARKING COMMANDS — what Short, Long and the rest do to a list of markings.
 *
 * ONE MODULE FOR EVERY PROGRAM. The desktop app's buttons and the Word add-in's
 * pane, ribbon and context menu all call `applyCommand`; it moved here out of
 * the add-in so that neither can grow its own idea of what a button does.
 *
 * Every one of them is `toggleMark`, `applyMark` or `removeMark` from
 * `@siksamitra/format`, over the range the selection resolved to. The algebra
 * is not restated here and must not be: "apply to a mixed selection and it all
 * turns on, apply again and it all turns off, apply to a subset and only that
 * subset turns off" is one set of functions in one file, and a second
 * implementation of it in a Word add-in is a second answer to what a holding is.
 *
 * TWO BUTTONS, NOT FOUR. Short and Long, each a toggle. `None` and `Clear`
 * existed in v1 because derivation ran on every keystroke and had to be
 * suppressed; the engine here runs only when asked, so the suppression a person
 * needs is "press Long again".
 */
import type { ChantSvara, Mark, MarkKind, TextAndMarks } from '@siksamitra/format';
import {
  assertMarks, coverage, mark, normalise, removeMark, shiftForEdit, toggleMark,
} from '@siksamitra/format';
import { ANU, CANDRA, PLAN_MARK, isConsonant, isVowel, typedAs, VIS } from '@siksamitra/engine';

export type MarkCommand =
  | { k: 'hold'; v: 'short' | 'long' }
  /** Any svara the format has — the two kampas too (`KAMPA_CHAR`). */
  | { k: 'svara'; v: ChantSvara }
  /** A dot before the range's start. A point marking. */
  | { k: 'sbhakti' }
  /** A pause at the range's start. A point marking. */
  | { k: 'pause'; v: 'short' | 'long' }
  /** The letters the rules replaced; `v` is what was typed — `ṁ` for an
   *  Anusvāra change, `ḥ` for a Visarga change. */
  | { k: 'was'; v: string }
  /**
   * A combining character typed onto the letters in the range.
   *
   * The candrabindu is this, and not a marking. A run of text is drawn as one
   * element with one text node in it, and a mark laid OVER a letter has
   * nowhere to live in that — the renderer parity gate photographed all 89 of
   * the corpus's candrabindus simply absent when it was one. U+0310 belongs in
   * the text, which is where an author types it, and the invariant that a
   * marking may not begin between a letter and its combining mark already
   * protects it.
   */
  | { k: 'combining'; v: string }
  /** Every marking in the range, gone — or only the kinds in `only`: the
   *  holding group's Clear takes the box off and leaves the svaras alone,
   *  exactly as the app's does. */
  | { k: 'clear'; only?: readonly MarkKind[] };

/** The kinds `clear` withdraws. `syl` is division, not an opinion. */
const CLEARABLE: readonly MarkKind[] =
  ['hold', 'svara', 'sbhakti', 'sup', 'pause', 'was', 'cj'];

export interface CommandResult {
  marks: Mark[];
  /**
   * The text, when the command changed it.
   *
   * Only `combining` does. Every other control moves markings over a text that
   * does not move, which is why this is optional rather than always returned —
   * a caller that ignores it cannot silently drop an edit it never makes.
   */
  text?: string;
  /** What happened, for the task pane to say. One line, plain. */
  note: string;
}

/**
 * A removal that undoes a rule's decision leaves a record of the removal.
 *
 * Otherwise a later keep-hand re-run puts the box straight back, and the person
 * who took it off watches it return. `{hold: none, by: hand}` is that record —
 * an explicit "there is no holding here" that a re-run reads and obeys. It is
 * the capability the old `None` button had, without the button.
 */
function suppression(removed: readonly Mark[], from: number, to: number): Mark[] {
  const byRule = removed.filter((m) => m.k === 'hold' && m.by === 'rule');
  if (byRule.length === 0) return [];
  return [mark({ k: 'hold', from, to, v: 'none', by: 'hand' })];
}

/**
 * Put a combining character onto every letter in the range, or take it off.
 *
 * A toggle, like every other control: if each letter already carries it, it
 * comes off. The markings move with the edit, because inserting a character
 * shifts every offset after it.
 */
function combining(
  tm: TextAndMarks, from: number, to: number, ch: string,
): { text: string; marks: Mark[]; added: number; removed: number } {
  let text = tm.text;
  let marks = [...tm.marks];
  let added = 0;
  let removed = 0;
  /* Backwards, so an earlier offset is still valid after a later edit. */
  const letters: number[] = [];
  for (let i = from; i < to && i < text.length; i += 1) {
    if (text[i] !== ch) letters.push(i);
  }
  for (let n = letters.length - 1; n >= 0; n -= 1) {
    const at = letters[n]! + 1;
    const has = text[at] === ch;
    const edit = has
      ? { from: at, to: at + ch.length, inserted: 0 }
      : { from: at, to: at, inserted: ch.length };
    text = has
      ? text.slice(0, at) + text.slice(at + ch.length)
      : text.slice(0, at) + ch + text.slice(at);
    marks = shiftForEdit(marks, edit).marks;
    if (has) removed += 1; else added += 1;
  }
  return { text, marks: normalise(marks), added, removed };
}

export function applyCommand(
  tm: TextAndMarks, from: number, to: number, cmd: MarkCommand,
): CommandResult {
  const { text, marks } = tm;
  if (cmd.k === 'clear') {
    let out = [...marks];
    for (const k of cmd.only ?? CLEARABLE) out = removeMark(out, k, from, to);
    assertMarks(out, text, 'after clear');
    return { marks: out, note: `${marks.length - out.length} marking(s) withdrawn` };
  }

  if (cmd.k === 'combining') {
    const done = combining(tm, from, to, cmd.v);
    assertMarks(done.marks, done.text, 'after a combining character');
    const note = done.added > 0
      ? `placed on ${done.added} letter(s)`
      : `removed from ${done.removed} letter(s)`;
    return { marks: done.marks, text: done.text, note };
  }

  if (cmd.k === 'sbhakti' || cmd.k === 'pause') {
    /* A point marking sits BETWEEN letters, so a range collapses to its start
       and pressing again at the same place removes it. */
    const at = from;
    const has = marks.some((m) => m.k === cmd.k && m.from === at && m.to === at);
    const out = has
      ? removeMark(marks, cmd.k, at, at)
      : normalise([...marks, mark({
        k: cmd.k, from: at, to: at, ...('v' in cmd ? { v: cmd.v } : {}),
      })]);
    assertMarks(out, text, `after ${cmd.k}`);
    return { marks: out, note: has ? `${cmd.k} removed` : `${cmd.k} placed` };
  }

  if (to <= from) return { marks: [...marks], note: 'nothing is selected' };

  const wanted = mark({
    k: cmd.k, from, to, ...('v' in cmd ? { v: cmd.v } : {}), by: 'hand',
  });
  const wasAll = coverage(marks, cmd.k, from, to, wanted.v) === 'all';
  const removed = wasAll
    ? marks.filter((m) => m.k === cmd.k && m.to > from && m.from < to)
    : [];
  const out = normalise([
    ...toggleMark(marks, wanted),
    ...(wasAll ? suppression(removed, from, to) : []),
  ]);
  assertMarks(out, text, `after ${cmd.k}`);
  const what = cmd.k === 'hold' ? `${wanted.v ?? ''} holding`
    : cmd.k === 'was' ? changeName(cmd.v) : cmd.k;
  const odd = cmd.k === 'was' && !wasAll ? unusualChange(text.slice(from, to), cmd.v) : '';
  return {
    marks: out,
    note: `${what} ${wasAll ? 'removed from' : 'placed over'} ${to - from} character(s)${odd}`,
  };
}

/** What a change is called, by what was typed. */
function changeName(typed: string): string {
  return typed === VIS ? 'visarga change' : 'anusvāra change';
}

/** The accents and the virāma tick; the candrabindu is part of the letter. */
const NOT_A_LETTER = /[̀-̏̑-ͯ]/gu;

/**
 * A change placed over letters that no rule of ours makes from what it says
 * was typed. Placed anyway — the person may know better, and "any text" is
 * what was asked for — but said, because it is usually a slip: a whole word
 * selected where one nasal was meant. `typedAs` is the one table.
 */
function unusualChange(selected: string, typed: string): string {
  const letters = selected.normalize('NFC').replace(NOT_A_LETTER, '');
  if (letters === '' || typedAs(letters) === typedAs(typed)) return '';
  return ` — "${letters}" is not a letter a ${typed} becomes`;
}

/**
 * What the buttons should look like for a selection.
 *
 * `all` lights the button; `some` is a mixed selection, which the next press
 * turns fully on. Read from the same `coverage` the toggle uses, so the button
 * cannot say one thing and the press do another.
 */
export function selectionState(
  tm: TextAndMarks, from: number, to: number,
): Record<string, 'all' | 'some' | 'none'> {
  const at = (k: MarkKind, v?: string) => coverage(tm.marks, k, from, to, v);
  return {
    'hold-short': at('hold', 'short'),
    'hold-long': at('hold', 'long'),
    anudatta: at('svara', 'anudatta'),
    svarita: at('svara', 'svarita'),
    'dirgha-svarita': at('svara', 'dirgha-svarita'),
    'change-anusvara': at('was', ANU),
    'change-visarga': at('was', VIS),
  };
}

/** One line's part of a selection that runs over several lines. */
export interface Span {
  tm: TextAndMarks;
  from: number;
  to: number;
}

/** The kinds a press toggles, bold's way, and the value it toggles. */
const toggled = (cmd: MarkCommand): { k: MarkKind; v?: string } | null =>
  cmd.k === 'hold' || cmd.k === 'svara' || cmd.k === 'was' ? { k: cmd.k, v: cmd.v } : null;

/**
 * A press over a selection of SEVERAL lines — bold's rule over the whole of it.
 *
 * Toggling each line on its own would be wrong in exactly the case that
 * matters: select three lines, one already boxed, press Short, and that one
 * would come OFF while the other two went on. Word's rule is decided once, for
 * the selection: if every selected letter already has it, it comes off
 * everywhere; otherwise it goes on everywhere, and a line that already had it
 * is left as it is. A point marking goes where the selection starts.
 */
export function applyAcross(spans: readonly Span[], cmd: MarkCommand): CommandResult[] {
  const unchanged = (s: Span): CommandResult => ({ marks: [...s.tm.marks], note: '' });
  if (cmd.k === 'sbhakti' || cmd.k === 'pause') {
    return spans.map((s, i) => (i === 0 ? applyCommand(s.tm, s.from, s.to, cmd) : unchanged(s)));
  }
  const t = toggled(cmd);
  const full = (s: Span): boolean => t !== null && coverage(s.tm.marks, t.k, s.from, s.to, t.v) === 'all';
  const everywhere = spans.every((s) => s.to <= s.from || full(s));
  return spans.map((s) => (s.to <= s.from || (!everywhere && full(s))
    ? unchanged(s)
    : applyCommand(s.tm, s.from, s.to, cmd)));
}

/**
 * What the buttons look like for a selection of several lines: lit only when
 * every line is, dark only when none is — the same answer `applyAcross` acts
 * on, so a button cannot say one thing and the press do another.
 */
export function selectionAcross(spans: readonly Span[]): Record<string, 'all' | 'some' | 'none'> {
  const each = spans.filter((s) => s.to > s.from || spans.length === 1)
    .map((s) => selectionState(s.tm, s.from, s.to));
  const out: Record<string, 'all' | 'some' | 'none'> = {};
  for (const key of Object.keys(each[0] ?? {})) {
    const got = each.map((e) => e[key]);
    out[key] = got.every((g) => g === 'all') ? 'all' : got.every((g) => g === 'none') ? 'none' : 'some';
  }
  return out;
}

/**
 * The letter just before a caret, with whatever already rides on it — as
 * `[from, to)`, or `null` when the caret follows a space or starts the line.
 *
 * WHAT A BUTTON PRESSED WITH NOTHING SELECTED MARKS. A person types `a`,
 * presses Svarita, and means the `a` they just typed; making them select it
 * first is what made every button feel broken. `to` is the caret, so an
 * accent covers the letter and every combining mark on it (a marking may not
 * end between the two).
 */
export function letterBefore(text: string, at: number): [number, number] | null {
  let start = at - 1;
  while (start > 0 && /\p{M}/u.test(text[start] ?? '')) start -= 1;
  if (start < 0 || text[start] === undefined || /\s/u.test(text[start]!)) return null;
  return [start, at];
}

/** What typing one character did: the text, and where the caret now is. */
export interface Typed extends CommandResult {
  text: string;
  caret: number;
}

const COMBINING = /^\p{M}+$/u;

/**
 * A character from the palette, typed at the caret — or over the selection.
 *
 * NOT STICKY, by construction. Word gives a typed character the formatting of
 * the one before it, so a letter typed after an accent came out accent-red and
 * one typed after a box went into the box. Here the character goes into the
 * TEXT and every marking is carried across the edit by `shiftForEdit`, whose
 * rules decide it: a letter typed at the end of a box is outside it.
 *
 * AN ACCENT IS A MARKING, NOT A CHARACTER: `a` + U+030D is a svarita placed on
 * the `a`, in its own style, exactly as the Svarita button places one — so it
 * is `applyCommand`, on the letter before the caret. So is the candrabindu, as
 * the combining character it is. Any other combining mark (the overline) is
 * text and rides on the letter before it.
 *
 * IN AN ABUGIDA a consonant is written with its `a` — `क` is `ka` — so a vowel
 * typed straight after one TAKES THE PLACE of that `a`, the vowel sign an
 * Indic keyboard gives: `क` then `ā` is `का`, not `कआ`. `abugida` says the
 * line is written in one; an `a` typed there stays an `a` of its own.
 */
export function typeAt(
  tm: TextAndMarks, from: number, to: number, ch: string, opts: { abugida?: boolean } = {},
): Typed {
  const svara = PLAN_MARK.get(ch);
  if (svara !== undefined || ch === CANDRA) {
    const letter = letterBefore(tm.text, from);
    if (letter === null) {
      return { marks: [...tm.marks], text: tm.text, caret: from, note: 'there is no letter before the caret to put it on' };
    }
    const [start] = letter;
    /* An accent covers the letter AND what already rides on it (a marking may
       not end between a letter and its combining mark); the candrabindu is
       typed onto the letter itself. */
    const r = svara !== undefined
      ? applyCommand(tm, start, from, { k: 'svara', v: svara })
      : applyCommand(tm, start, start + 1, { k: 'combining', v: ch });
    const text = r.text ?? tm.text;
    return { ...r, text, caret: from + (text.length - tm.text.length) };
  }
  /* The vowel is ONE character, as the `a` is, so it takes the `a`'s place and
     every marking stays exactly where it was: an accent on `क॑` is on `का॑`. */
  if (opts.abugida === true && from === to && ch !== 'a' && ch.length === 1 && isVowel(ch)
    && tm.text[from - 1] === 'a' && isConsonant(tm.text[from - 2] ?? '')) {
    const text = tm.text.slice(0, from - 1) + ch + tm.text.slice(from);
    assertMarks(tm.marks, text, 'after typing');
    return { marks: [...tm.marks], text, caret: from, note: `${ch} typed` };
  }
  const text = tm.text.slice(0, from) + ch + tm.text.slice(to);
  const { marks } = shiftForEdit(tm.marks, {
    from, to, inserted: ch.length, combining: COMBINING.test(ch),
  });
  assertMarks(marks, text, 'after typing');
  return { marks, text, caret: from + ch.length, note: `${ch} typed` };
}
