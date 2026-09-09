/**
 * A chant document as ONE `.html` file that needs nothing else.
 *
 * WHY THIS FORMAT IS THE LOSSLESS ONE. Word is lossy by construction: a
 * `.docx` can carry the marks as character styles but not the source layer, the
 * overrides, the register or the recording map, so importing one back gives a
 * document that only looks the same. HTML has somewhere to put all of it — the
 * page is what a person sees, and the document itself rides along inside a
 * `<script type="application/json">` block that no browser renders. So an
 * export can be BOTH the finished-looking thing you send someone AND the file
 * you open again tomorrow with nothing lost. `importHtml` in `import.ts` reads
 * it back, and `tools/export/gate-html.mjs` proves the round trip is exact,
 * field for field, over all eleven corpus documents.
 *
 * WHAT MAKES IT SELF-CONTAINED. Everything the page needs is inline: the
 * stylesheets the app itself loads, the font files as `data:` URIs inside the
 * `@font-face` rules that name them, and the recordings as base64. There is no
 * network request in the file — open it on a plane, or from a USB stick, and it
 * is the same page. That is not a nicety: a document whose fonts came off a CDN
 * would silently set the Vedic candrabindu in whatever face the machine had,
 * which is the exact failure `tools/fonts/manifest.mjs` exists to prevent.
 *
 * WHAT THIS FILE DOES NOT DO. It does not render anything. The markup arrives
 * in `view` already drawn by the app's own React components, because a second
 * renderer is a disagreement with no arbiter — the page you export has to be
 * the page you were looking at, and the only way to be sure of that is for
 * there to be one of them.
 */
import type { ChantDoc } from '@siksamitra/format';
import type { ExportStyle } from '@siksamitra/tokens/export-styles';
import { documentBytes, sha256Hex } from '../package.js';
import {
  HTML_FORMAT, HTML_SLOTS, HTML_VERSION, escapeHtml, jsonForScript, toBase64,
  type HtmlManifest,
} from './manifest.js';

export interface HtmlExportInput {
  doc: ChantDoc;
  /**
   * The document, rendered. The app's own view markup — `FlowView` for the
   * sheet and web frames, the `.doc` column for a card — as a string.
   */
  view: string;
  /** Every stylesheet the app loads, concatenated in the app's cascade order. */
  css: string;
  /** `@font-face` rules whose `src` is a `data:` URI. */
  fonts: string;
  style: ExportStyle;
  /** Which script the view was rendered in. Recorded, not applied. */
  script: string;
  /** What wrote the file. */
  engine: string;
  slug: string;
  /** Recordings and any other bytes the document refers to, by name. */
  assets?: Record<string, Uint8Array>;
  /** A `ChantSelection` expression, when only part of the document was taken. */
  select?: string;
  /**
   * When it was written. Passed in rather than read from the clock so a gate
   * can export the same document twice and compare the bytes — the `.docx`
   * exporter's determinism check found a real bug that way.
   */
  savedAt?: string;
}

/** The chrome axis an exported page is set under. The desk a sheet lies on is
 *  a chrome colour, so the attribute has to be present for it to resolve. */
const CHROME = 'palladio';

/**
 * The card's four lengths, as custom properties on the frame element.
 *
 * Written here rather than into `export.css` because they are the STYLE's
 * values, not the stylesheet's: two card styles share one `CARD` constant
 * today, and a third with a different measure must not need a CSS edit.
 */
function cardVars(style: ExportStyle): string {
  const c = style.card;
  if (c === undefined) return '';
  return ` style="--x-card-radius:${c.radius};--x-card-pad:${c.pad};`
    + `--x-card-measure:${c.measure};--x-card-mat-pad:${c.matPad}"`;
}

/** The frame, around the view. `page` and `web` need no wrapper of their own —
 *  `FlowView` already drew theirs. */
function framed(style: ExportStyle, view: string): string {
  const open = `<div class="export export--${style.frame}" data-doc="${escapeHtml(style.doc)}"`
    + `${cardVars(style)}>`;
  const inner = style.frame === 'card' ? `<div class="export__card">${view}</div>` : view;
  return `${open}${inner}</div>`;
}

function block(id: string, json: string): string {
  return `<script type="application/json" id="${id}">${jsonForScript(json)}</script>`;
}

/**
 * Write the file.
 *
 * Async because the document's identity is a SHA-256 and `crypto.subtle` is,
 * which is also why `packDocument` is async. The same hash function, so a
 * `.smdoc` and an `.html` of one document agree on what that document is.
 */
export async function exportHtml(input: HtmlExportInput): Promise<string> {
  const { doc, style } = input;
  const json = documentBytes(doc);
  const assets = input.assets ?? {};
  const assetNames = Object.keys(assets).sort();

  const manifest: HtmlManifest = {
    format: HTML_FORMAT,
    version: HTML_VERSION,
    slug: input.slug,
    title: doc.title,
    engine: input.engine,
    savedAt: input.savedAt ?? new Date().toISOString(),
    docHash: await sha256Hex(json),
    style: style.id,
    script: input.script,
    ...(input.select === undefined ? {} : { select: input.select }),
    contents: {
      documentBytes: json.length,
      assets: assetNames.length,
      assetBytes: assetNames.reduce((n, k) => n + assets[k]!.length, 0),
      verses: doc.sections.reduce((n, s) => n + s.verses.length, 0),
    },
  };

  /* Sorted, so exporting the same document twice gives the same bytes. */
  const encoded: Record<string, string> = {};
  for (const name of assetNames) encoded[name] = toBase64(assets[name]!);

  const title = escapeHtml(doc.title);
  return [
    '<!doctype html>',
    /* `data-mode` and `data-doc` are the two theme axes and the generated
       stylesheet selects on both — `[data-mode="dark"] [data-doc="vu-web"]` —
       so the mode has to be on an ANCESTOR of the frame, not on it. */
    `<html lang="sa" data-chrome="${CHROME}" data-mode="${style.mode}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    `<meta name="generator" content="${escapeHtml(input.engine)}">`,
    /* The faces come first: a `@font-face` declared after the rule that asks
       for the family is a face the browser has already given up on. */
    `<style>${input.fonts}</style>`,
    `<style>${input.css}</style>`,
    '</head>',
    `<body class="export-body">`,
    framed(style, input.view),
    /* The document itself, and its assets. Not rendered by anything; this is
       the part that makes the file openable rather than only readable. */
    block(HTML_SLOTS.manifest, JSON.stringify(manifest)),
    block(HTML_SLOTS.document, `${new TextDecoder().decode(json)}`.trimEnd()),
    block(HTML_SLOTS.assets, JSON.stringify(encoded)),
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
