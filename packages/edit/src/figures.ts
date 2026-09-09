/**
 * Putting a picture into a step, taking it out, and changing it.
 *
 * Pure, like everything in this package: a section in, a section out. The
 * session calls these and records the section it changed, so undo works for
 * nothing extra — a snapshot already restores a whole section, and a picture is
 * part of one.
 *
 * A PICTURE IS AN ITEM, and its position in `items` is its anchor. That is the
 * whole of the placement model and it is deliberate — see
 * `openspec/changes/document-images/design.md`, which sets out which of Word's
 * anchors survive here and why the other three do not.
 *
 * NO VERSE IS TOUCHED, so nothing is re-derived. Inserting a picture cannot
 * cost a mark, cannot orphan a recording and cannot reach a transcribed verse,
 * which is why the session dispatches these before rule zero runs rather than
 * through it.
 */
import type { ChantDoc, ChantFigure, ChantItem, ChantSection } from '@siksamitra/format';
import { FIGURE_DEFAULTS, figureBlockers, figureNudges } from '@siksamitra/format';

/** What a figure command did, and anything it had to say about it. */
export interface FigureResult {
  readonly section: ChantSection;
  /** Empty when nothing happened that a person needs to know about. */
  readonly notes: readonly string[];
  /** False when the command found nothing to do; the section is unchanged. */
  readonly changed: boolean;
}

const unchanged = (section: ChantSection, why: string): FigureResult =>
  ({ section, notes: [why], changed: false });

/** A section's items, whichever field is holding them. */
function itemsOf(section: ChantSection): ChantItem[] {
  if (section.items !== undefined) return [...section.items];
  return section.verses.map((v) => ({ t: 'verse', ...v }) as ChantItem);
}

const write = (section: ChantSection, items: ChantItem[]): ChantSection =>
  ({ ...section, items });

/**
 * An id no figure in the document is using.
 *
 * Document-wide rather than per section, because `ChantDoc.figures` is one
 * library addressed by id: a second `fig-3` in another step would make a `ref`
 * ambiguous, and the ambiguity would only show as the wrong drawing at one of
 * the two places.
 */
export function nextFigureId(taken: Iterable<string>): string {
  const used = new Set(taken);
  for (let n = 1; ; n += 1) {
    const id = `fig-${n}`;
    if (!used.has(id)) return id;
  }
}

/** Every figure id a document has spoken for — the library and every item. */
export function figureIdsIn(sections: readonly ChantSection[], library: readonly ChantFigure[]):
Set<string> {
  const out = new Set(library.map((f) => f.id));
  for (const section of sections) {
    for (const item of section.items ?? []) {
      if (item.t === 'figure' && item.figure !== undefined) out.add(item.figure.id);
      if (item.t === 'verse') for (const f of item.figures ?? []) out.add(f.id);
    }
  }
  return out;
}

/**
 * Put a picture into a step, before the item now at `at`.
 *
 * `at` is clamped rather than refused. The caller works it out from where the
 * caret is, and a caret at the end of the last verse of a section produces an
 * index one past the end — which is a legal place to put a picture and a silly
 * thing to refuse.
 *
 * A FAULTY FIGURE IS REFUSED HERE and not further down — except for a missing
 * description, which is REPORTED and let through. `figureFaults` is the one
 * definition of what a picture may be, and letting a picture with no bytes or
 * a 40 MB one into a document to be caught by a gate later means it is already
 * saved. A missing description is different in kind: it is something the
 * person has not written YET, and the Picture tab is where they write it. See
 * the note on `figureFaults`.
 */
export function insertFigure(
  section: ChantSection, at: number, figure: ChantFigure,
): FigureResult {
  const blockers = figureBlockers(figure, `the picture "${figure.id}"`);
  if (blockers.length > 0) return { section, notes: blockers, changed: false };
  const items = itemsOf(section);
  const where = Math.max(0, Math.min(at, items.length));
  items.splice(where, 0, { t: 'figure', figure });
  return {
    section: write(section, items),
    notes: figureNudges(figure, `the picture "${figure.id}"`),
    changed: true,
  };
}

/**
 * Change one picture in place.
 *
 * A REFERENCED FIGURE IS COPIED FIRST. `{ t: 'figure', ref }` points into
 * `ChantDoc.figures`, and the pūjā manual uses one añjali drawing at three
 * steps; resizing it at one of them would resize it at all three, which is not
 * what anybody pressing a button on one picture means. So the reference becomes
 * an inline copy carrying the change, the other sites keep the shared one, and
 * the person is told — because a command that quietly turns one thing into two
 * is a command whose effect nobody can predict.
 */
export function updateFigure(
  section: ChantSection,
  at: number,
  patch: Partial<ChantFigure>,
  resolve: (ref: string) => ChantFigure | undefined,
  freshId: () => string,
): FigureResult {
  const items = itemsOf(section);
  const item = items[at];
  if (item === undefined || item.t !== 'figure') {
    return unchanged(section, `there is no picture at position ${at} of "${section.id}"`);
  }

  const notes: string[] = [];
  let base = item.figure;
  if (base === undefined) {
    const found = item.ref === undefined ? undefined : resolve(item.ref);
    if (found === undefined) {
      return unchanged(section, `the picture "${String(item.ref)}" is not in this document`);
    }
    base = { ...found, id: freshId() };
    notes.push(
      `"${found.id}" is shared with other steps, so this one is now a copy `
      + `("${base.id}") and the change applies only here`,
    );
  }

  /*
   * A FIELD PATCHED TO `undefined` IS REMOVED, not written as undefined.
   *
   * Clearing a caption is `{ caption: undefined }`, and a plain spread leaves
   * the key present holding undefined. `canonicalJson` drops it, so the file is
   * right — but the in-memory figure then has a key the type says is absent,
   * and every `'caption' in fig` downstream disagrees with every
   * `fig.caption !== undefined`. Absent means absent.
   */
  const merged = { ...base, ...patch } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) if (v === undefined) delete merged[k];
  const next = merged as unknown as ChantFigure;
  /* A missing description is reported, not refused — see `insertFigure`. It
     would otherwise be impossible to CLEAR one, which is a thing a person may
     legitimately want while they think of a better sentence. */
  const blockers = figureBlockers(next, `the picture "${next.id}"`);
  if (blockers.length > 0) return { section, notes: blockers, changed: false };

  items[at] = { t: 'figure', figure: next };
  return { section: write(section, items), notes, changed: true };
}

/**
 * Where a dragged picture ENDS UP, given where it was and which gap it was
 * dropped in.
 *
 * `to.at` counts the gaps in the items as the person saw them, so a drop below
 * the picture's own position has shifted down by one once the picture is
 * lifted out. Exported because the window has to select the picture where it
 * landed, and two subtractions of one are two chances to select the item
 * beside it.
 */
export const movedFigureIndex = (
  from: { sectionId: string; at: number },
  to: { sectionId: string; at: number },
): number => (from.sectionId === to.sectionId && to.at > from.at ? to.at - 1 : to.at);

/**
 * Take the picture out of one place and put it in another.
 *
 * DRAGGING IS THE GESTURE THIS EXISTS FOR, and it is why `to` counts gaps in
 * the items as they are NOW rather than after the removal. A drop indicator is
 * drawn between two items the person can see; making the caller subtract one
 * when it is dragging downwards inside the same step is arithmetic nobody
 * would get right twice.
 *
 * ACROSS STEPS AS WELL. A picture's anchor is its position in a section's
 * items, so moving it to another section is the same operation with a
 * different list — and dragging a drawing from one step of the puja manual to
 * the next is a thing somebody will do on the first day.
 *
 * A SIDE, NOT A POSITION. A floating picture dropped in the left half of the
 * column floats left and in the right half floats right, because that is what
 * dragging a wrapped picture does in Word. A picture that is NOT floating is
 * not made to float by being dragged: its flow is a decision taken on the
 * Picture tab, and a drag that silently changed it would be a drag whose
 * effect could not be predicted.
 */
export function moveFigure(
  doc: ChantDoc,
  from: { sectionId: string; at: number },
  to: { sectionId: string; at: number; side?: 'start' | 'end' },
): FigureApplied {
  const source = doc.sections.find((s) => s.id === from.sectionId);
  const target = doc.sections.find((s) => s.id === to.sectionId);
  if (source === undefined) {
    return { doc, notes: [`no step "${from.sectionId}"`], changed: false };
  }
  if (target === undefined) {
    return { doc, notes: [`no step "${to.sectionId}"`], changed: false };
  }
  const out = itemsOf(source);
  const item = out[from.at];
  if (item === undefined || item.t !== 'figure') {
    return {
      doc,
      notes: [`there is no picture at position ${from.at} of "${from.sectionId}"`],
      changed: false,
    };
  }

  /* The one place a side is applied, and only to a picture that already
     floats. `side` is undefined for a drop in the middle of the column. */
  const flow = item.figure?.flow;
  const moved: ChantItem = to.side !== undefined && item.figure !== undefined
    && (flow === 'start' || flow === 'end') && flow !== to.side
    ? { ...item, figure: { ...item.figure, flow: to.side } }
    : item;

  const same = from.sectionId === to.sectionId;
  /* Dropping in either gap touching the picture leaves it where it is. A
     silent undo step for a drag that did nothing is a Ctrl+Z that appears to
     do nothing too. */
  if (same && (to.at === from.at || to.at === from.at + 1) && moved === item) {
    return { doc, notes: [], changed: false };
  }

  out.splice(from.at, 1);
  const into = same ? out : itemsOf(target);
  into.splice(Math.max(0, Math.min(movedFigureIndex(from, to), into.length)), 0, moved);

  const sections = doc.sections.map((s) => {
    if (s.id === to.sectionId) return write(s, into);
    if (s.id === from.sectionId) return write(s, out);
    return s;
  });
  return { doc: { ...doc, sections }, notes: [], changed: true };
}

/** Take a picture out. */
export function removeFigure(section: ChantSection, at: number): FigureResult {
  const items = itemsOf(section);
  const item = items[at];
  if (item === undefined || item.t !== 'figure') {
    return unchanged(section, `there is no picture at position ${at} of "${section.id}"`);
  }
  items.splice(at, 1);
  return { section: write(section, items), notes: [], changed: true };
}

/**
 * A figure with every axis it did not name filled in.
 *
 * Used when a picture is inserted, so that what is written to the document is
 * what is drawn — a figure whose size is absent draws `medium`, and a person
 * who then presses Medium would see the button do nothing.
 */
export const withFigureDefaults = (fig: ChantFigure): ChantFigure => ({
  size: FIGURE_DEFAULTS.size,
  flow: FIGURE_DEFAULTS.flow,
  captionAt: FIGURE_DEFAULTS.captionAt,
  crop: FIGURE_DEFAULTS.crop,
  frame: FIGURE_DEFAULTS.frame,
  rounded: FIGURE_DEFAULTS.rounded,
  ...fig,
});

/* ==========================================================================
   The command the session dispatches
   ========================================================================== */

/**
 * Put a picture in, change one, or take one out.
 *
 * ONE command for all six gestures — insert, replace, resize, align, caption,
 * delete — rather than six, because they differ only in the patch: a resize
 * and a re-alignment are both "this figure, with one field changed", and
 * splitting them would be six places for undo to be got wrong.
 *
 * `at` is an index into the section's `items`, which is a picture's whole
 * anchor.
 */
export interface FigureCommand {
  k: 'figure';
  sectionId: string;
  at: number;
  op:
  | { kind: 'insert'; figure: ChantFigure }
  | { kind: 'update'; patch: Partial<ChantFigure> }
  | { kind: 'remove' }
  /* Dragged somewhere else. `to.at` counts the gaps in the destination's items
     as they are now — see `moveFigure`. */
  | { kind: 'move'; to: { sectionId: string; at: number; side?: 'start' | 'end' } };
}

/** Every section a figure command can touch, so the undo step covers both. */
export const figureSectionsTouched = (command: FigureCommand): string[] =>
  (command.op.kind === 'move' && command.op.to.sectionId !== command.sectionId
    ? [command.sectionId, command.op.to.sectionId]
    : [command.sectionId]);

/** The document as the command leaves it, and anything it had to say. */
export interface FigureApplied {
  readonly doc: ChantDoc;
  readonly notes: readonly string[];
  readonly changed: boolean;
}

/**
 * Run one figure command over a document.
 *
 * Here rather than in `session.ts` because none of the session's machinery is
 * involved: no source is written, nothing is re-derived, no mark is rebased.
 * The session's remaining job is the undo step, which is the same one every
 * command records.
 */
export function applyFigureCommand(
  doc: ChantDoc, section: ChantSection, command: FigureCommand,
): FigureApplied {
  const library = doc.figures ?? [];
  if (command.op.kind === 'move') {
    return moveFigure(doc, { sectionId: command.sectionId, at: command.at }, command.op.to);
  }
  const done = command.op.kind === 'insert'
    ? insertFigure(section, command.at, command.op.figure)
    : command.op.kind === 'remove'
      ? removeFigure(section, command.at)
      : updateFigure(
        section, command.at, command.op.patch,
        (ref) => library.find((f) => f.id === ref),
        () => nextFigureId(figureIdsIn(doc.sections, library)),
      );
  if (!done.changed) return { doc, notes: done.notes, changed: false };
  return {
    doc: {
      ...doc,
      sections: doc.sections.map((s) => (s.id === section.id ? done.section : s)),
    },
    notes: done.notes,
    changed: true,
  };
}
