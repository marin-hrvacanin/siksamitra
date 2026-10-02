/**
 * The fonts śikṣāmitra ships.
 *
 * VENDORED, not requested from the system. Three reasons, in order of weight:
 *
 *   1. **A missing glyph is a wrong document.** This program's whole subject is
 *      diacritics — `ṛ ṣ ṭ ḍ ṇ ḷ ḥ ṁ ś ā ī ū` — and four Indic scripts. A face
 *      that lacks one renders a box, or worse, silently substitutes from
 *      another family at a different weight and the reader never knows the text
 *      they are checking is not the text they have.
 *   2. **The export promise.** "1:1 with the PDF, in infinite round trips"
 *      cannot be true if the page is laid out in whatever face the machine
 *      happened to have. Pagination measures glyphs; the glyphs must be the
 *      same everywhere.
 *   3. **A non-technical installer.** Someone double-clicks and it works. Not
 *      "install these fonts first".
 *
 * Every family here is SIL OFL 1.1 or Apache 2.0 — redistributable, which an
 * open-source program shipping fonts inside its installer needs to be sure of.
 *
 * Subsets: `latin` + `latin-ext`. Verified against the upstream unicode ranges:
 * `latin-ext` carries U+1E00–1E9F, which is where every IAST retroflex and
 * nasal lives. Anything narrower would drop them.
 */

/**
 * Letters a text face must be able to write.
 *
 * These are LETTERS, and their absence is fatal: a missing `ṣ` renders a box or
 * silently substitutes from another family at another weight, and the reader
 * never learns the text they are proofing is not the text they have.
 */
export const REQUIRED_LETTERS = {
  'ā': 0x0101, 'ī': 0x012b, 'ū': 0x016b, 'ṝ': 0x1e5d, 'ḹ': 0x1e39,
  'ṛ': 0x1e5b, 'ḷ': 0x1e37, 'ṅ': 0x1e45, 'ñ': 0x00f1, 'ṭ': 0x1e6d,
  'ḍ': 0x1e0d, 'ṇ': 0x1e47, 'ś': 0x015b, 'ṣ': 0x1e63, 'ḥ': 0x1e25,
  'ṁ': 0x1e41, 'ṃ': 0x1e43, 'ḻ': 0x1e3b, 'ē': 0x0113, 'ō': 0x014d,
};

/**
 * Combining marks the RENDERER emits as characters.
 *
 * Only the candrabindu. The svara marks (U+0331, U+030D, U+030E) are DATA in
 * this system: `bare()` strips them and the renderer draws them as positioned
 * strokes, which is why a font that lacks them is not disqualified.
 *
 * Getting this distinction wrong once already cost something: requiring all
 * four rejected every candidate text face, including the one designed for
 * exactly this work.
 */
export const REQUIRED_COMBINING = {
  'candrabindu (U+0310)': 0x0310,
};

/**
 * Marks drawn as geometry, never as glyphs. Listed so the distinction is
 * written down rather than rediscovered.
 */
export const DRAWN_NOT_TYPED = {
  'anudatta (U+0331)': 0x0331,
  'svarita (U+030D)': 0x030d,
  'udatta (U+030E)': 0x030e,
};

/** A role is what a face is FOR. Components name roles, never families. */
export const ROLES = ['text', 'ui', 'mono', 'deva', 'telu', 'taml', 'word'];

export const FAMILIES = [
  /* ── text faces: the document itself ─────────────────────────────────── */
  {
    id: 'gentium-book-plus', name: 'Gentium Book Plus', role: 'text',
    licence: 'OFL-1.1', weights: [400, 700], italics: true,
    why: 'The scholar\'s face for IAST. Designed for exactly this: heavy '
       + 'diacritic stacking that stays legible at reading size.',
  },
  {
    id: 'eb-garamond', name: 'EB Garamond', role: 'text',
    licence: 'OFL-1.1', weights: [400, 600], italics: true,
    why: 'Classical and light on the page. Small x-height, so it wants more '
       + 'leading than the others.',
  },
  {
    id: 'source-serif-4', name: 'Source Serif 4', role: 'text',
    licence: 'OFL-1.1', weights: [400, 600], italics: true,
    why: 'Built for screens. Sturdier than Garamond at small sizes and more '
       + 'even in colour, which suits a dense page.',
  },
  {
    id: 'crimson-pro', name: 'Crimson Pro', role: 'text',
    licence: 'OFL-1.1', weights: [400, 600], italics: true,
    why: 'Book-like and warm, with a calm rhythm. The quietest of the four.',
  },

  /* ── Indic ───────────────────────────────────────────────────────────── */
  {
    id: 'noto-serif-devanagari', name: 'Noto Serif Devanagari', role: 'deva',
    licence: 'OFL-1.1', weights: [400, 600], italics: false, subsets: ['devanagari', 'latin'],
    why: 'Full conjunct coverage and a serif weight that sits beside the Latin '
       + 'text faces without looking pasted in.',
  },
  {
    id: 'noto-serif-telugu', name: 'Noto Serif Telugu', role: 'telu',
    licence: 'OFL-1.1', weights: [400, 600], italics: false, subsets: ['telugu', 'latin'],
    why: 'The corpus\'s Telugu is verified against these forms.',
  },
  {
    id: 'noto-serif-tamil', name: 'Noto Serif Tamil', role: 'taml',
    licence: 'OFL-1.1', weights: [400, 600], italics: false, subsets: ['tamil', 'latin'],
    why: 'Tamil forms in the corpus are UNREVIEWED; the face is shipped so they '
       + 'render, not as a claim that they are right.',
  },

  /* ── chrome ──────────────────────────────────────────────────────────── */
  {
    id: 'inter', name: 'Inter', role: 'ui',
    licence: 'OFL-1.1', weights: [400, 500, 600], italics: false,
    why: 'Neutral to the point of invisibility, which is what chrome should be. '
       + 'Excellent at 11–12px, where a tool lives.',
  },
  {
    id: 'ibm-plex-sans', name: 'IBM Plex Sans', role: 'ui',
    licence: 'OFL-1.1', weights: [400, 500, 600], italics: false,
    why: 'What v1 used. Slightly technical, a little warmer than Inter.',
  },
  {
    id: 'source-sans-3', name: 'Source Sans 3', role: 'ui',
    licence: 'OFL-1.1', weights: [400, 600], italics: false,
    why: 'Humanist and gentle — the softest of the three, for a quieter shell.',
  },
  {
    id: 'ibm-plex-mono', name: 'IBM Plex Mono', role: 'mono',
    licence: 'OFL-1.1', weights: [400], italics: false,
    why: 'For the source view and anywhere a codepoint is shown.',
  },

  /* ── the Veda Union Word document ─────────────────────────────────────────
     Three METRIC-COMPATIBLE substitutes, and the compatibility is the whole
     reason they are here. His `.docx` sets the mantra line in Arial 16pt, the
     translation in Times New Roman and the headings in Calibri; none of the
     three is redistributable, and a face requested and not found does not
     error — it silently substitutes, and the line then breaks somewhere else.
     These carry the same advance widths at the same point size, so the same
     text occupies the same space and wraps in the same place, which is the
     property "1:1 with the Word document" actually needs. Identical outlines
     are not available at any price.                                           */
  {
    id: 'arimo', name: 'Arimo', role: 'word',
    licence: 'OFL-1.1', weights: [400, 700], italics: true,
    why: 'Metric-compatible with Arial — the `Translit` style, his mantra line.',
  },
  {
    id: 'tinos', name: 'Tinos', role: 'word',
    licence: 'OFL-1.1', weights: [400, 700], italics: true,
    why: 'Metric-compatible with Times New Roman — the `Prijevod` style, the '
       + 'translation.',
  },
  {
    id: 'carlito', name: 'Carlito', role: 'word',
    licence: 'OFL-1.1', weights: [400, 700], italics: true,
    why: 'Metric-compatible with Calibri — the headings and the body text.',
  },
];

export const DEFAULT_SUBSETS = ['latin', 'latin-ext'];

/**
 * HIS SVARA FACE — vendored from the file itself, not fetched, because no
 * library of fonts carries it.
 *
 * His `Svara` style is URW Palladio ITU, bold, 18 pt: every svara mark he
 * writes is a glyph of this face, set after its letter at no width (see
 * `packages/tokens/word-marks.mjs`). A svara drawn in any other face sits a
 * little elsewhere over its letter, and a svara a little elsewhere is a
 * different svara — the owner: "it's crucial … it must be an exact match".
 * His `VedicAnusvara` is the same face in italic.
 *
 * NOT OFL. URW++ and Hermann Zapf donated URW Palladio to Ulrich Stiehl,
 * "granting him permission to adapt and to add diacritical characters … and
 * to offer specialized URW Palladio diacritics fonts to Indologists free of
 * charge" (http://www.sanskritweb.net/itrans/); URW Palladio ITU is that font.
 * The terms travel with it in LICENSES.md. Its embedding flag (`fsType` 0) is
 * unrestricted, so a PDF may carry it.
 *
 * Its range is the Latin and combining blocks it draws for us; the stacks
 * that name it are the marks' alone, so nothing else is set in it.
 */
export const LOCAL_FAMILIES = [
  {
    id: 'urw-palladio-itu', name: 'URW Palladio ITU', role: 'word',
    licence: 'URW Palladio ITU (free of charge, by permission of URW++ and Hermann Zapf)',
    terms: 'URW++ Design & Development GmbH, Hamburg, and Prof. Hermann Zapf donated URW Palladio to '
      + 'Ulrich Stiehl, Heidelberg, granting him permission to adapt and to add diacritical characters '
      + 'and to offer specialized URW Palladio diacritics fonts to Indologists free of charge. '
      + 'Copyright (c) by (URW)++ Design & Development, 1999. Designed by Hermann Zapf. Diacritics added '
      + 'by Ulrich Stiehl. Source: http://www.sanskritweb.net/itrans/',
    weights: [400, 700], italics: true,
    /* And its private glyphs, which his `VedicAnusvara` writes: U+F141 is its m with a candrabindu. */
    range: 'U+0000-024F,U+0300-036F,U+1E00-1EFF,U+2000-206F,U+F100-F1FF',
    why: 'His Svara and VedicAnusvara styles: every svara mark is a glyph of this face.',
  },
  {
    id: 'siksamitra-danda', name: 'Siksamitra Danda', role: 'word',
    licence: 'SIL Open Font License 1.1 (this project’s own face)',
    terms: 'Two glyphs, U+0964 and U+0965: bars drawn from the measured dimensions of the daṇḍas of '
      + 'his Mangal by tools/fonts/danda.py. A rectangle is not a design anyone owns; the face is the '
      + 'project’s own, under the SIL Open Font License 1.1 (https://openfontlicense.org).',
    weights: [400], italics: false,
    range: 'U+0964-0965',
    why: 'His daṇḍas at Mangal’s width, height and weight on any machine — Mangal is Microsoft’s, and not on every one.',
  },
];

/** A vendored family's file, by weight and style. */
export const localName = (id, weight, style) => `${id}-${weight}-${style}.ttf`;

/**
 * THE FACES THE WORD ADD-IN'S OWN PAGES DRAW IN — Settings and the dialogs.
 * The interface face; the verse face a palette key is drawn in, which for a
 * Word document is Arial's stand-in, Arimo (`document-themes.ts`); and the
 * app's default verse faces, for a key drawn outside a Word theme. `gen-css.mjs`
 * writes their rules, and only theirs, for the add-in: the add-in is loaded
 * over the network by every Word that opens it, and the other seven families
 * would be nothing but weight.
 */
export const ADDIN_FAMILIES = ['ibm-plex-sans', 'arimo', 'gentium-book-plus', 'noto-serif-devanagari', 'urw-palladio-itu'];

/**
 * The face every text stack ends with.
 *
 * Measured, not assumed: of the four text faces, only Gentium Book Plus and
 * EB Garamond carry the Vedic candrabindu (U+0310). Source Serif 4 and Crimson
 * Pro do not, and the corpus contains 89 of them.
 *
 * Rather than drop two good faces, every text stack ends with this one. A
 * combining mark borrowed from another family is acceptable where a whole
 * letter would not be: it sits above the letter, it is small, and Gentium's is
 * drawn for exactly this purpose. What is NOT acceptable is the alternative —
 * the browser falling through to whatever the system has, which differs per
 * machine and would break the "same everywhere" promise the vendoring exists
 * to keep.
 */
export const TEXT_FALLBACK = 'Gentium Book Plus';

/** The full CSS stack for a text face: itself, the backstop, then generics. */
export const textStack = (name) => name === TEXT_FALLBACK
  ? `'${name}', Georgia, serif`
  : `'${name}', '${TEXT_FALLBACK}', Georgia, serif`;

/** Where a vendored file lives, relative to the fonts directory. */
export const fileName = (id, subset, weight, style) =>
  `${id}-${subset}-${weight}-${style}.woff2`;

export const CDN = 'https://cdn.jsdelivr.net/fontsource/fonts';

export const cdnUrl = (id, subset, weight, style) =>
  `${CDN}/${id}@latest/${subset}-${weight}-${style}.woff2`;

/**
 * Where a COMPLETE file lives.
 *
 * The text faces are taken whole rather than subsetted, because the Latin
 * subsets stop at U+1E9F and drop the candrabindu at U+0310 — a mark this
 * program actually emits. A complete file is ~800 KB against ~60 KB, which is
 * the right trade for the four faces that carry the document and the wrong one
 * for chrome, so chrome stays subsetted.
 */
export const FULL_FILES = {
  'gentium-book-plus': 'ofl/gentiumbookplus/GentiumBookPlus-Regular.ttf',
  'gentium-book-plus:700': 'ofl/gentiumbookplus/GentiumBookPlus-Bold.ttf',
  'gentium-book-plus:italic': 'ofl/gentiumbookplus/GentiumBookPlus-Italic.ttf',
  'eb-garamond': 'ofl/ebgaramond/EBGaramond%5Bwght%5D.ttf',
  'eb-garamond:italic': 'ofl/ebgaramond/EBGaramond-Italic%5Bwght%5D.ttf',
  'source-serif-4': 'ofl/sourceserif4/SourceSerif4%5Bopsz,wght%5D.ttf',
  'source-serif-4:italic': 'ofl/sourceserif4/SourceSerif4-Italic%5Bopsz,wght%5D.ttf',
  'crimson-pro': 'ofl/crimsonpro/CrimsonPro%5Bwght%5D.ttf',
  'crimson-pro:italic': 'ofl/crimsonpro/CrimsonPro-Italic%5Bwght%5D.ttf',
};

export const GOOGLE_RAW = 'https://raw.githubusercontent.com/google/fonts/main';
export const fullUrl = (path) => `${GOOGLE_RAW}/${path}`;
export const fullName = (id, variant) =>
  `${id}${variant === 'normal' ? '' : `-${variant}`}-full.ttf`;
