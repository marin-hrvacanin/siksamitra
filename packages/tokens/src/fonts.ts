/**
 * The faces, by ROLE.
 *
 * A component names a role — `text`, `ui`, `mono` — never a family. Changing
 * which family serves a role is then one edit here, which is the whole point.
 *
 * Every stack ends with Gentium Book Plus for the text roles. That is measured,
 * not assumed: `tools/fonts/verify.mjs` renders each face in a browser and
 * found that Source Serif 4 and Crimson Pro cannot write the Vedic candrabindu
 * (U+0310), of which the corpus contains 89. Rather than drop two good faces,
 * the backstop supplies that one mark — acceptable for a combining mark, where
 * borrowing a whole letter would not be.
 *
 * The Indic faces are appended to every text stack rather than swapped in, so
 * changing script does not change design: the Latin around a Devanāgarī word
 * stays in the same face it was.
 */

export const INDIC_STACK =
  "'Noto Serif Devanagari', 'Noto Serif Telugu', 'Noto Serif Tamil'";

/** The face that must be last in every text stack. See above. */
export const TEXT_BACKSTOP = "'Gentium Book Plus'";

const text = (family: string): string => {
  const own = `'${family}'`;
  const backstop = own === TEXT_BACKSTOP ? '' : `${TEXT_BACKSTOP}, `;
  return `${own}, ${backstop}${INDIC_STACK}, Georgia, serif`;
};

/** Text faces a document theme may name. */
export const TEXT_FACES = {
  gentium: text('Gentium Book Plus'),
  garamond: text('EB Garamond'),
  sourceSerif: text('Source Serif 4'),
  crimson: text('Crimson Pro'),
  /**
   * The Veda Union Word document's mantra face: Arimo, metric-compatible with
   * his Arial. This is the only text face that is not a reading choice — it is
   * a fidelity requirement. See `WORD_FACES` for why Arial itself is not named.
   */
  wordSans: `'Arial', 'Arimo', ${TEXT_BACKSTOP}, ${INDIC_STACK}, sans-serif`,
} as const;

/** Chrome faces a chrome theme may name. */
export const UI_FACES = {
  inter: "'Inter', system-ui, sans-serif",
  plex: "'IBM Plex Sans', system-ui, sans-serif",
  sourceSans: "'Source Sans 3', system-ui, sans-serif",
} as const;

export const MONO_FACE = "'IBM Plex Mono', Consolas, monospace";

/**
 * The Veda Union Word document's faces — HIS, then their metric-compatible
 * substitutes.
 *
 * His own faces first, now that he has them licensed (2026-10-02: "the
 * translation font is not the same as that in our PDFs"): `fonts/` at the
 * repository's root, on his machine and the bot's server (`tools/_browser.mjs`
 * points the printer at it). Where they are not, Arimo, Tinos and Carlito
 * stand in with the same advance widths, so the lines break where his do.
 *
 * Once named second and then not at all, because a browser takes each glyph
 * the first face lacks from the next: a letter carrying the Ṛgvedic overline
 * printed WHOLE in another face. The overline is drawn from the stylesheet
 * now, as the svaras are (`word-marks.mjs`), so no letter goes elsewhere for
 * it, and his faces cover every IAST letter (Arial 7.06, Times New Roman
 * 7.12, Calibri 6.27 — measured).
 *
 * The Indic faces and the text backstop follow, because a VU page still has to
 * write Devanāgarī and the Vedic candrabindu (see above).
 */
export const WORD_FACES = {
  /** `Translit` — the mantra line. Arial 16 pt. */
  sans: `'Arial', 'Arimo', ${TEXT_BACKSTOP}, ${INDIC_STACK}, sans-serif`,
  /** `Prijevod` — the translation. Times New Roman, italic. */
  serif: `'Times New Roman', 'Tinos', ${TEXT_BACKSTOP}, ${INDIC_STACK}, serif`,
  /** Headings and body. Calibri. */
  ui: `'Calibri', 'Carlito', ${TEXT_BACKSTOP}, ${INDIC_STACK}, sans-serif`,
} as const;

export type TextFace = keyof typeof TEXT_FACES;
export type UiFace = keyof typeof UI_FACES;

/**
 * Control geometry per chrome scale.
 *
 * `compact` puts the most on screen and is what a dense, Word-like shell wants;
 * `roomy` is for a quieter one. The steps are in rem so they follow the root.
 *
 * The window's own furniture is here too — the title bar, the ribbon's tab
 * strip, the ribbon body, and the width of a ribbon's large button — because
 * they are the same kind of decision as a control's height and have to move
 * with it. A ribbon at a compact density with a roomy title bar is two
 * different programs stacked.
 *
 * The ribbon's height is what THREE small rows and a group label need — 106px
 * at the regular step, which is Word's 92px body plus its 14px label. Set from
 * the large button's height instead, it clipped the third row of every stack
 * and the label under it: the group said "Fil" and the Print button was half a
 * button. A ribbon's height is decided by its densest group, not its tallest.
 */
export const CHROME_SCALES = {
  compact: {
    toolbar: '2rem', status: '1.35rem', text: '0.7rem', control: '1.4rem', gap: '0.3rem',
    titlebar: '2rem', tabs: '1.85rem', ribbon: '6.2rem', bigButton: '3.1rem',
  },
  regular: {
    toolbar: '2.25rem', status: '1.5rem', text: '0.74rem', control: '1.55rem', gap: '0.4rem',
    titlebar: '2.25rem', tabs: '2rem', ribbon: '6.6rem', bigButton: '3.4rem',
  },
  roomy: {
    toolbar: '2.6rem', status: '1.7rem', text: '0.78rem', control: '1.75rem', gap: '0.5rem',
    titlebar: '2.5rem', tabs: '2.2rem', ribbon: '7.2rem', bigButton: '3.7rem',
  },
} as const;

export type ChromeScale = keyof typeof CHROME_SCALES;
