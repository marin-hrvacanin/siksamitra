/**
 * A PICTURE IS THE SAME PICTURE IN WORD AS ON THE PAGE.
 *
 * Two ways it was not, and both were invisible to every gate we had, because
 * the document travels in a `.docx` inside a custom XML part — so the round
 * trip was lossless while the thing Word DRAWS was wrong.
 *
 *   THE CROP STRETCHED IT. A fixed crop reserves a BOX and the page fits the
 *   picture inside it (`object-fit: contain`), so the empty band is around the
 *   picture. The exporter wrote the BOX as the drawing's extent, and a
 *   `<a:stretch>` fill fills whatever extent it is given — so a 240x160
 *   photograph with `crop: square` came out of Word 1:1, half again as tall as
 *   it is, with every face in it wrong. A distorted picture is not a
 *   difference of layout; it is the wrong picture.
 *
 *   A CAPTION BESIDE IT WAS IGNORED. `captionAt: 'beside'` gives the caption a
 *   share of the figure's width on the page and the picture gets the rest. The
 *   exporter asked for the FIGURE's width, so the picture was drawn about 47 %
 *   wider in Word, with the caption underneath.
 *
 * ASSERTED AGAINST THE PICTURE'S OWN BYTES — 240x160, a ratio of 2:3 — and
 * against `pictureWidth`, which `figure.css` splits the flex line with. Not
 * against numbers retyped here: `cx` and `cy` are read out of the XML with a
 * regular expression and compared with arithmetic done from the figure.
 */
import { describe, expect, it } from 'vitest';
import type { ChantFigure } from '@siksamitra/format';
import { figureWidth, pictureWidth } from '@siksamitra/tokens/figure';
import { figureDrawing, mediaFor, EMU_PER_INCH } from '../word/drawing.js';

/** A one-pixel PNG, so there are real bytes to embed. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'
  + 'AAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** 240 x 160: a landscape picture, ratio 2:3, as unlike a square as it gets. */
const fig = (over: Partial<ChantFigure> = {}): ChantFigure => ({
  id: 'fig-1', src: PNG, alt: 'A lit brass lamp.', width: 240, height: 160, ...over,
});

/** An A4 text column in EMU. */
const COLUMN = 5486400;
const EMU_PER_POINT = EMU_PER_INCH / 72;
/** What one rem is worth in EMU — 16 px, and 1 px is 0.75 pt. */
const REM = EMU_PER_POINT * 12;

const xmlFor = (f: ChantFigure): string => figureDrawing(f, mediaFor([f], 8).get(f.src), 1, COLUMN)!;
const extentOf = (f: ChantFigure): { cx: number; cy: number } => {
  const m = /<wp:extent cx="([-0-9]+)" cy="([-0-9]+)"\/>/.exec(xmlFor(f));
  if (m === null) throw new Error('no <wp:extent> in the drawing');
  return { cx: Number(m[1]), cy: Number(m[2]) };
};

describe('the drawing keeps the picture’s own shape', () => {
  it('a picture with no crop is drawn at its own ratio', () => {
    /* The control, and it comes first: `auto` is the overwhelming case and it
       must be untouched by everything below. */
    const { cx, cy } = extentOf(fig({ size: 'full' }));
    expect(cy / cx).toBeCloseTo(160 / 240, 3);
  });

  for (const crop of ['square', 'portrait', 'wide'] as const) {
    it(`a ${crop} crop does not stretch it`, () => {
      const { cx, cy } = extentOf(fig({ size: 'full', crop }));
      /*
       * THE ASSERTION IS THE PICTURE'S RATIO, not the crop's. Before the fix
       * `square` wrote cy === cx, which is a 240x160 photograph drawn 1:1.
       */
      expect(cy / cx, `${crop}: ${cx}x${cy}`).toBeCloseTo(160 / 240, 3);
    });
  }

  it('and a crop taller than the picture makes it NARROWER, not taller', () => {
    /*
     * `contain`: a 3:4 box is taller than a 2:3 picture, so the picture is
     * width-bound and fills the box's width. A 16:9 box is SHORTER than the
     * picture, so the height binds and the picture comes in narrower than the
     * box — which is exactly what the page draws.
     */
    const wide = extentOf(fig({ size: 'full', crop: 'wide' }));
    const auto = extentOf(fig({ size: 'full' }));
    expect(wide.cx).toBeLessThan(auto.cx);
    /* And it fits the box's height, which is what bound it. */
    expect(wide.cy).toBeCloseTo(auto.cx * (9 / 16), -3);
  });

  it('a portrait crop, which is taller than the picture, leaves it alone', () => {
    const portrait = extentOf(fig({ size: 'full', crop: 'portrait' }));
    const auto = extentOf(fig({ size: 'full' }));
    expect(portrait.cx).toBe(auto.cx);
    expect(portrait.cy).toBe(auto.cy);
  });

  it('every crop writes a positive extent Word can open', () => {
    /* `cx="0"` and `cx="-1"` are both a package Word offers to repair. */
    for (const crop of ['auto', 'square', 'portrait', 'wide'] as const) {
      const { cx, cy } = extentOf(fig({ size: 'thumb', crop }));
      expect(cx, crop).toBeGreaterThan(0);
      expect(cy, crop).toBeGreaterThan(0);
    }
  });
});

describe('a caption beside the picture takes its share', () => {
  const beside = { captionAt: 'beside' as const, caption: { en: 'A lit brass lamp.' } };

  it('the drawing is the PICTURE’s width, not the figure’s', () => {
    const { cx } = extentOf(fig({ size: 'full', ...beside }));
    expect(cx).toBeCloseTo(pictureWidth({ size: 'full', ...beside }, COLUMN, REM), -3);
  });

  it('which is narrower than the same figure with its caption below', () => {
    /*
     * THE MEASUREMENT OF THE FAULT. Before the fix these two were identical,
     * and the page drew them 47 % apart.
     */
    const above = extentOf(fig({ size: 'full', captionAt: 'below', caption: { en: 'x' } })).cx;
    const side = extentOf(fig({ size: 'full', ...beside })).cx;
    expect(side).toBeLessThan(above);
    expect(above / side).toBeGreaterThan(1.4);
  });

  it('and it keeps its shape while it shrinks', () => {
    /* A narrower picture at the same height is a squashed picture. */
    const { cx, cy } = extentOf(fig({ size: 'full', ...beside }));
    expect(cy / cx).toBeCloseTo(160 / 240, 3);
  });

  it('a caption BELOW takes no share — the control', () => {
    /* Without this, always subtracting the share would pass every case above
       and shrink every picture in every document. */
    const plain = extentOf(fig({ size: 'full' })).cx;
    const below = extentOf(fig({ size: 'full', captionAt: 'below', caption: { en: 'x' } })).cx;
    expect(below).toBe(plain);
    expect(plain).toBeCloseTo(figureWidth({ size: 'full' }, COLUMN, REM), -3);
  });

  it('and neither does an empty caption set beside', () => {
    /* `Figure` draws no `figcaption` for an empty caption, so there is nothing
       beside the picture to make room for. */
    const empty = extentOf(fig({ size: 'full', captionAt: 'beside', caption: { en: '' } })).cx;
    expect(empty).toBe(extentOf(fig({ size: 'full' })).cx);
  });
});
