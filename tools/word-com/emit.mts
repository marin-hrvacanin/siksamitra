/**
 * THE PAYLOADS THE REAL-WORD GATE HANDS TO WORD.
 *
 * Node builds the XML — it is the add-in's own code that does it, imported
 * here rather than restated — and PowerShell hands it to Word over COM.
 * `Range.InsertXML` and `Range.WordOpenXML` are the COM twins of the add-in's
 * `insertOoxml` and `getOoxml`: the same flat OPC package on both sides, so
 * what Word does with it here is what Word does with it in the task pane.
 *
 * Written as files rather than passed as arguments because a flat OPC package
 * is 30 kB of XML with quotes in it, and a command line is not a place for
 * that.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { flatPackage } from '../../apps/word-addin/src/model/opc.js';
import { paragraphsXml } from '../../apps/word-addin/src/model/paragraph.js';
import { styleSheet, styleSheetFor } from '../../apps/word-addin/src/model/sheet.js';
import { specimenBody, styleIds } from '../../apps/word-addin/src/model/setup.js';
import { specimenMarks } from '../../apps/word-addin/src/model/specimen-text.js';

export interface Payloads {
  readonly dir: string;
  /** The style specimen, as a package ready for `InsertXML`. */
  readonly specimen: string;
  /** One marked mantra line, as a package. */
  readonly marked: string;
  /** Every style id the sheet declares, `Normal` included. */
  readonly styles: readonly string[];
  /** The marked line's text, for comparing what Word shows. */
  readonly text: string;
}

export function writePayloads(dir = 'artifacts/word-live'): Payloads {
  mkdirSync(dir, { recursive: true });
  const sheet = styleSheet();
  const tm = specimenMarks();
  const marked = paragraphsXml(tm);

  /* The specimen carries the PLAIN sheet — his vocabulary, which is what it
     demonstrates. A marked line carries the sheet for its OWN body, which is
     what `writeParagraph` sends and what has to define `Reference`. */
  const specimen = flatPackage(specimenBody(sheet, marked), sheet);
  const one = flatPackage(marked, styleSheetFor(marked));
  writeFileSync(join(dir, 'specimen.xml'), specimen, 'utf8');
  writeFileSync(join(dir, 'marked.xml'), one, 'utf8');

  return {
    dir,
    specimen: join(dir, 'specimen.xml'),
    marked: join(dir, 'marked.xml'),
    styles: styleIds(sheet).map((s) => s.id),
    text: tm.text,
  };
}
