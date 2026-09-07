/**
 * The file: open one, save one, export one, print one.
 *
 * WHAT WAS MISSING. The program could read the four documents in its own
 * corpus and nothing else: no way to open a file, no way to get a document
 * back out. Everything needed for all four of those already existed in
 * `@siksamitra/interop` — the native container, the Word writer, the importer
 * — and none of it was reachable from the window. This group is that wiring
 * and nothing more: it moves bytes between the disk and the same functions the
 * command-line tool uses, so there is no second implementation of any format.
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
import { RibbonButton, RibbonStack } from './RibbonButton.js';

/** What wrote the file. Stored in the manifest so a reader knows what derived
 *  it — see `DocumentManifest`. */
const ENGINE = 'siksamitra-web';

/** Hand the browser some bytes to save. */
function download(name: string, bytes: Uint8Array | string, type: string): void {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  /* Revoked on the next turn, not immediately: revoking in the same task can
     cancel the download in WebKit before it has read the blob. */
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A file name that is safe on all three platforms, from a document's title. */
const fileName = (title: string, ext: string): string =>
  `${(title.trim() === '' ? 'document' : title).replace(/[^\p{L}\p{N} .-]/gu, '_')}.${ext}`;

export function FileGroup(
  { doc, onOpen, onNote }: {
    doc: ChantDoc | null;
    /** A document read off the disk, ready to replace what is open. */
    onOpen: (doc: ChantDoc, name: string) => void;
    /** Say what happened — the status bar is where a refusal belongs. */
    onNote: (message: string) => void;
  },
): ReactNode {
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const open = async (file: File): Promise<void> => {
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
          onOpen(interop.unpackDocument(bytes).doc, file.name);
        } else {
          const result = await interop.importSmdoc(bytes);
          onOpen(result.doc, file.name);
          const marks = result.doc.overrides?.length ?? 0;
          onNote(
            `${file.name}: an older document, derived into this format`
            + (marks > 0 ? ` — ${marks} mark(s) kept as the author's own` : ''),
          );
        }
      } else if (ext === 'docx') {
        const { importDocx } = await import('@siksamitra/interop');
        const result = importDocx(bytes);
        onOpen(result.doc, file.name);
        if (result.report.unresolved.length > 0) {
          onNote(
            `${file.name}: ${result.report.unresolved.length} run(s) whose styling this `
            + 'version does not understand were kept as plain text',
          );
        }
      } else {
        onNote(`${file.name}: not a document this program reads (.smdoc, .vuchant, .docx)`);
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

  const save = async (): Promise<void> => {
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
      const bytes = await packDocument(doc, { slug: fileName(doc.title, 'smdoc'), engine: ENGINE });
      download(
        fileName(doc.title, 'smdoc'),
        bytes,
        'application/vnd.siksamitra.document+zip',
      );
    } catch (e) {
      onNote(`Could not save: ${e instanceof Error ? e.message : 'unknown error'}`);
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
        fileName(doc.title, 'docx'),
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
    <div className="rbg">
      <input
        ref={picker}
        type="file"
        accept=".smdoc,.vuchant,.docx"
        className="u-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          /* Cleared after reading, so opening the SAME file twice fires twice
             — otherwise the second attempt looks like a broken button. */
          e.target.value = '';
          if (file !== undefined) void open(file);
        }}
      />
      <RibbonButton
        icon="open"
        label="Open"
        size="lg"
        title="Open a .smdoc, a chant package or a Word document"
        disabled={busy}
        onClick={() => picker.current?.click()}
      />
      <RibbonStack>
        <RibbonButton
          icon="save"
          label="Save a copy"
          title="Write this document as a .smdoc — everything it holds, losslessly"
          disabled={doc === null || busy}
          onClick={() => void save()}
        />
        <RibbonButton
          icon="export"
          label="Export Word"
          title="Write a .docx using his own template's styles"
          disabled={doc === null || busy}
          onClick={() => void exportWord()}
        />
        <RibbonButton
          icon="print"
          label="Print / PDF"
          accel="Ctrl+P"
          title="Print, or save as PDF — the pages you see in Pages view"
          disabled={doc === null}
          onClick={() => window.print()}
        />
      </RibbonStack>
    </div>
  );
}
