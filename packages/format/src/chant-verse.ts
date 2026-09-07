/**
 * A verse, and the regenerability layer that says whether it may be re-derived.
 *
 * The distinction this file exists for: a verse WITH `src` is derived, and a
 * rule change can be rolled forward through it. A verse WITHOUT `src` is
 * transcribed — hand-marked in Word or read off a PDF — and re-deriving one
 * would replace evidence with a guess. That is rule zero, in the data.
 *
 * `ChantOverride` is the other half of it: a mark the author placed by hand,
 * addressed in SOURCE coordinates so it survives re-derivation.
 */
import type { ChantProfileRef } from './profile-ref.js';
import type { ChantBreakPolicy, ChantToken, ChantWordGram } from './chant-tokens.js';
import type { ChantFigure, ChantInstruction } from './chant-parts.js';

/* ==========================================================================
   Format v4 — the regenerability layer
   (specs/chant-editor/01-FORMAT.md §2. Additive: absent ⇒ v2/v3 behaviour,
   so every document already in client/public/chants/ is a valid v4 document.)
   ========================================================================== */

/**
 * Where a verse's letters come from, when they come from somewhere.
 *
 * This is the whole difference between a verse the engine may re-derive and one
 * it may not. A verse WITH `src` is *derived*: feeding `src.lines` back through
 * `derive()` reproduces its tokens, so a rule change can be rolled forward.
 * A verse WITHOUT `src` is *transcribed* — hand-marked in Word or a PDF, its
 * svaras attested rather than computed. Re-deriving one is refused, not
 * attempted; the marks exist nowhere else. That is rule zero, in the data.
 */
export interface ChantVerseSource {
  /** The UNDERLYING IAST, one string per displayed line: un-assimilated `ṁ`,
   *  un-sandhied `ḥ`, `|`/`||` for daṇḍas, `ˎ` kept as a coda. Holdings run
   *  before the substitutions, so the recited letters are the wrong input. */
  lines: string[];
  /** An accented witness, when the svara is a transcription: the same text
   *  carrying U+030D / U+030E / U+0331. */
  accented?: string[];
  /** Declared departures from the base edition, each with its reason. */
  departures?: { from: string; to: string; why: string }[];
}

/** How a verse's svara came to be — stored, never inferred (01 §2.2). */
export type ChantSvaraRegister =
  /** Transcribed from an accented source. */
  | 'attested'
  /** A positional preset; `meter` is then required. */
  | 'conventional'
  /** Holdings + anusvāra + visarga only. */
  | 'prose'
  /** Vedic with no accented source: ships unmarked, and a preset may NEVER be
   *  applied to it. The hard-refusal register. */
  | 'vedic-refuse';

export type ChantMeterKey =
  | 'anustubh' | 'gayatri' | 'tristubh' | 'jagati'
  | 'sardulavikridita' | 'pushpitagra';

/**
 * One mark the author placed by hand, addressed in SOURCE coordinates so it
 * survives re-derivation (01 §2.4).
 *
 * `why: 'owner-hand'` is the rule-zero case: it is never auto-cleared, however
 * confidently a later rule change disagrees with it.
 */
export interface ChantOverride {
  at: { verse: string; line: number; letter: number };
  /** `null` on a field means "suppress the mark the engine would place here". */
  set: Partial<Record<
    'hold' | 'hg' | 'svara' | 'change' | 'sup' | 'candra' | 'sbhakti' | 'dirgha',
    unknown
  >>;
  why: 'owner-hand' | 'source-witness' | 'engine-defect' | 'editorial';
  note?: string;
  /**
   * The letter this override was placed on, in IAST — a WITNESS, not an
   * address.
   *
   * An override is addressed by offset, and an offset survives a rule change
   * but not an edit to the text before it. The editor rebases offsets when the
   * source changes, and arithmetic alone cannot tell a correct rebase from one
   * that moved a box a letter to the left: both produce a valid offset. With
   * the letter recorded, a rebase is CHECKABLE — if the letter at the new
   * offset is not this one, the override is reported as unplaced instead of
   * silently marking the wrong glyph.
   *
   * Optional, because a document written before this field existed is still
   * valid; its overrides simply rebase unverified.
   */
  ch?: string;
  /** Set by an importer: where the mark was read from. */
  provenance?: string;
}

export interface ChantVerse {
  id: string;
  n?: string | null;
  audioId?: string;
  tokens: ChantToken[];
  translation?: { en: string };
  /** Where THIS mantra's words come from, when that is not the whole section's
   *  source: a step may hold three mantras from three different loci. Rendered
   *  under the verse in the same quiet register as `ChantSection.source`, and
   *  it names ONE authentic source — never a cross-recension apparatus. Keep it
   *  separate from what ASSIGNS the mantra to the step, which is the section's
   *  business. */
  source?: string;
  words?: ChantWordGram[];
  lineBreak?: ChantBreakPolicy;
  /** v4 — present ⇒ derived and regenerable; absent ⇒ transcribed and frozen. */
  src?: ChantVerseSource;
  /** v4 — engine parametrization for this verse alone; inherits otherwise. */
  profile?: ChantProfileRef;
  /** v4 — how this verse's svara came to be. */
  svaraRegister?: ChantSvaraRegister;
  /** v4 — required when `svaraRegister` is `conventional`. */
  meter?: ChantMeterKey;
  /** A direction that attaches to THIS mantra of a multi-mantra step. */
  instructions?: ChantInstruction[];
  /** Rare: a figure belonging to one mantra. */
  figures?: ChantFigure[];
}
