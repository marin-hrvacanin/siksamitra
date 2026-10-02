/**
 * THE FILES — made by the exporters the app and the gates already use.
 *
 *   pdf        the HTML export printed by a headless Chromium
 *              (`tools/export/pdf.mjs`), the document embedded in it — the
 *              same path `check:export:pdf` measures;
 *   docx       `exportWord`, the document inside it;
 *   smdoc      `packDocument`, śikṣāmitra's own file;
 *   vedaunion  `pack`, the `.vuchant` package the VedaUnion website takes
 *              (`docs/INTERCHANGE.md` §9.4) — offered only by that name.
 *
 * Every one in the Veda Union style, and nothing here lays out a page.
 */
import type { ChantDoc } from '@siksamitra/format';
import { exportWord, pack, packDocument } from '@siksamitra/interop';
import { exportStyle, styleStacks } from '@siksamitra/tokens/export-styles';
import type { Delivered, Exporters, Shot } from '@siksamitra/agent';
import { pageGeometry, px } from '@siksamitra/layout';
/* The PDF path is the export tools' own, run under their render config. */
// @ts-expect-error — a JavaScript module of the tools, without types
import { buildPdf } from '../../../tools/export/pdf.mjs';
// @ts-expect-error — a JavaScript module of the tools, without types
import { buildPage } from '../../../tools/export/page.mjs';
// @ts-expect-error — a JavaScript module of the tools, without types
import { launch } from '../../../tools/_browser.mjs';

const ENGINE = 'siksamitra-agent';
const STYLE = 'veda-union';

type Shooter = {
  setViewport(v: { width: number; height: number; deviceScaleFactor: number }): Promise<void>;
  setContent(html: string, o: { waitUntil: 'load' }): Promise<void>;
  evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
  emulateMediaType(type: 'print'): Promise<void>;
  screenshot(o: { type: 'png'; clip: { x: number; y: number; width: number; height: number } }): Promise<Uint8Array>;
  close(): Promise<void>;
};
type Browser = { close(): Promise<void>; newPage(): Promise<Shooter> };

export interface NodeExporters extends Exporters {
  close(): Promise<void>;
  /**
   * One page of the document as it will print, for a model that sees
   * (`look`): the export page the PDF is printed from, photographed at the
   * sheet's width and cut at its height. Not the PDF's own page breaks — what
   * the model looks at is the type, the marks and the layout.
   */
  look(doc: ChantDoc, page: number): Promise<Shot>;
}

/** The sheet, in CSS pixels, and how much finer than that the picture is. */
const SHEET = pageGeometry('a4');
const LOOK_SCALE = 1.4;

export function nodeExporters(): NodeExporters {
  let browser: Promise<Browser> | null = null;
  const chrome = (): Promise<Browser> => (browser ??= launch() as Promise<Browser>);
  const file = (format: Delivered['format'], name: string, mime: string, bytes: Uint8Array): Delivered => ({ format, name, mime, bytes });

  return {
    async pdf(doc: ChantDoc, name: string) {
      const out = await buildPdf(await chrome(), doc, { style: STYLE, slug: `${name}.pdf`, engine: ENGINE }) as { bytes: Uint8Array };
      return file('pdf', `${name}.pdf`, 'application/pdf', out.bytes);
    },
    async docx(doc: ChantDoc, name: string) {
      const style = exportStyle(STYLE);
      const stacks = styleStacks(style);
      const bytes = await exportWord({ doc, style, textStack: stacks.text, uiStack: stacks.ui, engine: ENGINE, slug: `${name}.docx`, script: 'iast' });
      return file('docx', `${name}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes);
    },
    async smdoc(doc: ChantDoc, name: string) {
      return file('smdoc', `${name}.smdoc`, 'application/zip', await packDocument(doc, { slug: `${name}.smdoc`, engine: ENGINE }));
    },
    async vedaunion(doc: ChantDoc, name: string) {
      return file('vedaunion', `${name}.vuchant`, 'application/zip', await pack(doc, { slug: name, engine: ENGINE }));
    },
    async look(doc: ChantDoc, page: number) {
      const built = await buildPage(doc, { style: STYLE }) as { html: string };
      const p = await (await chrome()).newPage();
      try {
        const width = Math.round(px(SHEET.width, 1));
        const height = Math.round(px(SHEET.height, 1));
        await p.setViewport({ width, height, deviceScaleFactor: LOOK_SCALE });
        await p.setContent(built.html, { waitUntil: 'load' });
        await p.evaluate(() => document.fonts.ready);
        await p.emulateMediaType('print');
        const total = await p.evaluate(() => document.documentElement.scrollHeight);
        const pages = Math.max(1, Math.ceil(total / height));
        const n = Math.min(Math.max(1, page), pages);
        const png = await p.screenshot({ type: 'png', clip: { x: 0, y: (n - 1) * height, width, height } });
        return { png: new Uint8Array(png), page: n, pages };
      } finally {
        await p.close();
      }
    },
    async close() {
      if (browser !== null) await (await browser).close();
      browser = null;
    },
  };
}
