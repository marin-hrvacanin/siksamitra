/**
 * WHAT IS ACTUALLY PRINTED ON A PDF PAGE — read out of the file itself.
 *
 * "The Word document and the PDF from it should be identical" cannot be
 * asserted, only measured, and the two are produced by different programs from
 * different inputs. What they have in common is that both end as a PDF, so this
 * reads one: every line of text with the point size it is set in, the colour it
 * is filled with, the baseline it sits on and the x it starts at. Two files
 * measured the same way can then be compared number for number.
 *
 * IT IS A MEASURING INSTRUMENT, NOT A PDF LIBRARY. It understands exactly the
 * operators a page of text uses and ignores the rest; it cannot render, and it
 * would be wrong about a rotated page or a Type 3 font. That is the right
 * trade: a general PDF reader is a dependency with its own bugs, and the whole
 * question here is whether two files agree, which needs one instrument used
 * twice rather than a correct one used once.
 *
 * TEXT COMES BACK THROUGH `/ToUnicode`. A subset font's codes are not
 * characters — Chrome's `(\x01\x02\x03)` is three glyph ids — so every string
 * is decoded through the font's own CMap. Without it the comparison would be
 * between two strings of glyph ids from two different subsets, which are never
 * equal and never mean anything.
 */
import { unzlibSync } from 'fflate';

const latin1 = (bytes) => new TextDecoder('latin1').decode(bytes);

/**
 * Every `N 0 obj … endobj` in the file, by number, with its stream bytes.
 *
 * THE STREAM'S LENGTH COMES FROM `/Length`, not from searching for `endstream`.
 * A deflated font subset is arbitrary bytes and one of them is as likely to
 * spell `endobj` as anything else; the first version of this looked for the
 * keyword and cut a 40 KB content stream in half, which fflate then reported as
 * "invalid length/literal" from three frames down. Where `/Length` is an
 * indirect reference — Word writes some of them that way — the keyword search
 * is the fallback, and it is right because by then the object is known to be a
 * stream and the search starts after its data begins.
 */
export function readObjects(pdf) {
  const text = latin1(pdf);
  const out = new Map();
  for (const m of text.matchAll(/(?:^|[\r\n>\s])(\d+)\s+0\s+obj\b/g)) {
    const num = Number(m[1]);
    const from = m.index + m[0].length;
    const streamAt = text.indexOf('stream', from);
    const endAt = text.indexOf('endobj', from);
    if (endAt === -1) continue;
    const hasStream = streamAt !== -1 && streamAt < endAt;
    const dict = text.slice(from, hasStream ? streamAt : endAt);
    if (!hasStream) {
      out.set(num, { dict, stream: null });
      continue;
    }
    const start = text.startsWith('\r\n', streamAt + 6) ? streamAt + 8 : streamAt + 7;
    const declared = /\/Length\s+(\d+)(?!\s+0\s+R)/.exec(dict)?.[1];
    const stop = declared === undefined
      ? text.indexOf('endstream', start)
      : start + Number(declared);
    /* The LAST definition wins: an incremental update supersedes an object by
       writing a new one with the same number further down the file. */
    out.set(num, { dict, stream: pdf.subarray(start, stop) });
  }
  return out;
}

const ref = (dict, key) => {
  const m = new RegExp(`/${key}\\s+(\\d+)\\s+0\\s+R`).exec(dict);
  return m === null ? null : Number(m[1]);
};

/**
 * The dictionary a key holds, whether it is written out or referred to.
 *
 * BALANCED, not non-greedy. `/Resources` on a Chrome page opens with
 * `<</ProcSet […] /ExtGState <</G3 3 0 R>> /Font <<…>>>>`, and a `<<([\s\S]*?)>>`
 * ends at the ExtGState's closing braces — so the `/Font` block was outside the
 * match, no font was found for any page, and every string came back as
 * undecoded glyph ids while the Word file next to it read perfectly. Counting
 * the braces is four lines and cannot be fooled.
 */
function subDict(source, key, objects) {
  const at = source.indexOf(`/${key}`);
  if (at === -1) return '';
  const rest = source.slice(at + key.length + 1);
  const indirect = /^\s*(\d+)\s+0\s+R/.exec(rest);
  if (indirect !== null) return objects.get(Number(indirect[1]))?.dict ?? '';
  const open = rest.indexOf('<<');
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < rest.length; i += 1) {
    if (rest.startsWith('<<', i)) { depth += 1; i += 1; } else if (rest.startsWith('>>', i)) {
      depth -= 1;
      i += 1;
      if (depth === 0) return rest.slice(open + 2, i - 1);
    }
  }
  return '';
}

/** A stream's bytes, inflated when the object says they are deflated. */
function data(obj) {
  if (obj?.stream === undefined || obj.stream === null) return new Uint8Array();
  /* `FlateDecode` is zlib, header and all — `inflateSync` on a raw deflate
     stream fails with "invalid length/literal" on the first byte. */
  return /\/FlateDecode/.test(obj.dict) ? unzlibSync(obj.stream) : obj.stream;
}

/**
 * A font's code-to-character map, from its `/ToUnicode` CMap.
 *
 * Only `bfchar` and `bfrange`, which is all either producer writes. A surrogate
 * pair in the destination is joined; a `bfrange` with an array destination is
 * expanded entry by entry.
 */
function toUnicode(cmap) {
  const map = new Map();
  const hexChars = (hex) => {
    let s = '';
    for (let i = 0; i + 3 < hex.length; i += 4) s += String.fromCharCode(Number.parseInt(hex.slice(i, i + 4), 16));
    return s;
  };
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const p of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(Number.parseInt(p[1], 16), hexChars(p[2]));
    }
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const body = block[1];
    for (const p of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const from = Number.parseInt(p[1], 16);
      const to = Number.parseInt(p[2], 16);
      const base = Number.parseInt(p[3], 16);
      for (let c = from; c <= to && c - from < 0x1000; c += 1) {
        map.set(c, String.fromCodePoint(base + (c - from)));
      }
    }
    for (const p of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g)) {
      const from = Number.parseInt(p[1], 16);
      let c = from;
      for (const d of p[3].matchAll(/<([0-9A-Fa-f]+)>/g)) {
        map.set(c, hexChars(d[1]));
        c += 1;
      }
    }
  }
  return map;
}

/** `[a b c d e f]` × `[a b c d e f]`, the PDF's own 3×2 matrices. */
const mul = (m, n) => [
  m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5],
];

/** Content-stream tokens: numbers, names, strings, arrays and operators. */
function* tokens(src) {
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\n' || c === '\r' || c === '\t') { i += 1; continue; }
    if (c === '%') { while (i < src.length && src[i] !== '\n') i += 1; continue; }
    if (c === '(') {
      let depth = 1;
      let s = '';
      i += 1;
      while (i < src.length && depth > 0) {
        const ch = src[i];
        if (ch === '\\') {
          const next = src[i + 1];
          const octal = /^[0-7]{1,3}/.exec(src.slice(i + 1, i + 4));
          if (octal !== null) {
            s += String.fromCharCode(Number.parseInt(octal[0], 8));
            i += 1 + octal[0].length;
            continue;
          }
          s += { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }[next] ?? next;
          i += 2;
          continue;
        }
        if (ch === '(') depth += 1;
        if (ch === ')') { depth -= 1; if (depth === 0) { i += 1; break; } }
        s += ch;
        i += 1;
      }
      yield { t: 'str', v: s };
      continue;
    }
    if (c === '<' && src[i + 1] !== '<') {
      const end = src.indexOf('>', i);
      const hex = src.slice(i + 1, end).replace(/\s+/g, '');
      let s = '';
      for (let k = 0; k + 1 < hex.length; k += 2) s += String.fromCharCode(Number.parseInt(hex.slice(k, k + 2), 16));
      yield { t: 'str', v: s };
      i = end + 1;
      continue;
    }
    if (c === '[' || c === ']') { yield { t: c }; i += 1; continue; }
    if (c === '/') {
      const m = /^\/([^\s/[\]<>()]*)/.exec(src.slice(i));
      yield { t: 'name', v: m[1] };
      i += m[0].length;
      continue;
    }
    const m = /^[-+.\d]+/.exec(src.slice(i));
    if (m !== null) { yield { t: 'num', v: Number(m[0]) }; i += m[0].length; continue; }
    const op = /^[A-Za-z'"*]+/.exec(src.slice(i));
    if (op === null) { i += 1; continue; }
    yield { t: 'op', v: op[0] };
    i += op[0].length;
  }
}

const hex2 = (v) => Math.round(v * 255).toString(16).padStart(2, '0');

/**
 * Every string shown on one page, with where and how.
 *
 * A "show" is one `Tj`/`TJ`: its device-space start, its device-space point
 * size (the `Tf` size through the text and current transformation matrices),
 * its fill colour and its decoded text.
 */
function showsOnPage(content, fonts) {
  const out = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let tm = [1, 0, 0, 1, 0, 0];
  let tlm = tm;
  let leading = 0;
  let size = 0;
  let font = null;
  let fill = '000000';
  const operands = [];
  const num = (k) => operands[operands.length - k];

  const show = (text) => {
    if (text === '') return;
    const m = mul(tm, ctm);
    /* The vertical scale of the combined matrix IS the printed size: a `Tf` of
       1 with a `Tm` of 16 is the same 16 pt as a `Tf` of 16 with an identity. */
    const scale = Math.hypot(m[2], m[3]);
    out.push({
      x: m[4], y: m[5], size: size * scale, font, fill, text,
    });
  };

  for (const tok of tokens(content)) {
    if (tok.t !== 'op') { operands.push(tok); continue; }
    const op = tok.v;
    if (op === 'q') stack.push(ctm);
    else if (op === 'Q') ctm = stack.pop() ?? ctm;
    else if (op === 'cm') ctm = mul(operands.slice(-6).map((o) => o.v), ctm);
    else if (op === 'BT') { tm = [1, 0, 0, 1, 0, 0]; tlm = tm; }
    else if (op === 'Tf') { font = num(2)?.v ?? null; size = num(1)?.v ?? 0; }
    else if (op === 'TL') leading = num(1).v;
    else if (op === 'Td') { tlm = mul([1, 0, 0, 1, num(2).v, num(1).v], tlm); tm = tlm; }
    else if (op === 'TD') {
      leading = -num(1).v;
      tlm = mul([1, 0, 0, 1, num(2).v, num(1).v], tlm);
      tm = tlm;
    } else if (op === 'Tm') { tlm = operands.slice(-6).map((o) => o.v); tm = tlm; }
    else if (op === 'T*') { tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm; }
    else if (op === 'rg' || op === 'sc' || op === 'scn') {
      const c = operands.slice(-3).filter((o) => o.t === 'num').map((o) => o.v);
      if (c.length === 3) fill = c.map(hex2).join('');
    } else if (op === 'g') {
      const v = num(1)?.v ?? 0;
      fill = `${hex2(v)}${hex2(v)}${hex2(v)}`;
    } else if (op === 'Tj' || op === "'" || op === '"') {
      if (op !== 'Tj') { tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm; }
      const s = operands.filter((o) => o.t === 'str').pop();
      if (s !== undefined) show(decode(s.v, fonts[font]));
    } else if (op === 'TJ') {
      let text = '';
      for (const o of operands) if (o.t === 'str') text += decode(o.v, fonts[font]);
      show(text);
    }
    operands.length = 0;
  }
  return out;
}

/** A shown string, through its font's `/ToUnicode`. */
function decode(raw, font) {
  if (font === undefined) return raw;
  const { map, twoByte } = font;
  let out = '';
  if (twoByte) {
    for (let i = 0; i + 1 < raw.length; i += 2) {
      const code = (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1);
      out += map.get(code) ?? '';
    }
    return out;
  }
  for (const ch of raw) out += map.get(ch.charCodeAt(0)) ?? ch;
  return out;
}

/** Every page's shows, plus its media box. */
export function readPages(pdf) {
  const objects = readObjects(pdf);
  const pages = [];
  for (const [, obj] of objects) {
    if (!/\/Type\s*\/Page\b/.test(obj.dict)) continue;
    const box = /\/MediaBox\s*\[([^\]]*)\]/.exec(obj.dict)?.[1].trim().split(/\s+/).map(Number)
      ?? [0, 0, 0, 0];

    const resDict = subDict(obj.dict, 'Resources', objects);
    const fonts = {};
    const fontBlock = subDict(resDict, 'Font', objects);
    for (const f of fontBlock.matchAll(/\/([A-Za-z0-9+_.-]+)\s+(\d+)\s+0\s+R/g)) {
      const fontObj = objects.get(Number(f[2]));
      if (fontObj === undefined) continue;
      const uni = ref(fontObj.dict, 'ToUnicode');
      fonts[f[1]] = {
        base: /\/BaseFont\s*\/([^\s/>]+)/.exec(fontObj.dict)?.[1] ?? '?',
        /* `/Subtype /Type0`, not `/Type`: every font dictionary there is
           has `/Type /Font`, so testing that matched nothing and a composite
           font's two-byte codes were decoded one byte at a time — every line
           came back as pairs of NULs and control characters. */
        twoByte: /\/Subtype\s*\/Type0\b/.test(fontObj.dict),
        map: uni === null ? new Map() : toUnicode(latin1(data(objects.get(uni)))),
      };
    }

    let content = '';
    const one = ref(obj.dict, 'Contents');
    if (one !== null) content = latin1(data(objects.get(one)));
    else {
      for (const c of (/\/Contents\s*\[([^\]]*)\]/.exec(obj.dict)?.[1] ?? '')
        .matchAll(/(\d+)\s+0\s+R/g)) {
        content += `${latin1(data(objects.get(Number(c[1]))))}\n`;
      }
    }
    pages.push({ box, shows: showsOnPage(content, fonts), fonts });
  }
  return pages;
}

/**
 * The shows of one page, gathered into LINES.
 *
 * Grouped by baseline within a quarter of a point — a combining mark is drawn
 * by a second show at the same baseline, and a page whose lines were one show
 * each could not be compared with a page whose lines were forty. Sorted by x,
 * because document order in the stream is not left-to-right order on the page.
 */
export function linesOf(page, tolerance = 0.25) {
  const rows = [];
  for (const s of page.shows) {
    if (s.text.trim() === '') continue;
    const row = rows.find((r) => Math.abs(r.y - s.y) <= tolerance);
    if (row === undefined) rows.push({ y: s.y, shows: [s] });
    else row.shows.push(s);
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => {
    const shows = [...r.shows].sort((a, b) => a.x - b.x);
    /* The line's size and colour are its WIDEST-SPANNING run's, not its first:
       a verse line starts with a holding box whose letter is one show, and the
       mark runs that follow are set two points larger. */
    const tally = new Map();
    for (const s of shows) {
      const key = `${s.size.toFixed(2)}|${s.fill}`;
      tally.set(key, (tally.get(key) ?? 0) + s.text.length);
    }
    const [most] = [...tally].sort((a, b) => b[1] - a[1]);
    const [size, fill] = most[0].split('|');
    return {
      y: r.y,
      x: shows[0].x,
      right: Math.max(...shows.map((s) => s.x)),
      size: Number(size),
      fill,
      text: shows.map((s) => s.text).join(''),
    };
  });
}
