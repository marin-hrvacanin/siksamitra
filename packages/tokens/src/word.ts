/**
 * The Veda Union Word document, measured — the values a page has to match to
 * be 1:1 with the owner's own `.docx` and the PDF printed from it.
 *
 * NOT A LOOKALIKE. Every number here was read out of
 * `tools/chant/templates/vu-word-template.docx`, which is built from
 * `Veda Union Youth Wing sAdhanA v1.0.1 IAST (1).docx` — his file, 845
 * paragraphs, 22 586 runs. Word stores sizes in HALF-POINTS, line spacing in
 * TWENTIETHS of a point, indents in TWIPS and border weights in EIGHTHS of a
 * point, so each is converted once, here, with the raw value beside it.
 *
 * THIS IS THE ONE SOURCE. `packages/interop/src/word-styles.ts` reads the
 * colours from here rather than repeating them, and the `word` document theme
 * is generated from the same table — so the exporter, the importer and the
 * on-screen page cannot drift apart. That is what makes "1:1" a test rather
 * than an opinion.
 *
 * WHY THE FACES ARE SUBSTITUTES. Arial, Calibri and Times New Roman are not
 * redistributable, and a face requested and not found does not error — it
 * silently substitutes, and then the line breaks somewhere else. Arimo, Tinos
 * and Carlito are METRIC-COMPATIBLE with those three: same advance widths at
 * the same point size, so the same text occupies the same space and wraps in
 * the same place. That is the property 1:1 needs; identical outlines are not
 * available at any price.
 */

/** Word's units, converted once. */
export const fromHalfPoints = (halves: number): number => halves / 2;
export const fromTwips = (twips: number): number => twips / 20;
export const fromEighths = (eighths: number): number => eighths / 8;

/** One paragraph style of the VU document, in points. */
export interface WordParagraphMetric {
  /** The `w:styleId` this came from. */
  style: string;
  /** What it is, in this program's language. */
  role: 'title' | 'verse-line' | 'part' | 'section' | 'step' | 'translation'
  | 'body' | 'comment' | 'head';
  /** Type size in POINTS (`w:sz` ÷ 2). */
  size: number;
  /** Exact leading in POINTS, or `null` for Word's automatic single spacing. */
  leading: number | null;
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
  /** Which vendored face stands in for the file's. */
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
export const WORD_PARAGRAPHS: readonly WordParagraphMetric[] = [
  {
    style: 'Translit',
    role: 'verse-line',
    size: fromHalfPoints(32),
    leading: fromTwips(480),
    after: 0,
    indent: fromTwips(284),
    hanging: fromTwips(284),
    right: fromTwips(-276),
    face: 'sans',
  },
  {
    style: 'Heading1',
    role: 'title',
    size: fromHalfPoints(48),
    leading: null,
    after: fromTwips(120),
    indent: fromTwips(397),
    hanging: 0,
    right: 0,
    face: 'ui',
  },
  {
    style: 'Heading2',
    role: 'part',
    size: fromHalfPoints(44),
    leading: null,
    after: 0,
    indent: 0,
    hanging: 0,
    right: 0,
    face: 'ui',
  },
  {
    style: 'Heading3',
    role: 'section',
    size: fromHalfPoints(36),
    leading: null,
    after: fromTwips(120),
    indent: fromTwips(397),
    hanging: 0,
    right: 0,
    face: 'ui',
    color: '7F7F7F',
  },
  {
    style: 'Heading4',
    role: 'step',
    size: fromHalfPoints(32),
    leading: null,
    after: 0,
    indent: fromTwips(567),
    hanging: 0,
    right: 0,
    face: 'ui',
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
    after: 0,
    indent: 0,
    hanging: 0,
    right: 0,
    face: 'ui',
  },
  {
    style: 'Normal',
    role: 'body',
    size: fromHalfPoints(22),
    leading: null,
    after: fromTwips(160),
    indent: 0,
    hanging: 0,
    right: 0,
    face: 'ui',
  },
  {
    style: 'Comment',
    role: 'comment',
    size: fromHalfPoints(22),
    leading: null,
    after: 0,
    indent: 0,
    hanging: 0,
    right: 0,
    face: 'ui',
    italic: true,
    color: '808080',
  },
];

/**
 * Word's "single" line spacing, as a ratio.
 *
 * A style with no `w:line` inherits `docDefaults`, which in his file is
 * `w:line="259" w:lineRule="auto"` — 259/240 of single spacing. Recorded so
 * the themes have one number to use for `leading: null` instead of each
 * guessing one.
 */
export const WORD_AUTO_LEADING = 259 / 240;

/**
 * The mark palette, and the two border weights.
 *
 * These are the character styles of his file, so a holding on screen is the
 * same green at the same weight as the one Word prints. The two holding
 * weights are the ONLY difference between a short and a long box — 0.25 pt
 * against 1.5 pt — which is why they are recorded to the eighth of a point.
 */
export const WORD_MARKS = {
  /** `Holding` — `w:bdr w:sz="2"`. */
  holdShort: { color: '538135', weight: fromEighths(2) },
  /** `2Holding` — `w:bdr w:sz="12"`. */
  holdLong: { color: '538135', weight: fromEighths(12) },
  /** `Svara`, and `Virama`, which shares its colour and size. */
  svara: { color: '943634', size: fromHalfPoints(36) },
  /** `Anusvara` / `VedicAnusvara` — the letter actually recited. */
  change: { color: '0070C0', italic: true },
  /** `Pause` — one style for both lengths; the glyph count decides. */
  pause: { color: 'C00000', italic: true },
  /** `Long` — the dīrgha overline (unresolved, 00 §5.1). */
  dirgha: { color: '4472C4', size: fromHalfPoints(36) },
  /** `Comment` — a source note under a section. */
  comment: { color: '808080', size: fromHalfPoints(22), italic: true },
} as const;

/**
 * The page.
 *
 * The template carries no `sectPr` in `document.xml`, so Word applies the
 * document defaults — and those are NOT one inch. Measured off his own PDF
 * (`Veda Union sAdhanA v9.1.4 IAST.pdf`, A4 595 x 842 pt): every mantra line
 * that starts at the margin starts at x = 70.9 pt, which is 25 mm. An inch
 * would be 72. It matters because the text column is what a line has to fit
 * in, so a 1.1 pt error per side moves where a long pāda wraps — and
 * `packages/layout` had 25 mm all along, so the two disagreed.
 */
export const WORD_PAGE = {
  size: 'a4',
  /** 25 mm, as his PDF measures — `1417` twips, Word's own default. */
  marginPt: 1417 / 20,
  /** A4's width in points, as Word writes it (`w:pgSz w:w="11906"` twips). */
  widthPt: 11906 / 20,
  /**
   * The text column, in points: A4 less both margins.
   *
   * Here because it is what a document line actually has to fit in, and the
   * screen themes' fluid mantra size is expressed against it — the line reaches
   * its full reading size at a full page's column and gives up size below that,
   * rather than at whatever width a card in the platform's reader happened to
   * be.
   */
  contentPt: 11906 / 20 - 2 * (1417 / 20),
  /** Calibri 11 pt, `w:sz="22"` in `docDefaults`. */
  bodySize: fromHalfPoints(22),
  /** `w:line="259" w:lineRule="auto"` — 1.08 lines. One definition, above. */
  bodyLeading: WORD_AUTO_LEADING,
} as const;

/** A Word colour (`538135`) as CSS (`#538135`). */
export const wordColor = (hex: string): string => `#${hex.toLowerCase()}`;

/**
 * The face each Word family is stood in for by, metric-compatible.
 *
 * Arimo, Tinos and Carlito are the Croscore faces: same advance widths as
 * Arial, Times New Roman and Calibri at the same point size, and OFL, so they
 * can travel inside the installer. The full CSS stacks are in `fonts.ts`, and
 * they name the original second — on a machine that has Arial, the page is
 * literally identical rather than merely metrically so.
 */
export const WORD_SUBSTITUTES = {
  sans: { of: 'Arial', use: 'Arimo' },
  serif: { of: 'Times New Roman', use: 'Tinos' },
  ui: { of: 'Calibri', use: 'Carlito' },
} as const;
