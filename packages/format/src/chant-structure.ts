/**
 * The document, and everything that holds verses: items, groups, sections, the
 * recording, the feature flags.
 *
 * This is where a rite becomes a document. A step is an ordered list of items;
 * a section is a step; a document is sections plus the parametrization every
 * section and verse inherits from — including `overrides`, the author's hand.
 */
import type { ChantProfileRef } from './profile-ref.js';
import type { ChantBreakPolicy } from './chant-tokens.js';
import type { ChantEmbed, ChantFigure, ChantInstruction } from './chant-parts.js';
import type { ChantOverride, ChantVerse } from './chant-verse.js';

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
