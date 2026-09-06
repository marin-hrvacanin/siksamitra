/**
 * The recitation-mark palette — TWO themes, each with exactly one home.
 *
 * Rendering for the app and rendering for Word/PDF interop are different by
 * design. The interop values are the owner's own print originals, read out of
 * his `styles.xml`; they are his documents' identity, not our design, and must
 * never be "corrected" to match the screen. The screen values are ours and live
 * in the `@theme` block of `client/src/index.css`.
 *
 * There is no third palette. Anything that draws a mark reads one of these two.
 *
 * See specs/chant-editor/06-SINGLE-SOURCE.md §2.
 */

/** One mark's colour in both themes. */
export interface MarkColour {
  /** A CSS custom-property reference into the site's @theme. Flips with
   *  light/dark for free, because it is a token, not a value. */
  readonly screen: string;
  /** The owner's own print colour, as a bare 6-digit hex (Word's `w:color`
   *  format — no leading `#`). FROZEN. */
  readonly print: string;
}

/**
 * Every mark that carries a colour.
 *
 * `print` values measured 2026-09-04 from
 * `Veda Union Youth Wing sAdhanA v1.0.1 IAST (1).docx` → `word/styles.xml`.
 */
export const MARK_THEME = {
  /** Pitch accents. Word character style `Svara` (and `Virama`, same colour). */
  svara: { screen: 'var(--color-svara)', print: '943634' },
  /** Holding boxes (saṁyukta). Word `Holding` / `2Holding` border colour. */
  hold: { screen: 'var(--color-hold)', print: '538135' },
  /** Anusvāra/visarga-derived letters and superscript reading aids.
   *  Word `Anusvara` / `VedicAnusvara`. */
  change: { screen: 'var(--color-change)', print: '0070C0' },
  /** Word has ONE `Pause` style; the screen distinguishes the two lengths. */
  pauseShort: { screen: 'var(--color-pause-short)', print: 'C00000' },
  pauseLong: { screen: 'var(--color-pause-long)', print: 'C00000' },
  /** Editorial notes. Word `Comment`. */
  comment: { screen: 'var(--color-ink-mute)', print: '808080' },
  /** The dīrgha overline. Word `Long` — UNRESOLVED, see
   *  specs/chant-editor/00-OVERVIEW.md §5.1. */
  dirgha: { screen: 'var(--color-change)', print: '4472C4' },
} as const satisfies Record<string, MarkColour>;

export type MarkKey = keyof typeof MARK_THEME;

/**
 * Print stroke weights for the holding box, in Word's `w:bdr/@w:sz` units
 * (eighths of a point — `2` = 0.25 pt, `12` = 1.5 pt). Measured from his
 * `Holding` and `2Holding` styles.
 */
export const PRINT_HOLD_BORDER = { short: 2, long: 12 } as const;

/** Word character-style names, so importer and exporter cannot disagree. */
export const WORD_MARK_STYLE = {
  holdShort: 'Holding',
  holdLong: '2Holding',
  svara: 'Svara',
  virama: 'Virama',
  change: 'Anusvara',
  gum: 'VedicAnusvara',
  pause: 'Pause',
  comment: 'Comment',
  dirgha: 'Long',
} as const;

/** Word paragraph-style names. `Prijevod` is Croatian for "translation". */
export const WORD_PARA_STYLE = {
  verseLine: 'Translit',
  translation: 'Prijevod',
  part: 'Heading2',
  section: 'Heading3',
  step: 'Heading4',
  insert: 'Insert',
} as const;
