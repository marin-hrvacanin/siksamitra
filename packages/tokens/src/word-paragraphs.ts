/**
 * HIS PARAGRAPH STYLES, MEASURED — the role table of his `.docx`, out of
 * `word.ts` at the module gate, which re-exports all of it.
 */
import { fromHalfPoints, fromTwips } from './word-units.js';

/** One paragraph style of the VU document, in points. */
export interface WordParagraphMetric {
  /** The `w:styleId` this came from. */
  style: string;
  /** What it is, in this program's language. */
  role: 'title' | 'verse-line' | 'part' | 'section' | 'step' | 'translation'
  | 'body' | 'comment' | 'head' | 'small';
  /** Type size in POINTS (`w:sz` ÷ 2). */
  size: number;
  /** Exact leading in POINTS, or `null` for Word's automatic spacing. */
  leading: number | null;
  /**
   * Automatic spacing's MULTIPLE, when `leading` is null: `w:line` ÷ 240. His
   * `Normal`, and the headings based on it, inherit `docDefaults`' 259 — a
   * line 7.9 % taller than single, which the page used to draw as single;
   * `Prijevod`, `Header` and `Insert` say 240.
   */
  multiple?: number;
  /** Space after the paragraph, in points (`w:spacing w:after` ÷ 20). */
  after: number;
  /** Left indent in points (`w:ind w:left` ÷ 20). */
  indent: number;
  /**
   * First-line OUTDENT in points (`w:ind w:hanging` ÷ 20).
   *
   * `Translit` carries `w:left="284" w:hanging="284"`: the paragraph sits at
   * 14.2 pt and its first line comes back out to the margin. That is the shape
   * of a VU verse on the page — the opening pāda flush, every continuation
   * stepped in — and rendering it flush was the most visible way our page was
   * not his page.
   */
  hanging: number;
  /**
   * Right indent in points (`w:ind w:right` ÷ 20). NEGATIVE is legal and
   * intended: `Translit` has `w:right="-276"`, letting a long pāda run 13.8 pt
   * into the right margin rather than wrap.
   */
  right: number;
  /**
   * Which vendored face stands in for the file's.
   *
   * THE HEADINGS AND THE BODY ARE ARIAL — `'sans'` — in his documents. They
   * were recorded as `'ui'` (Calibri) off `vu-word-template.docx`, whose
   * theme fonts are Calibri; but in his own files `Normal` sets Arial and the
   * heading styles set no ascii face, so they inherit it. Measured in the PDF
   * Word itself renders of three of them (the Lalitā Sahasranāma v9.3.1, the
   * Śivopāsana mantrāḥ v2, the Kanakadhārā v1.3): every heading, every
   * header and every Normal line is `ArialMT`. Only `Title` is Calibri Light.
   */
  face: 'sans' | 'serif' | 'ui';
  italic?: boolean;
  /** None of his heading styles is bold — the size and the grey carry them. */
  bold?: boolean;
  /** `w:color`, as Word writes it. */
  color?: string;
}

/**
 * The paragraph styles, in document order of importance.
 *
 * `Translit` is the one that matters most: it is the mantra line, and its
 * 24 pt exact leading over 16 pt Arial is what gives a VU page its rhythm —
 * marks sit outside the line box, and Word is reserving room for them.
 */
/**
 * Word's "single" line spacing, as a ratio.
 *
 * A style with no `w:line` inherits `docDefaults`, which in his file is
 * `w:line="259" w:lineRule="auto"` — 259/240 of single spacing. Recorded so
 * the themes have one number to use for `leading: null` instead of each
 * guessing one.
 */
export const WORD_AUTO_LEADING = 259 / 240;



export const WORD_PARAGRAPHS: readonly WordParagraphMetric[] = [
  {
    style: 'Translit',
    role: 'verse-line',
    size: fromHalfPoints(32),
    leading: fromTwips(480),
    after: 0,
    indent: fromTwips(284),
    hanging: fromTwips(284),
    /* −284 in the Lalitā v9.3.1 and the Śivopāsana v2 (−282 in the
       Kanakadhārā v1.3); the template's −276 is older than both. */
    right: fromTwips(-284),
    face: 'sans',
  },
  {
    style: 'Heading1',
    role: 'title',
    size: fromHalfPoints(48),
    leading: null,
    multiple: WORD_AUTO_LEADING,
    after: fromTwips(120),
    indent: fromTwips(397),
    hanging: 0,
    right: 0,
    face: 'sans',
  },
  {
    style: 'Heading2',
    role: 'part',
    size: fromHalfPoints(44),
    leading: null,
    multiple: WORD_AUTO_LEADING,
    after: fromTwips(120),
    indent: 0,
    hanging: 0,
    right: 0,
    face: 'sans',
  },
  {
    style: 'Heading3',
    role: 'section',
    size: fromHalfPoints(36),
    leading: null,
    multiple: WORD_AUTO_LEADING,
    after: fromTwips(120),
    indent: fromTwips(397),
    hanging: 0,
    right: 0,
    face: 'sans',
    color: '7F7F7F',
  },
  {
    style: 'Heading4',
    role: 'step',
    size: fromHalfPoints(32),
    leading: null,
    multiple: WORD_AUTO_LEADING,
    after: 0,
    indent: fromTwips(567),
    hanging: 0,
    right: 0,
    face: 'sans',
    color: '7F7F7F',
  },
  {
    style: 'Prijevod',
    role: 'translation',
    size: fromHalfPoints(22),
    /*
     * `w:line="240" w:lineRule="AUTO"` — single spacing, which is the FONT's
     * natural line height, not 12 pt. Recorded as `null` (automatic) because
     * that is what the file says and what the page must do: measured off his
     * PDF, consecutive translation baselines are 12.6 pt apart on an 11 pt
     * Times, which is Times' own 1.15 — not the 12.0 pt an exact reading gives.
     * `leading: 12` here rendered every translation a line too tight.
     */
    leading: null,
    multiple: 1,
    after: fromTwips(60),
    indent: fromTwips(284),
    hanging: fromTwips(284),
    right: fromTwips(284),
    face: 'serif',
    italic: true,
    color: '808080',
  },
  {
    style: 'Header',
    role: 'head',
    size: fromHalfPoints(24),
    leading: null,
    multiple: 1,
    after: 0,
    indent: 0,
    hanging: 0,
    right: 0,
    face: 'sans',
  },
  {
    style: 'Normal',
    role: 'body',
    size: fromHalfPoints(22),
    leading: null,
    multiple: WORD_AUTO_LEADING,
    after: fromTwips(160),
    indent: 0,
    hanging: 0,
    right: 0,
    face: 'sans',
  },
  {
    style: 'Comment',
    role: 'comment',
    size: fromHalfPoints(22),
    leading: null,
    multiple: 1,
    after: 0,
    indent: 0,
    hanging: 0,
    right: 0,
    /*
     * TIMES NEW ROMAN, and it was `'ui'` — Calibri. Measured in his template:
     * `<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"
     * w:cs="Times New Roman"/>`. The `serif` slot is the one a theme resolves
     * to its own Times, so a source note follows the theme rather than naming
     * a family, which is the difference between this and a mark's face.
     */
    face: 'serif',
    italic: true,
    color: '808080',
  },
  {
    /*
     * HIS `Insert` — an empty 8-point paragraph he spaces his blocks with: one
     * before every chant's heading in the sādhanā, 29 of them, and 127 across
     * his files. Measured: `w:sz="16"`, Times New Roman, `w:after="0"`,
     * `w:line="240" w:lineRule="auto"`. Its leading is SINGLE, not his
     * document default, because it says so.
     */
    style: 'Insert',
    role: 'small',
    size: fromHalfPoints(16),
    leading: null,
    multiple: 1,
    after: 0,
    indent: 0,
    hanging: 0,
    right: 0,
    face: 'serif',
  },
];
