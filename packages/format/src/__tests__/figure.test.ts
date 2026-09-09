/**
 * What a picture in a document is allowed to be.
 *
 * The expectations here are constants and Node's own base64 decoder — never a
 * value produced by the code under test. `figureBytes` computes a length from
 * the base64 string without decoding it, so the control is `Buffer.from(…,
 * 'base64').length`, which is a different implementation arriving at the same
 * number by a different route.
 */
import { describe, expect, it } from 'vitest';
import {
  figureBytes, figureFaults, figuresOf, documentFigureFaults, imageDataUri,
  imageMediaType, isEmbeddedImage, FIGURE_MAX_BYTES, figureBlockers, figureNudges } from '../figure.js';
import type { ChantDoc, ChantFigure } from '../chant.js';

/** A real 1x1 transparent PNG, 70 bytes: the 8-byte signature, IHDR, IDAT and
 *  IEND, checked by reading the chunk names out of the decoded bytes. */
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk'
  + 'YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG = imageDataUri('image/png', PNG_B64);

const fig = (over: Partial<ChantFigure> = {}): ChantFigure => ({
  id: 'fig-1',
  src: PNG,
  alt: 'A lit brass lamp on a tall stand.',
  width: 1,
  height: 1,
  ...over,
});

describe('a picture the document carries', () => {
  it('counts its bytes the way a decoder does', () => {
    /* The control is Node's decoder, not our arithmetic. */
    const decoded = Buffer.from(PNG_B64, 'base64').length;
    expect(decoded).toBe(70);
    expect(figureBytes(PNG)).toBe(decoded);
  });

  it('counts nothing for a picture that is only named', () => {
    expect(figureBytes('/figures/puja-vidhi/step-dipa.png?v=2be24db2')).toBe(0);
    expect(isEmbeddedImage('/figures/puja-vidhi/step-dipa.png')).toBe(false);
    expect(isEmbeddedImage(PNG)).toBe(true);
  });

  it('reads the media type off the front', () => {
    expect(imageMediaType(PNG)).toBe('image/png');
    expect(imageMediaType('https://example.org/a.png')).toBeNull();
  });
});

describe('what is wrong with a figure', () => {
  it('accepts a complete one', () => {
    expect(figureFaults(fig())).toEqual([]);
  });

  it('asks for a description, and does not block on one', () => {
    /* A NUDGE, not a blocker: `figureFaults` reports it and `figureBlockers`
       does not, which is what lets a picture be inserted before anybody has
       written a sentence about it. */
    expect(figureFaults(fig({ alt: '' })).join(' ')).toContain('no description yet');
    expect(figureFaults(fig({ alt: '   ' })).join(' ')).toContain('no description yet');
    expect(figureBlockers(fig({ alt: '' }))).toEqual([]);
    expect(figureNudges(fig({ alt: '' })).join(' ')).toContain('no description yet');
  });

  it('holds a dragged width to the range a picture can be', () => {
    expect(figureBlockers(fig({ widthPct: 58 }))).toEqual([]);
    expect(figureBlockers(fig({ widthPct: 1 })).join(' ')).toContain('outside');
    expect(figureBlockers(fig({ widthPct: 140 })).join(' ')).toContain('outside');
  });

  it('refuses a description that only repeats the caption', () => {
    const said = 'Añjali mudrā';
    const faults = figureFaults(fig({ alt: said, caption: { en: said } }));
    expect(faults.join(' ')).toContain('repeats its caption');
  });

  it('refuses an SVG, which is a script host', () => {
    const svg = imageDataUri('image/svg+xml', 'PHN2Zy8+');
    expect(figureFaults(fig({ src: svg })).join(' ')).toContain('may not hold');
  });

  it('refuses a picture over the ceiling', () => {
    /* One byte past it, built as base64 rather than as bytes: 4 characters per
       3 bytes, so this is the smallest string that decodes to more than the
       ceiling. The control is the ceiling itself, which the test does not
       compute. */
    const over = Math.ceil(((FIGURE_MAX_BYTES + 1) * 4) / 3);
    const huge = imageDataUri('image/png', 'A'.repeat(over));
    expect(figureBytes(huge)).toBeGreaterThan(FIGURE_MAX_BYTES);
    expect(figureFaults(fig({ src: huge })).join(' ')).toContain('over the');
  });

  it('refuses an auto crop with no intrinsic size, because nothing then reserves its space', () => {
    const faults = figureFaults(fig({ crop: 'auto', width: undefined, height: undefined }));
    expect(faults.join(' ')).toContain('nothing reserves its space');
    /* A fixed crop reserves the box on its own, so the same figure is fine. */
    expect(figureFaults(fig({ crop: 'square', width: undefined, height: undefined }))).toEqual([]);
  });

  it('names a value outside a vocabulary', () => {
    const faults = figureFaults(fig({ size: 'enormous' as never }));
    expect(faults.join(' ')).toContain('size "enormous"');
  });
});

describe('finding every picture in a document', () => {
  const doc: ChantDoc = {
    title: 'A manual',
    titleForms: {},
    figures: [fig({ id: 'shared', alt: 'The shared drawing.' })],
    sections: [
      {
        id: 's-1',
        verses: [],
        items: [
          { t: 'figure', figure: fig({ id: 'inline' }) },
          { t: 'figure', ref: 'shared' },
          { t: 'figure', ref: 'nowhere' },
          {
            t: 'verse',
            id: 'v-1',
            tokens: [],
            figures: [fig({ id: 'on-the-verse' })],
          },
        ],
      },
    ],
  };

  it('takes all three placements, and skips a reference that resolves to nothing', () => {
    /* The expectation is written out rather than derived: the inline figure,
       the resolved reference, and the one hanging off the verse. `nowhere`
       resolves to nothing and contributes none. */
    expect(figuresOf(doc).map((f) => f.figure.id))
      .toEqual(['inline', 'shared', 'on-the-verse']);
  });

  it('says where each one is, by item index', () => {
    expect(figuresOf(doc).map((f) => f.at)).toEqual([0, 1, -1]);
    expect(figuresOf(doc).every((f) => f.sectionId === 's-1')).toBe(true);
  });

  it('reports a fault under the section and figure it is in', () => {
    const bad: ChantDoc = {
      ...doc,
      figures: [],
      sections: [{
        id: 's-2', verses: [], items: [{ t: 'figure', figure: fig({ alt: '' }) }],
      }],
    };
    expect(documentFigureFaults(bad)).toEqual([
      's-2/fig-1: has no description yet — add one on the Picture tab, so '
      + 'somebody who cannot see it can still follow the step',
    ]);
  });
});
