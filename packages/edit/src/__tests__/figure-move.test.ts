/**
 * DRAGGING A PICTURE SOMEWHERE ELSE — the arithmetic, and what it must not lose.
 *
 * The gap a person drops into is counted in the items AS THEY SEE THEM, and
 * the picture is lifted out before it is put back: an off-by-one here puts the
 * picture on the wrong side of the verse it was dropped beside, which looks
 * like a bug in the drag rather than in a subtraction.
 *
 * THE CONTROLS, none of which `moveFigure` computes:
 *
 *   - the item list is written out by hand, by the marker each item carries,
 *     and compared with a hand-written expectation. Not with a second splice.
 *   - the figure is FOUND in the result by searching for its id, and the index
 *     found is compared with `movedFigureIndex`. The search knows nothing
 *     about the arithmetic, so the two agreeing is a real check on it.
 *   - across steps, the total number of items in the WHOLE document is
 *     counted: a move that dropped one or duplicated one would change it, and
 *     both were possible while the undo step snapshotted one section.
 *   - undo is checked against `canonicalJson` — bytes, not a comparison
 *     through the same restore path.
 */
import { describe, expect, it } from 'vitest';
import { canonicalJson, imageDataUri } from '@siksamitra/format';
import type { ChantDoc, ChantFigure, ChantItem } from '@siksamitra/format';
import { moveFigure, movedFigureIndex } from '../figures.js';
import { apply, newState, undo } from '../session.js';
import { emptyHistory } from '../history.js';

const PNG = imageDataUri(
  'image/png',
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk'
  + 'YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
);

const fig = (id: string, over: Partial<ChantFigure> = {}): ChantFigure => ({
  id, src: PNG, alt: 'A lit brass lamp.', width: 1, height: 1, ...over,
});

const verse = (id: string): ChantItem => ({ t: 'verse', id, tokens: [], src: { lines: ['a'] } });
const note = (en: string): ChantItem => ({ t: 'instruction', instruction: { text: { en } } });

/**
 * Two steps. The first holds five items with the picture third, which is the
 * only arrangement where every case — up, down, both no-op gaps and the two
 * ends — is a different index.
 */
const doc = (over: Partial<ChantFigure> = {}): ChantDoc => ({
  title: 'Two steps',
  titleForms: {},
  sections: [
    {
      id: 's-1',
      verses: [],
      items: [note('one'), verse('v-1'), { t: 'figure', figure: fig('fig-1', over) },
        verse('v-2'), note('two')],
    },
    { id: 's-2', verses: [], items: [verse('v-3'), note('three')] },
  ],
});

/** What each item IS, written as one letter, so a list can be read at a glance. */
const shape = (d: ChantDoc, sectionId: string): string =>
  (d.sections.find((s) => s.id === sectionId)?.items ?? [])
    .map((i) => (i.t === 'figure' ? 'F' : i.t === 'verse' ? 'v' : 'n')).join('');

/** Where the picture actually IS, found by its id rather than worked out. */
function found(d: ChantDoc, id: string): { sectionId: string; at: number } | null {
  for (const s of d.sections) {
    const at = (s.items ?? []).findIndex((i) => i.t === 'figure' && i.figure?.id === id);
    if (at !== -1) return { sectionId: s.id, at };
  }
  return null;
}

const from = { sectionId: 's-1', at: 2 };

describe('moving a picture inside its own step', () => {
  it('carried to the top, and nothing else changes order', () => {
    const out = moveFigure(doc(), from, { sectionId: 's-1', at: 0 });
    expect(out.changed).toBe(true);
    expect(shape(out.doc, 's-1')).toBe('Fnvvn');
  });

  it('carried to the very end', () => {
    const out = moveFigure(doc(), from, { sectionId: 's-1', at: 5 });
    expect(shape(out.doc, 's-1')).toBe('nvvnF');
  });

  it('carried down one place, which is the gap AFTER the verse below it', () => {
    const out = moveFigure(doc(), from, { sectionId: 's-1', at: 4 });
    expect(shape(out.doc, 's-1')).toBe('nvvFn');
  });

  it('lands where `movedFigureIndex` says, for every gap', () => {
    for (let gap = 0; gap <= 5; gap += 1) {
      const to = { sectionId: 's-1', at: gap };
      const out = moveFigure(doc(), from, to);
      if (!out.changed) continue;
      /* Searched for, not computed. */
      expect(found(out.doc, 'fig-1')).toEqual({ sectionId: 's-1', at: movedFigureIndex(from, to) });
    }
  });

  it('does nothing for either gap the picture already touches', () => {
    for (const gap of [2, 3]) {
      const out = moveFigure(doc(), from, { sectionId: 's-1', at: gap });
      expect(out.changed).toBe(false);
      expect(out.notes).toEqual([]);
    }
  });
});

describe('moving a picture to another step', () => {
  it('leaves one step and joins the other, and there is still one of it', () => {
    const out = moveFigure(doc(), from, { sectionId: 's-2', at: 1 });
    expect(shape(out.doc, 's-1')).toBe('nvvn');
    expect(shape(out.doc, 's-2')).toBe('vFn');
    const all = out.doc.sections.flatMap((s) => s.items ?? []);
    expect(all).toHaveLength(7);
    expect(all.filter((i) => i.t === 'figure')).toHaveLength(1);
  });

  it('refuses a step that is not there, and changes nothing', () => {
    const out = moveFigure(doc(), from, { sectionId: 's-9', at: 0 });
    expect(out.changed).toBe(false);
    expect(out.notes.join(' ')).toContain('s-9');
    expect(canonicalJson(out.doc)).toBe(canonicalJson(doc()));
  });

  it('refuses to move an item that is not a picture', () => {
    const out = moveFigure(doc(), { sectionId: 's-1', at: 1 }, { sectionId: 's-2', at: 0 });
    expect(out.changed).toBe(false);
    expect(out.notes.join(' ')).toContain('no picture at position 1');
  });
});

describe('the side a drop takes', () => {
  const flowOf = (d: ChantDoc): string | undefined => {
    const site = found(d, 'fig-1');
    const item = site === null
      ? undefined
      : d.sections.find((s) => s.id === site.sectionId)?.items?.[site.at];
    return item?.t === 'figure' ? item.figure?.flow : undefined;
  };

  it('turns a picture that already floats round to the other side', () => {
    const out = moveFigure(doc({ flow: 'start' }), from, { sectionId: 's-1', at: 0, side: 'end' });
    expect(flowOf(out.doc)).toBe('end');
  });

  it('does NOT make a picture float that was not floating', () => {
    const out = moveFigure(doc({ flow: 'block' }), from, { sectionId: 's-1', at: 0, side: 'end' });
    expect(flowOf(out.doc)).toBe('block');
  });

  it('turning it round IN PLACE is a real change, not a no-op gap', () => {
    /* Gap 2 is the gap the picture already touches. Dropping there with the
       other side is still something the person did. */
    const out = moveFigure(doc({ flow: 'start' }), from, { sectionId: 's-1', at: 2, side: 'end' });
    expect(out.changed).toBe(true);
    expect(flowOf(out.doc)).toBe('end');
    expect(shape(out.doc, 's-1')).toBe('nvFvn');
  });
});

describe('undo, through the session', () => {
  it('puts a cross-step move back, to the byte', () => {
    const start = doc();
    const before = canonicalJson(start);
    const moved = apply(newState(start), emptyHistory(), {
      k: 'figure', sectionId: 's-1', at: 2, op: { kind: 'move', to: { sectionId: 's-2', at: 0 } },
    });
    expect(shape(moved.state.doc, 's-2')).toBe('Fvn');
    const back = undo(moved.state, moved.history);
    expect(canonicalJson(back.state.doc)).toBe(before);
  });

  it('is ONE step for one drag', () => {
    const moved = apply(newState(doc()), emptyHistory(), {
      k: 'figure', sectionId: 's-1', at: 2, op: { kind: 'move', to: { sectionId: 's-1', at: 0 } },
    });
    expect(moved.history.past).toHaveLength(1);
  });

  it('records nothing for a drag that put it back where it was', () => {
    const moved = apply(newState(doc()), emptyHistory(), {
      k: 'figure', sectionId: 's-1', at: 2, op: { kind: 'move', to: { sectionId: 's-1', at: 3 } },
    });
    expect(moved.history.past).toHaveLength(0);
  });
});
