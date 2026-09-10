/**
 * A PICTURE'S WRAP, INTO WORD AND BACK.
 *
 * Word asks two questions about a picture and this program used to answer them
 * with one: `flow` meant both "which side" and "let the text run beside it",
 * so there was no way to put a picture on the left AND keep a mantra's line
 * whole. On the page the second half was hard-wired the other way —
 * `.verse { clear: both }` cleared every float at every verse — so a picture
 * set to Left had nothing beside it and the button looked inert.
 *
 * Now the picture carries `wrap`, and this checks that the `.docx` says what
 * the picture says:
 *
 *   top-bottom, centred   `wp:inline` — Word's own default, in the text line
 *   top-bottom, a side    `wp:anchor` + `wp:wrapTopAndBottom`, aligned
 *   square                `wp:anchor` + `wp:wrapSquare`, aligned
 *
 * ASSERTED AGAINST WORD'S OWN VOCABULARY — the element names from the
 * WordprocessingML drawing schema — and then round-tripped through the READER,
 * which is a different piece of code and the only control that matters: a
 * writer and a reader that agree with each other while both being wrong about
 * Word is exactly what this repository has been caught doing before.
 */
import { describe, expect, it } from 'vitest';
import { FIGURE_DEFAULTS, type ChantFigure } from '@siksamitra/format';
import { figureDrawing, mediaFor } from '../word/drawing.js';
import { readDrawings } from '../docx-figures.js';

/** A one-pixel PNG, so there are real bytes to embed. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'
  + 'AAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const fig = (over: Partial<ChantFigure> = {}): ChantFigure => ({
  id: 'fig-1', src: PNG, alt: 'A lit brass lamp.', width: 240, height: 160, ...over,
});

/** An A4 text column in EMU, which is what the drawing is measured against. */
const COLUMN = 5486400;

const drawingFor = (f: ChantFigure): string => {
  const media = mediaFor([f], 8);
  return figureDrawing(f, media, 1, COLUMN);
};

describe('what the .docx says the text should do', () => {
  it('a centred top-and-bottom picture is INLINE, like Word\'s own default', () => {
    const xml = drawingFor(fig({ flow: 'block', wrap: 'top-bottom' }));
    expect(xml).toContain('<wp:inline');
    expect(xml).not.toContain('<wp:anchor');
  });

  it('a square wrap is an anchor with wrapSquare', () => {
    const xml = drawingFor(fig({ flow: 'start', wrap: 'square' }));
    expect(xml).toContain('<wp:anchor');
    expect(xml).toContain('<wp:wrapSquare');
    expect(xml).not.toContain('<wp:wrapTopAndBottom');
  });

  it('a top-and-bottom picture WITH a side is an anchor with wrapTopAndBottom', () => {
    /*
     * THE CASE THAT WAS UNREPRESENTABLE. Every picture that named a side was
     * written as a square wrap, so a document meant to keep text off a mantra
     * arrived in Word with the text flowing beside it anyway.
     */
    const xml = drawingFor(fig({ flow: 'end', wrap: 'top-bottom' }));
    expect(xml).toContain('<wp:anchor');
    expect(xml).toContain('<wp:wrapTopAndBottom');
    expect(xml).not.toContain('<wp:wrapSquare');
  });

  it('and the side it names is the side Word is told', () => {
    expect(drawingFor(fig({ flow: 'start', wrap: 'square' })))
      .toContain('<wp:align>left</wp:align>');
    expect(drawingFor(fig({ flow: 'end', wrap: 'square' })))
      .toContain('<wp:align>right</wp:align>');
    expect(drawingFor(fig({ flow: 'end', wrap: 'top-bottom' })))
      .toContain('<wp:align>right</wp:align>');
  });

  it('a picture with no wrap of its own gets the default, which is a band', () => {
    /* Absent must mean `top-bottom`, or an old document opens with its text
       suddenly flowing beside every mantra. */
    expect(FIGURE_DEFAULTS.wrap).toBe('top-bottom');
    const xml = drawingFor(fig({ flow: 'end' }));
    expect(xml).toContain('<wp:wrapTopAndBottom');
  });

  it('only a square wrap takes a gutter towards the text', () => {
    /* Top-and-bottom has no text beside it, so a side gutter would be space
       reserved for nothing. */
    expect(drawingFor(fig({ flow: 'start', wrap: 'square' }))).toMatch(/distR="[1-9]/);
    expect(drawingFor(fig({ flow: 'start', wrap: 'top-bottom' }))).toContain('distR="0"');
  });
});

describe('and the reader gets back what the writer said', () => {
  /*
   * THE CONTROL, and the only one worth having: the reader is a different
   * piece of code from the writer. Two halves that agree with each other while
   * both being wrong about Word is the failure this repository has already
   * been caught making.
   */
  const roundTrip = (f: ChantFigure): { side?: string; wrap?: string } => {
    const [read] = readDrawings(`<w:p>${drawingFor(f)}</w:p>`);
    return { ...(read?.side === undefined ? {} : { side: read.side }),
      ...(read?.wrap === undefined ? {} : { wrap: read.wrap }) };
  };

  it('square on the left comes back square on the left', () => {
    expect(roundTrip(fig({ flow: 'start', wrap: 'square' })))
      .toEqual({ side: 'start', wrap: 'square' });
  });

  it('square on the right comes back square on the right', () => {
    expect(roundTrip(fig({ flow: 'end', wrap: 'square' })))
      .toEqual({ side: 'end', wrap: 'square' });
  });

  it('a band on the right comes back a band on the right', () => {
    expect(roundTrip(fig({ flow: 'end', wrap: 'top-bottom' })))
      .toEqual({ side: 'end', wrap: 'top-bottom' });
  });

  it('a band on the left comes back a band on the left', () => {
    expect(roundTrip(fig({ flow: 'start', wrap: 'top-bottom' })))
      .toEqual({ side: 'start', wrap: 'top-bottom' });
  });

  it('a centred picture comes back with neither, and draws as a centred block', () => {
    /* Inline has no side and no wrap in Word's vocabulary; `figureOf` turns
       that absence into `flow: block, wrap: top-bottom`. */
    expect(roundTrip(fig({ flow: 'block', wrap: 'top-bottom' }))).toEqual({});
  });

  it('every side-and-wrap combination survives, none collapsing into another', () => {
    /*
     * The whole matrix at once. Written as a table so a combination that
     * starts coming back as a DIFFERENT one is named, rather than showing up
     * as one of the four cases above quietly agreeing with its neighbour.
     */
    const seen = new Set<string>();
    for (const flow of ['start', 'end'] as const) {
      for (const wrap of ['square', 'top-bottom'] as const) {
        const back = roundTrip(fig({ flow, wrap }));
        expect(back, `${flow}/${wrap}`).toEqual({ side: flow, wrap });
        seen.add(`${back.side}/${back.wrap}`);
      }
    }
    expect(seen.size).toBe(4);
  });
});

describe('a width no drag would produce still writes a .docx Word can open', () => {
  /*
   * `widthPct` is floored at 5 and capped at 100 by the drag that produces it,
   * and by `figureBlockers` for a document being validated — and neither guard
   * is on the EXPORT path. A `.json` is a file a person can edit.
   *
   * `cx="-2880000"` and `cx="NaN"` are both a package Word offers to REPAIR
   * rather than open, so one bad number costs the whole document, and the only
   * report of it is "the file appears to be corrupted".
   */
  const cxOf = (xml: string): string => /<wp:extent cx="([^"]*)"/.exec(xml)?.[1] ?? 'absent';

  const bad: readonly { what: string; widthPct: number }[] = [
    { what: 'negative', widthPct: -50 },
    { what: 'zero', widthPct: 0 },
    { what: 'past a hundred', widthPct: 400 },
    { what: 'not a number', widthPct: Number.NaN },
    { what: 'infinite', widthPct: Number.POSITIVE_INFINITY },
  ];

  for (const { what, widthPct } of bad) {
    it(`a ${what} width is drawn as a real number of EMU`, () => {
      const cx = cxOf(drawingFor(fig({ widthPct })));
      expect(cx, `cx="${cx}"`).toMatch(/^[1-9][0-9]*$/);
      expect(Number(cx)).toBeGreaterThan(0);
      expect(Number(cx)).toBeLessThanOrEqual(COLUMN);
    });
  }

  it('and a sensible width is untouched — the control', () => {
    /* Without this, clamping everything to one value would pass every case
       above and make every picture the same size. */
    const half = Number(cxOf(drawingFor(fig({ widthPct: 50 }))));
    const quarter = Number(cxOf(drawingFor(fig({ widthPct: 25 }))));
    expect(half).toBeCloseTo(COLUMN / 2, -3);
    expect(quarter).toBeCloseTo(COLUMN / 4, -3);
    expect(half).toBeGreaterThan(quarter);
  });

  it('and the height keeps the picture shape whatever the width was', () => {
    /* A clamped width with an unclamped height is a stretched picture. */
    const xml = drawingFor(fig({ widthPct: -50 }));
    const cx = Number(cxOf(xml));
    const cy = Number(/<wp:extent[^>]*cy="([^"]*)"/.exec(xml)?.[1] ?? '0');
    expect(cy).toBeGreaterThan(0);
    /* 240x160 bytes, `crop: auto` — so the drawn ratio is the file's. */
    expect(cy / cx).toBeCloseTo(160 / 240, 1);
  });
});
