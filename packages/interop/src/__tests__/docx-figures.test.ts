/**
 * READING WORD'S OWN SHAPES, not the one we happen to write.
 *
 * `gate-word.mjs` exports a document with three pictures and reads it back,
 * which proves the writer and the reader agree. Two programs agreeing is not
 * the same as either being right about WORD, and this reader's whole job is
 * files this program did not write: the owner's manuals, and anything a
 * student sends back.
 *
 * So the XML here is Word's, in the shapes Word actually emits — an anchor
 * positioned by an offset rather than by an alignment, a tight wrap rather
 * than a square one, a picture behind the text, and a `<w:drawing>` that is
 * not a picture at all. None of these come out of our exporter, so none of
 * them would ever be exercised by a round trip.
 *
 * The sizes are read out of BYTES built here, and compared with the numbers
 * those bytes were built from.
 */
import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import {
  columnEmuOf, figureFromDrawing, imageSize, mediaTypeOf, readDrawings, relationshipTargets,
} from '../docx-figures.js';

/* ==========================================================================
   Pictures, built here so the expected size is known
   ========================================================================== */

function crc32(bytes: Buffer): number {
  let c = -1;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k += 1) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ -1) >>> 0;
}

function chunk(name: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(name, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(name, 'ascii'), body])), 0);
  return Buffer.concat([head, body, crc]);
}

/** A real PNG of the given size — one grey pixel per position. */
function png(width: number, height: number): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc(height * (1 + width * 3));
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

/** A GIF header, which is all `imageSize` reads. Little-endian, unlike PNG. */
const gif = (width: number, height: number): Uint8Array => new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
  width & 0xff, width >> 8, height & 0xff, height >> 8, 0x00, 0x00, 0x00,
]);

/**
 * A JPEG's markers as far as the first start-of-frame.
 *
 * With a JFIF segment in front of it, because Word writes one and a reader
 * that assumed the SOF came first would pass on a bare one and fail on every
 * real photograph. Height BEFORE width, which is JPEG's order and the easiest
 * thing in this file to get backwards.
 */
function jpeg(width: number, height: number): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const sof = [
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1,
  ];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof]);
}

describe('the size in the bytes', () => {
  it('reads a PNG', () => expect(imageSize(png(640, 427))).toEqual({ width: 640, height: 427 }));
  it('reads a GIF', () => expect(imageSize(gif(300, 200))).toEqual({ width: 300, height: 200 }));
  it('reads a JPEG past its JFIF segment', () =>
    expect(imageSize(jpeg(1920, 1080))).toEqual({ width: 1920, height: 1080 }));
  it('says nothing for bytes it does not know', () => {
    expect(imageSize(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBeNull();
  });
});

describe('the media type a part name implies', () => {
  it('takes the ones a document may carry', () => {
    expect(mediaTypeOf('word/media/image1.png')).toBe('image/png');
    expect(mediaTypeOf('word/media/image2.JPG')).toBe('image/jpeg');
  });
  it("refuses Word's own vector formats, which no browser draws", () => {
    expect(mediaTypeOf('word/media/image3.emf')).toBeNull();
    expect(mediaTypeOf('word/media/image4.wmf')).toBeNull();
  });
});

/* ==========================================================================
   The drawings, in the shapes Word writes
   ========================================================================== */

const BLIP = '<pic:blipFill><a:blip r:embed="rId7"/></pic:blipFill>';

const inlineDrawing = '<w:drawing><wp:inline distT="0" distB="0">'
  + '<wp:extent cx="2743200" cy="1828800"/>'
  + '<wp:docPr id="1" name="Picture 1" descr="A lit brass lamp."/>'
  + `${BLIP}</wp:inline></w:drawing>`;

/** Word's own float: an anchor with a square wrap, aligned to a margin. */
const alignedRight = '<w:drawing><wp:anchor behindDoc="0">'
  + '<wp:positionH relativeFrom="margin"><wp:align>right</wp:align></wp:positionH>'
  + '<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>'
  + '<wp:extent cx="1371600" cy="914400"/><wp:wrapSquare wrapText="bothSides"/>'
  + '<wp:docPr id="2" name="Picture 2" descr="The a&#241;jali mudr&#257;."/>' // token-exempt: XML character entities — Word's own spelling of a non-ASCII description, and the input under test
  + `${BLIP}</wp:anchor></w:drawing>`;

/** And Word's other float: a TIGHT wrap positioned by an offset in EMU. */
const offsetLeft = '<w:drawing><wp:anchor behindDoc="0">'
  + '<wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH>'
  + '<wp:extent cx="1371600" cy="914400"/><wp:wrapTight wrapText="bothSides"/>'
  + '<wp:docPr id="3" name="Picture 3" descr="A vessel."/>'
  + `${BLIP}</wp:anchor></w:drawing>`;

/** Behind the text — not a wrap at all, and there is nothing here it maps to. */
const behind = '<w:drawing><wp:anchor behindDoc="1">'
  + '<wp:positionH relativeFrom="page"><wp:align>right</wp:align></wp:positionH>'
  + '<wp:extent cx="1371600" cy="914400"/><wp:wrapNone/>'
  + '<wp:docPr id="4" name="Watermark" descr=""/>'
  + `${BLIP}</wp:anchor></w:drawing>`;

/** A chart. `<w:drawing>` is the wrapper for those too, and it has no blip. */
const chart = '<w:drawing><wp:inline><wp:extent cx="100" cy="100"/>'
  + '<wp:docPr id="5" name="Chart 1"/>'
  + '<c:chart xmlns:c="urn:chart" r:id="rId9"/></wp:inline></w:drawing>';

describe('reading the drawings out of a paragraph', () => {
  it('takes an inline picture, with its size and its alternative text', () => {
    const [d] = readDrawings(inlineDrawing);
    expect(d).toEqual({
      relId: 'rId7', alt: 'A lit brass lamp.', cx: 2743200, cy: 1828800,
    });
  });

  it('reads an aligned float as the side it is aligned to', () => {
    expect(readDrawings(alignedRight)[0]?.side).toBe('end');
    /* And the entity in the alt text is decoded, not carried through raw —
       which is what a reader that never decoded would show. */
    expect(readDrawings(alignedRight)[0]?.alt).toBe('The añjali mudrā.');
  });

  it('reads a tight wrap at offset zero as a left float', () => {
    expect(readDrawings(offsetLeft)[0]?.side).toBe('start');
  });

  it('does NOT pretend a watermark is a float', () => {
    /* `wrapNone` means the text runs over it. There is no such thing here, so
       it becomes an ordinary block rather than a lie about the layout. */
    expect(readDrawings(behind)[0]?.side).toBeUndefined();
  });

  it('skips a drawing that is not a picture', () => {
    expect(readDrawings(chart)).toEqual([]);
  });

  it('takes several from one paragraph, in order', () => {
    const got = readDrawings(inlineDrawing + alignedRight + chart + offsetLeft);
    expect(got.map((d) => d.side)).toEqual([undefined, 'end', 'start']);
  });
});

describe('the relationships and the column', () => {
  it('reads the targets, whatever order the attributes come in', () => {
    const xml = '<Relationships>'
      + '<Relationship Id="rId7" Type="…/image" Target="media/image1.png"/>'
      + '<Relationship Id="rId8" Type="…/image" Target="media/image2.jpeg"/>'
      + '</Relationships>';
    expect(relationshipTargets(xml).get('rId7')).toBe('media/image1.png');
    expect(relationshipTargets(xml).size).toBe(2);
  });

  it('measures the text column from the section, in EMU', () => {
    /* A4 at his 25 mm margins: 11906 twips wide, 1418 each side, so 9070 twips
       = 453.5 pt = 6.2986 in. Checked against the arithmetic, not against the
       function. */
    const xml = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
      + '<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418"/></w:sectPr>';
    expect(columnEmuOf(xml)).toBe(Math.round((9070 / 20 / 72) * 914400));
  });

  it('falls back to that same sheet when the file says nothing', () => {
    expect(columnEmuOf('<w:body/>')).toBe(columnEmuOf(
      '<w:sectPr><w:pgSz w:w="11906"/><w:pgMar w:right="1418" w:left="1418"/></w:sectPr>',
    ));
  });
});

describe('and the figure it becomes', () => {
  const columnEmu = columnEmuOf('<w:sectPr><w:pgSz w:w="11906"/>'
    + '<w:pgMar w:right="1418" w:left="1418"/></w:sectPr>');

  it('carries the bytes, the description and the side', () => {
    const bytes = png(640, 427);
    const [d] = readDrawings(alignedRight);
    const fig = figureFromDrawing(d!, 'word/media/image1.png', bytes, 'fig-1', columnEmu);
    expect(fig?.alt).toBe('The añjali mudrā.');
    expect(fig?.flow).toBe('end');
    expect(fig?.src.startsWith('data:image/png;base64,')).toBe(true);
    /* THE INTRINSIC SIZE, from the bytes — not the 1371600 x 914400 EMU Word
       drew it at, which is 3:2 and would reserve the wrong aspect box. */
    expect(fig).toMatchObject({ width: 640, height: 427 });
  });

  it('is as wide a fraction of the column as Word drew it', () => {
    const [d] = readDrawings(alignedRight);
    const fig = figureFromDrawing(d!, 'word/media/image1.png', png(64, 64), 'fig-1', columnEmu);
    /* 1371600 EMU is 1.5 in; the column is 6.2986 in. */
    expect(fig?.widthPct).toBe(Math.round((1.5 / 6.2986) * 100));
  });

  it('refuses a format a document may not carry', () => {
    const [d] = readDrawings(inlineDrawing);
    expect(figureFromDrawing(d!, 'word/media/image9.emf', png(8, 8), 'fig-1', columnEmu)).toBeNull();
  });

  it('falls back to the drawn size for bytes it cannot measure', () => {
    const [d] = readDrawings(inlineDrawing);
    const opaque = new Uint8Array(64);
    const fig = figureFromDrawing(d!, 'word/media/image1.png', opaque, 'fig-1', columnEmu);
    /* 2743200 x 1828800 EMU at 9525 EMU to the pixel. */
    expect(fig).toMatchObject({ width: 288, height: 192 });
  });
});
