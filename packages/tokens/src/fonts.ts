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
   * The Veda Union Word document's mantra face.
   *
   * Arimo first, Arial second: metric-compatible everywhere, and literally his
   * face on a machine that has it. This is the only text face that is not a
   * reading choice — it is a fidelity requirement.
   */
  wordSans: `'Arimo', Arial, ${TEXT_BACKSTOP}, ${INDIC_STACK}, sans-serif`,
} as const;

/** Chrome faces a chrome theme may name. */
export const UI_FACES = {
  inter: "'Inter', system-ui, sans-serif",
  plex: "'IBM Plex Sans', system-ui, sans-serif",
  sourceSans: "'Source Sans 3', system-ui, sans-serif",
} as const;

export const MONO_FACE = "'IBM Plex Mono', Consolas, monospace";

/**
 * The Veda Union Word document's faces — metric-compatible substitutes.
 *
 * Each stack names the substitute FIRST and the original SECOND: on a machine
 * that has Arial, Word's own face is used and the page is literally identical;
 * everywhere else the metric-compatible one gives the same widths at the same
 * size. Both are better than the browser's default, which differs per machine.
 *
 * The Indic faces and the text backstop follow, because a VU page still has to
 * write Devanāgarī and the Vedic candrabindu (see above).
 */
export const WORD_FACES = {
  /** `Translit` — the mantra line. Arial 16 pt. */
  sans: `'Arimo', Arial, ${TEXT_BACKSTOP}, ${INDIC_STACK}, sans-serif`,
  /** `Prijevod` — the translation. Times New Roman, italic. */
  serif: `'Tinos', 'Times New Roman', ${TEXT_BACKSTOP}, ${INDIC_STACK}, serif`,
  /** Headings and body. Calibri. */
  ui: `'Carlito', Calibri, ${TEXT_BACKSTOP}, ${INDIC_STACK}, sans-serif`,
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
