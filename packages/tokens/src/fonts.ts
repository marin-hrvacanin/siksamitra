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
} as const;

/** Chrome faces a chrome theme may name. */
export const UI_FACES = {
  inter: "'Inter', system-ui, sans-serif",
  plex: "'IBM Plex Sans', system-ui, sans-serif",
  sourceSans: "'Source Sans 3', system-ui, sans-serif",
} as const;

export const MONO_FACE = "'IBM Plex Mono', Consolas, monospace";

export type TextFace = keyof typeof TEXT_FACES;
export type UiFace = keyof typeof UI_FACES;

/**
 * Control geometry per chrome scale.
 *
 * `compact` puts the most on screen and is what a dense, Word-like shell wants;
 * `roomy` is for a quieter one. The steps are in rem so they follow the root.
 */
export const CHROME_SCALES = {
  compact: { toolbar: '2rem', status: '1.35rem', text: '0.7rem', control: '1.4rem', gap: '0.3rem' },
  regular: { toolbar: '2.25rem', status: '1.5rem', text: '0.74rem', control: '1.55rem', gap: '0.4rem' },
  roomy: { toolbar: '2.6rem', status: '1.7rem', text: '0.78rem', control: '1.75rem', gap: '0.5rem' },
} as const;

export type ChromeScale = keyof typeof CHROME_SCALES;
