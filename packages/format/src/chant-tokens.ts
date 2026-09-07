/**
 * The token stream — what marked text IS.
 *
 * A syllable, its letters, and the marks that land on a specific letter; plus
 * the things between syllables that are not letters: spaces, pauses, daṇḍas,
 * verse numbers, free text, and the one recursive construct, a slot.
 *
 * The bottom of the format. Nothing here refers to a verse, a section or a
 * document, which is what lets the renderer, the engine and the exporters all
 * agree on a letter without agreeing on anything larger.
 *
 * Split out of `chant.ts`, which is now the barrel: the contract's own
 * docstring and every export are still there, so no import path changed.
 */

/** The four scripts a marked syllable carries. */
export type ChantScriptKey = 'iast' | 'deva' | 'tel' | 'tam';

export type ChantSvara = 'anudatta' | 'svarita' | 'dirgha-svarita';

/** One letter of a syllable, with the marks that land on that specific letter. */
export interface ChantUnit {
  /** The letter in IAST, after anusvāra / visarga sandhi. */
  c: string;
  /** Holding box: thin (short vowel before) or thick (long vowel before). */
  hold?: 'short' | 'long';
  /** Holding-group id — adjacent units sharing hold+hg share ONE box. */
  hg?: number;
  /**
   * A conjunct boundary AFTER this letter — the information IAST loses.
   *
   * Devanagari writes `क्त्य` as one stack, but whether it is composed `kt` +
   * `ya` or `k` + `tya` is a real choice by the author, and IAST spells both
   * `ktya`. Without this field a document round-tripped through its IAST
   * cannot reproduce its own Devanagari: the engine computed the choice, used
   * it to build the Indic forms, and then discarded it.
   *
   * `split` suppresses the ligature (virama + ZWNJ in Unicode terms); `join`
   * forces it (ZWJ). Absent means "however the script normally writes it".
   *
   * Authored in IAST as `_` (split) and `+` (join) — `.` and `-` were already
   * taken by the danda and the word space.
   */
  cj?: 'split' | 'join';
  /** Anusvāra/visarga-derived letter — rendered in the "change" colour. */
  change?: boolean;
  /** Svara (attested Vedic data, or a sanctioned positional convention). */
  svara?: ChantSvara;
  /** Superscript annotation (e.g. upadhmānīya "f" after visarga before p). */
  sup?: string;
  /** Candrabindu on this letter. */
  candra?: boolean;
  /** Svarabhakti — an epenthetic dot BEFORE this letter, outside any box. */
  sbhakti?: boolean;
}

export interface ChantSyllable {
  t: 'syl';
  units: ChantUnit[];
  iast: string;
  deva: string;
  /** Telugu / Tamil forms. Optional: older fragment tables fall back to deva. */
  tel?: string;
  tam?: string;
}

/**
 * Unmarked running text inside a marked stream.
 *
 * Two uses, one token:
 *  - `fill: true` — FREE TEXT the reciter supplied (a name, a gotra, a place).
 *    Never marked, never transliterated: `s` renders in every script, under a
 *    dotted underline that says "your input".
 *  - `fill` absent — plain text that simply carries no marks. `deva`/`tel`/`tam`
 *    give its form per script; absent, `s` is used everywhere.
 */
export interface ChantText {
  t: 'text';
  s: string;
  deva?: string;
  tel?: string;
  tam?: string;
  fill?: boolean;
  /** `fill` only. This is a SLOT MARKER, not a word — "(your name)" standing
   *  where a free-text variable has not been supplied. It shows the reciter
   *  that something belongs there, and it is NEVER emitted as text: not into
   *  the composed recitation, not into a copy-to-clipboard, not into an HTML
   *  snapshot. `tokensToText` drops it, and every other reader of a token
   *  stream must do the same. */
  placeholder?: boolean;
}

/** A variable slot: renders `tokens` unless the host supplies a replacement for
 *  `name` (see `ChantReader`'s `slots` prop). Used for the deity slot in the
 *  pūjā mantras, where one document-level choice re-voices the whole rite. */
export interface ChantSlot {
  t: 'slot';
  name: string;
  tokens: ChantToken[];
}

export type ChantToken =
  | ChantSyllable
  | ChantText
  | ChantSlot
  | { t: 'sp' }
  | { t: 'pause'; len: 'short' | 'long' }
  | { t: 'bar' }
  | { t: 'br' }
  | { t: 'danda'; s: string }
  | { t: 'num'; s: string };

export interface ChantGram {
  lemma: string;
  /**
   * The word class. `sarvanāma` — a pronoun — declines like a noun but is its
   * own category in the grammar, and the corpus carries 22 of them; it was
   * missing here, so an editor form driven off this union silently offered the
   * wrong fields for `saḥ`, `tvam`, `yad`.
   */
  type: 'subanta' | 'sarvanāma' | 'tinanta' | 'avyaya' | 'upasarga' | 'other';
  meaning: string;
  /**
   * `m` / `f` / `n`, and whatever else the author wrote. The corpus carries 18
   * `-` (a word that has no gender to state) and one `adj`, and a form that
   * offered only the three would blank them on the next save — so the type
   * admits a string and the editor keeps an unrecognised value as written.
   */
  gender?: 'm' | 'f' | 'n' | (string & {});
  vibhakti?: number;
  vacana?: 'eka' | 'dvi' | 'bahu';
  stem?: string;
  purusha?: 1 | 2 | 3;
  /**
   * The tense/mood, AS THE AUTHOR WROTE IT. Free text, not an enum: the corpus
   * has 26 distinct values because the qualification carries the analysis —
   * `liṅ (opt.)`, `leṭ (Vedic subj.)`, `laṅ (Vedic injunctive, augmentless)` —
   * and also the kṛt suffixes `ktvā` and `lyap`, which are not lakāras at all.
   * A closed list would throw all of that away.
   */
  lakara?: string;
  root?: string;
  gana?: string;
  note?: string;
  forms?: { deva: string; tel: string; tam: string };
}
export interface ChantWordGram {
  surface: string;
  entries: ChantGram[];
  /**
   * This surface CONTINUES the previous surface's word: one analysis spans
   * both. `tuṣṭuvāṁsas` is broken in two by the gum and shares one entry
   * across the halves; a word written with a space does the same.
   *
   * Derived, never authored, and never written to the wire: `expandJoins`
   * copies the group's entries onto every member on save, which is exactly
   * what the eleven shipped files contain, and `detectJoins` recovers it on
   * read. Storing the flag as well would make one fact true in two places.
   */
  join?: 'prev';
}

/** How a verse breaks into displayed lines. */
export type ChantBreakPolicy = 'source' | 'hemistich' | 'pada' | 'none';
