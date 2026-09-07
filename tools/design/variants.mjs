/**
 * Round two: blends around Śānta.
 *
 * The owner likes Śānta (clean, zen, warm, saffron) and Palladio (crisp, a
 * visible corner radius), and neither is quite it. So rather than guess at a
 * blend, each variant here changes exactly ONE thing from Śānta — which makes
 * the comparison legible. A round of five options each differing in four ways
 * is how the first round ended up unreadable.
 *
 * Śānta and Palladio are both kept in the page for reference, so the blends are
 * judged against what they came from rather than from memory.
 */

import { OPTIONS } from './options.mjs';

const base = OPTIONS.find((o) => o.id === 'shanta');
const palladio = OPTIONS.find((o) => o.id === 'palladio');

/** Derive a variant: Śānta, with these fields replaced. */
const from = (id, name, tagline, note, patch = {}) => ({
  ...structuredClone(base),
  id, name, tagline, note,
  ...patch,
  light: { ...structuredClone(base.light), ...(patch.light ?? {}) },
  dark: { ...structuredClone(base.dark), ...(patch.dark ?? {}) },
});

/* The faces, repeated here so a variant can name one without importing the
   private table in options.mjs. */
const GENTIUM = "'Gentium Book Plus', 'Noto Serif Devanagari', 'Noto Serif Telugu', 'Noto Serif Tamil', Georgia, serif";
const CRIMSON = "'Crimson Pro', 'Gentium Book Plus', 'Noto Serif Devanagari', 'Noto Serif Telugu', 'Noto Serif Tamil', Georgia, serif";
const PLEX = "'IBM Plex Sans', system-ui, sans-serif";

export const VARIANTS = [
  from(
    'shanta-r4', 'Śānta · 4', 'radius only',
    'Śānta exactly as it was, with the corner radius taken from 2px to 4px — '
    + 'the one change asked for and nothing else, so it is clear how much of '
    + 'the difference was the radius.',
    { radius: 4 },
  ),

  from(
    'shanta-gentium', 'Śānta · Gentium', 'crisper face',
    'Śānta with Gentium Book Plus for the text instead of Crimson Pro. Gentium '
    + 'is drawn for exactly this diacritic load, so the retroflexes and the '
    + 'anusvāra sit cleaner and the page reads sharper — less bookish, more '
    + 'instrument. Radius 4.',
    { radius: 4, fonts: { ...base.fonts, text: GENTIUM } },
  ),

  from(
    'shanta-lift', 'Śānta · lifted', 'one soft shadow',
    'Śānta with a single soft shadow under the page, so the sheet sits above '
    + 'the desk rather than being a paler patch of it. Everything else stays '
    + 'flat — no shadow anywhere in the chrome. Radius 4.',
    { radius: 4, chrome: 'raised' },
  ),

  from(
    'shanta-cool', 'Śānta · cool', 'neutral ground',
    'Śānta\'s calm and spacing on Palladio\'s cool neutral grey instead of the '
    + 'warm off-white, with the saffron kept. Colder and more neutral; the '
    + 'saffron reads brighter against grey than against cream. Radius 4.',
    {
      radius: 4,
      light: {
        'chrome-bg': '#f1f2f4', 'chrome-raise': '#fafbfc', 'chrome-sunk': '#e7e9ec',
        'chrome-line': '#dfe2e6', 'chrome-line-soft': '#eaecef',
        'chrome-ink': '#1d1f22', 'chrome-ink-soft': '#5b6068', 'chrome-ink-mute': '#949aa2',
        'doc-bg': '#ffffff', 'doc-ink': '#1a1c1f', 'doc-line': '#e8eaed',
        desk: '#e4e6ea',
      },
      dark: {
        'chrome-bg': '#16181a', 'chrome-raise': '#1d2022', 'chrome-sunk': '#111314',
        'chrome-line': '#2b2e31', 'chrome-line-soft': '#212426',
        'chrome-ink': '#e7e9ec', 'chrome-ink-soft': '#a3a9b0', 'chrome-ink-mute': '#6e747b',
        'doc-bg': '#1c1f21', 'doc-ink': '#e9ebee', 'doc-line': '#282b2e',
        desk: '#101112',
      },
    },
  ),

  from(
    'shanta-dense', 'Śānta · closer', 'more on screen',
    'Śānta\'s palette and flatness at a medium density: tighter leading and '
    + 'smaller margins, so more of the text is visible at once. The calm '
    + 'without the airiness — closer to how a working session actually looks. '
    + 'Radius 4.',
    { radius: 4, density: 'medium' },
  ),

  from(
    'shanta-plex', 'Śānta · Plex chrome', 'v1\'s chrome face',
    'Śānta with IBM Plex Sans for the chrome — the face v1 used. Slightly more '
    + 'technical and a little tighter than Source Sans, which makes the toolbar '
    + 'read more like an instrument and less like a document. Text stays '
    + 'Crimson Pro. Radius 4.',
    { radius: 4, fonts: { ...base.fonts, ui: PLEX } },
  ),
];

/** The two the blends came from, for side-by-side reference. */
export const REFERENCE = [base, palladio];

export { CRIMSON, GENTIUM };
