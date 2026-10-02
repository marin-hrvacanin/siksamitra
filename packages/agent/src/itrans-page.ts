/**
 * A SOURCE IN ITRANS, READ AS LETTERS.
 *
 * sanskritdocuments publishes every text from one `.itx` file — ITRANS, the
 * ASCII scheme its volunteers type in (`shrIsUryAShTottarashatanAmastotram`) —
 * and its HTML and PDF are made from it. A real run fetched the `.itx`, built
 * from its lines, and was refused ten times: the program held its IAST to
 * letters it could not read (2026-10-02). So an `.itx` page is read into IAST
 * when it is kept, by the engine's own reader (`toIast(…, 'itrans')`, with the
 * spellings sanskritdocuments uses — `readAlso`), a line for a line, so its
 * line numbers stay the file's. Its header (`% …`) and its typesetting
 * (`\documentstyle`, `#include`, `\def …`) are left as they are: they are no
 * text, and nothing is built from them.
 */
import { toIast } from '@siksamitra/engine';

/** Whether a page is an ITRANS source file: an `.itx` address, or its header and its typesetting. */
export function isItransPage(url: string, lines: readonly string[]): boolean {
  if (/\.itx(?:$|[?#])/iu.test(url)) return true;
  return lines.some((l) => /^%\s*Text title\s*:/u.test(l)) && lines.some((l) => /\\begin\{document\}|#indian|\\documentstyle/u.test(l));
}

/** A line of the file that is no text: its header, its typesetting, an empty line. */
const markup = (line: string): boolean => /^\s*(?:%|\\(?!-)|#|$)/u.test(line);

/**
 * The file's lines, its text read into IAST. Its own in-line marks go first:
 * `\-` (its table's column rule, a dash), `##` (a line's end), `..` (a
 * title's daṇḍa) — then the letters.
 */
export function readItrans(lines: readonly string[]): string[] {
  return lines.map((line) => {
    if (markup(line)) return line;
    const text = line.replace(/\\-/gu, '-').replace(/##/gu, '').replace(/\.\.(?=\s|$)/gu, '||');
    /* ITRANS is a registered script but no document's (`ChantScriptKey`): read-only, as its module says. */
    return toIast(text, 'itrans' as Parameters<typeof toIast>[1]).iast.normalize('NFC');
  });
}
