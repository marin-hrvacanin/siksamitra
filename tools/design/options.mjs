/**
 * Design options for śikṣāmitra's own identity.
 *
 * śikṣāmitra is its own open-source program — a workbench for Sanskrit text —
 * and vedaunion.org is one integration among others. So it must not borrow the
 * platform's vellum-and-violet: that would say the wrong thing about what this
 * is. (The `web` view still previews the platform's appearance. That is a
 * preview of somewhere else and nothing here touches it.)
 *
 * WHY THE FIRST ATTEMPT FAILED. Four palettes that differed only in hue read as
 * one design in four moods — and worse, all four named the same text face and
 * three named UI faces that are not installed, so every option fell back to
 * Segoe UI and the typography was literally identical. A palette is the least
 * of what makes a program feel like itself.
 *
 * So each option now differs along FIVE axes, and every face named here is
 * verified present on the target machine:
 *
 *   1. the TEXT face — the dominant thing on screen, and never the UI face
 *   2. the UI face
 *   3. the palette
 *   4. radius and chrome treatment — flat and hairlined, or raised and shadowed
 *   5. density — how much air the document is given
 *
 * MARK COLOURS ARE PART OF THE PALETTE, not decoration. A holding box, a svara
 * stroke and a change-style letter must stay separable from each other and from
 * the text, in both modes. An option that looks handsome and loses the svaras
 * is not a candidate.
 */

/*
 * Faces, all VENDORED (assets/fonts) — not requested from the system.
 *
 * Every text stack ends with Gentium Book Plus: `tools/fonts/verify.mjs`
 * measured, in a browser, that Source Serif 4 and Crimson Pro do not carry the
 * Vedic candrabindu (U+0310), of which the corpus has 89. Rather than drop two
 * good faces, the backstop supplies that one mark.
 */
const T = (name) => name === 'Gentium Book Plus'
  ? `'Gentium Book Plus', Georgia, serif`
  : `'${name}', 'Gentium Book Plus', Georgia, serif`;

/* The Indic faces are appended to every text stack: the document switches
   script without switching design. */
const INDIC = `'Noto Serif Devanagari', 'Noto Serif Telugu', 'Noto Serif Tamil'`;
const TEXT = (name) => `${T(name).replace(', Georgia, serif', '')}, ${INDIC}, Georgia, serif`;

const F = {
  gentium: TEXT('Gentium Book Plus'),
  garamond: TEXT('EB Garamond'),
  sourceSerif: TEXT('Source Serif 4'),
  crimson: TEXT('Crimson Pro'),

  inter: `'Inter', system-ui, sans-serif`,
  plex: `'IBM Plex Sans', system-ui, sans-serif`,
  sourceSans: `'Source Sans 3', system-ui, sans-serif`,

  mono: `'IBM Plex Mono', Consolas, monospace`,
};

/** Structure: how tight, how round, how raised. */
const DENSITY = {
  /* Word-like: a lot on screen, small controls. */
  dense: { tb: 30, pad: 18, leading: 1.75, gap: 12, ui: 11, doc: 15, deskPad: 14 },
  medium: { tb: 34, pad: 22, leading: 1.95, gap: 15, ui: 11.5, doc: 15.5, deskPad: 18 },
  /* Room to think. Fewer verses visible, each easier to read. */
  airy: { tb: 40, pad: 34, leading: 2.25, gap: 22, ui: 12, doc: 16.5, deskPad: 26 },
};

export const OPTIONS = [
  {
    id: 'shanta',
    name: 'Śānta',
    tagline: 'zen · saffron',
    note: 'The quiet one. Warm off-white, almost no lines, no shadows at all, '
        + 'and a muted saffron used sparingly — on the active thing and nothing '
        + 'else. Crimson Pro is a calm book face with an even '
        + 'colour, so the marks are the only thing that draws the eye. Generous '
        + 'leading: fewer verses on screen, each one easier to hold.',
    fonts: { ui: F.sourceSans, text: F.crimson, mono: F.mono },
    radius: 2,
    chrome: 'flat',
    density: 'airy',
    light: {
      'chrome-bg': '#f6f4f0', 'chrome-raise': '#fbfaf7', 'chrome-sunk': '#efece6',
      'chrome-line': '#e4e0d8', 'chrome-line-soft': '#eeebe4',
      'chrome-ink': '#2f2c27', 'chrome-ink-soft': '#6b665d', 'chrome-ink-mute': '#a29c92',
      accent: '#c8781f', 'accent-hover': '#a86217', 'accent-on': '#fffdf9',
      'doc-bg': '#fdfcf9', 'doc-ink': '#26241f', 'doc-line': '#ece8e0',
      hold: '#3d7a52', 'hold-long': '#a8442f', svara: '#c8781f', change: '#3f6f8f',
      'pause-short': '#3f6f8f', 'pause-long': '#c8781f',
      desk: '#efece6',
    },
    dark: {
      'chrome-bg': '#1a1917', 'chrome-raise': '#211f1d', 'chrome-sunk': '#151412',
      'chrome-line': '#2e2c28', 'chrome-line-soft': '#252320',
      'chrome-ink': '#eae6df', 'chrome-ink-soft': '#a8a29a', 'chrome-ink-mute': '#736e67',
      accent: '#e2a44f', 'accent-hover': '#f0bd6e', 'accent-on': '#1a1917',
      'doc-bg': '#211f1c', 'doc-ink': '#ece8e1', 'doc-line': '#2c2a26',
      hold: '#6bbd83', 'hold-long': '#e08069', svara: '#e6a44f', change: '#82aecb',
      'pause-short': '#82aecb', 'pause-long': '#e6a44f',
      desk: '#131211',
    },
  },

  {
    id: 'palladio',
    name: 'Palladio',
    tagline: 'v1, tightened',
    note: 'What śikṣāmitra already had: cool neutral greys, a bronze accent, and '
        + 'Palatino for the text — the face v1 actually shipped. Dense, squarish '
        + 'controls and a lot on screen at once. The most Word-like of the five, '
        + 'and the one with nothing to relearn.',
    fonts: { ui: F.plex, text: F.gentium, mono: F.mono },
    radius: 4,
    chrome: 'raised',
    density: 'dense',
    light: {
      'chrome-bg': '#f2f2f5', 'chrome-raise': '#ffffff', 'chrome-sunk': '#e9e9ee',
      'chrome-line': '#dddde1', 'chrome-line-soft': '#e8e8ec',
      'chrome-ink': '#1b1b1f', 'chrome-ink-soft': '#5c5c66', 'chrome-ink-mute': '#9898a0',
      accent: '#b8813d', 'accent-hover': '#9a6b2f', 'accent-on': '#ffffff',
      'doc-bg': '#ffffff', 'doc-ink': '#1b1b1f', 'doc-line': '#e8e8ec',
      hold: '#10b981', 'hold-long': '#ef4444', svara: '#c2410c', change: '#2563eb',
      'pause-short': '#2563eb', 'pause-long': '#c2410c',
      desk: '#e4e4e9',
    },
    dark: {
      'chrome-bg': '#111113', 'chrome-raise': '#1c1c1f', 'chrome-sunk': '#0c0c0e',
      'chrome-line': '#333338', 'chrome-line-soft': '#2a2a2e',
      'chrome-ink': '#e8e8ec', 'chrome-ink-soft': '#a0a0a8', 'chrome-ink-mute': '#666670',
      accent: '#d4a574', 'accent-hover': '#e6b886', 'accent-on': '#1b1b1f',
      'doc-bg': '#1c1c1f', 'doc-ink': '#e8e8ec', 'doc-line': '#2a2a2e',
      hold: '#34d399', 'hold-long': '#f87171', svara: '#fb923c', change: '#7dd3fc',
      'pause-short': '#7dd3fc', 'pause-long': '#fb923c',
      desk: '#0a0a0b',
    },
  },

  {
    id: 'bhurja',
    name: 'Bhūrja',
    tagline: 'birch bark',
    note: 'Warm ivory and umber with a rust accent, set in EB Garamond — classical and light on '
        + 'the page, so it reads as printed rather than displayed. Warm '
        + 'WITHOUT being the platform: the heat is brown and rust, never violet '
        + 'and gold, so the two can never be mistaken for one product.',
    fonts: { ui: F.sourceSans, text: F.garamond, mono: F.mono },
    radius: 3,
    chrome: 'raised',
    density: 'medium',
    light: {
      'chrome-bg': '#eeeae1', 'chrome-raise': '#f7f4ee', 'chrome-sunk': '#e4dfd3',
      'chrome-line': '#d6cfc0', 'chrome-line-soft': '#e2dccf',
      'chrome-ink': '#2c2419', 'chrome-ink-soft': '#5f5445', 'chrome-ink-mute': '#95897a',
      accent: '#a2542a', 'accent-hover': '#8a4522', 'accent-on': '#fdfbf7',
      'doc-bg': '#fdfbf6', 'doc-ink': '#241d14', 'doc-line': '#e5dfd2',
      hold: '#3f7d4e', 'hold-long': '#a63a2f', svara: '#b4531c', change: '#2f6690',
      'pause-short': '#2f6690', 'pause-long': '#b4531c',
      desk: '#ddd6c8',
    },
    dark: {
      'chrome-bg': '#1a1611', 'chrome-raise': '#241f18', 'chrome-sunk': '#12100c',
      'chrome-line': '#3a3227', 'chrome-line-soft': '#2c261e',
      'chrome-ink': '#ece5d8', 'chrome-ink-soft': '#b3a894', 'chrome-ink-mute': '#7b7263',
      accent: '#d98b5a', 'accent-hover': '#e8a273', 'accent-on': '#1a1611',
      'doc-bg': '#221d17', 'doc-ink': '#efe8db', 'doc-line': '#332c23',
      hold: '#6cbf7e', 'hold-long': '#e0705f', svara: '#f0a057', change: '#7fb6d9',
      'pause-short': '#7fb6d9', 'pause-long': '#f0a057',
      desk: '#0e0c09',
    },
  },

  {
    id: 'slate',
    name: 'Slate',
    tagline: 'near-monochrome',
    note: 'Cool grey, one teal accent, sharp corners and hairlines only — no '
        + 'shadow anywhere. Source Serif 4 is built for screens and stays '
        + 'even at small sizes. The most restrained option and the one that gives the marks '
        + 'the most room: when the only colour on screen is a holding box and a '
        + 'svara, you cannot miss either.',
    fonts: { ui: F.inter, text: F.sourceSerif, mono: F.mono },
    radius: 0,
    chrome: 'flat',
    density: 'dense',
    light: {
      'chrome-bg': '#eef1f4', 'chrome-raise': '#ffffff', 'chrome-sunk': '#e3e8ed',
      'chrome-line': '#d3dae1', 'chrome-line-soft': '#e2e7ec',
      'chrome-ink': '#16202a', 'chrome-ink-soft': '#4a5a69', 'chrome-ink-mute': '#8a99a8',
      accent: '#0f766e', 'accent-hover': '#0c5f59', 'accent-on': '#ffffff',
      'doc-bg': '#ffffff', 'doc-ink': '#131b23', 'doc-line': '#e4e9ee',
      hold: '#0f766e', 'hold-long': '#b91c1c', svara: '#b45309', change: '#1d4ed8',
      'pause-short': '#1d4ed8', 'pause-long': '#b45309',
      desk: '#dde3e9',
    },
    dark: {
      'chrome-bg': '#0f1418', 'chrome-raise': '#171e24', 'chrome-sunk': '#0a0e11',
      'chrome-line': '#2a343d', 'chrome-line-soft': '#1f272e',
      'chrome-ink': '#e6edf3', 'chrome-ink-soft': '#9fb0be', 'chrome-ink-mute': '#6b7c8a',
      accent: '#2dd4bf', 'accent-hover': '#5eead4', 'accent-on': '#0f1418',
      'doc-bg': '#161d23', 'doc-ink': '#e8eff5', 'doc-line': '#242d35',
      hold: '#2dd4bf', 'hold-long': '#f87171', svara: '#fbbf24', change: '#60a5fa',
      'pause-short': '#60a5fa', 'pause-long': '#fbbf24',
      desk: '#080b0d',
    },
  },

  {
    id: 'nirnaya',
    name: 'Nirṇaya',
    tagline: 'dark chrome, bright page',
    note: 'Charcoal chrome around a bright page, the way a photo or design tool '
        + 'frames its artefact — the page is the only bright thing on screen. '
        + 'Gentium keeps the diacritics crisp against the bright ground. Rounder corners and '
        + 'real elevation. In dark mode the page dims with the room rather than '
        + 'staying a lamp.',
    fonts: { ui: F.inter, text: F.gentium, mono: F.mono },
    radius: 6,
    chrome: 'raised',
    density: 'medium',
    light: {
      'chrome-bg': '#2b2f36', 'chrome-raise': '#353a43', 'chrome-sunk': '#22262c',
      'chrome-line': '#454b55', 'chrome-line-soft': '#3a4049',
      'chrome-ink': '#eceef1', 'chrome-ink-soft': '#b3b9c2', 'chrome-ink-mute': '#7d848e',
      accent: '#e8a33d', 'accent-hover': '#f2b357', 'accent-on': '#22262c',
      'doc-bg': '#ffffff', 'doc-ink': '#16181c', 'doc-line': '#e6e8eb',
      hold: '#0f766e', 'hold-long': '#b91c1c', svara: '#c2410c', change: '#1d4ed8',
      'pause-short': '#1d4ed8', 'pause-long': '#c2410c',
      desk: '#1c1f24',
    },
    dark: {
      'chrome-bg': '#15171b', 'chrome-raise': '#1e2126', 'chrome-sunk': '#0e1013',
      'chrome-line': '#2e3238', 'chrome-line-soft': '#24272c',
      'chrome-ink': '#e7e9ec', 'chrome-ink-soft': '#a5abb4', 'chrome-ink-mute': '#6e747d',
      accent: '#e8a33d', 'accent-hover': '#f2b357', 'accent-on': '#15171b',
      'doc-bg': '#20242a', 'doc-ink': '#e9edf2', 'doc-line': '#2d323a',
      hold: '#34d399', 'hold-long': '#f87171', svara: '#fb923c', change: '#7dd3fc',
      'pause-short': '#7dd3fc', 'pause-long': '#fb923c',
      desk: '#090a0c',
    },
  },
];

/**
 * The option, expressed as the token names the real stylesheets read.
 *
 * The preview must drive the ACTUAL `chant.css`, or it is a drawing of a design
 * rather than the design itself.
 */
export function tokensFor(option, mode) {
  const p = option[mode];
  const d = DENSITY[option.density];
  return {
    'color-vellum': p['chrome-raise'],
    'color-vellum-dim': p['chrome-bg'],
    'color-vellum-warm': p['chrome-sunk'],
    'color-rule': p['chrome-line'],
    'color-rule-strong': p['chrome-line'],
    'color-rule-violet': p['chrome-line-soft'],
    'color-ink': p['chrome-ink'],
    'color-ink-soft': p['chrome-ink-soft'],
    'color-ink-mute': p['chrome-ink-mute'],
    'color-ink-light': p['chrome-ink-mute'],
    'color-violet': p.accent,
    'color-violet-deep': p['accent-hover'],
    'color-violet-glow': p.accent,
    'color-violet-bloom': p.accent,
    'color-gold': p.accent,
    'color-gold-deep': p['accent-hover'],
    'color-gold-light': p.accent,
    'color-surface': p['chrome-raise'],
    'color-bg': p['chrome-bg'],
    'color-bg-alt': p['chrome-sunk'],
    'color-border': p['chrome-line'],
    'color-brand': p.accent,
    'doc-bg': p['doc-bg'],
    'doc-ink': p['doc-ink'],
    'color-hold': p.hold,
    'color-svara': p.svara,
    'color-change': p.change,
    'color-pause-short': p['pause-short'],
    'color-pause-long': p['pause-long'],
    'color-danger': p['hold-long'],
    'font-ui': option.fonts.ui,
    'font-body': option.fonts.text,
    'font-display': option.fonts.text,
    'font-mono': option.fonts.mono,
    desk: p.desk,
    'accent-on': p['accent-on'],
    /* structure */
    'o-radius': `${option.radius}px`,
    'o-tb': `${d.tb}px`,
    'o-pad': `${d.pad}px`,
    'o-leading': String(d.leading),
    'o-gap': `${d.gap}px`,
    'o-ui-size': `${d.ui}px`,
    'o-doc-size': `${d.doc}px`,
    'o-desk-pad': `${d.deskPad}px`,
    'o-shadow': option.chrome === 'flat'
      ? 'none'
      : (mode === 'dark' ? '0 2px 14px rgba(0,0,0,.5)' : '0 2px 12px rgba(0,0,0,.13)'),
  };
}
