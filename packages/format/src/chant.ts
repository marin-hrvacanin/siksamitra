/**
 * Marked text — the ONE contract for every śikṣā-marked Sanskrit text in Veda
 * Union.
 *
 * A "marked document" is a title + sections + verses whose text is a stream of
 * TOKENS: syllables built from letter-level units carrying holdings / svara /
 * anusvāra-visarga change colour, plus spaces, pauses, daṇḍas, verse numbers,
 * free-text fills and variable slots. Every syllable carries its form in all
 * four scripts, so the reader is script-agnostic.
 *
 * Three kinds of source satisfy this contract, and the reader renders all three
 * identically:
 *
 *   1. a **static chant JSON** (`corpus/chants/*.json`, generated offline
 *      by `tools/chant/`) — the whole document;
 *   2. a **slice** of one (`ChantSelection` — sections, verses, or a range),
 *      so a document can embed just the Gaṇeśa stotram, or three of its verses;
 *   3. a **variable module** that composes its sections at render time — the
 *      saṅkalpa (`shared/src/sankalpa.ts`) builds a `ChantDoc` from precomputed
 *      fragment marks + the day's pañcāṅga coordinates.
 *
 * There is NO runtime marking engine anywhere. Marks are emitted offline by
 * `tools/chant/gen_marks.py` and shipped as data (see docs/MARKING-RULES.md).
 */

import type { ChantProfileKey, ChantProfileRef } from './profile-ref.js';

export type { ChantProfileKey, ChantProfileRef };

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

/* ==========================================================================
   Composition — instructions, figures, embeds, groups
   (docs/DOCUMENT-COMPOSITION.md)

   A STEP is an ordered list of ITEMS. An item is a mantra, an instruction, a
   figure, or a reference to text authored elsewhere. Order in the array is the
   ONLY ordering mechanism: "above the text", "below", "in the middle" are not
   flags, they are positions.
   ========================================================================== */

/** The four registers of non-mantra prose a rite contains, and no more.
 *  `do` = perform this · `note` = a fact about the step ·
 *  `option` = a permitted substitution · `caution` = do not do this. */
export type ChantInstructionKind = 'do' | 'note' | 'option' | 'caution';

/**
 * A direction. Prose that tells you what to do — and only that. It does NOT
 * own a figure: an instruction and an illustration are two independent items
 * that are frequently adjacent, which is not the same as being one thing. Their
 * order in the step is what puts them next to each other (see `ChantItem`), and
 * normal flow is what stacks them on a phone.
 *
 * English chrome, never recitable text — and that guarantee is
 * STRUCTURAL, not typographic: an instruction has no `tokens`, hence no `units`
 * for a hold / svara / anusvāra mark to attach to, and no `deva` / `tel` / `tam`
 * for the script switch to select. There is therefore no function in the reader
 * that can turn one into marked or transliterated text — it would not
 * typecheck. (Belt and braces: the validator bans Devanāgarī / Telugu / Tamil
 * codepoints in the text, and the reader renders it in the UI face, `lang="en"`,
 * unscaled by the mantra font-size slider.)
 */
export interface ChantInstruction {
  id?: string;
  /** Default `do`. */
  kind?: ChantInstructionKind;
  /** Prose, per language — the same shape as `ChantVerse.translation`, so the
   *  format has one localisation idiom. */
  text: { en: string };
  /** `step` (default) — shown once for the step.
   *  `each-verse` — also shown against every verse of the step ("take a sip of
   *  water after each mantra"; "offer a flower with each name"). */
  appliesTo?: 'step' | 'each-verse';
}

/** How the step's text moves around a figure. `aside` is a margin rail (≥1024
 *  only); everything degrades to `block` on a phone. */
export type ChantFigureFlow = 'block' | 'start' | 'end' | 'aside';
/** Width as a fraction of the step column — never free-form pixels. */
export type ChantFigureSize = 'thumb' | 'small' | 'medium' | 'large' | 'full';

/**
 * A figure of the rite. Four orthogonal axes — flow, size, caption position and
 * the box (crop + frame + rounded) — chosen so no value of one constrains
 * another. POSITION is deliberately not an axis: it is the item's index in the
 * step (see `ChantItem`).
 *
 * `frame` and `rounded` are the body `Image` block's own vocabulary, so the same
 * drawing looks identical in a document body and in the reader.
 */
export interface ChantFigure {
  id: string;
  /** Under `client/public/`. SVG line art on `currentColor` is preferred: it
   *  self-themes and needs no `srcDark`. */
  src: string;
  /** Alternate for the dark theme, when `src` cannot self-theme. */
  srcDark?: string;
  /** Required, non-empty, never a repeat of the caption. */
  alt: string;
  caption?: { en: string };
  flow?: ChantFigureFlow;
  size?: ChantFigureSize;
  captionAt?: 'below' | 'above' | 'beside' | 'none';
  /** Reserves the aspect box BEFORE the image loads, so a figure landing
   *  mid-step never pushes the mantra being read down the screen. `auto` is
   *  legal only when `width`/`height` are known. */
  crop?: 'auto' | 'square' | 'portrait' | 'wide';
  frame?: 'none' | 'thin' | 'violet';
  rounded?: boolean;
  /** Intrinsic pixel size, when known (the generator reads it off the file). */
  width?: number;
  height?: number;
}

/** What an embed points at. Discriminated, not a magic-prefixed string: a
 *  `module:` prefix inside a path-shaped field invites path-joining bugs and
 *  blocks per-flavour typing of `params`. */
export type ChantEmbedSrc =
  | { doc: string }
  | { module: string; params?: Record<string, unknown> };

/** How an embed degrades. The labelled placeholder + link is not one of these —
 *  it is the FLOOR underneath all of them, so there is no configuration in
 *  which the reader renders nothing. */
export type ChantEmbedFallback =
  | { kind: 'link' }
  | { kind: 'inline'; verses: ChantVerse[]; note?: ChantInstruction }
  | { kind: 'instruction'; instruction: ChantInstruction }
  /** Legal ONLY inside an optional group member. */
  | { kind: 'omit' };

export interface ChantEmbed {
  src: ChantEmbedSrc;
  /** Which part. See `parseChantSelect`. Absent = the whole thing. */
  select?: string;
  /** Shown on the embed header AND on the placeholder when it fails, so a
   *  failure still tells the performer what is missing. Required. */
  title: { en: string };
  fallback?: ChantEmbedFallback;
  instructions?: ChantInstruction[];
}

/** The six distinct causes of an unavailable embed. They are NOT one failure:
 *  `gated` in particular is a correct state of the system, never an error. */
export type ChantEmbedProblem =
  | 'missing'   // A · file / path does not resolve
  | 'anchor'    // B · `select` does not resolve in the target
  | 'draft'     // C · target not published
  | 'gated'     // D · target restricted for THIS reader — a feature, not a fault
  | 'network'   // E · transport failure
  | 'version';  // F · target needs a newer reader

export type ChantItem =
  | ({ t: 'verse' } & ChantVerse)
  | { t: 'instruction'; instruction: ChantInstruction }
  /** `figure` inline, or `ref` into `ChantDoc.figures` (so a drawing reused at
   *  five steps ships once). */
  | { t: 'figure'; figure?: ChantFigure; ref?: string }
  | { t: 'embed'; embed: ChantEmbed };

/**
 * A block of steps the reader may include, omit, or choose between.
 *
 * FLAT sections + a group table, not a tree: the reader flattens sections to
 * verses, keys audio per section/verse and deep-links verses by id, so a flat
 * array keeps every one of those code paths and makes inclusion a single filter
 * in one place.
 */
export interface ChantGroup {
  id: string;
  label: { en: string };
  source?: string;
  kind: 'optional' | 'choice' | 'expansion';
  /** Section ids, in order, contiguous in `ChantDoc.sections`. */
  members: string[];
  /** `expansion` only — the host step it attaches to. */
  at?: string;
  /** `expansion` only. */
  mode?: 'replace' | 'before' | 'after';
  /** `optional`: included by default (default false).
   *  `choice`: the member id selected by default (required). */
  default?: boolean | string;
  /** Why you would include it, in the reader's own instruction register. */
  note?: ChantInstruction;
  /** Show this group only when the reader's chosen deity is one of these.
   *  Vibhūti is Śaiva and smārta and explicitly not Vaiṣṇava — the Vaiṣṇava
   *  counterpart of the tripuṇḍra is the ūrdhvapuṇḍra — so it is gated rather
   *  than offered to everyone. A gated-out group is hidden entirely, including
   *  its "include" row: it is not an option this reader has declined, it is not
   *  an option for them. */
  onlyDeity?: string[];
  /** DECIDED FOR the reader, not offered to them: no toggle in the settings and
   *  no "include" row — the group is in exactly when `onlyDeity` matches. For
   *  blocks whose inclusion follows from a choice already made, so that asking
   *  again would be asking the same question twice. The kṣamā prārthanā is the
   *  case: four forms of one prayer, one per deity family, settled the moment
   *  the deity is chosen. A `fixed` group without `onlyDeity` is always in and
   *  means nothing — the flag exists to make a gate silent, not to hide a
   *  choice the reader should have. */
  fixed?: boolean;
}

export interface ChantSectionAudio { file: string; duration?: string | null; label?: string | null }

/**
 * A section the reader COMPOSES in place instead of reading it from the
 * document. The document declares WHERE the section stands and what it is; the
 * reader supplies the verses at render time from live inputs (the day's
 * pañcāṅga, the reader's chosen deity).
 *
 * Only one kind so far: `sankalpa`, the variable module in `sankalpa.ts`. It is
 * NOT a second renderer and not a second document — the composed verses are
 * spliced into this section and then render exactly like every other section of
 * the host document (same head, same marks, same type). Its options — level and
 * deity — live in the reader's own settings, never as chrome on the section.
 */
export interface ChantSectionModule {
  kind: 'sankalpa';
}

export interface ChantSection {
  id: string;
  /** Step number AS PRINTED: "7", "3a", "11a". Sub-numbers of an expansion are
   *  DERIVED by the loader (never hand-typed — see `ChantGroup`). */
  n?: string;
  /** The step's name, alone: "Karpūra-nīrājanam". No number, no direction. */
  title?: string;
  /** v2 compatibility. `normalizeChantDoc` fills `title` from it when absent;
   *  new documents set `n` + `title` + a `do` instruction instead. */
  label?: string;
  /** Which run of numbering this step belongs to — "Preparatory steps", "The
   *  sixteen upacāras", "Closing". Groups the contents nav, and explains why
   *  the numbering restarts at 1 for the upacāras. */
  part?: string;
  source?: string | null;
  audio?: ChantSectionAudio;
  /** Composed at render time (see `ChantSectionModule`); `verses`/`items` are
   *  then a placeholder the reader replaces. */
  module?: ChantSectionModule;
  /** THE CANONICAL CONTENT, ordered. `normalizeChantDoc` guarantees it. */
  items?: ChantItem[];
  /** Every verse of the step, in order — kept in step with `items` by
   *  `normalizeChantDoc` and `sliceChantDoc`, because audio, deep links, the
   *  practice cursor and the contents nav are all keyed on verses. A step with
   *  no mantra (prāṇāyāma, "light a lamp") has an EMPTY array and lives on its
   *  instructions alone. */
  verses: ChantVerse[];
  /** v4 — engine parametrization for this step; inherits from the document. */
  profile?: ChantProfileRef;
  /** Set by the loader from `ChantDoc.groups`; not authored on the section. */
  groupId?: string;
}

export interface ChantRecording {
  byVerse: Record<string, {
    file: string;
    duration?: string | number | null;
    label?: string | null;
    lines?: { start: number; end: number }[];
  }>;
}

/** What a marked document can offer. A composed module (the saṅkalpa) has no
 *  audio and no per-word grammar; declaring that here stops the reader from
 *  offering controls that would do nothing. Absent = capable. */
export interface ChantFeatures {
  audio?: boolean;
  grammar?: boolean;
  translation?: boolean;
}

export interface ChantDoc {
  title: string;
  subtitle?: string;
  source?: string | null;
  titleForms: Record<string, string>;
  sections: ChantSection[];
  recording?: ChantRecording;
  lineBreak?: ChantBreakPolicy;
  audioBase?: string;
  features?: ChantFeatures;
  /** Format version. 2 = verses only; 3 = items / instructions / figures /
   *  groups. A higher version than the reader knows is an explicit "update
   *  needed" card, never a blank document. */
  version?: number;
  /** Rite-wide directions, rendered once above the first step — for what is not
   *  about any one step ("wherever `deva` appears, put your deity"). */
  instructions?: ChantInstruction[];
  /** Shared figure library, addressed by `{ t: 'figure', ref }`, so a drawing
   *  reused at five steps ships once. */
  figures?: ChantFigure[];
  /** Optional / alternative / expansion step groups. */
  groups?: ChantGroup[];
  /** URL of this document's variant manifest (`ChantVariantIndex`) — the
   *  per-deity verse variants. Absent = the document has no variables. */
  variants?: string;
  /** v4 — the document's engine parametrization; the base every section and
   *  verse inherits from. Absent ⇒ the engine default. */
  profile?: ChantProfileRef;
  /** v4 — marks the author placed by hand, in source coordinates, so they
   *  survive re-derivation. Rule zero, as data. */
  overrides?: ChantOverride[];
}

/* ==========================================================================
   Variable VERSES — the deity, and anything else that re-voices a rite
   ========================================================================== */

/**
 * Why a whole verse and not the substituted word.
 *
 * A holding and an anusvāra/visarga change-mark are decided by the NEIGHBOURING
 * letters, and a saṁyukta run is not broken by a word space — so substituting
 * the deity changes the marks of the FIXED words around it:
 *
 *     devaṁ dhyāyāmi        → devan dhyāyāmi         (ṁ assimilates to n)
 *     mahālakṣmīṁ dhyāyāmi  → mahālakṣmīn dhyāyāmi   (and the holding on dh
 *                                                     becomes LONG, after ī)
 *
 * Splicing a pre-marked fragment into a pre-marked line therefore cannot be
 * right: the join is never derived. The generator instead substitutes into the
 * plain IAST and marks the whole line through the ordinary pipeline, offline.
 *
 * The unit is the verse rather than a one-word window because `words[]` is
 * indexed per verse under the invariant word-count == syl-run-count: splicing a
 * token range at runtime would force that alignment to be recomputed in the
 * browser, which is exactly what "no runtime marking engine" forbids. A verse is
 * also provably self-contained — a daṇḍa ends a cluster run, so no dependency
 * can cross a verse boundary.
 */
export interface ChantVariantOption {
  key: string;
  label: string;
  iast?: string;
  labelForms?: Record<string, string>;
  /** URL of the variant file. */
  file: string;
  /** Every verse this option replaces. A variant that covers only some of them
   *  is invalid WHOLESALE — a half-substituted rite (āvāhana naming Lakṣmī,
   *  udvāsana releasing "deva") is worse than none. */
  verses: string[];
}

export interface ChantVariantIndex {
  format: 'vedaunion.chant.variants';
  version: number;
  doc: string;
  slot: string;
  /** The key that means "the document's own base wording". */
  default: string;
  options: ChantVariantOption[];
}

export interface ChantVariantVerse {
  /** Hash of the BASE verse's token stream this was generated against. A
   *  mismatch means the base was edited without regenerating: render the base
   *  rather than a reading the two files disagree about. */
  baseHash: string;
  tokens: ChantToken[];
  words?: ChantWordGram[];
  translation?: { en: string };
}

export interface ChantVariantFile {
  format: 'vedaunion.chant.variant';
  version: number;
  doc: string;
  slot: string;
  value: string;
  verses: Record<string, ChantVariantVerse>;
}

/** Canonical JSON — keys sorted, no spaces. Must match the generator's
 *  `json.dumps(..., sort_keys=True, separators=(",", ":"), ensure_ascii=False)`
 *  byte for byte, or `baseHash` can never validate. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
}

/** The highest format version this build renders. */
export const CHANT_FORMAT_VERSION = 3;

/* ==========================================================================
   Normalising a loaded document
   ========================================================================== */

/** Does this step stand on instructions / figures / embeds alone? */
export function isTextlessStep(s: ChantSection): boolean {
  return !s.verses.length && !s.module && !!s.items?.length;
}

/**
 * Bring a loaded document to the v3 in-memory shape, so every consumer sees ONE
 * model: `items` always present and always in step with `verses`, `title`
 * always set. Pure, idempotent, and additive — a v2 document (the other three
 * chants) comes through unchanged in meaning.
 */
export function normalizeChantDoc(doc: ChantDoc): ChantDoc {
  let touched = false;
  const sections = doc.sections.map((s) => {
    const verses = s.verses ?? [];
    const items: ChantItem[] = s.items
      ? s.items
      : verses.map((v) => ({ t: 'verse' as const, ...v }));
    const title = s.title ?? s.label ?? '';
    // `items` is authoritative when authored; keep `verses` derived from it so
    // audio lookup, deep links and the practice cursor need no new code path.
    const fromItems = s.items
      ? s.items.filter((it): it is { t: 'verse' } & ChantVerse => it.t === 'verse')
          .map(({ t: _t, ...v }) => v as ChantVerse)
      : verses;
    if (s.items || !s.title || s.verses !== fromItems) touched = true;
    return { ...s, title, items, verses: fromItems };
  });
  if (!touched) return doc;
  return { ...doc, sections };
}

/* ==========================================================================
   `select` grammar for an embed (docs/DOCUMENT-COMPOSITION.md §4.3)

     #<sectionId>                                    one section
     #<sectionId>/<verseId>                          one verse
     #<sec>/<verse>..#<sec>/<verse>                  inclusive verse range
     #<sec>..#<sec>                                  inclusive section range
     (absent)                                        the whole document

   Ids are the TARGET's own — the same ids the deep-link fragment uses. No
   indices: an index breaks the moment the target gains a verse, and this format
   is regenerated often.
   ========================================================================== */

/** Parse a `select` string into a `ChantSelection`. Returns null when the string
 *  is malformed (the caller reports it as an authoring error, cause `anchor`). */
export function parseChantSelect(select: string | undefined | null): ChantSelection | null {
  if (!select || !select.trim()) return {};
  const parts = select.trim().split('..');
  if (parts.length > 2) return null;
  const one = (raw: string): { section: string; verse?: string } | null => {
    const m = /^#([^/\s]+)(?:\/([^/\s]+))?$/.exec(raw.trim());
    if (!m) return null;
    return { section: m[1]!, verse: m[2] };
  };
  const a = one(parts[0]!);
  if (!a) return null;
  if (parts.length === 1) {
    return a.verse ? { sections: [a.section], verses: [a.verse] } : { sections: [a.section] };
  }
  const b = one(parts[1]!);
  if (!b) return null;
  if (!!a.verse !== !!b.verse) return null;
  if (a.verse && b.verse) return { from: a.verse, to: b.verse };
  return { sectionFrom: a.section, sectionTo: b.section };
}

/* ==========================================================================
   Selecting part of a marked document
   ========================================================================== */

/**
 * Which part of a marked document to render. All fields are optional and are
 * applied in this order, so they compose:
 *
 *   sections → exclude → verses → from/to
 *
 * `from`/`to` are VERSE ids and delimit an inclusive range over the document's
 * verses in reading order; either end may be omitted. Empty selection (no
 * fields, or nothing matched) renders the whole document — a slice that
 * silently renders nothing would be worse than one that renders everything.
 */
export interface ChantSelection {
  /** Keep only these section ids (in the document's own order). */
  sections?: string[];
  /** Drop these section ids. */
  exclude?: string[];
  /** Keep only these verse ids. */
  verses?: string[];
  /** Inclusive verse-id range over the flattened verse order. */
  from?: string;
  to?: string;
  /** Inclusive SECTION-id range, in document order. */
  sectionFrom?: string;
  sectionTo?: string;
}

export function isEmptySelection(sel?: ChantSelection | null): boolean {
  if (!sel) return true;
  return (
    !sel.sections?.length && !sel.exclude?.length && !sel.verses?.length &&
    !sel.from && !sel.to && !sel.sectionFrom && !sel.sectionTo
  );
}

/** Apply a selection. Pure; returns the same object when nothing is selected. */
export function sliceChantDoc(doc: ChantDoc, sel?: ChantSelection | null): ChantDoc {
  if (isEmptySelection(sel) || !sel) return doc;

  // A step's `items` array is authoritative, so every verse filter has to cut
  // BOTH lists or the two drift apart (and a dropped verse would still render
  // out of `items`). One helper, used by every branch below.
  const keepVerses = (s: ChantSection, keep: Set<string>): ChantSection => ({
    ...s,
    verses: s.verses.filter((v) => keep.has(v.id)),
    ...(s.items
      ? { items: s.items.filter((it) => it.t !== 'verse' || keep.has(it.id)) }
      : {}),
  });

  let sections = doc.sections;
  if (sel.sections?.length) {
    const keep = new Set(sel.sections);
    sections = sections.filter((s) => keep.has(s.id));
  }
  if (sel.exclude?.length) {
    const drop = new Set(sel.exclude);
    sections = sections.filter((s) => !drop.has(s.id));
  }
  if (sel.sectionFrom || sel.sectionTo) {
    const order = sections.map((s) => s.id);
    const start = sel.sectionFrom ? order.indexOf(sel.sectionFrom) : 0;
    const end = sel.sectionTo ? order.indexOf(sel.sectionTo) : order.length - 1;
    if (start >= 0 && end >= 0 && end >= start) sections = sections.slice(start, end + 1);
  }
  if (sel.verses?.length) {
    const keep = new Set(sel.verses);
    sections = sections.map((s) => keepVerses(s, keep));
  }
  if (sel.from || sel.to) {
    const order = sections.flatMap((s) => s.verses.map((v) => v.id));
    const start = sel.from ? order.indexOf(sel.from) : 0;
    const end = sel.to ? order.indexOf(sel.to) : order.length - 1;
    if (start >= 0 && end >= 0 && end >= start) {
      const keep = new Set(order.slice(start, end + 1));
      sections = sections.map((s) => keepVerses(s, keep));
    }
  }
  // Keep a step that has text left, a composed module, or that never had any
  // mantra to begin with (prāṇāyāma stands on its instructions alone).
  sections = sections.filter((s) => s.verses.length > 0 || !!s.module || isTextlessStep(s));
  // A selection that matched nothing is a bad id, not an instruction to render
  // an empty page: fall back to the whole document rather than a blank card.
  if (!sections.length) return doc;
  return { ...doc, sections };
}

/** Substitute variable slots. Pure. `slots` maps a slot name to its tokens. */
export function fillChantSlots(
  tokens: ChantToken[],
  slots?: Record<string, ChantToken[] | undefined> | null,
): ChantToken[] {
  if (!tokens.some((t) => t.t === 'slot')) return tokens;
  const out: ChantToken[] = [];
  for (const tk of tokens) {
    if (tk.t !== 'slot') { out.push(tk); continue; }
    const replacement = slots?.[tk.name];
    out.push(...(replacement && replacement.length ? replacement : tk.tokens));
  }
  return out;
}
