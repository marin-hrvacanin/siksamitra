/**
 * A PICTURE THE DOCUMENT NAMES AND DOES NOT HAVE.
 *
 * A `figure` item can carry its picture inline or point into
 * `ChantDoc.figures` by `ref` — one drawing used at five steps of the pūjā
 * manual ships once and is addressed five times. A `ref` that names nothing
 * was skipped by every reader in the program:
 *
 *   `figuresOf`            dropped it, so `documentFigureFaults` reported a
 *                          sound document
 *   the page               drew nothing at all
 *   the platform reader    the same
 *   the Word exporter      wrote nothing
 *   the editor's hook      the same
 *
 * Six pieces of code resolved `item.figure ?? library.get(item.ref)` and five
 * of them treated "not found" as nothing at all. Only `edit/figures.ts` said
 * so, and only when somebody tried to change it. So a document naming a
 * picture it does not have opened as a manual with a step missing, and there
 * was nothing anywhere to say why.
 *
 * `figureItem` is now the one resolution and its type makes the miss a case a
 * reader has to name. This file is about that arm.
 */
import { describe, expect, it } from 'vitest';
import type { ChantDoc, ChantFigure } from '@siksamitra/format';
import {
  danglingFigures, documentFigureFaults, figureItem, figureLibrary, figuresOf,
} from '../figure.js';

/** A one-pixel PNG, so the figure is legal in every other way. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'
  + 'AAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const lamp: ChantFigure = {
  id: 'fig-lamp', src: PNG, alt: 'A lit brass lamp.', width: 240, height: 160,
};

/** A document whose one section holds the given items. */
const doc = (items: unknown[], figures?: ChantFigure[]): ChantDoc => ({
  title: 'refs',
  titleForms: {},
  sections: [{ id: 's-1', verses: [], items: items as never }],
  ...(figures === undefined ? {} : { figures }),
} as ChantDoc);

describe('resolving one item', () => {
  const library = figureLibrary(doc([], [lamp]));

  it('an inline picture is itself', () => {
    const read = figureItem({ figure: lamp }, library);
    expect(read.figure).toBe(lamp);
    expect(read.missingRef).toBeUndefined();
  });

  it('a ref into the library finds it, and says it was a ref', () => {
    /* The `ref` comes back because a consumer needs to know the picture is
       SHARED — changing it in one step must not change it in five. */
    const read = figureItem({ ref: 'fig-lamp' }, library);
    expect(read.figure).toBe(lamp);
    expect(read.ref).toBe('fig-lamp');
  });

  it('an inline picture wins over a ref', () => {
    /* Both is a document a bad merge produces. The inline one is the more
       specific answer, and it is what every one of the six call sites did. */
    const other: ChantFigure = { ...lamp, id: 'fig-other', alt: 'Something else.' };
    expect(figureItem({ figure: other, ref: 'fig-lamp' }, library).figure).toBe(other);
  });

  it('a ref that names nothing is a MISS, with the name in it', () => {
    const read = figureItem({ ref: 'fig-ghost' }, library);
    expect(read.figure).toBeUndefined();
    expect(read.missingRef).toBe('fig-ghost');
  });

  it('and an item with neither is a miss that names nothing', () => {
    /* `''` rather than `undefined`, so a reader cannot confuse "no picture"
       with "no answer". */
    expect(figureItem({}, library).missingRef).toBe('');
  });
});

describe('what a document says about its dangling refs', () => {
  it('a ref naming nothing is reported, with the section and the name', () => {
    const faults = danglingFigures(doc([{ t: 'figure', ref: 'fig-ghost' }]));
    expect(faults).toHaveLength(1);
    expect(faults[0]).toContain('fig-ghost');
    expect(faults[0]).toContain('s-1');
  });

  it('an item with neither a picture nor a ref is reported too', () => {
    const faults = danglingFigures(doc([{ t: 'figure' }]));
    expect(faults).toHaveLength(1);
    expect(faults[0]).toContain('neither');
  });

  it('and a sound document reports nothing — the control', () => {
    /*
     * Without this, reporting every figure item would pass both cases above
     * and fail the corpus, which has 22 refs and no dangling one.
     */
    expect(danglingFigures(doc([{ t: 'figure', ref: 'fig-lamp' }], [lamp]))).toEqual([]);
    expect(danglingFigures(doc([{ t: 'figure', figure: lamp }]))).toEqual([]);
    expect(danglingFigures(doc([{ t: 'verse', id: 'v-1', tokens: [] }]))).toEqual([]);
  });

  it('the position is in the message, because five steps may share one name', () => {
    /* "no picture named X" is not actionable in a manual of 54 steps if it
       does not say WHICH step. */
    const faults = danglingFigures(doc([
      { t: 'verse', id: 'v-1', tokens: [] },
      { t: 'figure', ref: 'fig-ghost' },
      { t: 'figure', ref: 'fig-ghost' },
    ]));
    expect(faults).toHaveLength(2);
    expect(faults[0]).toContain('s-1/1');
    expect(faults[1]).toContain('s-1/2');
  });
});

describe('the validator the gate runs', () => {
  it('reports a dangling ref, which it used to call a sound document', () => {
    /*
     * THE MEASUREMENT OF THE FAULT. `documentFigureFaults` maps over
     * `figuresOf`, which DROPS an unresolved item — so the document with a
     * picture missing was the one the gate called sound.
     */
    const bad = doc([{ t: 'figure', ref: 'fig-ghost' }]);
    expect(figuresOf(bad)).toEqual([]);
    expect(documentFigureFaults(bad).length).toBeGreaterThan(0);
    expect(documentFigureFaults(bad)[0]).toContain('fig-ghost');
  });

  it('and still reports what is wrong with the pictures that ARE there', () => {
    /* The dangling ones are added to the existing faults, not instead of
       them: a document can have both. */
    const noAlt: ChantFigure = { id: 'fig-2', src: PNG, alt: '', width: 10, height: 10 };
    const both = doc([
      { t: 'figure', ref: 'fig-ghost' },
      { t: 'figure', figure: noAlt },
    ]);
    const faults = documentFigureFaults(both);
    expect(faults.some((f) => f.includes('fig-ghost'))).toBe(true);
    expect(faults.some((f) => f.includes('fig-2'))).toBe(true);
  });

  it('a sound document has no faults at all — the control', () => {
    expect(documentFigureFaults(doc([{ t: 'figure', figure: lamp }]))).toEqual([]);
  });
});
