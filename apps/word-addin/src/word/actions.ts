/**
 * WHAT A BUTTON DOES — the same whether it is pressed in the pane, on the
 * ribbon tab, or in the right-click menu.
 *
 * Out of the pane's React hook so that the ribbon's function file calls the
 * very code the pane does: a second copy of "press Short" in the function file
 * would be a second answer to what Short means, and the two would drift the
 * first time one of them was fixed. Every function here reads Word through
 * `selection.ts` and `client.ts`, decides with `@siksamitra/edit` and
 * `@siksamitra/engine`, and answers with what to SAY — never with a thrown
 * error for something a person did.
 */
import type { ChantProfileKey, Stage, TextAndMarks } from '@siksamitra/format';
import { CHANT_PROFILE_NOTES } from '@siksamitra/format';
import { STAGES, rerun, resolveProfile, showsLengthening, type ReRunMode } from '@siksamitra/engine';
import { applyAcross, typeAt, type MarkCommand } from '@siksamitra/edit';
import { notCarried } from '../model/carry.js';
import { readDocument, writeDocument } from './client.js';
import { writeLines, type Line, type LineWrite, type Located } from './selection.js';
import { recordRegister, recordedRegister } from './settings.js';

/** What to tell the person, in one line and any detail under it. */
export interface Said {
  text: string;
  kind: 'plain' | 'warn';
  lines: string[];
}

const said = (text: string, kind: Said['kind'] = 'plain', lines: string[] = []): Said => ({ text, kind, lines });

/** The rules as the pane sets them: which register, which stages, and what
 *  becomes of markings placed by hand. */
export interface Rules {
  register: ChantProfileKey;
  stages: ReadonlySet<Stage>;
  mode: ReRunMode;
}

/** The rules a ribbon button runs: the document's own register, every stage,
 *  and the hand kept. */
export const defaultRules = (): Rules => ({
  register: recordedRegister() ?? 'taittiriya', stages: new Set(STAGES), mode: 'keep-hand',
});

/** One text and its markings, in an order that does not depend on how they
 *  were produced — so "did the rules change this line?" has one answer. `by`
 *  is left out: Word cannot store it, and every line read out of Word says
 *  `hand`. */
const canon = (tm: TextAndMarks): string => JSON.stringify([tm.text, tm.marks
  .map(({ by: _by, ...m }) => JSON.stringify(m)).sort()]);
export const sameText = (a: TextAndMarks, b: TextAndMarks): boolean => canon(a) === canon(b);

/**
 * Why this selection may not be written, or `null` if it may. Asked of EVERY
 * line: a press over five lines where one has a picture writes none of them
 * rather than four, so nothing half-happens.
 */
export function refusalOf(here: Located): Said | null {
  const many = here.lines.length > 1;
  const where = (i: number): string => (many ? `line ${i + 1} of the selection` : 'this line');
  const blocked = here.lines.findIndex((l) => l.blocked.length > 0);
  if (blocked >= 0) {
    return said(`Left alone: ${where(blocked)} has ${here.lines[blocked]!.blocked.join(' and ')} on it, `
      + 'and rewriting it would lose that.', 'warn', ['Move it to a line of its own, or remove it, and press again.']);
  }
  const lost = here.lines.flatMap((l, i) => l.unresolved.filter((u) => u.lossy)
    .map((u) => `${many ? `line ${i + 1}: ` : ''}${u.what}: ${u.raw}`));
  if (lost.length > 0) {
    return said(`Refusing to write: ${many ? 'the selection' : 'this line'} carries text the reader cannot place.`,
      'warn', lost);
  }
  return null;
}

/** A marking button pressed over the selection. */
export async function markSelection(here: Located, command: MarkCommand): Promise<Said> {
  const refused = refusalOf(here);
  if (refused !== null) return refused;
  const results = applyAcross(here.lines, command);
  const writes: LineWrite[] = [];
  results.forEach((r, i) => {
    const l = here.lines[i]!;
    const tm = { text: r.text ?? l.tm.text, marks: r.marks };
    if (!sameText(tm, l.tm)) writes.push({ line: i, tm, style: l.style, wordText: l.wordText });
  });
  await writeLines(writes);
  const undrawable = results.flatMap((r) => notCarried(r.marks));
  const note = here.lines.length === 1 ? results[0]!.note : `${writes.length} of ${here.lines.length} lines changed`;
  return said(note, undrawable.length === 0 ? 'plain' : 'warn', undrawable.map((l) => l.why));
}

/**
 * A character from the insert palette, typed at the caret or over the
 * selected letters of one line. Through the model and the writer, never
 * Word's own typing — so it takes exactly the style it should and the next
 * letter is not dragged into it (`typeAt`). The caret comes back after it.
 */
export async function typeInSelection(here: Located, ch: string): Promise<Said> {
  if (here.lines.length > 1) {
    return said('Select within one line to type over it — this selection runs over several.', 'warn');
  }
  const refused = refusalOf(here);
  if (refused !== null) return refused;
  const l = here.lines[0]!;
  const t = typeAt(l.tm, l.from, l.to, ch);
  const tm = { text: t.text, marks: t.marks };
  if (sameText(tm, l.tm)) return said(t.note, 'warn');
  await writeLines([{ line: 0, tm, style: l.style, wordText: l.wordText }], { line: 0, at: t.caret });
  return said('');
}

/**
 * The register a line is marked in NOW, to be undone before the chosen one
 * runs. What the document RECORDS decides, because a register may carry marks
 * another would read differently — the corpus has overlines under a Ṛgveda
 * with lengthening switched off. Only where nothing is recorded does the
 * line's own evidence speak: the Ṛgveda's marks mean the Ṛgveda, and otherwise
 * the line is taken as marked in the register chosen.
 */
function previousOf(tm: TextAndMarks, chosen: ChantProfileKey) {
  const marked = recordedRegister();
  return resolveProfile([{ preset: marked ?? (showsLengthening(tm) ? 'rigveda' : chosen) }]);
}

/** After a run: the document is marked in the register just used — unless only
 *  part of it was, into a register the rest is not in; then that is said. */
async function remember(whole: boolean, chosen: ChantProfileKey): Promise<string | null> {
  const marked = recordedRegister();
  if (whole || marked === null || marked === chosen) {
    await recordRegister(chosen);
    return null;
  }
  return `Only these lines are ${CHANT_PROFILE_NOTES[chosen].name} now; `
    + `the rest of the document stays ${CHANT_PROFILE_NOTES[marked].name}.`;
}

const requestOf = (rules: Rules) => ({
  stages: STAGES.filter((s) => rules.stages.has(s)),
  mode: rules.mode,
  profile: resolveProfile([{ preset: rules.register }]),
});

/** The rules over the selection: a caret means its whole line, a selection the
 *  part of each line that is selected — recompute over a range, as the app does. */
export async function runOverSelection(here: Located, rules: Rules): Promise<Said> {
  const refused = refusalOf(here);
  if (refused !== null) return refused;
  const { stages, mode, profile } = requestOf(rules);
  const whole = here.lines.length === 1 && here.from === here.to;
  const range = (l: Line): [number, number] => (whole ? [0, l.tm.text.length] : [l.from, l.to]);
  const outs = here.lines.map((l) => {
    const [from, to] = range(l);
    return to > from ? rerun(l.tm, { stages, mode, profile, from, to, previous: previousOf(l.tm, rules.register) }) : null;
  });
  const writes: LineWrite[] = [];
  outs.forEach((out, i) => {
    const l = here.lines[i]!;
    if (out === null) return;
    const tm = { text: out.text, marks: out.marks };
    if (!sameText(tm, l.tm)) writes.push({ line: i, tm, style: l.style, wordText: l.wordText });
  });
  await writeLines(writes);
  const mixed = await remember(false, rules.register);
  const done = outs.filter((o): o is NonNullable<typeof o> => o !== null);
  const lost = done.flatMap((o) => o.lost);
  const head = here.lines.length > 1
    ? `The selection: ${writes.length === 0 ? 'nothing to change' : `${writes.length} line(s) re-marked`}`
    : `${whole ? 'This line' : 'The selection'}: ${writes.length === 0 ? 'nothing to change' : done[0]?.note ?? ''}`;
  return said(head, lost.length === 0 ? 'plain' : 'warn', [
    ...(mixed === null ? [] : [mixed]), ...done.flatMap((o) => o.warnings),
    ...lost.map((m) => `${m.k} at ${m.from} was placed by hand`),
  ]);
}

/** The rules over every mantra line. Only lines the rules change are written,
 *  so a second run writes nothing; a line in the way is left and listed. */
export async function runOverDocument(rules: Rules): Promise<Said> {
  const { stages, mode, profile } = requestOf(rules);
  const { lines, total } = await readDocument();
  let lost = 0;
  const skipped = lines.filter((p) => p.blocked.length > 0);
  const changed = lines.filter((p) => p.blocked.length === 0).flatMap((p) => {
    const out = rerun(p.tm, {
      stages, mode, profile, from: 0, to: p.tm.text.length, previous: previousOf(p.tm, rules.register),
    });
    lost += out.lost.length;
    const tm = { text: out.text, marks: out.marks };
    return sameText(tm, p.tm) ? [] : [{ ...p, tm }];
  });
  const written = await writeDocument(changed, total);
  await remember(true, rules.register);
  return said(`${written === 0 ? 'Nothing to change' : `${written} mantra line(s) re-marked`}`
    + `${lost === 0 ? '' : `, ${lost} hand marking(s) could not be carried`}`
    + `${skipped.length === 0 ? '' : `, ${skipped.length} left alone`}.`,
  lost === 0 && skipped.length === 0 ? 'plain' : 'warn',
  skipped.map((p) => `line ${p.index + 1}: it has ${p.blocked.join(' and ')} on it`));
}
