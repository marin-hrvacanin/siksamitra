/**
 * A NOTE IS NOT A MANTRA — the rules never run over it, and it is never lost.
 *
 * His lines carry notes after their letters — `… ॥ 4॥ p.b. sūryā̍d (with
 * svarita)`, `… suvaḥ । required as per taittirīya āraṇyaka 2.11.` — kept as a
 * `plain` marking `note` over the note's own text. Handed to the rules with
 * the verse, its words were derived as letters and the derivation dropped
 * them: running the rules over sūryopaniṣat 4 deleted the note, in the window
 * and in Word, and said only that "a hand marking could not be carried".
 *
 * So the notes are lifted out first, with the spaces that set them off, the
 * rules run over the mantra alone, and each note goes back after the same
 * letters it followed, carrying its marking. Nothing here is a rule.
 */
import type { Mark, TextAndMarks } from '@siksamitra/format';
import { normalise, shiftForEdit, textEdits } from '@siksamitra/format';
import type { ReRun, ReRunRequest } from './rerun.js';

const isNote = (m: Mark): boolean => m.k === 'plain' && m.v === 'note' && m.to > m.from;

interface Cut {
  /** Where the cut begins in the text: the spaces before the note, then it. */
  readonly from: number;
  readonly to: number;
  readonly lead: string;
  readonly note: Mark;
}

/** The re-run `run`, over the text without its notes; the notes put back. */
export function aroundNotes(
  tm: TextAndMarks,
  req: ReRunRequest,
  run: (tm: TextAndMarks, req: ReRunRequest) => ReRun,
): ReRun {
  const notes = tm.marks.filter(isNote).sort((a, b) => a.from - b.from);
  if (notes.length === 0) return run(tm, req);

  const cuts: Cut[] = notes.map((note) => {
    let from = note.from;
    while (from > 0 && /[ \t]/.test(tm.text[from - 1]!)) from -= 1;
    return { from, to: note.to, lead: tm.text.slice(from, note.from), note };
  });
  /* A position of the text, in the text without the notes. */
  const bareAt = (p: number): number => cuts.reduce((q, c) => (c.to <= p ? q - (c.to - c.from) : c.from < p ? q - (p - c.from) : q), p);
  let bare = tm.text;
  for (const c of [...cuts].reverse()) bare = bare.slice(0, c.from) + bare.slice(c.to);
  const marks = tm.marks
    .filter((m) => !isNote(m) && !cuts.some((c) => m.from >= c.from && m.to <= c.to && m.to > m.from))
    .map((m) => ({ ...m, from: bareAt(m.from), to: bareAt(m.to) }));

  const out = run({ text: bare, marks }, { ...req, from: bareAt(req.from), to: bareAt(req.to) });

  /* Where a place of the bare text went in the rules' text. */
  const edits = textEdits(bare, out.text);
  const moved = (p: number): number =>
    edits.filter((e) => e.to <= p).reduce((q, e) => q + e.inserted - (e.to - e.from), p);

  let text = out.text;
  let back: Mark[] = [...out.marks];
  for (const c of [...cuts].reverse()) {
    const at = moved(bareAt(c.from));
    const put = c.lead + tm.text.slice(c.note.from, c.note.to);
    text = text.slice(0, at) + put + text.slice(at);
    back = shiftForEdit(back, { from: at, to: at, inserted: put.length }).marks;
    back.push({ ...c.note, from: at + c.lead.length, to: at + put.length });
  }
  return { ...out, text, marks: normalise(back) };
}
