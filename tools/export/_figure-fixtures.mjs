/**
 * WHAT THE PICTURE GATE IS LOOKING AT — the pictures, and the documents.
 *
 * Split out of `gate-figures.mjs` when it crossed the 400-line limit
 * `check:modules` holds new code to. The division is the honest one: what the
 * gate MEASURES is one thing and what it measures it ON is another — and the
 * fixtures are the half that has to be a known quantity, which is why the
 * picture is written byte by byte here rather than read from a file that could
 * quietly be replaced by something nearly the same colour.
 */
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { loadDoc } from './page.mjs';

export const CORPUS = 'corpus/chants';
export const FIXED = '2026-01-01T00:00:00.000Z';

/* ==========================================================================
   A picture, made here rather than fetched
   ========================================================================== */

const CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return (bytes) => {
    let c = -1;
    for (const b of bytes) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(name, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(name, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(Buffer.concat([Buffer.from(name, 'ascii'), body])), 0);
  return Buffer.concat([head, body, crc]);
}

/**
 * A solid rectangle, as a real PNG.
 *
 * Written by hand rather than taken from a fixture file so that the gate's
 * input is a known quantity: the colour asserted against in check 4 is the one
 * put in here, and there is no chance of a fixture being replaced by something
 * that happens to be nearly the same colour.
 */
export function solidPng(width, height, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: truecolour
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 3);
    for (let x = 0; x < width; x += 1) {
      raw[row + 1 + x * 3] = r;
      raw[row + 2 + x * 3] = g;
      raw[row + 3 + x * 3] = b;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A colour nothing in any theme uses, so a pixel of it can only be the
 *  picture: full-strength magenta. */
export const INK = [255, 0, 255];
export const PICTURE = solidPng(400, 300, INK);
/** Taller than any page this program prints — for check 6. */
export const TALL = solidPng(300, 4000, [0, 160, 90]);
export const TALL_SRC = `data:image/png;base64,${TALL.toString('base64')}`;
export const SRC = `data:image/png;base64,${PICTURE.toString('base64')}`;
export const ALT = 'A solid magenta rectangle, four hundred by three hundred.';
export const MISSING_ALT = 'A lit brass oil lamp on a tall stand.';
/** Long enough to run to several lines in either width — see check 5b. */
export const PROSE = 'Take the lamp in the right hand, circle it three times before '
  + 'the deity at the level of the heart, and set it down to the right of the '
  + 'vessel before beginning the next offering.';

/** One step, one embedded picture, one picture the document only names. */
export const withPictures = () => ({
  title: 'A step with pictures',
  titleForms: {},
  version: 3,
  sections: [{
    id: 'sec-1',
    title: 'Dīpa',
    verses: [],
    items: [
      {
        t: 'figure',
        figure: {
          id: 'fig-1', src: SRC, alt: ALT, width: 400, height: 300,
          size: 'full', flow: 'block', captionAt: 'below', crop: 'auto',
          frame: 'none', rounded: true, caption: { en: 'The test rectangle' },
        },
      },
      {
        t: 'figure',
        figure: {
          id: 'fig-2', src: '/figures/puja-vidhi/step-dipa.png?v=2be24db2',
          alt: MISSING_ALT, width: 512, height: 512, size: 'small', crop: 'square',
        },
      },
    ],
  }],
});

/**
 * A real chant with a picture floated into it.
 *
 * Durgā Sūktam rather than a made-up verse, because the question is whether a
 * PĀDA fits, and only a real pāda has a real length.
 */
export function withFloat({ wrap = 'square' } = {}) {
  const it = loadDoc(join(CORPUS, 'durga-suktam.json'));
  const items = [...it.sections[0].items];
  const at = items.findIndex((x, i) => i > 1 && x.t === 'verse');
  items.splice(at, 0, {
    t: 'figure',
    figure: {
      id: 'fig-float', src: SRC, alt: ALT, width: 400, height: 300,
      /*
       * `wrap` IS THE PARAMETER, because it is now the picture's own answer to
       * "may the text run beside me" — and the gate needs both readings. The
       * default here is `square`, so a caller asking for a float gets one;
       * `top-bottom` is what the APPLICATION defaults to, and the gate takes
       * that reading too.
       */
      size: 'medium', flow: 'start', wrap, captionAt: 'none', crop: 'portrait',
      frame: 'thin', rounded: true,
    },
  }, {
    /* PROSE BESIDE THE PICTURE — the other half of the rule. A pāda must not
       wrap beside a float and an instruction must, so the page needs one of
       each level with it. Durgā Sūktam carries no instructions, so this is
       the pūjā manual's kind of item put on a page that has a float. */
    t: 'instruction',
    instruction: { text: { en: PROSE } },
  });
  return { ...it, sections: [{ ...it.sections[0], items }, ...it.sections.slice(1)] };
}

