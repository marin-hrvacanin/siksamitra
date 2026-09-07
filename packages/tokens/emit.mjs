/**
 * THE EMITTERS — a theme in, custom properties out.
 *
 * Split from `gen.mjs` when that file crossed 400 lines, which is the limit
 * the module gate holds new code to. The division is the honest one: this file
 * knows what a token IS for each of the three axes — the instrument, the page,
 * the density — and `gen.mjs` knows what a FILE looks like. Neither needs the
 * other's detail.
 *
 * Every function here is pure: same theme in, same properties out, no reading
 * and no writing. That is what lets the generator be run twice — once to
 * write, once to check — and get the same answer.
 */
import { WORD_PAGE } from './src/word.ts';
import { CHROME_SCALES, MONO_FACE, TEXT_FACES, UI_FACES } from './src/fonts.ts';
import { DOC_ROLES } from './src/document-type.ts';
import { typeScaleOf } from './src/document-themes.ts';

export const MODES = ['light', 'dark'];

/** The density steps, by name — the third axis. */
export const DENSITIES = Object.keys(CHROME_SCALES);

/**
 * The column-tracking coefficient for a fluid size, in `cqi`.
 *
 * Chosen so the role reaches its full size exactly at a full page's text
 * column and shrinks only below that. The inherited `3.1cqi` was tuned against
 * a card in the platform's reader, and once the document column became a real
 * container it put a 19.44 pt mantra line at 13.99 pt — smaller than the Word
 * theme it is meant to be the roomier alternative to.
 */
const cqiFor = (rem) => ((rem * 16) / ((WORD_PAGE.contentPt / 72) * 96)) * 100;

/** Flatten mark geometry to custom properties: `--mark-holdStroke-short`. */
export function flatten(obj, prefix, into = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = `${prefix}-${k}`;
    if (v !== null && typeof v === 'object') flatten(v, key, into);
    else into[key] = String(v);
  }
  return into;
}

export const decl = (vars, indent = '  ') => Object.entries(vars)
  .map(([k, v]) => `${indent}--${k}: ${v};`).join('\n');

/**
 * The chrome tokens a theme+mode produces.
 *
 * NOT including the scale: how condensed the shell is became a third
 * independent axis, because it is a preference about the person's screen and
 * eyes rather than a property of a palette. A theme still names a DEFAULT
 * scale, used until the reader chooses.
 */
export function chromeVars(theme, mode) {
  const c = theme[mode];
  return {
    'chrome-bg': c.bg,
    'chrome-raise': c.raise,
    'chrome-sunk': c.sunk,
    'chrome-desk': c.desk,
    'chrome-line': c.line,
    'chrome-line-soft': c.lineSoft,
    'chrome-ink': c.ink,
    'chrome-ink-soft': c.inkSoft,
    'chrome-ink-mute': c.inkMute,
    'chrome-accent': c.accent,
    'chrome-accent-hover': c.accentHover,
    'chrome-accent-on': c.accentOn,
    'chrome-danger': c.danger,
    /* The window's own title bar — see `ChromeMode.title`. */
    'chrome-title': c.title,
    'chrome-title-ink': c.titleInk,
    'chrome-radius': `${theme.radius}px`,
    'chrome-shadow': theme.elevation === 'flat'
      ? 'none'
      : (mode === 'dark' ? '0 2px 14px rgba(0,0,0,.5)' : '0 1px 3px rgba(0,0,0,.10)'),
    'chrome-shadow-lift': theme.elevation === 'flat'
      ? 'none'
      : (mode === 'dark' ? '0 6px 26px rgba(0,0,0,.6)' : '0 3px 16px rgba(0,0,0,.15)'),
    'font-ui': UI_FACES[theme.face],
    'font-mono': MONO_FACE,
  };
}

/** The scale tokens for one density. The third axis. */
export function densityVars(name) {
  const s = CHROME_SCALES[name];
  return {
    'toolbar-h': s.toolbar,
    'status-h': s.status,
    'text-ui': s.text,
    'control-h': s.control,
    'chrome-gap': s.gap,
    'titlebar-h': s.titlebar,
    'tabs-h': s.tabs,
    'ribbon-h': s.ribbon,
    'rbb-lg-w': s.bigButton,
  };
}

/** The document tokens a theme+mode produces. */
export function documentVars(theme, mode) {
  const d = theme[mode];
  return {
    'doc-bg': d.bg,
    'doc-ink': d.ink,
    'doc-line': d.line,
    'doc-heading': d.heading,
    'doc-quiet': d.quiet,
    'doc-fill': d.fill,
    'doc-size': `${theme.size}rem`,
    'doc-leading': String(theme.leading),
    /* The translation's register. Mixed from this paper's own ink when the
       theme does not name one, so adding a theme never leaves a translation
       resolving to nothing. */
    'doc-soft': d.soft ?? `color-mix(in srgb, ${d.ink} 74%, ${d.bg})`,
    'font-body': TEXT_FACES[theme.face],
    'font-display': TEXT_FACES[theme.face],
    /* The marks. On the DOCUMENT axis because they must be legible against this
       paper — switching the shell must never be able to hide a svara. */
    'color-hold': d.hold,
    'color-hold-long': d.holdLong,
    'color-svara': d.svara,
    'color-change': d.change,
    'color-pause-short': d.pauseShort,
    'color-pause-long': d.pauseLong,
  };
}

/**
 * The type scale, as custom properties — one block per document theme.
 *
 * Emitted OUTSIDE the light/dark blocks because type does not change with the
 * mode: the same page, differently lit. Colours that belong to a role are
 * emitted here too, but every one of them is either a measured value from his
 * file or a reference into the mode's own palette, so they follow the mode
 * through the indirection rather than by being repeated.
 *
 * A fluid role becomes a `clamp()`: the floor, the column-tracking middle and
 * the size. `cqi` is the width of the document column — see `document.css`,
 * which makes the column a container — so a mantra line gives up type size
 * rather than wrapping. A role with no floor is one fixed number, which is
 * what a facsimile of an A4 page needs.
 *
 * ZOOM IS A MULTIPLIER IN THE TOKEN, `--doc-zoom`, set by the views. So every
 * length here is a finished CSS expression — `calc(1.3333rem * var(--doc-zoom))`
 * — and the stylesheet never does arithmetic.
 *
 * Two wrong ways were tried first, and both are instructive. Plain `rem`
 * ignores zoom, which is what the inherited stylesheet did: pressing Zoom in
 * grew the paper and left the mantra line at 19.44 pt. Plain `em` off a column
 * whose own font-size carried the zoom fixes the type but breaks the indents,
 * because a margin in `em` resolves against the ELEMENT's size — a 14.2 pt
 * hanging indent came out 18.93 pt on a 16 pt line, exactly the 1.33 ratio
 * between them. An explicit multiplier has neither failure.
 *
 * The fluid middle term is NOT multiplied: `cqi` is a share of the column, and
 * the column already widens with zoom, so multiplying again would square it.
 */
/** A length in rem, times the zoom. `0` stays `0`, which reads better. */
export const zoomed = (rem) => (rem === 0 ? '0px' : `calc(${rem}rem * var(--doc-zoom))`);

export function typeVars(theme) {
  const scale = typeScaleOf(theme);
  const face = (role) => {
    if (role === 'text') return TEXT_FACES[theme.face];
    if (role === 'display') return theme.faces?.display ?? TEXT_FACES[theme.face];
    if (role === 'serif') return theme.faces?.serif ?? TEXT_FACES[theme.face];
    return theme.faces?.ui ?? 'var(--font-ui)';
  };
  const out = {
    /* Not a role: whether the page draws a verse number of its own. `inline`
       means the document already prints one in the line. */
    'doc-number-display': theme.numbers === 'inline' ? 'none' : 'inline-block',
    /* The gutter a page-drawn verse number lives in. Zero where the document
       prints the number itself, so nothing reserves space for it. */
    'doc-gutter': theme.numbers === 'inline' ? '0px' : zoomed(theme.size * 2.4),
  };
  for (const role of DOC_ROLES) {
    const m = scale[role];
    out[`doc-${role}-size`] = m.floor === null
      ? zoomed(m.size)
      : `clamp(${zoomed(m.floor)}, ${cqiFor(m.size).toFixed(3)}cqi, ${zoomed(m.size)})`;
    out[`doc-${role}-lead`] = String(m.leading);
    out[`doc-${role}-after`] = zoomed(m.after);
    out[`doc-${role}-indent`] = zoomed(m.indent);
    out[`doc-${role}-hanging`] = zoomed(m.hanging);
    out[`doc-${role}-right`] = zoomed(m.right);
    out[`doc-${role}-face`] = face(m.face);
    out[`doc-${role}-style`] = m.italic ? 'italic' : 'normal';
    out[`doc-${role}-weight`] = m.bold ? '700' : '400';
    out[`doc-${role}-color`] = m.color;
  }
  return out;
}

/**
 * Aliases for the inherited stylesheet.
 *
 * `chant.css` arrived from the platform naming `--color-vellum`, `--color-ink`
 * and friends. Rather than rewrite 841 lines of it against a size baseline,
 * those names are mapped onto the new ones here, once. They are DEPRECATED: new
 * code names `--chrome-*` or `--doc-*`, and this block shrinks as chant.css is
 * migrated.
 */
/**
 * Aliases for the inherited stylesheet — EMITTED PER THEME.
 *
 * The subtle part, and it was wrong: a custom property whose value is
 * `var(--other)` is resolved where it is DECLARED, not where it is used. So
 * declaring `--color-ink: var(--doc-ink)` once on `:root` froze it at the
 * DEFAULT theme's ink and every theme after that inherited a light-mode value.
 * Invisible in light mode; in dark mode the marks layer painted itself white
 * with near-black text — a white page inside a dark one, unreadable.
 *
 * Emitting the block inside each theme's own rule makes every alias resolve
 * against that theme's tokens, which is what an alias is for.
 */
export function legacyAliases() {
  return {
    'color-vellum': 'var(--chrome-raise)',
    'color-vellum-dim': 'var(--chrome-bg)',
    'color-vellum-warm': 'var(--chrome-sunk)',
    'color-rule': 'var(--chrome-line)',
    'color-rule-strong': 'var(--chrome-line)',
    'color-rule-violet': 'var(--chrome-line-soft)',
    'color-ink': 'var(--doc-ink)',
    'color-ink-soft': 'var(--chrome-ink-soft)',
    'color-ink-mute': 'var(--chrome-ink-mute)',
    'color-ink-light': 'var(--chrome-ink-mute)',
    'color-violet': 'var(--chrome-accent)',
    'color-violet-deep': 'var(--chrome-accent-hover)',
    'color-violet-glow': 'var(--chrome-accent)',
    'color-violet-bloom': 'var(--chrome-accent)',
    'color-gold': 'var(--chrome-accent)',
    'color-gold-deep': 'var(--chrome-accent-hover)',
    'color-gold-light': 'var(--chrome-accent)',
    'color-surface': 'var(--chrome-raise)',
    'color-bg': 'var(--chrome-bg)',
    'color-bg-alt': 'var(--chrome-sunk)',
    'color-border': 'var(--chrome-line)',
    'color-brand': 'var(--chrome-accent)',
    'color-danger': 'var(--chrome-danger)',
    'color-danger-soft': 'var(--chrome-danger)',

    /*
     * The MARK aliases, `--c-*`.
     *
     * The renderer's mark rules (`chant.css`, `mark-geometry.css`) name these,
     * and that stylesheet declared them on `.chant-root, .chant-marks` — which
     * also PAINTED, so any surface that wanted the marks got the reader's
     * background too. In dark mode the editor's page was a white rectangle
     * inside the dark one, because those aliases were frozen at the default
     * theme's values.
     *
     * Emitted here instead, per theme: a mark resolves its colour wherever it
     * is drawn, no class from the inherited file is needed, and that file —
     * which this program is shrinking, not growing — stays untouched.
     */
    'c-bg': 'var(--doc-bg)',
    'c-bg-raise': 'var(--chrome-raise)',
    'c-bg-sink': 'var(--chrome-sunk)',
    'c-ink': 'var(--doc-ink)',
    'c-ink-soft': 'var(--doc-soft)',
    'c-ink-mute': 'var(--doc-quiet)',
    'c-line': 'var(--doc-line)',
    'c-line-soft': 'var(--chrome-line-soft)',
    'c-violet': 'var(--chrome-accent)',
    'c-violet-soft': 'var(--chrome-accent)',
    'c-svara': 'var(--color-svara)',
    'c-hold': 'var(--color-hold)',
    'c-change': 'var(--color-change)',
    'c-pause-short': 'var(--color-pause-short)',
    'c-pause-long': 'var(--color-pause-long)',
  };
}
