/**
 * THE MARKING COMMANDS — what Short, Long and the rest do to a list of markings.
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
import type { Mark, MarkKind, TextAndMarks } from '@siksamitra/format';
import {
  assertMarks, coverage, mark, normalise, removeMark, toggleMark,
} from '@siksamitra/format';

export type MarkCommand =
  | { k: 'hold'; v: 'short' | 'long' }
  | { k: 'svara'; v: 'anudatta' | 'svarita' | 'dirgha-svarita' }
  | { k: 'candra' }
  /** A dot before the range's start. A point marking. */
  | { k: 'sbhakti' }
  /** A pause at the range's start. A point marking. */
  | { k: 'pause'; v: 'short' | 'long' }
  /** The letters the rules replaced; `v` is what was typed. */
  | { k: 'was'; v: string }
  /** Every marking in the range, gone. */
  | { k: 'clear' };

/** The kinds `clear` withdraws. `syl` is division, not an opinion. */
const CLEARABLE: readonly MarkKind[] =
  ['hold', 'svara', 'candra', 'sbhakti', 'sup', 'pause', 'was', 'cj'];

export interface CommandResult {
  marks: Mark[];
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

export function applyCommand(
  tm: TextAndMarks, from: number, to: number, cmd: MarkCommand,
): CommandResult {
  const { text, marks } = tm;
  if (cmd.k === 'clear') {
    let out = [...marks];
    for (const k of CLEARABLE) out = removeMark(out, k, from, to);
    assertMarks(out, text, 'after clear');
    return { marks: out, note: `${marks.length - out.length} marking(s) withdrawn` };
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
  const what = cmd.k === 'hold' ? `${wanted.v ?? ''} holding` : cmd.k;
  return {
    marks: out,
    note: `${what} ${wasAll ? 'removed from' : 'placed over'} ${to - from} character(s)`,
  };
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
    candra: at('candra'),
    anudatta: at('svara', 'anudatta'),
    svarita: at('svara', 'svarita'),
    'dirgha-svarita': at('svara', 'dirgha-svarita'),
  };
}
