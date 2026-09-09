/**
 * Putting the document inside a PDF, without rewriting the PDF.
 *
 * A PDF can carry arbitrary files: `/Names /EmbeddedFiles` is the name tree an
 * attachment lives in, `/AF` is the array that says an attachment belongs to
 * the document rather than merely travelling with it, and `/Metadata` is an XMP
 * packet. All three hang off the catalogue. So the document goes in as an
 * attachment named `document.json` — the same canonical bytes the `.smdoc`, the
 * `.html` and the `.docx` carry — and `importPdf` takes it back out.
 *
 * AN INCREMENTAL UPDATE, NOT A REWRITE. The file Chrome produced is left
 * BYTE FOR BYTE alone and new objects are appended after it, followed by a new
 * cross-reference section whose `/Prev` points at the old one. That is the
 * mechanism the format was designed with for exactly this, and it has the
 * property that matters here: nothing in the appearance can change, because not
 * one byte describing the appearance is touched. A library that parsed the file
 * and wrote a new one would be re-encoding every glyph run for the sake of
 * adding an attachment, and any difference it introduced would be invisible
 * until someone compared the printed page with the Word file.
 *
 * WHICH PRODUCERS KEEP IT. Anything that opens and re-saves a PDF decides for
 * itself: Acrobat and pdftk keep `/EmbeddedFiles`, Chrome's own viewer only
 * downloads the original bytes and cannot re-save, and a "print to PDF" of a
 * PDF is a new document and keeps nothing. `tools/export/gate-pdf.mjs` states
 * what it has measured rather than what is hoped.
 */
import { toBase64 } from '../base64.js';
import type { ExportManifest } from '../embed.js';
import { PDF_ATTACHMENT, PdfError } from './manifest.js';

/** Latin-1 bytes for a PDF's own syntax — a PDF is a byte format, not text. */
const latin1 = (s: string): Uint8Array => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i) & 0xff;
  return out;
};

/** A PDF string literal: `(` `)` and `\` are the three that must be escaped. */
const pdfString = (s: string): string =>
  `(${s.replace(/[\\()]/g, (c) => `\\${c}`)})`;

/**
 * A PDF date, as `D:YYYYMMDDHHmmSS+00'00'`.
 *
 * From the manifest's `savedAt` rather than the clock, so two exports of one
 * document give the same bytes.
 */
function pdfDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new PdfError(`"${iso}" is not a date`);
  const two = (n: number): string => String(n).padStart(2, '0');
  return `D:${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}`
    + `${two(d.getUTCHours())}${two(d.getUTCMinutes())}${two(d.getUTCSeconds())}+00'00'`;
}

/**
 * The last `startxref` offset, the object numbers already used, and the two
 * trailer entries that have to be repeated.
 *
 * `/Info` and `/ID` are NOT inherited from the previous trailer: an incremental
 * update's trailer stands alone, so a file whose new trailer omits them loses
 * its document properties and its identity. They are copied through verbatim.
 */
function readTail(
  pdf: Uint8Array,
): { startxref: number; nextObj: number; carry: string } {
  const tail = new TextDecoder('latin1').decode(pdf.subarray(Math.max(0, pdf.length - 2048)));
  const at = tail.lastIndexOf('startxref');
  if (at === -1) throw new PdfError('no startxref — this is not a PDF this can extend');
  const offset = Number.parseInt(tail.slice(at + 'startxref'.length).trim(), 10);
  if (!Number.isFinite(offset)) throw new PdfError('the startxref offset is not a number');

  const trailer = tail.slice(tail.lastIndexOf('trailer'), at);
  const carry = [
    /\/Info\s+\d+\s+0\s+R/.exec(trailer)?.[0],
    /\/ID\s*\[[^\]]*\]/.exec(trailer)?.[0],
  ].filter((x) => x !== undefined).join(' ');

  /*
   * The next free object number comes from the trailer's `/Size`, not from
   * counting `N 0 obj` headers. A file with a compressed object stream has
   * objects that never appear as `N 0 obj` at all, and reusing one of their
   * numbers silently replaces a font or a page.
   */
  const text = new TextDecoder('latin1').decode(pdf);
  let size = 0;
  for (const m of text.matchAll(/\/Size\s+(\d+)/g)) size = Math.max(size, Number(m[1]));
  if (size === 0) throw new PdfError('the trailer has no /Size');
  return { startxref: offset, nextObj: size, carry };
}

/**
 * The catalogue's object number and its dictionary, as written.
 *
 * The dictionary is found by MATCHING `<<` AGAINST `>>`, not by a non-greedy
 * regex. A catalogue that already carries `/Names <</EmbeddedFiles …>>` — the
 * second time this runs on one file — ends at the INNER `>>`, and the rest of
 * the dictionary is then copied into the appended object as loose tokens. The
 * reader that follows reports a broken page tree.
 */
function readCatalog(pdf: Uint8Array): { num: number; dict: string } {
  const text = new TextDecoder('latin1').decode(pdf);
  for (const m of text.matchAll(/(\d+)\s+0\s+obj\s*<</g)) {
    const open = m.index! + m[0].length - 2;
    let depth = 0;
    let at = open;
    for (; at < text.length; at += 1) {
      if (text.startsWith('<<', at)) {
        depth += 1;
        at += 1;
      } else if (text.startsWith('>>', at)) {
        depth -= 1;
        at += 1;
        if (depth === 0) break;
      }
    }
    const dict = text.slice(open + 2, at - 1);
    if (/\/Type\s*\/Catalog\b/.test(dict)) return { num: Number(m[1]), dict };
  }
  throw new PdfError(
    'no /Type /Catalog object in plain form. A PDF whose catalogue lives in an '
    + 'object stream cannot be extended by this writer; Chrome does not produce one.',
  );
}

/**
 * The XMP packet.
 *
 * XMP is where a PDF says what it is in a form other programs read, and it is
 * the second place the hash is written: a reader whose tool has dropped the
 * attachment can still see that the file WAS one of ours and what its document
 * should have hashed to.
 */
function xmp(manifest: ExportManifest): string {
  const esc = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>'
    + '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF '
    + 'xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    + '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" '
    + 'xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:sm="urn:sikshamitra:document:1">'
    + `<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${esc(manifest.title)}`
    + '</rdf:li></rdf:Alt></dc:title>'
    + `<xmp:CreatorTool>${esc(manifest.engine)}</xmp:CreatorTool>`
    + `<sm:format>${esc(manifest.format)}</sm:format>`
    + `<sm:version>${manifest.version}</sm:version>`
    + `<sm:docHash>${esc(manifest.docHash)}</sm:docHash>`
    + `<sm:style>${esc(manifest.style)}</sm:style>`
    + '</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
}

/** One appended object, ready to be written. */
interface Appended { num: number; body: Uint8Array }

/** `a` and `b`, one after the other. */
function join(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/**
 * A stream object's bytes.
 *
 * `/Length` IS A BYTE COUNT, and building the object as a JavaScript string got
 * that wrong the first time: `durgā sūktam` is twelve characters and thirteen
 * UTF-8 bytes, so a manifest with one long vowel in the title declared a length
 * one short and every reader stopped mid-word. The payload is passed in as
 * bytes and only the syntax around it is text.
 */
function streamBytes(dict: string, data: Uint8Array): Uint8Array {
  return join(
    latin1(`<<${dict}/Length ${data.length}>>\nstream\n`),
    data,
    latin1('\nendstream'),
  );
}

/**
 * Attach the document to a PDF that already exists.
 *
 * The document payload is base64 rather than raw JSON, and no stream is
 * compressed. Base64 for the reason it is base64 everywhere else — it cannot be
 * mangled by a program that treats the stream as text — and uncompressed
 * because a stream filter is one more thing that has to agree between the
 * writer and the reader, and the document is 156 KB against a 228 KB PDF.
 */
export function embedInPdf(
  pdf: Uint8Array, manifest: ExportManifest, json: Uint8Array,
  assets: Record<string, Uint8Array> = {},
): Uint8Array {
  const { startxref, nextObj, carry } = readTail(pdf);
  const catalog = readCatalog(pdf);

  const names = Object.keys(assets).sort();
  const encoded: Record<string, string> = {};
  for (const name of names) encoded[name] = toBase64(assets[name]!);
  const utf8 = new TextEncoder();
  const payload = latin1(toBase64(json));
  const sidecar = utf8.encode(JSON.stringify({ manifest, assets: encoded }));

  let n = nextObj;
  const objects: Appended[] = [];
  const add = (body: Uint8Array): number => {
    objects.push({ num: n, body });
    n += 1;
    return n - 1;
  };

  const JSON_TYPE = '/Type /EmbeddedFile /Subtype /application#2Fjson ';
  const fileObj = add(streamBytes(JSON_TYPE, payload));
  const sideObj = add(streamBytes(JSON_TYPE, sidecar));
  const when = pdfDate(manifest.savedAt);
  const spec = (name: string, ref: number, size: number, desc: string): number => add(latin1(
    `<</Type /Filespec /F ${pdfString(name)} /UF ${pdfString(name)} `
    + `/Desc ${pdfString(desc)} /AFRelationship /Source `
    + `/EF <</F ${ref} 0 R>> /Params <</Size ${size} /ModDate ${pdfString(when)}>>>>`,
  ));
  const docSpec = spec(
    PDF_ATTACHMENT.document, fileObj, payload.length,
    'The document this page was printed from, canonical JSON, base64.',
  );
  const sideSpec = spec(
    PDF_ATTACHMENT.manifest, sideObj, sidecar.length,
    'What wrote the file, of which document, in which style.',
  );

  const meta = add(streamBytes('/Type /Metadata /Subtype /XML ', utf8.encode(xmp(manifest))));
  const namesObj = add(latin1(
    '<</Names ['
    + `${pdfString(PDF_ATTACHMENT.document)} ${docSpec} 0 R `
    + `${pdfString(PDF_ATTACHMENT.manifest)} ${sideSpec} 0 R]>>`,
  ));

  /*
   * The catalogue is REPLACED, not edited in place: an incremental update
   * supersedes an object by writing a new one with the same number, and the old
   * bytes stay where they are. Its existing keys are copied through verbatim —
   * `/Pages`, `/Type`, whatever else the producer put there — and only the three
   * this adds are appended. Rebuilding the dictionary from what we happen to
   * know about would drop a key nobody thought of.
   */
  const kept = catalog.dict
    .replace(/\/Names\s*<<[\s\S]*?>>/, '')
    .replace(/\/Metadata\s+\d+\s+0\s+R/, '')
    .replace(/\/AF\s*\[[^\]]*\]/, '')
    .trim();
  objects.push({
    num: catalog.num,
    body: latin1(
      `<<${kept} /Names <</EmbeddedFiles ${namesObj} 0 R>> `
      + `/AF [${docSpec} 0 R ${sideSpec} 0 R] /Metadata ${meta} 0 R>>`,
    ),
  });

  /* Assemble: the original, then the objects, then a new xref pointing back. */
  const chunks: Uint8Array[] = [pdf];
  let at = pdf.length;
  /* A file that does not end in a newline would run `1 0 obj` onto its last
     line. Chrome's ends with `%%EOF\n`, but a caller's may not. */
  if (pdf[pdf.length - 1] !== 0x0a) {
    chunks.push(latin1('\n'));
    at += 1;
  }
  const offsets = new Map<number, number>();
  for (const o of objects) {
    offsets.set(o.num, at);
    const head = latin1(`${o.num} 0 obj\n`);
    const body = typeof o.body === 'string' ? latin1(o.body) : o.body;
    const foot = latin1('\nendobj\n');
    chunks.push(head, body, foot);
    at += head.length + body.length + foot.length;
  }

  /*
   * ONE SUBSECTION PER RUN of consecutive object numbers. The appended objects
   * are consecutive and the superseded catalogue is not, so a single
   * `xref 0 N` header would claim entries for every object in between and
   * declare them free — which deletes the page tree.
   */
  const nums = [...offsets.keys()].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const num of nums) {
    const last = runs[runs.length - 1];
    if (last !== undefined && num === last[last.length - 1]! + 1) last.push(num);
    else runs.push([num]);
  }
  let xref = 'xref\n';
  for (const run of runs) {
    xref += `${run[0]} ${run.length}\n`;
    for (const num of run) {
      xref += `${String(offsets.get(num)).padStart(10, '0')} 00000 n \n`;
    }
  }
  const trailer = `trailer\n<</Size ${n} /Root ${catalog.num} 0 R ${carry} `
    + `/Prev ${startxref}>>\nstartxref\n${at}\n%%EOF\n`;
  chunks.push(latin1(xref), latin1(trailer));
  return join(...chunks);
}
