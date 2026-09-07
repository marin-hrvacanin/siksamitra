/**
 * Zoom, the page, and the three views.
 *
 * The invariant the whole paged view rests on is that PAGINATION IS INVARIANT
 * UNDER ZOOM: where a page breaks is decided in points, so zooming from 70% to
 * 250% cannot move a break. Nothing tested it, and nothing tested the fits —
 * which is how a fixed 100% ended up showing two thirds of an A4 page on a
 * 500px window with the rest behind a horizontal scrollbar.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE, DEFAULT_VIEW, MM_TO_PT, PAGE_SIZES, PT_TO_PX, VIEW_CYCLE, VIEW_MODES,
  clampZoom, contentBox, nextView, pageGeometry, pt, px, resolveZoom, stepZoom,
  themeFor, viewMode, zoomLabel, ZOOM_MAX, ZOOM_MIN,
} from '../index.js';

const A4 = PAGE_SIZES.a4!;

describe('the page, in points', () => {
  it('is A4 at 210 x 297 mm', () => {
    // Points, not pixels: a page is a PHYSICAL thing.
    expect(A4.width).toBeCloseTo(pt(210), 3);
    expect(A4.height).toBeCloseTo(pt(297), 3);
    expect(MM_TO_PT).toBeCloseTo(2.8346, 3);
  });

  it('has his own 25 mm margins, not an inch', () => {
    /* Measured off his PDF: a line at the margin starts at x = 70.9pt. */
    expect(A4.margins.left).toBeCloseTo(70.87, 1);
    expect(A4.margins.top).toBeCloseTo(70.87, 1);
  });

  it('has a text column of trim less margins', () => {
    const box = contentBox(A4);
    expect(box.width).toBeCloseTo(A4.width - 2 * A4.margins.left, 3);
    expect(box.height).toBeCloseTo(A4.height - 2 * A4.margins.top, 3);
    // 453.5pt, which is what a line has to fit in.
    expect(box.width).toBeCloseTo(453.5, 0);
  });

  it('refuses a size it does not know, by name', () => {
    /*
     * REFUSES rather than falling back. A page size that silently became A4
     * would produce a document paginated for a page nobody asked for, and the
     * export would disagree with the preview about where the paper ends.
     */
    expect(pageGeometry('a4')).toEqual(PAGE_SIZES.a4!);
    expect(() => pageGeometry('no-such-size')).toThrow(/unknown page size/);
    expect(pageGeometry(DEFAULT_PAGE).id).toBe(DEFAULT_PAGE);
  });

  it('converts points to pixels at 96 dpi, and only there', () => {
    expect(PT_TO_PX).toBeCloseTo(96 / 72, 6);
    expect(px(72, 1)).toBeCloseTo(96, 6);
    expect(px(72, 2)).toBeCloseTo(192, 6);
  });
});

describe('a zoom level', () => {
  it('stays inside its range', () => {
    expect(clampZoom(99)).toBe(ZOOM_MAX);
    expect(clampZoom(0.001)).toBe(ZOOM_MIN);
    expect(clampZoom(1)).toBe(1);
  });

  it('steps through the levels a person expects, and stops at the ends', () => {
    expect(stepZoom(1, 1)).toBeGreaterThan(1);
    expect(stepZoom(1, -1)).toBeLessThan(1);
    expect(stepZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
    expect(stepZoom(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
  });

  it('reads as a percentage', () => {
    expect(zoomLabel(1)).toBe('100%');
    expect(zoomLabel(0.665)).toMatch(/^6[67]%$/);
  });
});

describe('fitting a page to a window', () => {
  const wide = { width: 1600, height: 1000 };
  const narrow = { width: 500, height: 900 };

  it('a fixed zoom ignores the window', () => {
    expect(resolveZoom({ kind: 'fixed', value: 1 }, A4, narrow)).toBe(1);
    expect(resolveZoom({ kind: 'fixed', value: 1 }, A4, wide)).toBe(1);
  });

  it('fit-width puts the whole width of the page in the window', () => {
    const zoom = resolveZoom({ kind: 'fit-width' }, A4, narrow);
    const drawn = px(A4.width, zoom);
    expect(drawn).toBeLessThanOrEqual(narrow.width);
    /* And it uses the room it has: within the gutter, not half the window. */
    expect(drawn).toBeGreaterThan(narrow.width * 0.6);
  });

  it('fit-page puts the whole page in the window, both ways', () => {
    const zoom = resolveZoom({ kind: 'fit-page' }, A4, { width: 900, height: 500 });
    expect(px(A4.width, zoom)).toBeLessThanOrEqual(900);
    expect(px(A4.height, zoom)).toBeLessThanOrEqual(500);
  });

  it('fit-page is never larger than fit-width', () => {
    for (const viewport of [wide, narrow, { width: 900, height: 400 }]) {
      expect(resolveZoom({ kind: 'fit-page' }, A4, viewport))
        .toBeLessThanOrEqual(resolveZoom({ kind: 'fit-width' }, A4, viewport));
    }
  });

  it('never returns a zoom outside the range, however small the window', () => {
    for (const width of [1, 40, 200, 5000]) {
      const zoom = resolveZoom({ kind: 'fit-width' }, A4, { width, height: 400 });
      expect(zoom).toBeGreaterThanOrEqual(ZOOM_MIN);
      expect(zoom).toBeLessThanOrEqual(ZOOM_MAX);
    }
  });
});

describe('the three views', () => {
  it('are flow, pages and web, in that order', () => {
    expect(VIEW_CYCLE).toEqual(['flow', 'paged', 'web']);
    expect(DEFAULT_VIEW).toBe('flow');
  });

  it('cycle, and come back round', () => {
    let kind = DEFAULT_VIEW;
    const seen = [kind];
    for (let i = 0; i < VIEW_CYCLE.length; i += 1) {
      kind = nextView(kind);
      seen.push(kind);
    }
    expect(seen[seen.length - 1]).toBe(DEFAULT_VIEW);
    expect(new Set(seen).size).toBe(VIEW_CYCLE.length);
  });

  it('say which of them is paginated', () => {
    expect(VIEW_MODES.flow.paginated).toBe(false);
    expect(VIEW_MODES.paged.paginated).toBe(true);
    expect(VIEW_MODES.web.paginated).toBe(false);
  });

  it('are all editable — a view is a SHAPE, not a permission', () => {
    /*
     * Paged was always editable on purpose: a proofing mode you cannot correct
     * in makes you switch back, lose your place, and hunt for the line you
     * just saw. Web was read-only while it meant "a preview of the website";
     * now it means "no page, the text filling the window", and there is
     * nothing about a continuous column that makes a correction less safe.
     */
    for (const kind of VIEW_CYCLE) expect(viewMode(kind).editable, kind).toBe(true);
  });

  it('each say what they are FOR, in a sentence', () => {
    for (const kind of VIEW_CYCLE) {
      expect(viewMode(kind).purpose.length).toBeGreaterThan(10);
      expect(viewMode(kind).label.length).toBeGreaterThan(2);
    }
  });

  it('never override the appearance the author chose', () => {
    /*
     * The web view used to pin the site's own theme, so switching view
     * repainted the page in someone else's colours and threw the choice away.
     * A view decides the shape; the appearance is the author's, in every one
     * of them — the site's look included, one click away in Appearance.
     */
    for (const kind of VIEW_CYCLE) {
      expect(themeFor(kind, 'dark'), kind).toBe('dark');
      expect(themeFor(kind, 'light'), kind).toBe('light');
    }
  });
});
