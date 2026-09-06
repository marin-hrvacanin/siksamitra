/**
 * Seed the token source from the values already in use.
 *
 * These are the owner's colours, faces and mark geometry, measured and tuned
 * over the life of the platform. Retyping 56 tokens, 27 overrides and a
 * geometry table would be an invitation to change one of them by accident, so
 * they are carried across mechanically and the generated CSS is diffed against
 * the stylesheet that was in use.
 *
 * ONE-SHOT. After this runs, `packages/tokens/src/source.ts` is the source of
 * truth and this file is history.
 *
 *   node tools/seed-tokens.mjs <path-to-theme-tokens.json>
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const input = process.argv[2];
if (input === undefined) {
  console.error('usage: node tools/seed-tokens.mjs <theme-tokens.json>');
  process.exit(2);
}
const src = JSON.parse(readFileSync(input, 'utf8'));

const isFont = (k) => k.startsWith('--font-');
const name = (k) => k.replace(/^--/, '');

/** Fonts come out of the flat token bag and become ROLES with stacks. */
const FONT_ROLE = { display: 'display', body: 'body', grotesk: 'ui', deva: 'deva' };
const ROLE_NOTE = {
  display: 'Titles and the reading face for a document heading.',
  body: 'The reading face. This is the one a chant is actually read in.',
  ui: 'Tool chrome. Never used for text being edited.',
  deva: 'Devanagari-first stack, where the body face lacks the coverage.',
};

const fonts = {};
for (const [k, v] of Object.entries(src.light)) {
  if (!isFont(k)) continue;
  const role = FONT_ROLE[name(k).replace('font-', '')];
  if (role === undefined) throw new Error(`no role mapped for ${k}`);
  fonts[role] = v.split(',').map((s) => s.trim());
}

const base = {};
for (const [k, v] of Object.entries(src.light)) {
  if (isFont(k)) continue;
  base[name(k)] = v;
}
const dark = {};
for (const [k, v] of Object.entries(src.dark ?? {})) {
  if (isFont(k)) throw new Error(`a theme may not override a font: ${k}`);
  dark[name(k)] = v;
}

const lit = (v) => JSON.stringify(v);
const entries = (o, indent = '  ') =>
  Object.entries(o).map(([k, v]) => `${indent}${JSON.stringify(k)}: ${lit(v)},`).join('\n');

const stack = (role) =>
  `  ${role}: {\n    note: ${lit(ROLE_NOTE[role])},\n    stack: [\n` +
  fonts[role].map((f) => `      ${lit(f)},`).join('\n') +
  `\n    ],\n  },`;

mkdirSync('packages/tokens/src', { recursive: true });
writeFileSync('packages/tokens/src/source.ts', `/**
 * THE token source. Every design value in this program starts here.
 *
 * Nothing downstream may contain a literal colour, face, size, radius, weight
 * or duration: the stylesheets, the TypeScript modules and the export style
 * tables are all GENERATED from this file, and \`npm run check:tokens\` fails
 * the build on any literal it finds elsewhere.
 *
 * The rules this file exists to make true:
 *
 *   - Adding a THEME is one entry in \`THEMES\`. No component ever names a theme.
 *   - Changing a FACE is one edit in \`FONTS\`. A component names a ROLE.
 *   - Changing a COLOUR is one edit in \`BASE\` or a theme's patch.
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
${['display', 'body', 'ui', 'deva'].map(stack).join('\n')}
} as const satisfies Record<string, FontRole>;

export type FontRoleName = keyof typeof FONTS;

/**
 * The default token set. A theme is this, patched.
 *
 * Names are semantic where they can be (\`ink\`, \`rule\`, \`svara\`) because a
 * token named for its value cannot be re-themed.
 */
export const BASE = {
${entries(base)}
} as const;

export type TokenName = keyof typeof BASE;

export interface Theme {
  /**
   * Which colour scheme this theme IS.
   *
   * The generator wires it to \`prefers-color-scheme\` from this field, so
   * nothing anywhere hardcodes the word "dark" to mean the dark theme — which
   * is what lets a second dark theme, or a high-contrast one, be added without
   * editing a stylesheet.
   */
  readonly scheme: 'light' | 'dark';
  /** What it changes about \`BASE\`. Everything unlisted is inherited. */
  readonly patch: Partial<Record<TokenName, string>>;
}

/**
 * Themes. Each is a PATCH over \`BASE\`, resolved by the generator to a complete
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
${entries(dark, '      ')}
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
 * distinguishable at every text size, which is why \`minPx\` exists.
 */
export const MARK_GEOMETRY = ${JSON.stringify(src.markGeometry, null, 2).replace(/\n/g, '\n')} as const;
`);

console.log(`  fonts   ${Object.keys(fonts).length} roles`);
console.log(`  base    ${Object.keys(base).length} tokens`);
console.log(`  themes  ${Object.keys({ light: 1, dark: 1 }).length} (dark patches ${Object.keys(dark).length})`);
console.log('  wrote packages/tokens/src/source.ts');
