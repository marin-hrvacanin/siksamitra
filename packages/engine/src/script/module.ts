/**
 * What a writing system is, to this engine.
 *
 * A script is DATA: a mapping from phoneme to written form, plus the few
 * assembly rules an abugida needs. It is not code, it is not a branch, and it
 * is not a column beside IAST. Adding Kannada means adding one of these and
 * registering it — nothing else in the engine changes, and no other script's
 * data is touched.
 *
 * The rule that keeps it that way: **no function in this package may branch on
 * a script id.** If a script needs different behaviour, that behaviour is a
 * field here. `letterFor` used to read
 *
 *     if (script === 'iast') … if (script === 'itrans') … if (script === 'tam') …
 *
 * and every one of those branches is now a field below — `letters`,
 * `approximations`, `signs`, `virama`.
 */

import type { PhonemeId } from './phonemes.js';

/**
 * A script identifier. An OPEN string, deliberately.
 *
 * A closed union would mean the compiler had to be taught about a writing
 * system before a document could name one, which is backwards: a script is not
 * a property of the format. An unregistered id is a run-time report naming the
 * script, not a compile error and not a crash.
 */
export type ScriptId = string;

export type ScriptKind =
  /** Consonants carry an inherent vowel; other vowels are signs. */
  | 'abugida'
  /** One letter per sound, vowels written in line. */
  | 'alphabetic'
  /** A Latin-alphabet scheme for representing another script. */
  | 'romanisation';

export interface ScriptModule {
  readonly id: ScriptId;
  /** How the script is named to a reader, in their own reading of it. */
  readonly name: string;
  readonly kind: ScriptKind;
  /**
   * Can PLAIN text in this script be read back unambiguously, with no
   * disambiguating marker?
   *
   * False for Tamil, which writes `k`, `kh`, `g` and `gh` all as `க`, and for
   * ITRANS, where `sh` is both one phoneme and `s` + `h`.
   *
   * It does NOT mean the script is lossy. Every registered script round-trips
   * exactly in lossless mode — Tamil through variation selectors, ITRANS
   * through the form boundary — and `check:lossless` measures that over the
   * whole corpus. What this field decides is whether a person can be offered
   * the script as a typing surface, where there is no opportunity to insert a
   * marker they cannot see.
   */
  readonly reversible: boolean;
  /**
   * Have these forms been reviewed by someone who reads the script?
   *
   * An unreviewed script is carried and displayed, and is reported as
   * unverified rather than counted as passing by the gates. Shipping a script
   * nobody has read and calling it correct is how a wrong glyph survives.
   */
  readonly verified: boolean;
  /** The written form of each phoneme; `null` where the script has none. */
  readonly letters: Readonly<Record<PhonemeId, string | null>>;
  /**
   * The nearest available letter for a phoneme this script cannot write.
   *
   * Using one is LOSSY and is reported as an approximation. It is recorded here
   * rather than in shared code so that no script is a special case.
   */
  readonly approximations?: Readonly<Record<PhonemeId, string>>;
  /**
   * Vowel signs (mātrās), for an abugida. `null` for a vowel this script has no
   * sign for — the syllable builder then closes the onset with a virāma and
   * writes the vowel's own letter.
   */
  readonly signs?: Readonly<Record<PhonemeId, string | null>>;
  /** Suppresses a consonant's inherent vowel. Empty where the concept is absent. */
  readonly virama: string;
  /** The praṇava, where the script has a dedicated form. */
  readonly pranava: string | null;
  /** Digits, 0-9, where the script has its own. */
  readonly digits?: readonly string[];
  /**
   * The Unicode ranges this script claims, inclusive, for detecting what a
   * piece of text is written in.
   *
   * Detection used to be a chain of hardcoded block comparisons in
   * `detectScript`, so a new writing system was invisible to it until someone
   * remembered to add a branch. A script that claims no range is a FALLBACK —
   * the romanisations share the Latin range and are told apart by other means,
   * so neither claims it.
   */
  readonly blocks?: readonly (readonly [number, number])[];
}

/** The written form of a phoneme, falling back to an approximation. */
export function formOf(
  script: ScriptModule,
  phoneme: PhonemeId,
): { form: string; approximate: boolean } | null {
  const direct = script.letters[phoneme];
  if (direct !== undefined && direct !== null) return { form: direct, approximate: false };
  const near = script.approximations?.[phoneme];
  if (near !== undefined) return { form: near, approximate: true };
  return null;
}

/** The vowel sign for a phoneme; `null` when this script has none for it. */
export function signOf(script: ScriptModule, phoneme: PhonemeId): string | null {
  return script.signs?.[phoneme] ?? null;
}
