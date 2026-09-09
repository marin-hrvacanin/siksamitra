/**
 * Putting a picture in, changing it, taking it out — and undoing all three.
 *
 * THE CONTROL FOR UNDO IS `canonicalJson`, which nothing in `@siksamitra/edit`
 * computes: a document that has had a picture inserted and then undone must be
 * byte-identical to the one that went in. That is the assertion the previous
 * undo test could not make — it compared the document with itself through the
 * same restore path — and it is how five of the eleven shipped documents were
 * found to be NOT byte-identical after an edit and its undo.
 *
 * The other expectations are written-out item lists, not lists the code under
 * test produced.
 */
import { describe, expect, it } from 'vitest';
import { canonicalJson, imageDataUri } from '@siksamitra/format';
import type { ChantDoc, ChantFigure } from '@siksamitra/format';
import { apply, newState, undo } from '../session.js';
import { emptyHistory } from '../history.js';
import { insertFigure, nextFigureId, removeFigure, updateFigure } from '../figures.js';

const PNG = imageDataUri(
  'image/png',
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk'
  + 'YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
);

const fig = (id: string, over: Partial<ChantFigure> = {}): ChantFigure => ({
  id, src: PNG, alt: 'A lit brass lamp.', width: 1, height: 1, ...over,
});

/** A document with one step, one verse and no picture in it. */
const doc = (): ChantDoc => ({
  title: 'A step',
  titleForms: {},
  sections: [{
    id: 's-1',
    verses: [{ id: 'v-1', tokens: [], src: { lines: ['agním īḷe'] } }],
    items: [
      { t: 'instruction', instruction: { text: { en: 'Light the lamp.' } } },
      { t: 'verse', id: 'v-1', tokens: [], src: { lines: ['agním īḷe'] } },
    ],
  }],
});

const kinds = (d: ChantDoc): string[] => (d.sections[0]?.items ?? []).map((i) => i.t);

describe('a picture as a section item', () => {
  it('goes in where it is put, and moves nothing else', () => {
    const done = insertFigure(doc().sections[0]!, 1, fig('fig-1'));
    expect(done.changed).toBe(true);
    expect(done.section.items?.map((i) => i.t)).toEqual(['instruction', 'figure', 'verse']);
    /* The verse is the same object it was — an insert must not rewrite one. */
    expect(done.section.verses).toEqual(doc().sections[0]!.verses);
  });

  it('clamps an index past the end rather than refusing it', () => {
    const done = insertFigure(doc().sections[0]!, 99, fig('fig-1'));
    expect(done.section.items?.map((i) => i.t)).toEqual(['instruction', 'verse', 'figure']);
  });

  it('takes a picture with no description, and says one is wanted', () => {
    /*
     * IT USED TO REFUSE. The owner: "photo name shouldn't be obligatory and
     * neither description — by default it should only insert the picture and
     * then in the picture tab can you set these." A dialog between choosing a
     * file and seeing it on the page is a dialog people learn to dismiss, and
     * a description written to get past one is not a description.
     */
    const before = doc().sections[0]!;
    const done = insertFigure(before, 1, fig('fig-1', { alt: '' }));
    expect(done.changed).toBe(true);
    expect(done.section).not.toBe(before);
    expect(done.notes.join(' ')).toContain('no description yet');
  });

  it('still refuses one that cannot be drawn at all', () => {
    /* A blocker is different in kind from something not written yet: a
       picture with no bytes is not a picture. */
    const before = doc().sections[0]!;
    const done = insertFigure(before, 1, fig('fig-1', { src: '' }));
    expect(done.changed).toBe(false);
    expect(done.section).toBe(before);
    expect(done.notes.join(' ')).toContain('has no picture');
  });

  it('copies a shared picture before changing it, and says so', () => {
    const shared = fig('shared', { size: 'small' });
    const section = { ...doc().sections[0]!, items: [{ t: 'figure' as const, ref: 'shared' }] };
    const done = updateFigure(
      section, 0, { size: 'full' }, (ref) => (ref === 'shared' ? shared : undefined),
      () => 'fig-2',
    );
    expect(done.changed).toBe(true);
    const item = done.section.items?.[0];
    expect(item?.t === 'figure' && item.figure?.id).toBe('fig-2');
    expect(item?.t === 'figure' && item.figure?.size).toBe('full');
    /* The library entry is untouched: the other steps still show the small one. */
    expect(shared.size).toBe('small');
    expect(done.notes.join(' ')).toContain('shared with other steps');
  });

  it('says so when there is no picture where it was told to look', () => {
    const done = removeFigure(doc().sections[0]!, 0);
    expect(done.changed).toBe(false);
    expect(done.notes.join(' ')).toContain('no picture at position 0');
  });

  it('picks an id nothing else is using', () => {
    expect(nextFigureId([])).toBe('fig-1');
    expect(nextFigureId(['fig-1', 'fig-3'])).toBe('fig-2');
  });
});

describe('through the session, with undo', () => {
  it('inserts, and Ctrl+Z gives back the very bytes that went in', () => {
    const before = doc();
    const bytes = canonicalJson(before);

    const put = apply(newState(before), emptyHistory(), {
      k: 'figure', sectionId: 's-1', at: 1, op: { kind: 'insert', figure: fig('fig-1') },
    });
    expect(kinds(put.state.doc)).toEqual(['instruction', 'figure', 'verse']);

    const back = undo(put.state, put.history);
    /* Byte for byte, by a function this package does not own. An undo that
       only "looks the same" changes the document's hash and its file. */
    expect(canonicalJson(back.state.doc)).toBe(bytes);
  });

  it('resizes, and the undo restores the size it had', () => {
    const put = apply(newState(doc()), emptyHistory(), {
      k: 'figure', sectionId: 's-1', at: 1,
      op: { kind: 'insert', figure: fig('fig-1', { size: 'small' }) },
    });
    const sized = apply(put.state, put.history, {
      k: 'figure', sectionId: 's-1', at: 1, op: { kind: 'update', patch: { size: 'full' } },
    });
    const sizeOf = (d: ChantDoc): unknown => {
      const item = d.sections[0]?.items?.[1];
      return item?.t === 'figure' ? item.figure?.size : undefined;
    };
    expect(sizeOf(sized.state.doc)).toBe('full');
    expect(sizeOf(undo(sized.state, sized.history).state.doc)).toBe('small');
  });

  it('records no undo step for a command that changed nothing', () => {
    const put = apply(newState(doc()), emptyHistory(), {
      k: 'figure', sectionId: 's-1', at: 0, op: { kind: 'remove' },
    });
    expect(put.history.past).toHaveLength(0);
    expect(put.state.refusals.join(' ')).toContain('no picture at position 0');
  });

  it('leaves the verses alone — a picture is not text', () => {
    const put = apply(newState(doc()), emptyHistory(), {
      k: 'figure', sectionId: 's-1', at: 1, op: { kind: 'insert', figure: fig('fig-1') },
    });
    expect(put.state.doc.sections[0]?.verses).toEqual(doc().sections[0]?.verses);
    expect(put.state.lostMarks).toEqual([]);
    expect(put.state.orphaned).toEqual([]);
    expect(put.state.reports).toEqual([]);
  });
});
