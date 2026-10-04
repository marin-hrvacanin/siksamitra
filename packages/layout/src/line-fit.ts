/**
 * A LINE THAT FITS ITS COLUMN — divided where it is written, evenly.
 *
 * His ruling (2026-10-02): "breaking the lines sooner, dividing them nicely in
 * consistent size ... Sometimes longer, sometimes shorter, but more
 * consistent, no need to fill the entire line". A line wider than its column
 * was left for the page to wrap, and a page wraps by FILLING: as much as fits,
 * then the rest — one long line and a stub, and `॥ 1॥` torn in two. Divided
 * here instead, the line becomes lines of about the same width, at a word's
 * end, preferring the end of a half-verse; and since it is the document's own
 * lines that change, the PDF, the `.docx` and the app all show the same ones.
 *
 * His own lines say where "fits" ends: a median of 295 pt and nine in ten
 * under 410 pt, in a column of 454 (all 1 263 of his reference documents'
 * mantra lines, measured). The caller passes that limit and a width function;
 * this module knows no font and no page.
 *
 * Never divided: inside a word, before a daṇḍa or a verse's number (a daṇḍa
 * never begins a line, `॥ 1॥` is one sign), or at a no-break space — his own
 * way of keeping two words on one line.
 */

/** How to measure a line, and how wide one may be — in the same unit. */
export interface LineFit {
  readonly widthOf: (text: string) => number;
  readonly limit: number;
}

/** A sign a line writes rather than a word: daṇḍas, a verse's number, a bar, a closing bracket. */
const SIGN_ONLY = /^[।॥|¦0-9०-९ˎ)\]]+$/u;
/** An opening bracket, which goes with the word after it: `( ā no̍`. */
const OPENS = /^[([]+$/u;
/** A piece that closes a half-verse, where a line had best end. */
const CLOSES = /[।|¦]$/u;

/**
 * A line's pieces: its words, each with the signs that follow it. A line
 * breaks only between two pieces, at an ordinary space (`' '`).
 */
export function piecesOf(line: string): string[] {
  const out: string[] = [];
  let opening = '';
  for (const word of line.split(' ')) {
    if (word === '') continue;
    if (OPENS.test(word)) { opening += `${word} `; continue; }
    if (out.length > 0 && opening === '' && SIGN_ONLY.test(word)) out[out.length - 1] += ` ${word}`;
    else { out.push(`${opening}${word}`); opening = ''; }
  }
  if (opening !== '') out.push(opening.trimEnd());
  return out;
}

/**
 * The line, divided — or the line itself when it fits.
 *
 * At its HALF-VERSES first: his lines end at their daṇḍas, and a page is read
 * by them. A half-verse that fits is one unit; one too wide by itself is
 * divided evenly at its words' ends. The units are then set as few to a line
 * as fit, as even as they can be. A piece wider than the limit by itself is a
 * line of its own; nothing can be done inside it.
 */
export function fitLine(line: string, fit: LineFit): string[] {
  if (fit.widthOf(line) <= fit.limit) return [line];
  const pieces = piecesOf(line);
  if (pieces.length < 2) return [line];
  const halves: string[][] = [[]];
  for (const piece of pieces) {
    halves[halves.length - 1]!.push(piece);
    if (CLOSES.test(piece)) halves.push([]);
  }
  const units = halves.filter((h) => h.length > 0)
    .flatMap((h) => (fit.widthOf(h.join(' ')) <= fit.limit ? [h.join(' ')] : evenly(h, fit)));
  return units.length < 2 ? units : evenly(units, fit);
}

/**
 * The line, divided only where it may be — at the word ends `cuts` names
 * (counted from 0, a cut after that many words) — as few lines as fit and as
 * even as they can be; the line itself when it fits. A classical metre's
 * pāda is divided at its yati so (his sragdharā: `… sthaḥ | sphaṭika maṇi
 * nibhair |` and not `… maṇi / nibhair |`, 2026-10-04). A unit still too wide
 * is divided by `fitLine`.
 */
export function fitLineAt(line: string, cuts: readonly number[], fit: LineFit): string[] {
  if (fit.widthOf(line) <= fit.limit) return [line];
  const words = piecesOf(line);
  const at = [...new Set(cuts)].filter((c) => c > 0 && c < words.length).sort((a, b) => a - b);
  if (at.length === 0) return fitLine(line, fit);
  const units = [0, ...at].map((from, i) => words.slice(from, at[i] ?? words.length).join(' '));
  return evenly(units, fit).flatMap((u) => (fit.widthOf(u) <= fit.limit ? [u] : fitLine(u, fit)));
}

/**
 * Items set into as few lines as fit the limit, each closest to an even share
 * — the squared difference, so two lines of 300 beat one of 450 and one of
 * 150. An item wider than the limit by itself is a line of its own.
 */
function evenly(items: readonly string[], fit: LineFit): string[] {
  const n = items.length;
  const width = (a: number, b: number): number => fit.widthOf(items.slice(a, b).join(' '));
  const total = width(0, n);
  for (let parts = Math.max(1, Math.ceil(total / fit.limit)); parts <= n; parts += 1) {
    const target = total / parts;
    const cost: number[][] = Array.from({ length: parts + 1 }, () => new Array<number>(n + 1).fill(Infinity));
    const from: number[][] = Array.from({ length: parts + 1 }, () => new Array<number>(n + 1).fill(-1));
    cost[0]![0] = 0;
    for (let k = 1; k <= parts; k += 1) {
      for (let j = k; j <= n - (parts - k); j += 1) {
        for (let i = k - 1; i < j; i += 1) {
          if (cost[k - 1]![i] === Infinity) continue;
          const w = width(i, j);
          if (w > fit.limit && j - i > 1) continue;
          const c = cost[k - 1]![i]! + (w - target) ** 2;
          if (c < cost[k]![j]!) { cost[k]![j] = c; from[k]![j] = i; }
        }
      }
    }
    if (cost[parts]![n] === Infinity) continue;
    const out: string[] = [];
    for (let k = parts, j = n; k > 0; k -= 1) {
      const i = from[k]![j]!;
      out.unshift(items.slice(i, j).join(' '));
      j = i;
    }
    return out;
  }
  return [items.join(' ')];
}

/**
 * A width function from a table of advances, in ems: the letters' advances
 * times the size, a combining mark nothing, a letter the table lacks its
 * `fallback`.
 */
/** The raised digits, in their order. */
const RAISED = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** `raised`: the share of a digit's width a raised one is drawn at — the tokens' `supScale`. */
export function advanceWidth(
  advance: ReadonlyMap<string, number>, fallback: number, size: number, raised = 1,
): (text: string) => number {
  return (text) => {
    let em = 0;
    for (const ch of text.normalize('NFC')) {
      if (/\p{M}/u.test(ch)) continue;
      /* A raised digit — a name's number — is drawn at about two thirds of
         the size, the way a raised reading aid is: its digit's width, scaled. */
      const digit = RAISED.indexOf(ch);
      em += digit < 0 ? advance.get(ch) ?? fallback : (advance.get(String(digit)) ?? fallback) * raised;
    }
    return em * size;
  };
}
