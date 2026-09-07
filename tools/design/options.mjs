/**
 * Design options for śikṣāmitra's own identity.
 *
 * The brief: the TOOL must not look like vedaunion.org. The platform is
 * vellum-and-violet, editorial and warm; this is an instrument someone sits in
 * front of for hours, and it should read as one. The `web` view still previews
 * the platform's appearance — that is a preview of somewhere else and is
 * unaffected by anything here.
 *
 * Each option is a complete palette in both modes, plus the two faces that
 * matter: one for the CHROME and one for the TEXT BEING EDITED. They are never
 * the same face. The document face has to carry IAST diacritics and four Indic
 * scripts; the chrome face has to disappear.
 *
 * MARK COLOURS ARE PART OF THE PALETTE, not decoration. A holding box, a svara
 * stroke and a change-style letter have to stay separable from each other and
 * from the text at every size, in both modes. An option that looks handsome and
 * loses the svaras is not a candidate.
 */

/** Fallbacks that exist on Windows without installing anything. */
const SERIF_TEXT = '"Gentium Book Plus", "Gentium Plus", "URW Palladio ITU", "Palatino Linotype", "Book Antiqua", Palatino, "Noto Serif Devanagari", "Nirmala UI", Georgia, serif';
const SANS_UI = '"IBM Plex Sans", "Segoe UI Variable", "Segoe UI", system-ui, -apple-system, sans-serif';
const GROTESK_UI = '"Inter", "Segoe UI Variable", "Segoe UI", system-ui, -apple-system, sans-serif';
const HUMANIST_UI = '"Source Sans 3", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif';
const MONO_UI = '"IBM Plex Mono", "Cascadia Mono", Consolas, monospace';

export const OPTIONS = [
  {
    id: 'palladio',
    name: 'Palladio',
    tagline: 'v1, tightened',
    note: 'The palette śikṣāmitra already had — cool neutral greys with a bronze '
        + 'accent — with the spacing and hierarchy tightened. The safest choice: '
        + 'nothing to relearn, and it already reads as an editor rather than a site.',
    fonts: { ui: SANS_UI, text: SERIF_TEXT, mono: MONO_UI },
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
    note: 'Warm ivory paper and umber ink, with a rust accent. Scholarly and '
        + 'quiet, and warm WITHOUT being the platform: the heat comes from brown '
        + 'and rust rather than violet and gold, so the two never look like the '
        + 'same product.',
    fonts: { ui: HUMANIST_UI, text: SERIF_TEXT, mono: MONO_UI },
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
    note: 'Cool grey chrome, one teal accent, nothing else coloured except the '
        + 'marks. The most restrained option, and the one that gives the marks '
        + 'the most room: when the only colour on screen is a holding box and a '
        + 'svara, you cannot miss either.',
    fonts: { ui: GROTESK_UI, text: SERIF_TEXT, mono: MONO_UI },
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
        + 'frames its artefact. The strongest separation between the instrument '
        + 'and the text — the page is the only bright thing on screen. In dark '
        + 'mode the page dims with it rather than staying a lamp.',
    fonts: { ui: GROTESK_UI, text: SERIF_TEXT, mono: MONO_UI },
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
 * The option palette, expressed as the token names the real stylesheets read.
 *
 * The preview must drive the ACTUAL `chant.css`, or it is a drawing of a design
 * rather than the design. So each option is mapped onto `--color-*`, and the
 * marks come out of the same rules the app uses.
 */
export function tokensFor(option, mode) {
  const p = option[mode];
  return {
    /* chrome */
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
    /* the document */
    'doc-bg': p['doc-bg'],
    'doc-ink': p['doc-ink'],
    /* the marks */
    'color-hold': p.hold,
    'color-svara': p.svara,
    'color-change': p.change,
    'color-pause-short': p['pause-short'],
    'color-pause-long': p['pause-long'],
    'color-danger': p['hold-long'],
    /* faces */
    'font-ui': option.fonts.ui,
    'font-body': option.fonts.text,
    'font-display': option.fonts.text,
    'font-mono': option.fonts.mono,
    /* the desk the pages sit on */
    desk: p.desk,
    'accent-on': p['accent-on'],
  };
}
