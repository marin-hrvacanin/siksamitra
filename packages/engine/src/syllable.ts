/**
 * Syllabification — the one definition of "a syllable" in this system.
 *
 * A SYLLABLE IS ONE VOWEL NUCLEUS. A consonant cluster is part of one nucleus
 * (`mbhu`, `nda`, `jñi`, `kṣu`, `ñca` each count once); hyphens are
 * orthographic and neither add nor reset the count (`cida-gni` = ci·da·gni, so
 * position 2 is `da`). This is what the metre presets count, what the audio
 * aligner counts, and what `words[]` is aligned to — so there is exactly one
 * implementation and everything else calls it.
 *
 * Ported from `gen_marks.syllabify`.
 */
import { NEVER_ONSET } from './alphabet.js';
import type { Elem } from './lex.js';

/**
 * Split a word's letters into syllables.
 *
 * Onset consonants attach to the FOLLOWING vowel; the last syllable also takes
 * every trailing coda consonant. So `sahasra` is `sa · ha · sra` and `puruṣaḥ`
 * is `pu · ru · ṣaḥ`.
 */
export function syllabify(letters: Elem[]): Elem[][] {
  const vowelAt = letters.map((l, i) => (l.vowel ? i : -1)).filter((i) => i >= 0);
  if (vowelAt.length === 0) {
    // No vowel at all (a lone punctuation letter, or a bare cluster): one
    // "syllable", so nothing is silently dropped.
    return letters.length > 0 ? [letters] : [];
  }
  const out: Elem[][] = [];
  let start = 0;
  vowelAt.forEach((vp, si) => {
    const onset = letters.slice(start, vp);
    const nucleus = letters[vp]!;
    if (si + 1 < vowelAt.length) {
      out.push([...onset, nucleus]);
      start = vp + 1;
    } else {
      // The last syllable carries the coda.
      out.push([...onset, nucleus, ...letters.slice(vp + 1)]);
      start = letters.length;
    }
  });
  // An anusvāra, a visarga or a virāma tick standing at the head of a syllable
  // is a CODA of the one before it: `chaṁyorā` is `chaṁ · yo · rā`, never
  // `cha · ṁyo · rā`. Moved after the split rather than special-cased inside
  // it, so the nucleus count — what the metre presets and the aligner read —
  // is computed by exactly one rule and cannot drift from this one.
  //
  for (let i = 1; i < out.length; i += 1) {
    const syl = out[i]!;
    while (syl.length > 1 && isCoda(syl[0]!)) out[i - 1]!.push(syl.shift()!);
  }
  return out;
}

/**
 * Can this letter only ever close a syllable?
 *
 * Judged on the letter AS WRITTEN IN THE SOURCE, not as recited. By the time
 * the syllabifier runs, sandhi has already turned every anusvāra into
 * something else — `taṅ ku`'s into `ṅ`, `rajāṁsi`'s into an `m` with a
 * candrabindu — and testing the letter it BECAME reads it as an ordinary
 * consonant, an onset, giving `ta · ṅku` and `ra · jā · msi`.
 *
 * That would be defensible Devanāgarī — `ङ्क` is a real conjunct — but it is
 * not what the owner writes. Counted across all eleven shipped documents: a
 * nasal derived from an anusvāra closes its syllable 551 times and opens one
 * twice, and it is set with an explicit virāma when it does (`जाम्·सि`,
 * `तङ्·कु`, `गञ्·चि`). The two exceptions are transcription slips.
 */
function isCoda(l: Elem): boolean {
  // A gum IS an anusvāra — written `m` only because the candrabindu needs a
  // base to sit on. It carries no `wasCh` of its own.
  if (l.candra === true) return true;
  return NEVER_ONSET.has(l.wasCh ?? l.ch);
}

/** How many nuclei a run of letters has — the metre's own count. */
export function nucleusCount(letters: readonly Elem[]): number {
  return letters.reduce((n, l) => n + (l.vowel ? 1 : 0), 0);
}
