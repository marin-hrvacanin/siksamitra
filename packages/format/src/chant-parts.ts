/**
 * The non-mantra parts of a rite: directions, illustrations, and references to
 * text authored elsewhere.
 *
 * All three are ITEMS of a step, and their ORDER in the step is the only
 * positioning mechanism — "above the text", "below", "in the middle" are not
 * flags, they are positions.
 *
 * The guarantee worth keeping in view: an instruction has no `tokens`, so
 * there is no function anywhere that can turn one into marked or transliterated
 * text. It would not typecheck.
 */
import type { ChantVerse } from './chant-verse.js';

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

/** WHICH SIDE a figure sits on. `aside` is a margin rail (>=1024 only);
 *  everything degrades to `block` on a phone. What the text does about it is
 *  `ChantFigureWrap`, which is a separate question — Word asks them
 *  separately too, and conflating them is why "Left" used to mean two
 *  different things. */
export type ChantFigureFlow = 'block' | 'start' | 'end' | 'aside';

/**
 * WHAT THE TEXT DOES ABOUT THE PICTURE — Word's wrap, as the two that matter.
 *
 * `top-bottom` is the default: the picture gets a band of its own and the text
 * resumes below it, aligned to whichever side `flow` names. `square` lets the
 * text run BESIDE it, which is Word's "Square".
 *
 * TOP-AND-BOTTOM IS THE DEFAULT FOR A MEASURED REASON, not a cautious one. A
 * pāda is a metrical line, and text narrowed by a picture wraps where the
 * picture ends rather than where the metre does. Measured on Durgā Sūktam at
 * A4 with a medium picture floated left: the column is 605 px, the picture and
 * its gutter take 320, and of the four pādas level with it THREE wrap — one
 * mid-word (`asmānth svastibhira-ti du / rgāṇi viśvā`) and one leaving its
 * closing `‖` alone on a line.
 *
 * But it is a DEFAULT and not a prohibition, because that is not what Word
 * does: Word's wrap is a property of the picture, and if you ask for Square it
 * narrows whatever is beside it, mantra included. So `square` is offered, it
 * really wraps, and the consequence is the person's to choose.
 */
export type ChantFigureWrap = 'top-bottom' | 'square';
/** Width as a fraction of the step column — never free-form pixels. The same
 *  document is drawn in an A4 column, a web measure and a card, so a picture
 *  set at 340 px is a third of one and two thirds of another. */
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
  /**
   * The picture. Either the bytes, as `data:<type>;base64,…`, or a path the
   * HOST resolves (`RenderHost.resolveUrl`) — the platform serves its own from
   * `client/public/`.
   *
   * A picture inserted in the editor is always the bytes, because this program
   * saves one `.json` and a path is a picture the file does not carry. See
   * `figure.ts`; the media types, the size ceiling and the reason are there.
   */
  src: string;
  /** Alternate for the dark theme, when `src` cannot self-theme. */
  srcDark?: string;
  /**
   * What is IN the picture. Required, non-empty, never a repeat of the caption.
   *
   * Not a formality: a mudrā drawing is the only form that instruction takes,
   * so a picture with no alternative text is a step a blind reciter cannot
   * perform. `figureFaults` refuses one.
   */
  alt: string;
  caption?: { en: string };
  flow?: ChantFigureFlow;
  /** Word's wrap. Absent means `top-bottom` — see `ChantFigureWrap`. */
  wrap?: ChantFigureWrap;
  size?: ChantFigureSize;
  /**
   * A width in PER CENT of the column, when a person has dragged a corner.
   *
   * `size` is five presets and stays the ordinary way to set a width: a
   * document whose pictures are all "medium" is a document that stays tidy
   * when the column changes. But a picture that is nearly right at half and
   * wrong at three quarters has no preset, and Word lets you drag the corner,
   * so this does too. Set, it wins over `size`.
   *
   * PER CENT AND NOT PIXELS, for the reason the whole sizing scheme is a
   * fraction: a picture that held its pixel width would stop fitting the
   * moment the page size, the zoom or the column changed. Clamped to 5..100
   * on the way in — a picture at 2% is a picture nobody meant.
   */
  widthPct?: number;
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
