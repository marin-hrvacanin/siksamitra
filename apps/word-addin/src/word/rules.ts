/**
 * THE RULES, RUN BECAUSE A PERSON ASKED — over the selection or the document.
 *
 * EVERY LINE BY ITS OWN RULES. A document may hold parts marked in different
 * registers (`word/rule-parts.ts` in interop), so a line is marked in its part's register,
 * or in the register of the lines outside every part — never in one register chosen for
 * the whole run. When a register is being CHANGED, the caller passes the new
 * one (`register`) and the one the lines are marked in now (`was`), which is
 * undone first; recording the change is the caller's, done before the run.
 *
 * Only lines the rules change are written, so a second run writes nothing.
 */
import type { ChantProfileKey, Stage, TextAndMarks } from '@siksamitra/format';
import {
  DEFAULT_PROFILE_KEY, STAGES, conventionsPatch, rerun, resolveProfile, showsLengthening, type ReRunMode,
} from '@siksamitra/engine';
import type { PartRules } from '@siksamitra/interop';
import { refusalOf, sameText, type Said } from './actions.js';
import { readDocument, writeDocument, type DocParagraph } from './client.js';
import { writeLines, type Line, type LineWrite, type Located } from './selection.js';
import { writeOf } from './line-write.js';
import { asMarkedBy } from '../model/provenance.js';
import { recordMarkedWith, recordedConventions, recordedMarkedWith, recordedRegister, recordedStages } from './settings.js';

const said = (text: string, kind: Said['kind'] = 'plain', lines: string[] = []): Said => ({ text, kind, lines });

export interface Rules {
  /** Which of the engine's stages run. */
  stages: ReadonlySet<Stage>;
  /** What becomes of markings placed by hand. */
  mode: ReRunMode;
  /** Mark in this register instead of each line's own — a register being changed. */
  register?: ChantProfileKey;
  /** What the lines are marked in NOW, when that is being changed. */
  was?: ChantProfileKey | null;
  /** The same, line by line — a selection that reached over several sources. */
  wasEach?: readonly (ChantProfileKey | null)[];
}

/** The rules a ribbon button runs: each line's own register, the stages the file records. */
export const defaultRules = (mode: ReRunMode = 'keep-hand'): Rules => ({ stages: recordedStages(), mode });

/** The register a line is recorded as marked in: its part's, or that of the lines outside every part. */
export const recordedFor = (part: PartRules | null): ChantProfileKey | null =>
  part?.register ?? recordedRegister();

/** What a line is to be marked in. */
export const targetOf = (rules: Rules, part: PartRules | null): ChantProfileKey =>
  rules.register ?? recordedFor(part) ?? DEFAULT_PROFILE_KEY;

/**
 * The register a line is marked in NOW, to be undone before the rules run.
 * What is RECORDED decides, because a register may carry marks another would
 * read differently — the corpus has overlines under a Ṛgveda with lengthening
 * switched off. Only where nothing is recorded does the line's own evidence
 * speak: the Ṛgveda's marks mean the Ṛgveda, and otherwise the line is taken
 * as marked in the register it is about to be marked in.
 */
function previousOf(tm: TextAndMarks, rules: Rules, part: PartRules | null, line = -1) {
  const each = rules.wasEach?.[line];
  const marked = each !== undefined ? each : rules.was !== undefined ? rules.was : recordedFor(part);
  return resolveProfile([{ preset: marked ?? (showsLengthening(tm) ? 'rigveda' : targetOf(rules, part)), patch: markedWith() }]);
}

/** The conventions the document is set to, over whatever register marks a line. */
const conventions = () => conventionsPatch(recordedConventions()) as never;
/** The conventions the text was last marked with (`recordedMarkedWith`), to undo. */
const markedWith = () => conventionsPatch(recordedMarkedWith() ?? recordedConventions()) as never;

/**
 * After a run: the text is marked with the conventions chosen now — recorded
 * the first time, and whenever EVERY line was re-marked. A run over some
 * lines leaves the others marked as they were, so it records nothing then.
 */
async function markedNow(everyLine: boolean): Promise<void> {
  if (everyLine || recordedMarkedWith() === null) await recordMarkedWith(recordedConventions());
}

/** One line re-run over `[from, to)`, by its own rules. */
function rerunLine(tm: TextAndMarks, from: number, to: number, rules: Rules, part: PartRules | null, line = -1) {
  const previous = previousOf(tm, rules, part, line);
  /* Word forgets which marks were the rules': told again first (`provenance.ts`). */
  return rerun(asMarkedBy(tm, previous), {
    stages: STAGES.filter((s) => rules.stages.has(s)),
    mode: rules.mode,
    profile: resolveProfile([{ preset: targetOf(rules, part), patch: conventions() }]),
    from, to,
    previous,
  });
}

/** The rules over the selection: a caret means its whole line, a selection the
 *  part of each line that is selected — recompute over a range, as the app does. */
export async function runOverSelection(here: Located, rules: Rules): Promise<Said> {
  const refused = refusalOf(here);
  if (refused !== null) return refused;
  const whole = here.lines.length === 1 && here.from === here.to;
  const range = (l: Line): [number, number] => (whole ? [0, l.tm.text.length] : [l.from, l.to]);
  const outs = here.lines.map((l, i) => {
    const [from, to] = range(l);
    return to > from ? rerunLine(l.tm, from, to, rules, l.part, i) : null;
  });
  const writes: LineWrite[] = [];
  outs.forEach((out, i) => {
    const l = here.lines[i]!;
    if (out === null) return;
    const tm = { text: out.text, marks: out.marks };
    if (!sameText(tm, l.tm)) writes.push(writeOf(l, i, tm));
  });
  await writeLines(writes);
  await markedNow(false);
  const done = outs.filter((o): o is NonNullable<typeof o> => o !== null);
  const lost = done.flatMap((o) => o.lost);
  const head = here.lines.length > 1
    ? `The selection: ${writes.length === 0 ? 'nothing to change' : `${writes.length} line(s) re-marked`}`
    : `${whole ? 'This line' : 'The selection'}: ${writes.length === 0 ? 'nothing to change' : done[0]?.note ?? ''}`;
  return said(head, lost.length === 0 ? 'plain' : 'warn', [
    ...done.flatMap((o) => o.warnings),
    ...lost.map((m) => `${m.k} at ${m.from} was placed by hand`),
  ]);
}

/**
 * The rules over every mantra line — or, with `only`, over the lines it keeps
 * (the register outside every part changing re-marks those lines, and
 * leaves each part to its own). A line in the way is left and listed.
 */
const EVERY_LINE = (): boolean => true;

export async function runOverDocument(rules: Rules, only: (p: DocParagraph) => boolean = EVERY_LINE): Promise<Said> {
  const { lines, shape } = await readDocument();
  const mantra = lines.filter(only);
  if (lines.length === 0) {
    return said('There are no mantra lines in this document to mark.', 'warn', [
      'A mantra line is one in the Mantra style (Translit in older documents). Type a line and mark it, '
        + 'or give lines the Mantra style from Word’s Styles gallery, and press again.',
    ]);
  }
  let lost = 0;
  const skipped = mantra.filter((p) => p.blocked.length > 0);
  const changed = mantra.filter((p) => p.blocked.length === 0).flatMap((p) => {
    const out = rerunLine(p.tm, 0, p.tm.text.length, rules, p.part);
    lost += out.lost.length;
    const tm = { text: out.text, marks: out.marks };
    return sameText(tm, p.tm) ? [] : [{ ...p, tm }];
  });
  const written = await writeDocument(changed, shape);
  await markedNow(only === EVERY_LINE && skipped.length === 0);
  return said(`${written === 0 ? 'Nothing to change' : `${written} mantra line(s) re-marked`}`
    + `${lost === 0 ? '' : `, ${lost} hand marking(s) could not be carried`}`
    + `${skipped.length === 0 ? '' : `, ${skipped.length} left alone`}.`,
  lost === 0 && skipped.length === 0 ? 'plain' : 'warn',
  skipped.map((p) => `line ${p.index + 1}: it has ${p.blocked.join(' and ')} on it`));
}
