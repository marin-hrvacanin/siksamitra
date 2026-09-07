/**
 * THE token source. Every design value in this program starts here.
 *
 * Nothing downstream may contain a literal colour, face, size, radius, weight
 * or duration: the stylesheets, the TypeScript modules and the export style
 * tables are all GENERATED from this file, and `npm run check:tokens` fails
 * the build on any literal it finds elsewhere.
 *
 * The rules this file exists to make true:
 *
 *   - Adding a THEME is one entry in `THEMES`. No component ever names a theme.
 *   - Changing a FACE is one edit in `FONTS`. A component names a ROLE.
 *   - Changing a COLOUR is one edit in `BASE` or a theme's patch.
 *
 * Values seeded from the platform's own measured tokens (tools/seed-tokens.mjs)
 * so that nothing was retyped, and therefore nothing quietly changed.
 */

/** A face, named by what it is FOR rather than by what it is. */
export interface FontRole {
  readonly note: string;
  /** Ordered fallbacks. First that resolves wins. */
  readonly stack: readonly string[];
}

export const FONTS = {
  display: {
    note: "Titles and the reading face for a document heading.",
    stack: [
      "\"Cormorant Garamond\"",
      "\"Gentium Book Plus\"",
      "\"EB Garamond\"",
      "\"Noto Serif Devanagari\"",
      "\"Noto Serif Tamil\"",
      "\"Noto Serif Telugu\"",
      "\"Noto Serif Bengali\"",
      "\"Noto Serif Kannada\"",
      "\"Noto Serif Malayalam\"",
      "\"Noto Serif Gurmukhi\"",
      "\"Noto Serif Gujarati\"",
      "\"Noto Serif Sinhala\"",
      "\"Noto Sans Tibetan\"",
      "Georgia",
      "\"Times New Roman\"",
      "serif",
    ],
  },
  body: {
    note: "The reading face. This is the one a chant is actually read in.",
    stack: [
      "\"Gentium Book Plus\"",
      "\"EB Garamond\"",
      "\"Noto Serif Devanagari\"",
      "\"Noto Serif Tamil\"",
      "\"Noto Serif Telugu\"",
      "\"Noto Serif Bengali\"",
      "\"Noto Serif Kannada\"",
      "\"Noto Serif Malayalam\"",
      "\"Noto Serif Gurmukhi\"",
      "\"Noto Serif Gujarati\"",
      "\"Noto Serif Sinhala\"",
      "\"Noto Sans Tibetan\"",
      "Georgia",
      "\"Times New Roman\"",
      "serif",
    ],
  },
  ui: {
    note: "Tool chrome. Never used for text being edited.",
    stack: [
      "\"Hanken Grotesk\"",
      "\"Noto Serif Devanagari\"",
      "\"Noto Serif Tamil\"",
      "\"Noto Serif Telugu\"",
      "\"Noto Serif Bengali\"",
      "\"Noto Serif Kannada\"",
      "\"Noto Serif Malayalam\"",
      "\"Noto Serif Gurmukhi\"",
      "\"Noto Serif Gujarati\"",
      "\"Noto Serif Sinhala\"",
      "\"Noto Sans Tibetan\"",
      "-apple-system",
      "BlinkMacSystemFont",
      "\"Segoe UI\"",
      "system-ui",
      "sans-serif",
    ],
  },
  deva: {
    note: "Devanagari-first stack, where the body face lacks the coverage.",
    stack: [
      "\"Noto Serif Devanagari\"",
      "\"Cormorant Garamond\"",
      "serif",
    ],
  },
} as const satisfies Record<string, FontRole>;

export type FontRoleName = keyof typeof FONTS;

/**
 * The default token set. A theme is this, patched.
 *
 * Names are semantic where they can be (`ink`, `rule`, `svara`) because a
 * token named for its value cannot be re-themed.
 */
export const BASE = {
  "color-vellum": "#faf7f0",
  "color-vellum-dim": "#f3edde",
  "color-vellum-warm": "#ebe2cc",
  "color-ink": "#2a1b47",
  "color-ink-soft": "#3a2862",
  "color-ink-mute": "#6b5c7e",
  "color-ink-light": "#9a8fa8",
  "color-rule": "#d5cfc1",
  "color-rule-strong": "#b8b1a0",
  "color-rule-violet": "#c8b9d8",
  "color-violet": "#5e3fa0",
  "color-violet-deep": "#432c75",
  "color-violet-glow": "#8b6ec8",
  "color-violet-bloom": "#a386cf",
  "color-gold": "#b58e4a",
  "color-gold-deep": "#8d6d34",
  "color-gold-light": "#d6b277",
  "text-display": "7rem",
  "text-display-sm": "4rem",
  "text-headline": "3.25rem",
  "text-eyebrow": "0.75rem",
  "ease-out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
  "ease-in-out-quart": "cubic-bezier(0.76, 0, 0.24, 1)",
  "radius-xs": "2px",
  "radius-sm": "3px",
  "radius-md": "5px",
  "radius-lg": "7px",
  "radius-xl": "9px",
  "radius-2xl": "12px",
  "radius-3xl": "16px",
  "radius-full": "999px",
  "radius": "5px",
  "radius-control": "5px",
  "radius-card": "7px",
  "radius-pill": "999px",
  "icon-stroke": "1.6",
  "color-danger": "#a5443a",
  "color-danger-soft": "#c46a5f",
  "color-bg": "#faf7f0",
  "color-bg-alt": "#f3edde",
  "color-surface": "#faf7f0",
  "color-border": "#d5cfc1",
  "color-brand": "#5e3fa0",
  "color-brand-muted": "#8b6ec8",
  "color-svara": "#b23a2e",
  "color-hold": "#4e7a3f",
  "color-change": "#3d6fb4",
  "color-pause-short": "#3d6fb4",
  "color-pause-long": "#b23a2e",
  "shadow-sm": "0 1px 2px rgba(42, 27, 71, 0.06)",
  "shadow-md": "0 6px 24px -8px rgba(42, 27, 71, 0.16)",
  "shadow-lg": "0 18px 50px -18px rgba(42, 27, 71, 0.28)",
  /* ── spacing ──────────────────────────────────────────────────────────────
     A geometric-ish scale in rem, so every gap in the program is one of nine
     values and all of them scale with the root. Literal spacing is how a
     stylesheet ends up with 0.45rem next to 0.5rem next to 7px, each chosen by
     a different person on a different day. */
  "space-0": "0",
  "space-1": "0.125rem",
  "space-2": "0.25rem",
  "space-3": "0.375rem",
  "space-4": "0.5rem",
  "space-5": "0.75rem",
  "space-6": "1rem",
  "space-7": "1.5rem",
  "space-8": "2rem",
  "space-9": "3rem",

  /* ── chrome type ──────────────────────────────────────────────────────────
     The tool's own text, one step below the document's. Chrome should be
     legible and unobtrusive rather than competing with what is being read. */
  "text-ui": "0.72rem",
  "text-ui-sm": "0.66rem",
  "text-ui-lg": "0.8rem",
  "text-brand": "0.95rem",

  /* ── control geometry ─────────────────────────────────────────────────── */
  "control-h": "1.55rem",
  "toolbar-h": "2.25rem",
  "status-h": "1.5rem",
  "gutter": "3rem",
  "measure-pad": "2rem",
  /* Minimum widths. A ribbon group narrower than `group-min` has collapsed to
     nothing useful, and a menu narrower than `menu-min` wraps its own labels —
     both are design decisions about how small a thing may get, which is why
     they are here and not in the three stylesheets that used to hold them. */
  "group-min": "4rem",
  "menu-min": "11rem",
  "panel-min": "13rem",

  /* ── borders ──────────────────────────────────────────────────────────────
     A hairline is ONE DEVICE PIXEL and is deliberately not relative: scaled
     with the text it becomes a visible rule at large sizes and vanishes at
     small ones, and its job is to be the thinnest line the screen can draw. */
  "border-hair": "1px",
  "border-thick": "0.125rem",

  /* ── the document's own presentation ─────────────────────────────────────
     Separate from the chrome tokens above, because the two answer different
     questions: chrome should recede, and the document should be read. A theme
     that wants a different reading register — the website's, say — patches
     these and leaves the tool alone. */
  "doc-bg": "#faf7f0",
  "doc-ink": "#2a1b47",
  "doc-size": "1rem",
  "doc-leading": "1.9",
  "doc-title-size": "1.35rem",
  "doc-title-face": "var(--font-display)",
  "doc-pad": "2rem",
  "doc-verse-gap": "1.15rem",

} as const;

export type TokenName = keyof typeof BASE;

export interface Theme {
  /**
   * Which colour scheme this theme IS.
   *
   * The generator wires it to `prefers-color-scheme` from this field, so
   * nothing anywhere hardcodes the word "dark" to mean the dark theme — which
   * is what lets a second dark theme, or a high-contrast one, be added without
   * editing a stylesheet.
   */
  readonly scheme: 'light' | 'dark';
  /** What it changes about `BASE`. Everything unlisted is inherited. */
  readonly patch: Partial<Record<TokenName, string>>;
}

/**
 * Themes. Each is a PATCH over `BASE`, resolved by the generator to a complete
 * set, so a theme can never be half-defined.
 *
 * Adding one is an entry here and nothing else. If adding a theme ever requires
 * touching a component, that component is reading something it should not.
 */
export const THEMES = {
  light: { scheme: 'light', patch: {} },
  dark: {
    scheme: 'dark',
    patch: {
      "color-vellum": "#171226",
      "color-vellum-dim": "#1f1834",
      "color-vellum-warm": "#292040",
      "color-ink": "#ece7f6",
      "color-ink-soft": "#d3cae6",
      "color-ink-mute": "#a89dc2",
      "color-ink-light": "#988cb2",
      "color-rule": "#362c4e",
      "color-rule-strong": "#4a3f66",
      "color-rule-violet": "#483b66",
      "color-violet": "#a98cdb",
      "color-violet-deep": "#8567c0",
      "color-violet-glow": "#bda6ea",
      "color-violet-bloom": "#ccbcf1",
      "color-gold": "#cba766",
      "color-gold-deep": "#b18f4f",
      "color-gold-light": "#e2c78d",
      "color-danger": "#e08a7e",
      "color-danger-soft": "#c46a5f",
      "color-svara": "#f0836f",
      "color-hold": "#86c06f",
      "color-change": "#86a9e6",
      "color-pause-short": "#86a9e6",
      "color-pause-long": "#f0836f",
      "shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.4)",
      "shadow-md": "0 6px 24px -8px rgba(0, 0, 0, 0.55)",
      "shadow-lg": "0 18px 50px -18px rgba(0, 0, 0, 0.65)",
    },
  },
  /**
   * How the document reads on vedaunion.org.
   *
   * Pinned by the `web` view (see layout/view.ts) because the point of that
   * mode is to show the PLATFORM's appearance — a preview the author can
   * re-colour is a preview of nothing.
   *
   * It patches the document register, not the chrome: the site sets its text
   * larger and more open than a tool would, on the warm ground the site uses,
   * with the display face for headings. The tool's own chrome stays exactly as
   * it is, because the author has not gone anywhere.
   */
  'vu-web': {
    scheme: 'light',
    patch: {
      "doc-bg": "#faf7f0",
      "doc-ink": "#2a1b47",
      "doc-size": "1.15rem",
      "doc-leading": "2.05",
      "doc-title-size": "1.75rem",
      "doc-pad": "3rem",
      "doc-verse-gap": "1.5rem",
      "color-vellum": "#faf7f0",
    },
  },
} as const satisfies Record<string, Theme>;

export type ThemeName = keyof typeof THEMES;

/** What a reader gets before expressing any preference. */
export const DEFAULT_THEME: ThemeName = 'light';

/**
 * Mark geometry — how a siksa mark is DRAWN, in em unless a name says px.
 *
 * These are measured, not chosen: the short and long holding strokes must stay
 * distinguishable at every text size, which is why `minPx` exists.
 */
export const MARK_GEOMETRY = {
  "holdPad": {
    "top": 0.1,
    "x": 0.07,
    "bottom": 0.12
  },
  "holdMargin": 0.03,
  "holdStroke": {
    "short": 0.032,
    "long": 0.075,
    "minPx": 1
  },
  "holdRadius": "var(--radius-sm)",
  "svaraStroke": {
    "widthPx": 3,
    "height": 0.34,
    "top": -0.36,
    "dirghaSepPx": 3.5,
    "radiusPx": 1.5
  },
  "anudattaRule": {
    "thickness": 0.035,
    "drop": 0.14
  },
  "sbhaktiDot": {
    "r": 0.055,
    "gap": 0.05
  },
  "supScale": 0.668
} as const;
