/**
 * READING BACK A CHOICE SOMEBODY ELSE MAY HAVE WRITTEN.
 *
 * `localStorage` is input from outside the program: a person can edit it in a
 * console, an extension can clear half of it, and a build that has removed a
 * page size will meet the id it used to have. The dangerous one is exactly
 * that last case — `pageGeometry` THROWS on an unknown id, by design, and it is
 * called during the first render, so an unrecognised stored value would stop
 * the program from starting at all rather than showing the wrong paper.
 *
 * So the validation is a pure function and this is its whole surface.
 */
import { describe, expect, it } from 'vitest';
import { PAGE_SIZES, VIEW_MODES, ZOOM_MAX, ZOOM_MIN } from '@siksamitra/layout';
import { viewChoicesFrom } from '../view-store.js';

describe('a blob that is not choices at all', () => {
  for (const raw of [null, undefined, 7, 'paged', [], true]) {
    it(`${JSON.stringify(raw) ?? 'undefined'} yields nothing, rather than throwing`, () => {
      expect(viewChoicesFrom(raw)).toEqual({});
    });
  }
});

describe('the view', () => {
  it('every view this build has is accepted — by the registry, not a list here', () => {
    /* Read from `VIEW_MODES` so adding a fourth view does not silently fail to
       persist, which is the extension-point rule. */
    for (const kind of Object.keys(VIEW_MODES)) {
      expect(viewChoicesFrom({ view: kind }).view, kind).toBe(kind);
    }
  });

  it('and one this build has never heard of is dropped', () => {
    expect(viewChoicesFrom({ view: 'scroll' }).view).toBeUndefined();
    expect(viewChoicesFrom({ view: 3 }).view).toBeUndefined();
    /* `__proto__` and `constructor` are properties of every object; a plain
       `in` check would accept them and hand `viewMode` a function. */
    expect(viewChoicesFrom({ view: 'constructor' }).view).toBeUndefined();
  });
});

describe('the page size', () => {
  it('every size this build has is accepted', () => {
    for (const id of Object.keys(PAGE_SIZES)) {
      expect(viewChoicesFrom({ page: id }).page, id).toBe(id);
    }
  });

  it('and a size that has been removed from the build is dropped', () => {
    /*
     * THE ONE THAT WOULD HAVE STOPPED THE PROGRAM. `pageGeometry('legal')`
     * throws, and it is called while the first render is deciding how wide the
     * page is.
     */
    expect(viewChoicesFrom({ page: 'legal' }).page).toBeUndefined();
    expect(viewChoicesFrom({ page: 'toString' }).page).toBeUndefined();
  });
});

describe('the zoom', () => {
  it('a fit is kept as a fit, not as the number it happened to resolve to', () => {
    /* The point of a fit is that it is recomputed against the window that is
       open now. Stored as a number it would be the fit for a window that has
       been closed. */
    expect(viewChoicesFrom({ zoom: { kind: 'fit-width' } }).zoom).toEqual({ kind: 'fit-width' });
    expect(viewChoicesFrom({ zoom: { kind: 'fit-page' } }).zoom).toEqual({ kind: 'fit-page' });
  });

  it('a fixed zoom comes back as itself', () => {
    expect(viewChoicesFrom({ zoom: { kind: 'fixed', value: 0.9 } }).zoom)
      .toEqual({ kind: 'fixed', value: 0.9 });
  });

  it('and one outside this build’s range is clamped rather than refused', () => {
    /* A stored 8 is a build whose maximum used to be higher; the nearest legal
       zoom is a better answer than throwing the choice away. */
    expect(viewChoicesFrom({ zoom: { kind: 'fixed', value: 8 } }).zoom)
      .toEqual({ kind: 'fixed', value: ZOOM_MAX });
    expect(viewChoicesFrom({ zoom: { kind: 'fixed', value: 0.01 } }).zoom)
      .toEqual({ kind: 'fixed', value: ZOOM_MIN });
  });

  it('a zoom that is not a number at all is dropped', () => {
    /* `--doc-zoom: NaN` is a document drawn at no size, and nothing on screen
       says why. */
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, '1.5', null, undefined]) {
      expect(viewChoicesFrom({ zoom: { kind: 'fixed', value } }).zoom, String(value))
        .toBeUndefined();
    }
  });

  it('and a kind this build cannot resolve is dropped', () => {
    expect(viewChoicesFrom({ zoom: { kind: 'fit-height' } }).zoom).toBeUndefined();
    expect(viewChoicesFrom({ zoom: 1.5 }).zoom).toBeUndefined();
  });
});

describe('all three together', () => {
  it('a whole stored blob comes back whole — the control', () => {
    /*
     * Without this, dropping EVERYTHING would satisfy every case above and
     * nothing would ever be remembered.
     */
    expect(viewChoicesFrom({
      view: 'paged', page: 'a5', zoom: { kind: 'fixed', value: 0.9 },
    })).toEqual({ view: 'paged', page: 'a5', zoom: { kind: 'fixed', value: 0.9 } });
  });

  it('and one bad field does not take the good ones with it', () => {
    /* A person who edited the zoom by hand should still get their paper. */
    expect(viewChoicesFrom({ view: 'paged', page: 'a5', zoom: 'big' }))
      .toEqual({ view: 'paged', page: 'a5' });
  });

  it('an absent zoom stays absent, which is not the same as 100%', () => {
    /* Until a person takes the zoom over, it follows the window — 100 % while
       a page fits, fitted to the width when it does not. Storing a 1 here
       would freeze that on the first run. */
    expect(viewChoicesFrom({ view: 'flow', page: 'a4' }).zoom).toBeUndefined();
  });
});
