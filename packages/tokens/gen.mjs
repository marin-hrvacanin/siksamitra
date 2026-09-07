#!/usr/bin/env node
/**
 * Generate every consumer of the design tokens.
 *
 * TWO INDEPENDENT AXES, and the CSS shape follows from that:
 *
 *   [data-chrome="palladio"][data-mode="light"]   the instrument
 *   [data-doc="warm"][data-mode="light"]          the page
 *
 * They are separate attributes on separate elements, so any chrome may be worn
 * with any document theme — thirty combinations from eleven entries, none of
 * them special-cased. A single combined theme would have needed thirty entries
 * and would still have been the wrong shape, because the two things answer to
 * different people at different moments: the shell to whoever is sitting there
 * for two hours, the page to whatever is being proofed.
 *
 * The typed source is the master and CSS is one of its outputs, not the other
 * way round. The platform this came from parsed a stylesheet to produce its
 * tokens, which leaves every non-CSS consumer — the Word style table, the print
 * sheet, Python tooling — downstream of a text parse.
 *
 *   node packages/tokens/gen.mjs
 *   node packages/tokens/gen.mjs --check    # exit 1 if anything would change
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'generated');
const check = process.argv.includes('--check');

const { BASE, MARK_GEOMETRY } = await import('./src/source.ts');
const { CHROME_THEMES, DEFAULT_CHROME } = await import('./src/chrome-themes.ts');
const { DOCUMENT_THEMES, DEFAULT_DOCUMENT } = await import('./src/document-themes.ts');
const { CHROME_SCALES, MONO_FACE, TEXT_FACES, UI_FACES } = await import('./src/fonts.ts');

const MODES = ['light', 'dark'];

/** Flatten mark geometry to custom properties: `--mark-holdStroke-short`. */
function flatten(obj, prefix, into = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = `${prefix}-${k}`;
    if (v !== null && typeof v === 'object') flatten(v, key, into);
    else into[key] = String(v);
  }
  return into;
}

const decl = (vars, indent = '  ') => Object.entries(vars)
  .map(([k, v]) => `${indent}--${k}: ${v};`).join('\n');

/**
 * The chrome tokens a theme+mode produces.
 *
 * NOT including the scale: how condensed the shell is became a third
 * independent axis, because it is a preference about the person's screen and
 * eyes rather than a property of a palette. A theme still names a DEFAULT
 * scale, used until the reader chooses.
 */
function chromeVars(theme, mode) {
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
function densityVars(name) {
  const s = CHROME_SCALES[name];
  return {
    'toolbar-h': s.toolbar,
    'status-h': s.status,
    'text-ui': s.text,
    'control-h': s.control,
    'chrome-gap': s.gap,
  };
}

/** The document tokens a theme+mode produces. */
function documentVars(theme, mode) {
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
 * Aliases for the inherited stylesheet.
 *
 * `chant.css` arrived from the platform naming `--color-vellum`, `--color-ink`
 * and friends. Rather than rewrite 841 lines of it against a size baseline,
 * those names are mapped onto the new ones here, once. They are DEPRECATED: new
 * code names `--chrome-*` or `--doc-*`, and this block shrinks as chant.css is
 * migrated.
 */
function legacyAliases() {
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
  };
}

const scaleVars = Object.fromEntries(
  Object.entries(BASE).filter(([k]) => !k.startsWith('color-') && !k.startsWith('doc-')),
);
const geometry = flatten(MARK_GEOMETRY, 'mark');

// ── CSS ─────────────────────────────────────────────────────────────────────
const css = `/* GENERATED by packages/tokens/gen.mjs. Do not edit.
 *
 * ${CHROME_THEMES.length} chrome themes x ${DOCUMENT_THEMES.length} document themes x ${MODES.length} modes.
 * Two independent attributes, so any shell may be worn with any page.
 *
 *   <html data-mode="light|dark">
 *   <div  data-chrome="palladio">   the instrument
 *   <div  data-doc="warm">          the page
 */

/* Scales, geometry and anything that does not vary by theme. */
:root {
${decl({ ...scaleVars, ...geometry })}
}

/* The defaults, so an unthemed subtree is still legible. */
:root {
${decl(chromeVars(CHROME_THEMES.find((t) => t.id === DEFAULT_CHROME), 'light'))}
${decl(documentVars(DOCUMENT_THEMES.find((t) => t.id === DEFAULT_DOCUMENT), 'light'))}
${decl(densityVars(CHROME_THEMES.find((t) => t.id === DEFAULT_CHROME).scale))}
${decl(legacyAliases())}
}
${Object.keys(CHROME_SCALES).map((name) => `
[data-density="${name}"] {
${decl(densityVars(name))}
}`).join('')}
${CHROME_THEMES.flatMap((theme) => MODES.map((mode) => `
[data-chrome="${theme.id}"]${mode === 'light' ? ':not([data-mode="dark"])' : '[data-mode="dark"]'},
[data-mode="${mode}"] [data-chrome="${theme.id}"] {
${decl(chromeVars(theme, mode))}
}`)).join('')}
${DOCUMENT_THEMES.flatMap((theme) => MODES.map((mode) => `
[data-doc="${theme.id}"]${mode === 'light' ? ':not([data-mode="dark"])' : '[data-mode="dark"]'},
[data-mode="${mode}"] [data-doc="${theme.id}"] {
${decl(documentVars(theme, mode))}
}`)).join('')}
`;

// ── TypeScript ──────────────────────────────────────────────────────────────
const ts = `/* GENERATED by packages/tokens/gen.mjs. Do not edit. */

export const CHROME_IDS = ${JSON.stringify(CHROME_THEMES.map((t) => t.id))} as const;
export const DOCUMENT_IDS = ${JSON.stringify(DOCUMENT_THEMES.map((t) => t.id))} as const;
export const MODES = ${JSON.stringify(MODES)} as const;

export type ChromeId = (typeof CHROME_IDS)[number];
export type DocumentId = (typeof DOCUMENT_IDS)[number];
export type Mode = (typeof MODES)[number];

export const DEFAULT_CHROME = ${JSON.stringify(DEFAULT_CHROME)};
export const DEFAULT_DOCUMENT = ${JSON.stringify(DEFAULT_DOCUMENT)};

export const DENSITIES = ${JSON.stringify(Object.keys(CHROME_SCALES))} as const;
export type Density = (typeof DENSITIES)[number];

/** Each chrome theme's default density, until the reader chooses one. */
export const CHROME_DENSITY: Readonly<Record<string, string>> = ${JSON.stringify(
  Object.fromEntries(CHROME_THEMES.map((t) => [t.id, t.scale])), null, 2)};

export const DENSITY_CHOICES = [
  { id: 'compact', name: 'Compact', note: 'The most on screen. Small controls, tight rows.' },
  { id: 'regular', name: 'Regular', note: 'The middle setting.' },
  { id: 'roomy', name: 'Roomy', note: 'Larger controls and more air. Easier at a distance.' },
];

/** What to show in a theme picker: id, name, and one line of why. */
export const CHROME_CHOICES = ${JSON.stringify(
  CHROME_THEMES.map((t) => ({ id: t.id, name: t.name, note: t.note })), null, 2)};

export const DOCUMENT_CHOICES = ${JSON.stringify(
  DOCUMENT_THEMES.map((t) => ({ id: t.id, name: t.name, note: t.note })), null, 2)};

/** Resolved values, for consumers that cannot read CSS (Word export, print). */
export const CHROME_TOKENS = ${JSON.stringify(
  Object.fromEntries(CHROME_THEMES.map((t) => [t.id,
    Object.fromEntries(MODES.map((m) => [m, chromeVars(t, m)]))])), null, 2)};

export const DOCUMENT_TOKENS = ${JSON.stringify(
  Object.fromEntries(DOCUMENT_THEMES.map((t) => [t.id,
    Object.fromEntries(MODES.map((m) => [m, documentVars(t, m)]))])), null, 2)};
`;

const json = JSON.stringify({
  generated: 'packages/tokens/gen.mjs',
  chromeThemes: CHROME_THEMES.map((t) => t.id),
  documentThemes: DOCUMENT_THEMES.map((t) => t.id),
  defaults: { chrome: DEFAULT_CHROME, document: DEFAULT_DOCUMENT },
  scales: scaleVars,
  markGeometry: MARK_GEOMETRY,
  chrome: Object.fromEntries(CHROME_THEMES.map((t) => [t.id,
    Object.fromEntries(MODES.map((m) => [m, chromeVars(t, m)]))])),
  document: Object.fromEntries(DOCUMENT_THEMES.map((t) => [t.id,
    Object.fromEntries(MODES.map((m) => [m, documentVars(t, m)]))])),
}, null, 2) + '\n';

const files = [['tokens.css', css], ['tokens.ts', ts], ['tokens.json', json]];

if (check) {
  let stale = 0;
  for (const [name, body] of files) {
    const path = join(OUT, name);
    if (!existsSync(path) || readFileSync(path, 'utf8') !== body) {
      console.error(`  stale: generated/${name}`);
      stale += 1;
    }
  }
  if (stale > 0) {
    console.error(`\n${stale} generated file(s) stale — run: npm run gen:tokens\n`);
    process.exit(1);
  }
  console.log(`tokens current — ${CHROME_THEMES.length} chrome x ${DOCUMENT_THEMES.length} document x ${MODES.length} modes`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
for (const [name, body] of files) writeFileSync(join(OUT, name), body);
console.log(`\n  ${CHROME_THEMES.length} chrome themes  ${DOCUMENT_THEMES.length} document themes  `
  + `${MODES.length} modes  = ${CHROME_THEMES.length * DOCUMENT_THEMES.length * MODES.length} combinations`);
console.log(`  ${Object.keys(geometry).length} geometry vars, ${Object.keys(scaleVars).length} scale tokens`);
console.log(`  -> ${OUT}\n`);
