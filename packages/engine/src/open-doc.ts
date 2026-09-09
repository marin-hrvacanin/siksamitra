/**
 * OPENING A DOCUMENT — the one place a file becomes something the program can
 * draw.
 *
 * A verse on disk is one text and a list of markings. Everything in the
 * program still reads `tokens`: a syllable per akṣara, an object per letter,
 * the script spellings alongside. That expansion is 45% of the file, so it is
 * not written — it is rebuilt here, once, on open.
 *
 * WHY HERE AND NOT IN `@siksamitra/format`. Going from tokens to text and
 * markings needs nothing but the tokens, so the writer does it. Coming back
 * needs to divide the text into letters and syllables and to spell each
 * syllable in Devanāgarī, Telugu and Tamil — all of it this package's, and
 * `format` has no dependencies and must keep none.
 *
 * AND NOT IN `@siksamitra/edit`, where it was written first. The READER needs
 * to open a document too and `@siksamitra/render` cannot depend on an editing
 * session. This uses nothing an editor has, so it belongs at the lowest layer
 * that can hold it.
 *
 * WHAT MAKES IT SAFE. `tools/migrate-audit.mjs` converts all 573 verses of the
 * corpus both ways and compares byte for byte — 573 of 573 — and `check:size`
 * re-reads every file it writes. A verse whose text and markings cannot
 * rebuild its tokens is a bug that fails a gate, not one that reaches a page.
 *
 * A DOCUMENT THAT ALREADY CARRIES TOKENS IS LEFT ALONE. Every document written
 * before this existed has them and no `text`, and rebuilding tokens it already
 * holds would replace what an author shipped with what the engine now thinks —
 * which is precisely the substitution rule zero exists to prevent.
 */
import {
  decodeMarks, normalizeChantDoc, toTokens, withVerses,
  type ChantDoc, type ChantSyllable, type ChantUnit, type ChantVerse,
} from '@siksamitra/format';
import { DIGRAPHS } from './alphabet.js';
import { transliterateSyllable } from './script/index.js';
import type { ScriptUnit } from './script/index.js';

/**
 * The text divided into LETTERS.
 *
 * A letter is not a character: `bh`, `ai` and their kin are two characters and
 * one letter, and the engine's `DIGRAPHS` is the list. Longest match first, so
 * `bha` is `bh` + `a` and never `b` + `h` + `a`.
 *
 * A combining mark is not a letter of its own either — U+0310 over an `m` is
 * one character to a reader, and a marking may not begin between them.
 */
export function splitLetters(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length;) {
    const two = text.slice(i, i + 2);
    let letter: string;
    if ((DIGRAPHS as readonly string[]).includes(two)) { letter = two; i += 2; } else { letter = text[i] as string; i += 1; }
    while (i < text.length && /\p{Mn}|\p{Mc}/u.test(text[i] as string)) {
      letter += text[i]; i += 1;
    }
    out.push(letter);
  }
  return out;
}

/**
 * One syllable's other scripts, from the engine's tables.
 *
 * THE ENGINE, AND NOT THE FILE. Devanāgarī and Telugu are exact — 15,881
 * syllables, 0 disagreements — so for those there is no question. Tamil is a
 * decision, and it was made on this evidence: the shipped Tamil disagrees with
 * the engine on 215 syllables, and it disagrees WITH ITSELF on 15 of them.
 * `saṁ` is written `ஸம்` in one place and `ஸஂ` in another inside one document;
 * `mṛ` appears as both `ம்ரு` and `ம்ரு'`. Where the two variants differ in
 * quality the engine's is the sound one — it never writes `ऽ`, the DEVANĀGARĪ
 * avagraha, into a Tamil field, which the shipped data does ten times.
 *
 * Carrying the file's own spellings was tried first and had to be abandoned:
 * keyed by syllable it cannot represent a document that spells one syllable
 * two ways, and it propagated the defective variant onto the occurrences that
 * had been right.
 *
 * `check:transliteration` prints every remaining difference on every run.
 */
const spell = (
  _iast: string,
  units: readonly ChantUnit[],
): Omit<ChantSyllable, 't' | 'units' | 'iast'> => {
  const u = units as readonly ScriptUnit[];
  return {
    deva: transliterateSyllable(u, 'deva'),
    tel: transliterateSyllable(u, 'tel'),
    tam: transliterateSyllable(u, 'tam'),
  } as Omit<ChantSyllable, 't' | 'units' | 'iast'>;
};

/** One verse's tokens, rebuilt from its text and markings. */
export function hydrateVerse(v: ChantVerse): ChantVerse {
  if (v.text === undefined) return v;
  const tokens = toTokens(
    { text: v.text, marks: decodeMarks(v.marks ?? []) },
    { spell, split: splitLetters },
  );
  return { ...v, tokens };
}

/**
 * A parsed document, ready to draw.
 *
 * `normalizeChantDoc` first — it is what puts `items` and `verses` in step —
 * and then the tokens, through `withVerses` so both copies get them. Writing
 * to `verses` alone is the trap that function exists to close.
 */
export function openChantDoc(doc: ChantDoc): ChantDoc {
  const norm = normalizeChantDoc(doc);
  let touched = false;
  const sections = norm.sections.map((s) => {
    if (!s.verses.some((v) => v.text !== undefined)) return s;
    touched = true;
    return withVerses(s, s.verses.map(hydrateVerse));
  });
  return touched ? { ...norm, sections } : norm;
}
