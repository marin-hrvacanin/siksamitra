/**
 * WHICH OF A LINE'S MARKS THE RULES MADE — told again, since Word forgets.
 *
 * A marking carries whether a person or the rules placed it (`by`), and a
 * re-run keeps a person's and replaces the rules'. Word keeps no such record:
 * every mark read out of a document is `by: 'hand'`, so "Re-apply, keeping
 * what you placed by hand" kept EVERYTHING the rules had placed before.
 * Measured in real Word (`tools/word-ui/dirty.ts`): the visarga marked as a
 * change before `k` survived switching that convention off, and the raised u
 * survived switching it back — each taken for a person's.
 *
 * So the rules the line is marked in NOW (its register and the conventions
 * the text was last marked with) are asked what they make of it, and a mark
 * that is exactly one of theirs — same kind, same letters, same value — is
 * theirs again. Anything else stays a person's.
 *
 * Only where the rules give back the line's own letters: if the letters differ
 * the line was edited since, offsets no longer correspond, and nothing is
 * reclaimed — a person's mark is never taken for the rules' by accident of
 * position. A person's mark that happens to be exactly the rules' is taken
 * for theirs; without a record there is no telling the two apart, and it is
 * what the rules would put there anyway.
 */
import type { Mark, TextAndMarks } from '@siksamitra/format';
import { STAGES, rerun, type Profile } from '@siksamitra/engine';
import { mergeRuns, readParagraphs } from '@siksamitra/interop';
import { decodeRuns } from './paragraph.js';
import { lineXml } from './line-xml.js';

/*
 * IN THE FORM WORD GIVES BACK. The rules mark a visarga's change over the
 * letter AND the space after it (`27-29`); written to Word and read back it
 * is the letter alone (`27-28`). Compared as the rules made it, their own
 * mark — once through Word — was no longer theirs, and every Re-apply after
 * the first added the change again beside it (Puruṣa Sūktam v-6, found by
 * `word-idempotence.test.ts`). So their answer goes through the same writer
 * and reader the line did before it is compared.
 */
const asWordHasIt = (tm: TextAndMarks): TextAndMarks =>
  decodeRuns(mergeRuns(readParagraphs(lineXml({ tm, style: 'Mantra', script: 'iast', notes: [] }))[0]?.runs ?? []));

const key = (m: Pick<Mark, 'k' | 'from' | 'to' | 'v'>): string => `${m.k}|${m.from}|${m.to}|${m.v ?? ''}`;

/** The line with the marks `previous` would have made given back to the rules. */
export function asMarkedBy(tm: TextAndMarks, previous: Profile): TextAndMarks {
  let made: TextAndMarks;
  try {
    made = asWordHasIt(rerun(tm, { stages: STAGES, mode: 'replace-all', profile: previous, previous, from: 0, to: tm.text.length }));
  } catch {
    return tm;
  }
  if (made.text !== tm.text) return tm;
  const theirs = new Set(made.marks.filter((m) => m.k !== 'syl').map(key));
  return { text: tm.text, marks: tm.marks.map((m) => (m.by === 'hand' && theirs.has(key(m)) ? { ...m, by: 'rule' as const } : m)) };
}
