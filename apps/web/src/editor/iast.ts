/**
 * TYPING IAST — the leader key and the character palette, as data.
 *
 * A person marking a Vedic text types `ā`, `ṛ`, `ṁ`, `ṭh`, `ś` and `ḥ` all
 * day, and no keyboard layout has them. v1 answered that twice and the answers
 * are HIS, so both are transcribed here from v1's own source rather than
 * redesigned:
 *
 *   THE LEADER: `editor-quill.js` `setupIASTShortcuts` (L5626). Press F9,
 *   release it, then a letter, and the diacritic form is inserted. A LEADER
 *   and not a modifier — which is the point: the whole IAST range is reachable
 *   with no chord and no OS keyboard layout, on any machine, including one
 *   where AltGr already means something.
 *
 *   THE PALETTE: `dialog-iast.html` — eight groups laid out the way Sanskrit
 *   phonology is taught (vowels, then the five stop series by place of
 *   articulation, then semivowels and sibilants, then the Vedic marks), with
 *   the F9 letter on each key so the shortcut is learned by using the palette.
 *
 * WHERE THE TWO DISAGREED, THE CODE WINS. v1's dialog titled `ṅ` "F9+G" and
 * `ñ` "F9+J", but its own shortcut table maps `G` and `J` BOTH to `ñ` and `N`
 * to `ṅ`. So the dialog told you a chord that produces a different letter, and
 * the chord for `ṅ` was not shown at all. The map below is the running code's;
 * the hints are derived FROM it (`leaderFor`), so the palette cannot say
 * something the keyboard does not do.
 *
 * `G` AND `J` BOTH GIVE `ñ`, and both are kept. It is in his table and a habit
 * is a habit.
 *
 * WHY THIS IS A TABLE AND NOT A SWITCH — rule 15. A key binding is data, in
 * one place, so it can be listed, shown in a tooltip, checked for a clash and
 * one day overridden per person.
 */

/** The key that arms the leader. `KeyboardEvent.key`. */
export const IAST_LEADER_KEY = 'F9';

/**
 * F9 + key → the IAST character. Verbatim from `editor-quill.js` L5641-5647.
 *
 * Case-SENSITIVE, deliberately: `r` is `ṛ` and `R` is `ṝ`, `t` is `ṭ` and `T`
 * is `ṭh`. Nineteen entries for eighteen characters.
 */
export const IAST_LEADER: Readonly<Record<string, string>> = {
  a: 'ā', i: 'ī', u: 'ū', r: 'ṛ', R: 'ṝ',
  l: 'ḷ', L: 'ḹ', m: 'ṁ', h: 'ḥ',
  t: 'ṭ', T: 'ṭh', d: 'ḍ', D: 'ḍh', n: 'ṇ',
  s: 'ś', S: 'ṣ', G: 'ñ', J: 'ñ', N: 'ṅ',
};

/** One key on the palette. */
export interface IastKey {
  /** What is inserted. */
  readonly ch: string;
  /** What is drawn on the key, when the character alone is not legible — a
   *  combining accent needs a letter to sit on. */
  readonly show?: string;
  /** What it is, for the tooltip. */
  readonly name?: string;
}

/** A row of the palette, headed the way the grammar heads it. */
export interface IastGroup {
  readonly group: string;
  readonly keys: readonly IastKey[];
}

/**
 * The palette, from `dialog-iast.html`.
 *
 * THE PLAIN LETTERS ARE HERE TOO — `k`, `kh`, `g`, `gh` — and that is his
 * arrangement, not an oversight. The palette is a TABLE OF THE ALPHABET as a
 * reciter learns it: five stop series of five, in order of place of
 * articulation. Showing only the letters a keyboard lacks would make it a bag
 * of odd characters instead of the varṇamālā, and the aspirates are two
 * keystrokes a person would rather press once.
 */
export const IAST_PALETTE: readonly IastGroup[] = [
  {
    group: 'Vowels & special',
    keys: [
      { ch: 'ā' }, { ch: 'ī' }, { ch: 'ū' }, { ch: 'ṛ' }, { ch: 'ṝ' },
      { ch: 'ḷ' }, { ch: 'ḹ' }, { ch: 'ṁ', name: 'anusvāra' },
      { ch: 'ḥ', name: 'visarga' },
    ],
  },
  {
    group: 'Gutturals',
    keys: [{ ch: 'k' }, { ch: 'kh' }, { ch: 'g' }, { ch: 'gh' }, { ch: 'ṅ' }],
  },
  {
    group: 'Palatals',
    keys: [{ ch: 'c' }, { ch: 'ch' }, { ch: 'j' }, { ch: 'jh' }, { ch: 'ñ' }],
  },
  {
    group: 'Retroflexes',
    keys: [{ ch: 'ṭ' }, { ch: 'ṭh' }, { ch: 'ḍ' }, { ch: 'ḍh' }, { ch: 'ṇ' }],
  },
  {
    group: 'Dentals',
    keys: [{ ch: 't' }, { ch: 'th' }, { ch: 'd' }, { ch: 'dh' }, { ch: 'n' }],
  },
  {
    group: 'Labials',
    keys: [{ ch: 'p' }, { ch: 'ph' }, { ch: 'b' }, { ch: 'bh' }, { ch: 'm' }],
  },
  {
    group: 'Semivowels & sibilants',
    keys: [
      { ch: 'y' }, { ch: 'r' }, { ch: 'l' }, { ch: 'v' },
      { ch: 'ś' }, { ch: 'ṣ' }, { ch: 's' }, { ch: 'h' },
    ],
  },
  {
    /*
     * THE VEDIC MARKS ARE COMBINING CHARACTERS, so each is drawn on a carrier
     * letter — a lone U+0331 on a button is an invisible key. The carrier is
     * `show`; what is inserted is the bare mark, which lands on whatever
     * letter the caret is after.
     */
    group: 'Vedic & punctuation',
    keys: [
      { ch: 'ḻ', name: 'Dravidian ḻ' },
      { ch: 'ṃ', name: 'anusvāra, alternate form' },
      { ch: '।', name: 'daṇḍa' },
      { ch: '॥', name: 'double daṇḍa' },
      { ch: 'ꣳ', name: 'Vedic tiryak' },
      { ch: '̱', show: 'a̱', name: 'anudātta (U+0331)' },
      { ch: '̍', show: 'a̍', name: 'svarita (U+030D)' },
      { ch: '̎', show: 'a̎', name: 'udātta (U+030E)' },
      { ch: '̐', show: 'm̐', name: 'candrabindu (U+0310)' },
      { ch: 'ꣻ', name: 'Vedic anusvāra above (U+A8FB)' },
    ],
  },
];

/**
 * Which F9 letter produces this character, if any.
 *
 * DERIVED, never restated — this is the whole reason v1's palette could tell
 * you a chord that did something else. Where two letters give the same
 * character (`G` and `J` both give `ñ`) the first in the table wins, so the
 * hint is stable rather than dependent on object order.
 */
export function leaderFor(ch: string): string | undefined {
  for (const [key, value] of Object.entries(IAST_LEADER)) {
    if (value === ch) return key;
  }
  return undefined;
}

/**
 * What the leader inserts for this key press, or nothing.
 *
 * A MODIFIER PRESS WHILE ARMED IS NOT THE SECOND KEY. Shift is exactly how the
 * capital half of the table is typed — `F9` then `Shift+T` for `ṭh` — so
 * consuming the leader on the Shift keydown would make every capital entry
 * unreachable. `null` means "still armed, this was not it".
 */
export function leaderStep(key: string): { insert: string } | null | 'miss' {
  if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta') return null;
  const found = IAST_LEADER[key];
  return found === undefined ? 'miss' : { insert: found };
}
