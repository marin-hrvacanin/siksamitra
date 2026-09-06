/**
 * GENERATED — do not edit. Run: npm run gen:tokens
 *
 * Source of truth: the `@theme` block in client/src/index.css, plus the
 * `:root[data-theme="dark"]` overrides. See
 * specs/chant-editor/06-SINGLE-SOURCE.md §3.1.
 *
 * `var(--…)` references are resolved here so non-CSS consumers (the PDF
 * writer, PowerPoint, Python tooling) get concrete values. In CSS and TSX,
 * always use `var(--token)` directly — never import these.
 */

export const DESIGN_TOKENS = {
  "light": {
    "--color-vellum": "#faf7f0",
    "--color-vellum-dim": "#f3edde",
    "--color-vellum-warm": "#ebe2cc",
    "--color-ink": "#2a1b47",
    "--color-ink-soft": "#3a2862",
    "--color-ink-mute": "#6b5c7e",
    "--color-ink-light": "#9a8fa8",
    "--color-rule": "#d5cfc1",
    "--color-rule-strong": "#b8b1a0",
    "--color-rule-violet": "#c8b9d8",
    "--color-violet": "#5e3fa0",
    "--color-violet-deep": "#432c75",
    "--color-violet-glow": "#8b6ec8",
    "--color-violet-bloom": "#a386cf",
    "--color-gold": "#b58e4a",
    "--color-gold-deep": "#8d6d34",
    "--color-gold-light": "#d6b277",
    "--font-display": "\"Cormorant Garamond\", \"Gentium Book Plus\", \"EB Garamond\", \"Noto Serif Devanagari\", \"Noto Serif Tamil\", \"Noto Serif Telugu\", \"Noto Serif Bengali\", \"Noto Serif Kannada\", \"Noto Serif Malayalam\", \"Noto Serif Gurmukhi\", \"Noto Serif Gujarati\", \"Noto Serif Sinhala\", \"Noto Sans Tibetan\", Georgia, \"Times New Roman\", serif",
    "--font-body": "\"Gentium Book Plus\", \"EB Garamond\", \"Noto Serif Devanagari\", \"Noto Serif Tamil\", \"Noto Serif Telugu\", \"Noto Serif Bengali\", \"Noto Serif Kannada\", \"Noto Serif Malayalam\", \"Noto Serif Gurmukhi\", \"Noto Serif Gujarati\", \"Noto Serif Sinhala\", \"Noto Sans Tibetan\", Georgia, \"Times New Roman\", serif",
    "--font-grotesk": "\"Hanken Grotesk\", \"Noto Serif Devanagari\", \"Noto Serif Tamil\", \"Noto Serif Telugu\", \"Noto Serif Bengali\", \"Noto Serif Kannada\", \"Noto Serif Malayalam\", \"Noto Serif Gurmukhi\", \"Noto Serif Gujarati\", \"Noto Serif Sinhala\", \"Noto Sans Tibetan\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", system-ui, sans-serif",
    "--font-deva": "\"Noto Serif Devanagari\", \"Cormorant Garamond\", serif",
    "--text-display": "7rem",
    "--text-display-sm": "4rem",
    "--text-headline": "3.25rem",
    "--text-eyebrow": "0.75rem",
    "--ease-out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
    "--ease-in-out-quart": "cubic-bezier(0.76, 0, 0.24, 1)",
    "--radius-xs": "2px",
    "--radius-sm": "3px",
    "--radius-md": "5px",
    "--radius-lg": "7px",
    "--radius-xl": "9px",
    "--radius-2xl": "12px",
    "--radius-3xl": "16px",
    "--radius-full": "999px",
    "--radius": "5px",
    "--radius-control": "5px",
    "--radius-card": "7px",
    "--radius-pill": "999px",
    "--icon-stroke": "1.6",
    "--color-danger": "#a5443a",
    "--color-danger-soft": "#c46a5f",
    "--color-bg": "#faf7f0",
    "--color-bg-alt": "#f3edde",
    "--color-surface": "#faf7f0",
    "--color-border": "#d5cfc1",
    "--color-brand": "#5e3fa0",
    "--color-brand-muted": "#8b6ec8",
    "--color-svara": "#b23a2e",
    "--color-hold": "#4e7a3f",
    "--color-change": "#3d6fb4",
    "--color-pause-short": "#3d6fb4",
    "--color-pause-long": "#b23a2e",
    "--shadow-sm": "0 1px 2px rgba(42, 27, 71, 0.06)",
    "--shadow-md": "0 6px 24px -8px rgba(42, 27, 71, 0.16)",
    "--shadow-lg": "0 18px 50px -18px rgba(42, 27, 71, 0.28)"
  },
  "dark": {
    "--color-vellum": "#171226",
    "--color-vellum-dim": "#1f1834",
    "--color-vellum-warm": "#292040",
    "--color-ink": "#ece7f6",
    "--color-ink-soft": "#d3cae6",
    "--color-ink-mute": "#a89dc2",
    "--color-ink-light": "#988cb2",
    "--color-rule": "#362c4e",
    "--color-rule-strong": "#4a3f66",
    "--color-rule-violet": "#483b66",
    "--color-violet": "#a98cdb",
    "--color-violet-deep": "#8567c0",
    "--color-violet-glow": "#bda6ea",
    "--color-violet-bloom": "#ccbcf1",
    "--color-gold": "#cba766",
    "--color-gold-deep": "#b18f4f",
    "--color-gold-light": "#e2c78d",
    "--color-danger": "#e08a7e",
    "--color-danger-soft": "#c46a5f",
    "--color-svara": "#f0836f",
    "--color-hold": "#86c06f",
    "--color-change": "#86a9e6",
    "--color-pause-short": "#86a9e6",
    "--color-pause-long": "#f0836f",
    "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.4)",
    "--shadow-md": "0 6px 24px -8px rgba(0, 0, 0, 0.55)",
    "--shadow-lg": "0 18px 50px -18px rgba(0, 0, 0, 0.65)"
  }
} as const;

export type DesignTokenName = keyof typeof DESIGN_TOKENS.light;

/** A token's value in a theme, falling back to light when dark omits it. */
export function token(name: string, theme: 'light' | 'dark' = 'light'): string {
  const d = DESIGN_TOKENS.dark as Record<string, string>;
  const l = DESIGN_TOKENS.light as Record<string, string>;
  if (theme === 'dark' && d[name] !== undefined) return d[name] as string;
  return (l[name] ?? '') as string;
}
