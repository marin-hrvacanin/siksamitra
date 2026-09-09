/**
 * DOES A PICTURE SURVIVE THE `.docx`, and does WORD get to see it?
 *
 * Two different questions, and for a long time only the first was asked. A
 * `.docx` we write carries the whole document in a custom XML part, so
 * `importWord` gave every picture back perfectly while `word/document.xml` —
 * the part Word actually reads — had no drawing in it at all. The round trip
 * being lossless is exactly what hid the loss: somebody inserts a photograph
 * of a mudrā, exports to Word to send to a student, and the file they send has
 * no picture in it.
 *
 * SO NOTHING HERE READS THE DATASTORE. Every assertion is against the parts a
 * `.docx` is made of and against `importDocx`, which is the reader for files
 * this program did not write:
 *
 *   the bytes       `word/media/image1.png`, compared with the PNG this file
 *                   built — not with the base64 that went in.
 *   the plumbing    every `r:embed` in `document.xml` names a relationship
 *                   that exists, whose target is a part that exists, whose
 *                   extension the content types declare. Word's whole report
 *                   for any one of those being wrong is "unreadable content".
 *   the wrap        an inline picture is `wp:inline`; a floated one is a
 *                   `wp:anchor` with `wp:wrapSquare` aligned to the side the
 *                   document asked for.
 *   how wide        the drawn `cx` against the section's own text column, so
 *                   `medium` is half the column in Word as it is on the page.
 *   and back        `importDocx` of what we wrote returns the pictures, with
 *                   their alternative text, their side, and byte-identical
 *                   bytes.
 */
import { strFromU8, unzipSync } from 'fflate';
import { figuresOf } from '@siksamitra/format';
import { importDocx } from '@siksamitra/interop';
import { solidPng } from './_figure-fixtures.mjs';

const EMU_PER_INCH = 914400;

/** Three pictures, one of each wrap, in one step. */
export function withThreePictures(png) {
  const src = `data:image/png;base64,${png.toString('base64')}`;
  const fig = (id, flow, alt) => ({
    t: 'figure',
    figure: {
      id, src, alt, width: 400, height: 300,
      size: 'medium', flow, captionAt: 'below', crop: 'auto', frame: 'none', rounded: true,
      caption: { en: `Caption for ${id}` },
    },
  });
  return {
    title: 'Three pictures',
    titleForms: {},
    version: 3,
    sections: [{
      id: 'sec-1',
      title: 'Dīpa',
      verses: [],
      items: [
        fig('fig-1', 'block', 'A lamp held at the level of the heart.'),
        { t: 'instruction', instruction: { text: { en: 'Circle the lamp three times.' } } },
        fig('fig-2', 'start', 'The añjali mudrā, seen from the front.'),
        fig('fig-3', 'end', 'The vessel set down to the right.'),
      ],
    }],
  };
}

/**
 * @param write  an async `(doc) => Uint8Array`, the gate's own exporter, so
 *   this measures the file the gate produces and not a second configuration.
 * @returns the problems found, as sentences. Empty means the pictures survive.
 */
export async function pictureProblems(write) {
  const problems = [];
  const fail = (what, detail) => problems.push(`pictures — ${what}: ${detail}`);

  const png = solidPng(400, 300, [255, 0, 255]);
  const doc = withThreePictures(png);
  const bytes = await write(doc);
  const zip = unzipSync(bytes);
  const documentXml = strFromU8(zip['word/document.xml']);
  const types = strFromU8(zip['[Content_Types].xml']);
  const rels = strFromU8(zip['word/_rels/document.xml.rels']);

  /* ── the bytes ─────────────────────────────────────────────────────────── */
  const media = Object.keys(zip).filter((n) => n.startsWith('word/media/'));
  if (media.length !== 1) {
    /* ONE part for three items, because all three name the same picture: a
       `.docx` that stored it three times would be three times the size for
       nothing, and the pūjā manual uses one drawing at five steps. */
    fail('the media parts', `${media.length} of them, expected 1 for one picture`);
  } else if (Buffer.compare(Buffer.from(zip[media[0]]), png) !== 0) {
    fail('the bytes', `${zip[media[0]].length} bytes in the part, ${png.length} put in`);
  }

  /* ── the plumbing ──────────────────────────────────────────────────────── */
  const embeds = [...documentXml.matchAll(/<a:blip[^>]*r:embed="([^"]+)"/g)].map((m) => m[1]);
  if (embeds.length !== 3) {
    fail('the drawings', `${embeds.length} <a:blip> in document.xml, expected 3`);
  }
  const targets = new Map(
    [...rels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)]
      .map((m) => [m[1], m[2]]),
  );
  for (const id of new Set(embeds)) {
    const target = targets.get(id);
    if (target === undefined) fail('a relationship', `${id} is named but not declared`);
    else if (zip[`word/${target}`] === undefined) {
      fail('a relationship', `${id} points at word/${target}, which is not in the file`);
    }
  }
  if (media.length > 0) {
    const ext = media[0].slice(media[0].lastIndexOf('.') + 1);
    if (!types.includes(`Extension="${ext}"`)) {
      fail('the content types', `nothing declares .${ext}, so Word reports unreadable content`);
    }
  }
  if (!/xmlns:r="[^"]*officeDocument\/2006\/relationships"/.test(documentXml)) {
    fail('the namespaces', 'document.xml does not declare xmlns:r, which r:embed needs');
  }
  const ids = [...documentXml.matchAll(/<wp:docPr id="(\d+)"/g)].map((m) => m[1]);
  if (new Set(ids).size !== ids.length) {
    fail('the drawing ids', `${ids.join(', ')} — a repeated docPr id loses its alt text`);
  }

  /* ── the wrap ──────────────────────────────────────────────────────────── */
  if (!documentXml.includes('<wp:inline')) fail('the inline picture', 'no <wp:inline>');
  const anchors = [...documentXml.matchAll(/<wp:anchor[\s\S]*?<\/wp:anchor>/g)].map((m) => m[0]);
  if (anchors.length !== 2) {
    fail('the floated pictures', `${anchors.length} <wp:anchor>, expected 2`);
  } else {
    for (const [i, want] of ['left', 'right'].entries()) {
      if (!anchors[i].includes('<wp:wrapSquare')) {
        fail('a float', `the ${want} one has no <wp:wrapSquare>, so no text runs beside it`);
      }
      if (!anchors[i].includes(`<wp:align>${want}</wp:align>`)) {
        fail('a float', `the ${want} one is not aligned ${want}`);
      }
    }
  }

  /* ── how wide ──────────────────────────────────────────────────────────── */
  /*
   * A4 with his 25 mm margins is a 453.5 pt column; `medium` is half of it,
   * with a floor and a ceiling that do not bite at this width. Measured
   * against the sheet the file itself declares, so a change of paper moves
   * both numbers together.
   */
  const pgSz = /<w:pgSz[^>]*w:w="(\d+)"/.exec(documentXml);
  const pgMar = /<w:pgMar[^>]*>/.exec(documentXml)?.[0] ?? '';
  const twip = (re) => Number(re.exec(pgMar)?.[1] ?? 0);
  const columnEmu = ((Number(pgSz?.[1] ?? 0) - twip(/w:left="(\d+)"/) - twip(/w:right="(\d+)"/))
    / 20 / 72) * EMU_PER_INCH;
  const cx = Number(/<wp:extent cx="(\d+)"/.exec(documentXml)?.[1] ?? 0);
  const fraction = columnEmu > 0 ? cx / columnEmu : 0;
  if (Math.abs(fraction - 0.5) > 0.02) {
    fail('the width', `a "medium" picture is ${(fraction * 100).toFixed(1)} % of the column, `
      + 'and medium is a half');
  }

  /* ── and back, through the reader for files we did not write ───────────── */
  const back = importDocx(bytes, 'again');
  const got = figuresOf(back.doc).map((f) => f.figure);
  if (got.length !== 3) {
    fail('re-reading', `${got.length} picture(s) came back, of 3`);
    return problems;
  }
  const put = figuresOf(doc).map((f) => f.figure);
  for (const [i, figure] of got.entries()) {
    if (figure.alt !== put[i].alt) {
      fail('re-reading', `picture ${i + 1} came back described as "${figure.alt}"`);
    }
    if ((figure.flow ?? 'block') !== put[i].flow) {
      fail('re-reading', `picture ${i + 1} came back as ${String(figure.flow)}, `
        + `not ${put[i].flow}`);
    }
    const recovered = Buffer.from(figure.src.split(',')[1], 'base64');
    if (Buffer.compare(recovered, png) !== 0) {
      fail('re-reading', `picture ${i + 1} came back as ${recovered.length} bytes, `
        + `not ${png.length}`);
    }
    if (figure.width !== 400 || figure.height !== 300) {
      fail('re-reading', `picture ${i + 1} came back ${figure.width}x${figure.height}, `
        + 'and the bytes are 400x300');
    }
  }
  /* The instruction between the pictures must still be there and still be
     BETWEEN them: a reader that appended figures rather than placing them
     would pass every check above. */
  const kinds = (back.doc.sections[0]?.items ?? []).map((i) => i.t).join(',');
  if (kinds !== 'figure,instruction,figure,figure') {
    fail('the order', `the step came back as ${kinds}`);
  }
  return problems;
}
