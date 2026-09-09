/**
 * The document, drawn into a string, and wrapped as a self-contained file.
 *
 * THE MARKUP IS THE VIEW'S. `FlowView` and `DocumentBlocks` are the components
 * the editor draws with; here they are handed to `renderToStaticMarkup` instead
 * of to the DOM. Nothing about how a holding box, a svara or a hanging indent
 * is drawn is decided in this file. An exported page that could disagree with
 * the page on screen would make "what you see is what you send" untrue, and
 * there would be no way to say which of the two was right.
 *
 * IT LIVES BESIDE THE VIEW AND IS CALLED FROM BOTH SIDES — by `FileGroup` when
 * someone presses Export, and by `tools/export/page.mjs` when a command does
 * the same thing. The two hosts differ in exactly two ways, and those are the
 * `ExportIo` below: where the stylesheets come from, and how a font file is
 * read. Everything else — the frame, the slice, which faces, the envelope — is
 * this one function, so the file a command writes and the file the window
 * writes are the same file.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  normalizeChantDoc, parseChantSelect, sliceChantDoc, type ChantDoc, type ChantScriptKey,
} from '@siksamitra/format';
import { DEFAULT_PAGE, pageGeometry } from '@siksamitra/layout';
import {
  chooseFaces, codepointsIn, exportHtml, faceRule, facesNeeded, parseFaceCss,
} from '@siksamitra/interop';
import { CHROME_TOKENS, DEFAULT_CHROME } from '@siksamitra/tokens';
import { documentThemeOf, exportStyle, type ExportStyle } from '@siksamitra/tokens/export-styles';
import { typeScaleOf } from '@siksamitra/tokens/document-themes';
import { TEXT_FACES } from '@siksamitra/tokens/fonts';
import { FlowView } from './FlowView.js';
import { DocumentBlocks } from './DocumentBlocks.js';

export const EXPORT_SCRIPTS: readonly ChantScriptKey[] = ['iast', 'deva', 'tel', 'tam'];

/** The two things a host has to supply, because only it knows them. */
export interface ExportIo {
  /** Every stylesheet the app applies, in the app's cascade order, plus the
   *  export frames. */
  css: () => string | Promise<string>;
  /** The vendored `fonts.css`, whose `@font-face` rules name the files. */
  faceCss: () => string | Promise<string>;
  /** One font file, base64. */
  fontBytes: (file: string) => string | Promise<string>;
}

export interface ExportOptions {
  /** An `EXPORT_STYLES` id. */
  style?: string;
  script?: ChantScriptKey;
  /** A `ChantSelection` expression — `#sec-1`, or `#sec-1/v-3`. */
  select?: string;
  assets?: Record<string, Uint8Array>;
  slug?: string;
  /** Fixed by a gate so two exports of one document can be compared. */
  savedAt?: string;
  engine?: string;
}

export interface ExportedPage {
  html: string;
  style: ExportStyle;
  script: ChantScriptKey;
  /** The document that is actually in the file — the slice, if one was taken. */
  doc: ChantDoc;
  fonts: { faces: number; bytes: number; families: string[]; uncovered: string[] };
}

/**
 * The document drawn, as markup.
 *
 * `page` and `web` go through `FlowView`, which is the app's own Flow and Web
 * view — sheet width, page margins and reading measure included — so an export
 * in those frames IS the view rather than an imitation of it. `card` and `bare`
 * have no sheet, so they take the `.doc` column `FlowView` would have wrapped
 * and hand it straight to the frame `export.css` draws.
 */
export function documentView(
  doc: ChantDoc, style: ExportStyle, script: ChantScriptKey,
): string {
  const props = { doc, script, showMarks: true };
  if (style.frame === 'page' || style.frame === 'web') {
    return renderToStaticMarkup(createElement(FlowView, {
      ...props,
      page: pageGeometry(DEFAULT_PAGE),
      zoom: 1,
      web: style.frame === 'web',
    }));
  }
  return renderToStaticMarkup(createElement(
    'div',
    /* Zoom is a MULTIPLIER every document token multiplies by, not a font size
       — see the comment on `FlowView`'s column. Absent, every `calc()` in the
       generated sheet resolves against nothing. */
    { className: 'doc', style: { '--doc-zoom': '1' } as React.CSSProperties },
    createElement(DocumentBlocks, props),
  ));
}

/** Build the file. */
export async function buildExportPage(
  source: ChantDoc, options: ExportOptions, io: ExportIo,
): Promise<ExportedPage> {
  const doc = normalizeChantDoc(source);
  const style = exportStyle(options.style ?? 'veda-union');
  /*
   * `primaryScript` and `id` are fields the corpus carries and `ChantDoc` does
   * not declare. They ride through every export untouched — the round-trip gate
   * compares the whole document and would say otherwise — but nothing typed may
   * pretend they are always there, so they are read as what they are: two
   * strings that may be absent.
   */
  const extra = doc as unknown as { primaryScript?: string; id?: string };
  const named = extra.primaryScript as ChantScriptKey | undefined;
  const script = options.script
    ?? (named !== undefined && EXPORT_SCRIPTS.includes(named) ? named : 'iast');

  const selection = options.select === undefined ? null : parseChantSelect(options.select);
  if (options.select !== undefined && selection === null) {
    throw new Error(
      `cannot read the selection "${options.select}" — try #section or #section/verse`,
    );
  }
  const shown = sliceChantDoc(doc, selection);
  const view = documentView(shown, style, script);

  const theme = documentThemeOf(style);
  /*
   * The `ui` face slot falls back to the CHROME theme's face when a document
   * theme names none of its own — `emit.mjs`'s `face()` resolves it to
   * `var(--font-ui)` — so the export has to know which chrome the page is set
   * under to know which family that is. It is always the default one.
   */
  const uiStack = CHROME_TOKENS[DEFAULT_CHROME]![style.mode]!['font-ui']!;
  const stacks = facesNeeded(theme, TEXT_FACES[theme.face], typeScaleOf(theme), uiStack);
  const { chosen, uncovered } = chooseFaces(
    parseFaceCss(await io.faceCss()), stacks, codepointsIn(view),
  );

  const rules: string[] = [];
  let bytes = 0;
  for (const face of chosen) {
    const base64 = await io.fontBytes(face.file);
    /* Base64 is four characters per three bytes, less the padding. Reported so
       a person can see what the file weighs without decoding it. */
    bytes += Math.floor((base64.length * 3) / 4);
    rules.push(faceRule(face, base64));
  }

  const html = await exportHtml({
    doc: shown,
    view,
    css: await io.css(),
    fonts: rules.join('\n'),
    style,
    script,
    engine: options.engine ?? 'siksamitra',
    slug: options.slug ?? `${extra.id ?? 'document'}.html`,
    ...(options.assets === undefined ? {} : { assets: options.assets }),
    ...(options.select === undefined ? {} : { select: options.select }),
    ...(options.savedAt === undefined ? {} : { savedAt: options.savedAt }),
  });

  return {
    html,
    style,
    script,
    doc: shown,
    fonts: {
      faces: chosen.length,
      bytes,
      families: [...new Set(chosen.map((f) => f.family))].sort(),
      uncovered: uncovered.map((cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`),
    },
  };
}
