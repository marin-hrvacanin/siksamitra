/**
 * WRITING LINES IN ANOTHER SCRIPT — every mark kept, and back again exactly.
 *
 * A mantra line is one text in IAST and its markings, whatever it is written
 * in (`word/script-runs.ts` in interop): so writing it in Devanāgarī changes
 * nothing but what Word shows. The holdings, svaras, changes and aids are the
 * same markings, drawn the script's way, and writing the line in IAST again
 * gives back the very line — byte for byte, over the whole corpus
 * (`tests/integration/script-round-trip.test.ts`).
 *
 * Only MANTRA lines are rewritten. A heading or a translation is somebody's
 * prose, in whatever language it is in, and transliterating English would
 * turn it into nonsense.
 */
import { getScript, type ScriptKey } from '@siksamitra/engine';
import { refusalOf, type Said } from './actions.js';
import { readDocument, writeDocument } from './client.js';
import { writeLines, type LineWrite, type Located } from './selection.js';
import { writeOf } from './line-write.js';

const said = (text: string, kind: Said['kind'] = 'plain', lines: string[] = []): Said => ({ text, kind, lines });

/** The script's name as a reader knows it: the engine registry's. */
export const scriptName = (script: ScriptKey): string => getScript(script)?.name ?? script;

const NONE = [
  'A mantra line is one in the Mantra style (Translit in older documents). Headings and translations '
    + 'are left in the script they are in.',
];

/** The lines of the selection, written in `script`. */
export async function scriptSelection(here: Located, script: ScriptKey): Promise<Said> {
  const refused = refusalOf(here);
  if (refused !== null) return refused;
  const mantra = here.lines.filter((l) => l.isVerse);
  if (mantra.length === 0) return said('There is no mantra line here to write in another script.', 'warn', NONE);
  const writes: LineWrite[] = here.lines.flatMap((l, i) => (l.isVerse && l.script !== script
    ? [writeOf(l, i, l.tm, script)] : []));
  if (writes.length === 0) return said(`${mantra.length === 1 ? 'This line is' : 'These lines are'} in ${scriptName(script)} already.`);
  /* The caret, or the letters selected in one line, stay where they were —
     the same letters, now in the other script. */
  const one = here.lines.length === 1 ? here.lines[0]! : null;
  await writeLines(writes, one === null ? undefined : { line: 0, at: one.from, ...(one.to > one.from ? { to: one.to } : {}) });
  return said(`${writes.length} line(s) written in ${scriptName(script)}.`);
}

/** Every mantra line of the document, written in `script`. */
export async function scriptDocument(script: ScriptKey): Promise<Said> {
  const { lines, shape } = await readDocument();
  if (lines.length === 0) return said('There are no mantra lines in this document to write in another script.', 'warn', NONE);
  const skipped = lines.filter((p) => p.blocked.length > 0);
  const changed = lines.filter((p) => p.blocked.length === 0 && p.script !== script).map((p) => ({ ...p, script }));
  const written = await writeDocument(changed, shape);
  return said(`${written === 0 ? `Every mantra line is in ${scriptName(script)} already`
    : `${written} mantra line(s) written in ${scriptName(script)}`}${skipped.length === 0 ? '' : `, ${skipped.length} left alone`}.`,
  skipped.length === 0 ? 'plain' : 'warn',
  skipped.map((p) => `line ${p.index + 1}: it has ${p.blocked.join(' and ')} on it`));
}
