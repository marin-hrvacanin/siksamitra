/**
 * A BOX ON AN AKṢARA IS A BOX ON ITS CONSONANT — the one the holding rule puts it on.
 *
 * In IAST a person selects the consonant and presses Short: the box is on
 * `s`. In Devanāgarī, Telugu or Tamil the smallest thing that can be selected
 * is the akṣara — `स` is `s` and `a` — so the same press boxed `sa`, and the
 * line said something its IAST twin did not (found in real Word,
 * `tools/word-ui/dirty-scripts.ts`). A holding is on a consonant. So a box
 * pressed over ONE akṣara of a script line goes on the consonant the holding
 * rule chooses for that cluster (`holdingHostOf`) — the very consonant the
 * add-in's script reader puts a boxed cluster's box on, so pressing and
 * reading agree. More than one akṣara selected is a person's span, kept.
 */
import { DEFAULT_PROFILE_KEY, holdingHostOf, isConsonant, isVowel, parseLetters, resolveProfile, type ScriptKey } from '@siksamitra/engine';
import type { MarkCommand } from '@siksamitra/edit';

const PLAIN = resolveProfile([{ preset: DEFAULT_PROFILE_KEY }]);

/** `[from, to)` narrowed to the host consonant, where it is one akṣara of a script line boxed. */
export function onTheHost(
  text: string, from: number, to: number, script: ScriptKey, command: MarkCommand,
): [number, number] {
  if (script === 'iast' || command.k !== 'hold' || to <= from) return [from, to];
  const letters = parseLetters(text.slice(from, to));
  if (letters.join('') !== text.slice(from, to)) return [from, to];
  if (letters.filter((l) => isVowel(l)).length > 1) return [from, to];
  const consonants = letters.map((l, k) => (isConsonant(l) ? k : -1)).filter((k) => k >= 0);
  if (consonants.length === 0) return [from, to];
  const before = text[from - 1];
  const at = { wordInitial: from === 0 || before === ' ' || before === '\n', afterHyphen: before === '-' };
  const host = consonants[holdingHostOf(consonants.map((k) => letters[k]!), at, PLAIN)]!;
  const start = from + letters.slice(0, host).join('').length;
  return [start, start + letters[host]!.length];
}
