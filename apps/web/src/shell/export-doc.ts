/**
 * Exporting from the window: the three things the browser answers differently.
 *
 * The file itself is built by `views/export-page.tsx`, which a command line
 * calls with the same arguments. Here are only the host's own answers — where
 * the stylesheets are, how a font file is read, and how a page becomes a
 * picture without a headless browser to point at it.
 *
 * THE STYLESHEETS ARE THE ONES THE WINDOW IS WEARING, read out of
 * `document.styleSheets` rather than fetched or listed. That is the strongest
 * form of "what you see is what you send" available: the rules in the exported
 * file are the rules that are styling the page behind the dialog, the same
 * objects, in the same cascade order.
 */
import {
  normalizeChantDoc, parseChantSelect, sliceChantDoc,
  type ChantDoc, type ChantScriptKey,
} from '@siksamitra/format';
import { CLIP_SELECTOR, RASTER_ATTR, svgDocument, toBase64 } from '@siksamitra/interop';
import {
  exportStyle, styleStacks, type ExportStyle,
} from '@siksamitra/tokens/export-styles';
import {
  buildExportPage, type ExportIo, type ExportedPage,
} from '../views/export-page.js';

/** What wrote the file. Stored in the manifest, so a reader can say what did. */
const ENGINE = 'siksamitra-web';

/** Where the vendored faces are served from — see `apps/web/index.html`. */
const FONT_DIR = '/fonts/';

/**
 * Every rule the window is applying.
 *
 * The vendored face sheet is SKIPPED. Its `@font-face` rules point at relative
 * `.woff2` files, and carrying them into a self-contained file would leave it
 * asking a server that is not there for the faces it already has inline — the
 * one thing an offline file must not do. The faces the export needs are chosen
 * and embedded separately; see `chooseFaces`.
 *
 * `cssRules` throws on a stylesheet the page may not read. Nothing here is
 * cross-origin today, but a browser extension's injected sheet would be, and it
 * is not worth an exception.
 */
function pageCss(): string {
  const out: string[] = [];
  const take = (sheet: CSSStyleSheet): void => {
    if ((sheet.href ?? '').includes(FONT_DIR)) return;
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      return;
    }
    for (let at = 0; at < rules.length; at += 1) {
      const rule = rules[at]!;
      /* An `@import` is a fetch. Follow it and inline what it points at, in
         its own place in the cascade, rather than copying the line. */
      if (rule instanceof CSSImportRule && rule.styleSheet != null) take(rule.styleSheet);
      else out.push(rule.cssText);
    }
  };
  for (const sheet of document.styleSheets) take(sheet as CSSStyleSheet);
  return out.join('\n');
}

async function base64Of(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`could not read ${url} (HTTP ${response.status})`);
  /* `toBase64` rather than `btoa`, and for the reason recorded there:
     `String.fromCharCode(...bytes)` on an 800 KB font file is an argument list
     of 800 000 and throws a RangeError before anything is encoded. */
  return toBase64(new Uint8Array(await response.arrayBuffer()));
}

const io: ExportIo = {
  css: pageCss,
  faceCss: async () => {
    const response = await fetch(`${FONT_DIR}fonts.css`);
    if (!response.ok) throw new Error(`the vendored fonts are not there (HTTP ${response.status})`);
    return response.text();
  },
  fontBytes: (file) => base64Of(`${FONT_DIR}${file}`),
};

/**
 * One `.docx`: the Word document, and the document inside it.
 *
 * The whole build is `packages/interop/src/word/`, which the command line calls
 * too; the window supplies nothing, because a `.docx` names its faces and the
 * machine that opens it provides them. `styleStacks` is the same resolution the
 * page export uses, so the Word file asks for the family the page is set in.
 */
export async function exportDocumentWord(
  doc: ChantDoc,
  options: { style: string; script?: ChantScriptKey; select?: string; slug?: string },
): Promise<{ bytes: Uint8Array; style: ExportStyle }> {
  const { exportWord } = await import('@siksamitra/interop');
  const style = exportStyle(options.style);
  const stacks = styleStacks(style);
  const shown = sliceChantDoc(
    normalizeChantDoc(doc),
    options.select === undefined ? null : parseChantSelect(options.select),
  );
  const bytes = await exportWord({
    doc: shown,
    style,
    textStack: stacks.text,
    uiStack: stacks.ui,
    engine: ENGINE,
    slug: options.slug ?? 'document.docx',
    script: options.script ?? 'iast',
    ...(options.select === undefined ? {} : { select: options.select }),
  });
  return { bytes, style };
}

/** One self-contained `.html`: the page, and the document inside it. */
export function exportDocumentHtml(
  doc: ChantDoc,
  options: { style: string; script?: ChantScriptKey; select?: string; slug?: string },
): Promise<ExportedPage> {
  return buildExportPage(doc, { ...options, engine: ENGINE }, io);
}

/**
 * Open an exported page off-screen, long enough to photograph it.
 *
 * `srcdoc` rather than a blob URL: the frame is then same-origin, so its fonts
 * and its computed styles are readable, and there is nothing to revoke. It is
 * 1 400 px wide because that is a comfortable working width for the sheet
 * frames; the card and the transparent frame size themselves and ignore it.
 */
async function inFrame<T>(html: string, fn: (doc: Document) => Promise<T>): Promise<T> {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  /* A scratch window, off-screen and never seen: a working size for the sheet
     frames, not a size anything is designed at. The card and the transparent
     frame size themselves and ignore it. */
  frame.style.cssText = 'position:fixed;left:-99999px;top:0;border:0';
  frame.style.width = '1400px'; // token-exempt: the rasteriser's scratch window
  frame.style.height = '900px'; // token-exempt: the rasteriser's scratch window
  document.body.append(frame);
  try {
    await new Promise<void>((done, fail) => {
      frame.addEventListener('load', () => done(), { once: true });
      frame.addEventListener('error', () => fail(new Error('the page would not open')), { once: true });
      frame.srcdoc = html;
    });
    const inner = frame.contentDocument;
    if (inner === null) throw new Error('the page would not open');
    inner.documentElement.setAttribute(RASTER_ATTR, '');
    /* The faces are `data:` URIs so there is no network to wait for, but
       decoding an 818 KB TrueType still happens after the first layout, and a
       picture taken before it finishes is a picture of the fallback face. */
    await inner.fonts.ready;
    return await fn(inner);
  } finally {
    frame.remove();
  }
}

/**
 * A PNG of an exported page, at a chosen scale.
 *
 * Through the page's own SVG form, drawn into a canvas. The browser has no
 * `element.screenshot()`, and the alternative — a second layout engine in
 * JavaScript that walks the DOM and paints it — is the second renderer this
 * program refuses to have. `svgDocument` is the one the command line uses too,
 * so the picture is assembled the same way on both sides.
 */
export async function exportDocumentPng(
  html: string, style: ExportStyle, scale = 2,
): Promise<{ blob: Blob; width: number; height: number }> {
  const svg = await inFrame(html, async (doc) => {
    const el = doc.querySelector(CLIP_SELECTOR[style.frame]);
    if (el === null) throw new Error(`the ${style.frame} frame did not render`);
    const box = el.getBoundingClientRect();
    const sheets = [...doc.querySelectorAll('style')].map((s) => s.textContent ?? '');
    const root = doc.documentElement;
    return {
      text: svgDocument({
        body: new XMLSerializer().serializeToString(el),
        css: sheets.join('\n'),
        chrome: root.getAttribute('data-chrome') ?? '',
        mode: root.getAttribute('data-mode') ?? '',
        doc: style.doc,
        width: box.width,
        height: box.height,
      }),
      width: Math.ceil(box.width),
      height: Math.ceil(box.height),
    };
  });

  /* A `data:` URI keeps the canvas untainted, which a blob URL from this
     document does not: `getImageData` and `toBlob` both refuse a tainted one. */
  const uri = `data:image/svg+xml;base64,${toBase64(new TextEncoder().encode(svg.text))}`;
  const image = new Image();
  image.src = uri;
  await image.decode();

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(svg.width * scale);
  canvas.height = Math.round(svg.height * scale);
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('this browser will not give a 2D canvas');
  ctx.scale(scale, scale);
  ctx.drawImage(image, 0, 0);

  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'));
  if (blob === null) throw new Error('the picture could not be encoded');
  return { blob, width: canvas.width, height: canvas.height };
}
