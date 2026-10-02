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

/**
 * THE VISARGA, SPELT AS IT IS SAID. Before k/kh and p/ph a Vedic text may
 * write the jihvāmūlīya `ᳵ` and the upadhmānīya `ᳶ` — vignanam's bhū sūktam,
 * `क्रु॒द्धᳶ प॑रो॒वप॑` — where IAST types `ḥ` and the visarga's treatments say
 * how it is said (`visarga.before-p`). Read as the visarga.
 */
const VISARGA_SIGNS: Partial<Record<ScriptKey, RegExp>> = { deva: /[\u1CF5\u1CF6]/gu };

/**
 * A SVARA SET AFTER THE ANUSVĀRA OR THE VISARGA IS ITS VOWEL'S. Devanāgarī
 * writes the sign at the end of the akṣara — `नमः॑`, `श्लोकं॒` — where IAST,
 * and his texts, mark the vowel: `nama̍ḥ`, `śloka̱ṁ`. Moved onto the vowel
 * BEFORE the gum sign is read as the anusvāra, because the gum carries a svara
 * of its own and keeps it — `त्रि॒ꣳ॒शद्`, his `tri̱ṁ̱śad`.
 */
const SVARA_AFTER: Partial<Record<ScriptKey, RegExp>> = { deva: /([\u0902\u0903])([\u0951\u0952\u1CDA]+)/gu };

/**
 * THE Y, V OR L AN ANUSVĀRA NASALISES, SPELT OUT. Before y, v and l the
 * Taittirīya anusvāra is said as that letter nasalised, and a source may write
 * it so, with a candrabindu on the next syllable — vignanam's `दे॒वीं-विँष्णु॑`,
 * `श्लोकं॒-यँज॑मानाय` — where IAST, and his texts, write the anusvāra alone:
 * `de̱vīṁ viṣṇu̍`, `śloka̱ṁ yaja̍mānāya`. Read as a letter it became an
 * anusvāra of its own, and the gum rule drew a gum on `vi` (`viṁ̐ggṣṇu`, the
 * bot's nīlā sūktam, 2026-10-02).
 */
const NASALISED_AFTER: Partial<Record<ScriptKey, RegExp>> = {
  deva: /(\u0902[\u0951\u0952\u1CDA]*[\s-]*[\u092F\u0935\u0932]([\u093E-\u094C\u0951\u0952]*))\u0901/gu,
};

/** The text with each Vedic sign of this script replaced by the letter it stands for. */
export function vedicSignsIn(text: string, script: ScriptKey): string {
  const table = READ_AS[script];
  if (table === undefined) return text;
  let out = text;
  const visarga = VISARGA_SIGNS[script];
  if (visarga !== undefined) out = out.replace(visarga, '\u0903');
  const after = SVARA_AFTER[script];
  if (after !== undefined) out = out.replace(after, '$2$1');
  const nasalised = NASALISED_AFTER[script];
  if (nasalised !== undefined) out = out.replace(nasalised, '$1');
  for (const [sign, letter] of Object.entries(table)) out = out.split(sign).join(letter);
  return out;
}
