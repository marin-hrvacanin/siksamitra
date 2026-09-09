/**
 * WHAT A `.docx` SAYS IT WILL LOOK LIKE — read back out of the file, in points.
 *
 * The gates need to compare a Word file with something: with the table his own
 * document was measured into (`WORD_PARAGRAPHS`), and with the PDF printed
 * beside it. Neither comparison can be made against the exporter's inputs — a
 * test that asks the exporter what it meant to write passes over a broken
 * exporter — so this parses the bytes that were actually written and converts
 * Word's four units back to the one unit everything else is measured in.
 *
 * IT IS ALSO THE PACKAGE CHECK. `parts` walks `[Content_Types].xml` and every
 * `.rels` file and reports parts that are declared and missing or present and
 * unreachable. That is not pedantry: the exporter this replaced shipped a
 * package whose content types named eleven parts that had been stripped out of
 * it, and Word offered to repair every file it wrote.
 */
import { strFromU8, unzipSync } from 'fflate';

const attr = (xml, name) => new RegExp(`${name}="([^"]*)"`).exec(xml)?.[1] ?? null;
const num = (xml, name) => {
  const v = attr(xml, name);
  return v === null ? null : Number(v);
};

/** `<w:sz w:val="32"/>` — a value carried by an element rather than by an
 *  attribute of its parent. */
const element = (xml, name) => {
  const found = new RegExp(`<${name}[ /][^>]*w:val="([^"]*)"`).exec(xml);
  return found === null ? null : Number(found[1]);
};

/** Word's units, back to points. */
const fromHalfPoints = (v) => v / 2;
const fromTwips = (v) => v / 20;
const fromEighths = (v) => v / 8;

/** Every part in the zip, by name. */
export function partsOf(bytes) {
  const zip = unzipSync(bytes);
  const text = {};
  for (const [name, data] of Object.entries(zip)) {
    text[name] = /\.(xml|rels)$/.test(name) ? strFromU8(data) : null;
  }
  return { zip, text };
}

/**
 * Parts declared but absent, and relationship targets that point at nothing.
 *
 * Both directions matter and they fail differently: a declared part that is
 * missing makes Word call the file corrupt, and a relationship to nothing makes
 * it silently drop whatever the relationship was for.
 */
export function packageProblems(bytes) {
  const { zip, text } = partsOf(bytes);
  const have = new Set(Object.keys(zip));
  const problems = [];

  const types = text['[Content_Types].xml'] ?? '';
  for (const m of types.matchAll(/<Override PartName="\/([^"]+)"/g)) {
    if (!have.has(m[1])) problems.push(`[Content_Types].xml declares /${m[1]}, which is not here`);
  }
  const extensions = new Set(
    [...types.matchAll(/<Default Extension="([^"]+)"/g)].map((m) => m[1].toLowerCase()),
  );
  const overridden = new Set(
    [...types.matchAll(/<Override PartName="\/([^"]+)"/g)].map((m) => m[1]),
  );
  for (const name of have) {
    if (name === '[Content_Types].xml') continue;
    const ext = name.split('.').pop().toLowerCase();
    if (!extensions.has(ext) && !overridden.has(name)) {
      problems.push(`${name} has no content type`);
    }
  }

  for (const [name, body] of Object.entries(text)) {
    if (!name.endsWith('.rels') || body === null) continue;
    /* `word/_rels/document.xml.rels` resolves its targets against `word/`. */
    const base = name.slice(0, name.lastIndexOf('_rels/'));
    for (const m of body.matchAll(/Target="([^"]+)"[^>]*?(TargetMode="External")?\/>/g)) {
      if (m[2] !== undefined || /^https?:/.test(m[1])) continue;
      const target = new URL(m[1], `file:///${base}`).pathname.slice(1);
      if (!have.has(target)) problems.push(`${name} points at ${target}, which is not here`);
    }
  }
  return problems;
}

/**
 * The paragraph and character styles of a `word/styles.xml`, in points.
 *
 * Returned by style id, with the same field names `WORD_PARAGRAPHS` uses so the
 * two can be compared without a translation table in between.
 */
export function stylesOf(stylesXml) {
  /*
   * `docDefaults` IS PART OF EVERY ANSWER. His `Normal` states no size and no
   * spacing at all: both come from `<w:docDefaults>`, and a parser that read
   * only the style reported `null` where the file plainly sets 11 pt on 8 pt
   * after. Resolving the default here is what lets his file and ours be
   * compared value for value even though one states what the other inherits.
   */
  const defaults = /<w:docDefaults>([\s\S]*?)<\/w:docDefaults>/.exec(stylesXml)?.[1] ?? '';
  const defSpacing = /<w:spacing[^>]*\/>/.exec(defaults)?.[0] ?? '';
  const defSize = element(defaults, 'w:sz');

  const out = {};
  for (const m of stylesXml.matchAll(/<w:style ([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const head = m[1];
    const body = m[2];
    const id = attr(head, 'w:styleId');
    const kind = attr(head, 'w:type');
    const pPr = /<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(body)?.[1] ?? '';
    const rPr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(body)?.[1] ?? '';
    const spacing = /<w:spacing[^>]*\/>/.exec(pPr)?.[0] ?? (kind === 'paragraph' ? defSpacing : '');
    const ind = /<w:ind[^>]*\/>/.exec(pPr)?.[0] ?? '';
    const bdr = /<w:bdr[^>]*\/>/.exec(rPr)?.[0] ?? '';
    /* `w:sz` is an ELEMENT with a `w:val`, not an attribute — `<w:sz w:val="32"/>`.
       Read as an attribute it came back null for every style in the file. */
    const size = element(rPr, 'w:sz') ?? (kind === 'paragraph' ? defSize : null);
    const lineRule = attr(spacing, 'w:lineRule');
    const after = num(spacing, 'w:after');
    out[id] = {
      id,
      kind,
      size: size === null ? null : fromHalfPoints(size),
      /* `auto` is Word's automatic spacing and only the font knows the number,
         which is what `leading: null` means in `WORD_PARAGRAPHS`. */
      leading: lineRule === 'exact' ? fromTwips(num(spacing, 'w:line')) : null,
      after: after === null ? null : fromTwips(after),
      indent: num(ind, 'w:left') === null ? 0 : fromTwips(num(ind, 'w:left')),
      hanging: num(ind, 'w:hanging') === null ? 0 : fromTwips(num(ind, 'w:hanging')),
      right: num(ind, 'w:right') === null ? 0 : fromTwips(num(ind, 'w:right')),
      face: attr(rPr, 'w:ascii'),
      italic: /<w:i\/>/.test(rPr),
      bold: /<w:b\/>/.test(rPr),
      color: attr(/<w:color[^>]*\/>/.exec(rPr)?.[0] ?? '', 'w:val'),
      border: bdr === '' ? null : {
        weight: fromEighths(num(bdr, 'w:sz')),
        color: attr(bdr, 'w:color'),
      },
      keepLines: /<w:keepLines\/>/.test(pPr),
    };
  }
  return out;
}

/**
 * The lines a `word/document.xml` will print, in order.
 *
 * A LINE IS A `<w:br/>`, not a paragraph. `Translit` carries a negative right
 * indent so a pāda runs into the margin rather than wrapping, which is what
 * makes this predictable enough to compare with a PDF: the file's line
 * structure IS what Word will lay out. A style whose paragraphs do wrap — a
 * translation — is returned as one entry per paragraph and the caller joins the
 * PDF's wrapped lines back together before comparing.
 */
export function linesOf(documentXml) {
  const out = [];
  for (const p of documentXml.matchAll(/<w:p>([\s\S]*?)<\/w:p>/g)) {
    const body = p[1];
    const style = attr(/<w:pStyle\b[^>]*\/>/.exec(body)?.[0] ?? '', 'w:val') ?? 'Normal';
    const runStyles = new Set();
    let line = '';
    let up = '';
    const lines = [];
    const raised = [];
    for (const piece of body.matchAll(/<w:r>([\s\S]*?)<\/w:r>/g)) {
      const run = piece[1];
      const rStyle = attr(/<w:rStyle\b[^>]*\/>/.exec(run)?.[0] ?? '', 'w:val');
      if (rStyle !== null) runStyles.add(rStyle);
      if (/<w:br\/>/.test(run)) {
        lines.push(line);
        raised.push(up);
        line = '';
        up = '';
        continue;
      }
      /*
       * A SUPERSCRIPT RUN IS NOT ON THE LINE. `w:vertAlign="superscript"` is
       * how the reading aid over a gum anusvāra is written, and both Word and
       * the browser put it on a baseline of its own — so a PDF measured line by
       * line has it as a row of its own too, and a comparison that left it in
       * the line's text could never match. Kept apart rather than dropped,
       * because how many there are is worth comparing.
       */
      const isUp = /vertAlign[^>]*superscript/.test(run);
      for (const t of run.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)) {
        const text = t[1]
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        if (isUp) up += text;
        else line += text;
      }
    }
    lines.push(line);
    raised.push(up);
    lines.forEach((text, i) => {
      if (text.trim() === '') return;
      out.push({ style, text, raised: raised[i] ?? '', runStyles: [...runStyles] });
    });
  }
  return out;
}
