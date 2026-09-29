/**
 * READ A MARKED FILE — a `.docx` or a `.pdf` — into a document. The one entry
 * point, for the CLI's `import` and for every gate that reads the owner's own
 * files, so a gate measures exactly what a person gets.
 *
 * A PDF's PAGE is read in Python (`tools/chant/vu_import.py`, where PyMuPDF and
 * the calibrated readers are): its rows, letters and marks, and nothing more.
 * The document is built here, by the same builder and run reader that read a
 * `.docx`. The title: one given wins, then the file's own, then its name.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { ChantDoc } from '@siksamitra/format';
import { importDocx, importPdfRows } from '@siksamitra/interop';
import type { ImportReport, PdfRow } from '@siksamitra/interop';

export class ImportFailure extends Error {
  constructor(message: string, readonly code: number) { super(message); }
}

export interface ImportedFile {
  doc: ChantDoc;
  report: ImportReport;
  /** What the PDF reader said on its way, for a caller to show. */
  notes: string;
}

export function importFile(path: string, opts: { title?: string; family?: string } = {}): ImportedFile {
  const bytes = new Uint8Array(readFileSync(path));
  const fallbackTitle = basename(path).replace(/\.(docx|pdf)$/i, '').normalize('NFC');
  if (!/\.pdf$/i.test(path)) {
    const { doc, report } = importDocx(bytes, opts.title, fallbackTitle);
    return { doc, report, notes: '' };
  }
  const rowsAt = join(mkdtempSync(join(tmpdir(), 'sm-pdf-')), 'rows.json');
  const r = spawnSync('python', [
    join('tools', 'chant', 'vu_import.py'), '--in', path, '--rows', rowsAt,
    ...(opts.family === undefined ? [] : ['--family', opts.family]),
  ], { encoding: 'utf8' });
  if (r.error !== undefined) {
    throw new ImportFailure('python is not on PATH — PDF import needs Python with PyMuPDF,'
      + ' or the vu-import sidecar in the desktop app', 2);
  }
  if (r.status !== 0) throw new ImportFailure(r.stderr.trim() || 'the PDF reader failed', r.status ?? 4);
  const page = JSON.parse(readFileSync(rowsAt, 'utf8')) as { rows: PdfRow[] };
  const { doc, report } = importPdfRows(page.rows, {
    ...(opts.title === undefined ? {} : { title: opts.title }), fallbackTitle, bytes: bytes.length,
  });
  return { doc, report, notes: r.stderr.trimEnd() };
}
