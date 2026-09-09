/**
 * WHICH FACES an exported page has to carry, and the `@font-face` rules for
 * them.
 *
 * Deciding this twice would be two answers to one question, and the two places
 * that ask it could not be further apart: a command line reading
 * `assets/fonts` off the disk, and the window fetching `/fonts/` over HTTP. So
 * the decision is here, over parsed data, and each caller only supplies the
 * bytes — `tools/export/fonts.mjs` with `readFileSync`, the app with `fetch`.
 *
 * WHY IT IS NOT SIMPLY ALL OF THEM: `assets/fonts` is 9.3 MB and base64 costs a
 * third on top, so every exported mantra would be a 12 MB file. Three filters
 * cut it to what the page can use, and each reads the theme rather than a list
 * kept here:
 *
 *   1. THE FAMILIES ITS ROLES NAME. A document theme sets each role — mantra,
 *      translation, heading, folio — in one of four face slots, and nothing
 *      else on the page chooses a family. A Veda Union export therefore
 *      carries Arimo, Tinos and Carlito and no Garamond.
 *   2. THE SLANT THAT ROLE IS SET IN. His translation is Times italic and
 *      nothing else on his page is, so Tinos ships with its italics and Arimo
 *      and Carlito do not: 390 KB off a Veda Union export.
 *   3. THE CODEPOINTS ON THE PAGE, against each subset's `unicode-range`, and
 *      IN STACK ORDER — see `chooseFaces`.
 *
 * WEIGHT IS NOT FILTERED, deliberately. The type scale says which roles are
 * bold, but the stylesheets set weights it does not describe: `.doc .pause` is
 * `font-weight: 600`, so the daṇḍā between pādas is bold and no role says so.
 * Dropping the bold files leaves the browser to synthesise one, and a
 * synthesised bold is a different shape from a designed one.
 */
import type { DocumentTheme } from '@siksamitra/tokens/document-themes';
import type { DocTypeScale } from '@siksamitra/tokens/document-type';

/** The complete, unranged face every text stack ends with. */
export const FONT_BACKSTOP = 'Gentium Book Plus';

/** One `@font-face` rule, as data. */
export interface DeclaredFace {
  family: string;
  style: string;
  /** As written: `400`, `700`, or a range like `400 700`. */
  weight: string;
  /** The file name, relative to the stylesheet. */
  file: string;
  /** The declared `unicode-range`, or null for a complete face. */
  range: string | null;
  /** `range`, parsed. Null when the face declares none. */
  spans: [number, number][] | null;
}

/** A fallback list one role is set in, and the slant it is set in. */
export interface FaceStack {
  families: string[];
  style: 'normal' | 'italic';
}

/** `U+0100-02BA,U+0131` becomes `[[256, 698], [305, 305]]`. */
export function parseUnicodeRange(text: string): [number, number][] {
  const spans: [number, number][] = [];
  for (const part of text.split(',')) {
    const m = /U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?/.exec(part.trim());
    if (m === null) continue;
    const from = Number.parseInt(m[1]!, 16);
    spans.push([from, m[2] === undefined ? from : Number.parseInt(m[2], 16)]);
  }
  return spans;
}

/** Every `@font-face` a stylesheet declares. */
export function parseFaceCss(css: string): DeclaredFace[] {
  const out: DeclaredFace[] = [];
  for (const block of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = block[1]!;
    const value = (prop: string): string | null => {
      const m = new RegExp(`${prop}\\s*:\\s*([^;]+);`).exec(body);
      return m === null ? null : m[1]!.trim();
    };
    const src = value('src');
    const file = src === null
      ? null
      : /url\(['"]?\.?\/?([^'")]+)['"]?\)/.exec(src)?.[1] ?? null;
    if (file === null) continue;
    const range = value('unicode-range');
    out.push({
      family: (value('font-family') ?? '').replace(/^['"]|['"]$/g, ''),
      style: value('font-style') ?? 'normal',
      weight: value('font-weight') ?? '400',
      file,
      range,
      spans: range === null ? null : parseUnicodeRange(range),
    });
  }
  return out;
}

const inSpans = (spans: [number, number][], cp: number): boolean =>
  spans.some(([a, b]) => cp >= a && cp <= b);

const familiesIn = (stack: string): string[] =>
  [...stack.matchAll(/'([^']+)'/g)].map((m) => m[1]!);

/**
 * The fallback stacks a theme's roles ask for, each with its slant.
 *
 * Resolved by the same four-way rule the token generator uses (`emit.mjs`'s
 * `face`), so what an export embeds is what the page will ask the browser for.
 * `uiStack` is the chrome theme's interface face, which is what the generator
 * falls back to when a document theme names no `ui` face of its own.
 *
 * Returned as ordered STACKS rather than a flat set of families, because the
 * order is the whole of filter 3 below.
 */
export function facesNeeded(
  theme: DocumentTheme, textStack: string, scale: DocTypeScale, uiStack: string,
): FaceStack[] {
  const named = (role: string): string | null => {
    if (role === 'display') return theme.faces?.display ?? null;
    if (role === 'serif') return theme.faces?.serif ?? null;
    if (role === 'ui') return theme.faces?.ui ?? uiStack;
    return null;
  };
  const seen = new Map<string, FaceStack>();
  for (const metric of Object.values(scale)) {
    const stack = named(metric.face) ?? textStack;
    const style = metric.italic ? 'italic' : 'normal';
    seen.set(`${stack}|${style}`, { families: familiesIn(stack), style });
  }
  return [...seen.values()];
}

/** Every codepoint in some rendered markup, tags and entities removed. */
export function codepointsIn(html: string): Set<number> {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, ' ');
  const out = new Set<number>();
  for (const ch of text) out.add(ch.codePointAt(0)!);
  return out;
}

export interface FaceChoice {
  /** The subset files to embed, plus the backstop if one is needed. */
  chosen: DeclaredFace[];
  /** Codepoints no subset anywhere declares. Empty on most documents. */
  uncovered: number[];
}

/**
 * Which of the declared faces this page needs.
 *
 * WALKS EACH STACK THE WAY THE BROWSER WILL. A family is asked for a codepoint
 * only after every family before it in the stack has failed on it, so a family
 * that is never reached is a family the file does not need. Every text stack
 * ends with the three Indic faces and all three declare U+0964, the daṇḍa — so
 * a flat "does this subset cover anything used?" test embedded Noto Serif Tamil
 * and Noto Serif Telugu, 150 KB, in a Devanāgarī export, for one character
 * Devanāgarī had already drawn.
 *
 * The complete unranged file is the exception. It is the only thing that can
 * write a codepoint no subset declares — the Vedic candrabindu at U+0310, of
 * which the corpus holds 89 — and it costs 818 KB, so it goes in only when the
 * page actually contains such a character. `uncovered` is measured against
 * EVERY range in the stylesheet rather than one stack's: a stack that leaves a
 * letter unwritten in italic is not a gap, it is a slant the browser
 * synthesises, and counting those as gaps pulled the complete file into every
 * export.
 */
export function chooseFaces(
  faces: DeclaredFace[], stacks: FaceStack[], used: Set<number>,
): FaceChoice {
  const keep = new Set<DeclaredFace>();
  const anySubset = faces.filter((f) => f.spans !== null);
  const uncovered = [...used]
    .filter((cp) => cp > 0x20 && !anySubset.some((f) => inSpans(f.spans!, cp)))
    .sort((a, b) => a - b);
  const backstop = uncovered.length > 0
    && stacks.some((s) => s.families.includes(FONT_BACKSTOP));

  for (const { families, style } of stacks) {
    const left = new Set(used);
    for (const family of families) {
      const subsets = faces.filter(
        (f) => f.family === family && f.style === style && f.spans !== null,
      );
      if (subsets.length === 0) continue;
      const mine = [...left].filter((cp) => subsets.some((f) => inSpans(f.spans!, cp)));
      if (mine.length === 0) continue;
      for (const cp of mine) left.delete(cp);
      for (const f of subsets) if (mine.some((cp) => inSpans(f.spans!, cp))) keep.add(f);
    }
  }

  /*
   * ONE complete file, not three. The unranged Gentium blocks are upright
   * 400–700 (a weight RANGE, which is why this reads the first number rather
   * than comparing the string with "400" — that comparison silently matched
   * nothing, and no export carried a backstop at all), upright 700, and italic
   * 400. The first covers the other two for a mark whose job is to exist.
   */
  const chosen = faces.filter((f) => (
    f.spans === null
      ? backstop && f.family === FONT_BACKSTOP && f.style === 'normal'
        && f.weight.split(/\s+/)[0] === '400'
      : keep.has(f)
  ));
  return { chosen, uncovered };
}

const MEDIA: Record<string, string> = {
  woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
};

/** One `@font-face` rule with the file inside it. */
export function faceRule(face: DeclaredFace, base64: string): string {
  const ext = face.file.split('.').pop() ?? '';
  const media = MEDIA[ext];
  if (media === undefined) throw new Error(`no media type for font file "${face.file}"`);
  /*
   * `block`, not the vendored sheet's `swap`. There is no network here so
   * neither costs anything — but a rasteriser paints the first frame it is
   * given, and under `swap` that frame is the fallback face. The PNG then shows
   * Times where the page shows Arimo, with nothing in any log.
   */
  const decl = [
    `font-family:'${face.family}'`, // token-exempt: written, not chosen — data from fonts.css
    `font-style:${face.style}`,
    `font-weight:${face.weight}`,
    'font-display:block',
    `src:url(data:${media};base64,${base64}) format('${ext === 'ttf' ? 'truetype' : ext}')`,
    ...(face.range === null ? [] : [`unicode-range:${face.range}`]),
  ];
  return `@font-face{${decl.join(';')};}`;
}
