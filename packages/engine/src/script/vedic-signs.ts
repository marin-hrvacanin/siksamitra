/**
 * VEDIC SIGNS READ AS THE LETTER THEY STAND FOR.
 *
 * A Taittirīya text in Devanāgarī writes the anusvāra recited as "gum" with
 * its own sign — `ए॒वेदꣳ सर्व॑म्`, U+A8F3, and U+A8F4 after a long vowel —
 * where IAST types `ṁ` and the Taittirīya rules make the gum of it. Read
 * through the letter table the sign was no letter at all, and stayed in the
 * IAST as a Devanāgarī character: `e̱vedaꣳ sarvam`, a word nobody can read and
 * no rule can mark. These are read as the anusvāra they are typed as.
 *
 * READ ONLY. The engine never writes them: a Devanāgarī line it writes is
 * marked by its own rules, which draw the gum as they draw it in IAST.
 */
import type { ScriptKey } from './tables.js';

const READ_AS: Partial<Record<ScriptKey, Readonly<Record<string, string>>>> = {
  deva: { 'ꣳ': 'ं', 'ꣴ': 'ं' },
};

/** The text with each Vedic sign of this script replaced by the letter it stands for. */
export function vedicSignsIn(text: string, script: ScriptKey): string {
  const table = READ_AS[script];
  if (table === undefined) return text;
  let out = text;
  for (const [sign, letter] of Object.entries(table)) out = out.split(sign).join(letter);
  return out;
}
