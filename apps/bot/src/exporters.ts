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
import type { Delivered, Exporters } from '@siksamitra/agent';
/* The PDF path is the export tools' own, run under their render config. */
// @ts-expect-error — a JavaScript module of the tools, without types
import { buildPdf } from '../../../tools/export/pdf.mjs';
// @ts-expect-error — a JavaScript module of the tools, without types
import { launch } from '../../../tools/_browser.mjs';

const ENGINE = 'siksamitra-agent';
const STYLE = 'veda-union';

type Browser = { close(): Promise<void> };

export interface NodeExporters extends Exporters {
  close(): Promise<void>;
}

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
    async close() {
      if (browser !== null) await (await browser).close();
      browser = null;
    },
  };
}
