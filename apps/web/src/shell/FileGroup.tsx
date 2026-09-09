/**
 * The File group: New, Open, Save, Save As — and the other formats.
 *
 * WHAT WAS MISSING, TWICE OVER.
 *
 * The first pass gave the program an importer and an exporter and called it
 * File: it could read a `.smdoc` and hand back a download, and that was all.
 * There was no way to make a document, no way to write one back where it came
 * from, and nothing anywhere knew whether the thing on screen had been changed
 * — so the answer to "what happens to my work when I close this?" was that it
 * went. The four commands at the top of this group are that gap, and they come
 * from the registry so that the button and the accelerator cannot drift apart:
 * see `commands.ts` and `useDocFile.ts`.
 *
 * IMPORT IS NOT OPEN, and it stopped pretending to be. `.smdoc`, `.vuchant`
 * and `.docx` come IN and cannot be written back — a `.docx` round trip is
 * lossy by construction and a `.vuchant` is a package, not this document — so
 * an imported document arrives unsaved, named after the file it came from, and
 * the first Save takes it to a `.json` of its own.
 *
 * PRINTING IS THE PDF PATH, deliberately. The paged view already lays the
 * document out on real A4 with his own 25 mm margins, measured from his file;
 * the browser's own print pipeline turns exactly that into a PDF, on every
 * platform, with no PDF library in the bundle. A second renderer for print
 * would be a second thing that could disagree with the preview — which is the
 * one promise the paged view makes.
 */
import { useRef, useState, type ReactNode } from 'react';
import type { ChantDoc } from '@siksamitra/format';
import { DEFAULT_EXPORT_STYLE, EXPORT_STYLES } from '@siksamitra/tokens/export-styles';
import { CommandButtons } from './CommandButtons.js';
import { RibbonButton, RibbonStack } from './RibbonButton.js';
import { fileNameFor } from './doc-file.js';
import type { CommandContext } from './commands.js';

/** What wrote the file. Stored in the manifest so a reader knows what derived
 *  it — see `DocumentManifest`. */
const ENGINE = 'siksamitra-web';

/** Hand the browser some bytes to save. */
function download(name: string, bytes: Uint8Array | string | Blob, type: string): void {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  /* Revoked on the next turn, not immediately: revoking in the same task can
     cancel the download in WebKit before it has read the blob. */
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function FileGroup(
  { ctx, doc, onImport, onNote }: {
    /** New / Open / Save / Save As come from the registry through this. */
    ctx: CommandContext;
    doc: ChantDoc | null;
    /** A document an importer produced, ready to replace what is open. */
    onImport: (doc: ChantDoc, name: string) => void;
    /** Say what happened — the status bar is where a refusal belongs. */
    onNote: (message: string) => void;
  },
): ReactNode {
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  /* Which style the next export is set in. One choice for both exports,
     because "send me that mantra as a card" is one decision and asking twice
     would let the page and the picture disagree. */
  const [style, setStyle] = useState(DEFAULT_EXPORT_STYLE);

  const importFrom = async (file: File): Promise<void> => {
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      /*
       * Imported lazily, and the reason is the browser build: the Word reader
       * and the zip container pull in the compression code, which is a third
       * of the bundle and is needed by nobody who only reads.
       */
      if (ext === 'smdoc' || ext === 'vuchant') {
        /*
         * BOTH GENERATIONS OF `.smdoc`, decided by the file's own bytes.
         *
         * v2 is a zip; v1 is `SMDI` (xz), `SMDC` (zlib) or bare JSON. Back
         * compatibility is a promise, and it was one nothing could keep: the
         * v1 reader existed, was tested by hand, and was reachable from no
         * application code — so opening a years-old document threw.
         */
        const interop = await import('@siksamitra/interop');
        if (interop.documentFlavour(bytes) === 'v2') {
          onImport(interop.unpackDocument(bytes).doc, file.name);
        } else {
          const result = await interop.importSmdoc(bytes);
          onImport(result.doc, file.name);
          const marks = result.doc.overrides?.length ?? 0;
          onNote(
            `${file.name}: an older document, derived into this format`
            + (marks > 0 ? ` — ${marks} mark(s) kept as the author's own` : ''),
          );
        }
      } else if (ext === 'docx') {
        const { importDocx } = await import('@siksamitra/interop');
        const result = importDocx(bytes);
        onImport(result.doc, file.name);
        if (result.report.unresolved.length > 0) {
          onNote(
            `${file.name}: ${result.report.unresolved.length} run(s) whose styling this `
            + 'version does not understand were kept as plain text',
          );
        }
      } else {
        onNote(`${file.name}: not a document this program imports (.smdoc, .vuchant, .docx)`);
      }
    } catch (e) {
      /*
       * The message, not a generic failure. An `SMDI` file says exactly what
       * it needs (an xz decoder, which the browser build does not carry), and
       * a person who is told that can open it in the desktop app instead.
       */
      onNote(`${file.name}: ${e instanceof Error ? e.message : 'could not be opened'}`);
    } finally {
      setBusy(false);
    }
  };

  const exportPackage = async (): Promise<void> => {
    if (doc === null) return;
    setBusy(true);
    try {
      const { packDocument } = await import('@siksamitra/interop');
      /*
       * LEAN, which is the default and the right one: a verse whose source
       * re-derives to the same tokens stores the source alone, and
       * `unpackDocument` rebuilds the rest. A verse that does NOT re-derive
       * keeps its tokens — the container verifies that per verse rather than
       * trusting the engine, so a lean file cannot lose a mark.
       */
      const bytes = await packDocument(doc, { slug: fileNameFor(doc.title, 'smdoc'), engine: ENGINE });
      download(
        fileNameFor(doc.title, 'smdoc'),
        bytes,
        'application/vnd.siksamitra.document+zip',
      );
    } catch (e) {
      onNote(`Could not export: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  /*
   * HTML AND IMAGE, both through `views/export-page.tsx` and both taking a
   * style from `EXPORT_STYLES`.
   *
   * The HTML is the LOSSLESS export and the only one that is also an import:
   * the page is what you send someone, and the document itself rides inside it
   * in a `<script type="application/json">` block, so the same file reopens
   * with nothing lost. `.docx` above cannot do that — it has nowhere to put the
   * source layer, the overrides or the register — which is why Import and
   * Export Word are separate verbs and this one is not.
   *
   * The PNG is that same file, photographed. See `export-doc.ts`.
   */
  const exportHtmlFile = async (): Promise<void> => {
    if (doc === null) return;
    setBusy(true);
    try {
      const { exportDocumentHtml } = await import('./export-doc.js');
      const page = await exportDocumentHtml(doc, { style });
      download(fileNameFor(doc.title, 'html'), page.html, 'text/html;charset=utf-8');
      onNote(`Exported as ${page.style.name} — the document travels inside the page, `
        + `with ${page.fonts.faces} font file(s) and nothing to fetch.`);
    } catch (e) {
      onNote(`Could not export: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const exportImage = async (): Promise<void> => {
    if (doc === null) return;
    setBusy(true);
    try {
      const { exportDocumentHtml, exportDocumentPng } = await import('./export-doc.js');
      const page = await exportDocumentHtml(doc, { style });
      /* Twice the size it is laid out at: a card is read on a phone, where the
         screen has two device pixels to a CSS one, and a 1x image of a mantra
         is soft exactly where the marks are. */
      const png = await exportDocumentPng(page.html, page.style, 2);
      download(fileNameFor(doc.title, 'png'), png.blob, 'image/png');
      onNote(`Exported as ${page.style.name} — ${png.width}x${png.height} pixels.`);
    } catch (e) {
      onNote(`Could not export: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const exportWord = async (): Promise<void> => {
    if (doc === null) return;
    setBusy(true);
    try {
      const [{ exportDocx }, template] = await Promise.all([
        import('@siksamitra/interop'),
        /* His own template, so the exported file carries his style definitions
           rather than ones we invented — that is what makes the round trip 1:1
           rather than approximate. */
        fetch('/templates/vu-word-template.docx').then(async (r) => {
          if (!r.ok) throw new Error(`the Word template is not available (HTTP ${r.status})`);
          return new Uint8Array(await r.arrayBuffer());
        }),
      ]);
      download(
        fileNameFor(doc.title, 'docx'),
        exportDocx(doc, template),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    } catch (e) {
      onNote(`Could not export: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <CommandButtons
        group="file"
        ctx={ctx}
        large={['file.new', 'file.open', 'file.save']}
      />
      <div className="rbg">
        <input
          ref={picker}
          type="file"
          accept=".smdoc,.vuchant,.docx"
          className="u-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            /* Cleared after reading, so importing the SAME file twice fires
               twice — otherwise the second attempt looks like a broken
               button. */
            e.target.value = '';
            if (file !== undefined) void importFrom(file);
          }}
        />
        <RibbonStack>
          <RibbonButton
            icon="import"
            label="Import"
            title="Read a .smdoc, a chant package or a Word document"
            disabled={busy}
            onClick={() => picker.current?.click()}
          />
          <RibbonButton
            icon="export"
            label="Export Word"
            title="Write a .docx using his own template's styles"
            disabled={doc === null || busy}
            onClick={() => void exportWord()}
          />
          <RibbonButton
            icon="html"
            label="Export HTML"
            title="Write one self-contained .html — the page to send, and the document to reopen"
            disabled={doc === null || busy}
            onClick={() => void exportHtmlFile()}
          />
          <RibbonButton
            icon="image"
            label="Export image"
            title="Write a .png of the document in the chosen style, at twice its size"
            disabled={doc === null || busy}
            onClick={() => void exportImage()}
          />
          <RibbonButton
            icon="print"
            label="Print / PDF"
            accel="Ctrl+P"
            title="Print, or save as PDF — the pages you see in Pages view"
            disabled={doc === null}
            onClick={() => window.print()}
          />
          <RibbonButton
            icon="document"
            label="Package"
            title="Write a .smdoc — everything this document holds, losslessly"
            disabled={doc === null || busy}
            onClick={() => void exportPackage()}
          />
        </RibbonStack>
        <label className="rbf">
          <span className="rbf__l">Style</span>
          <select
            className="tb__sel"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            aria-label="Export style"
            title={EXPORT_STYLES.find((s) => s.id === style)?.note}
          >
            {EXPORT_STYLES.map((s) => (
              <option key={s.id} value={s.id} title={s.note}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}
