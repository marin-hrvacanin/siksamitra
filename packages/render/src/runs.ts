/**
 * TEXT AND MARKINGS, AS RUNS — the one shape both the page and the editor draw.
 *
 * A run is a stretch of text over which every marking is constant. Splitting a
 * verse into runs is the whole of "how is this drawn": each run becomes one
 * element carrying its marks as classes, and a marking that covers eleven
 * letters becomes ONE element rather than eleven, which is why a holding box
 * crosses a space without anything having to join the pieces afterwards.
 *
 * WHY RUNS AND NOT A SPAN PER LETTER. The Lexical spike settled it by
 * measurement (`tools/spike-lexical`, and the design under
 * `openspec/changes/text-and-marks`). A per-letter markup inside an editable
 * text node breaks the editor's offset mapping outright: a click on the sixth
 * letter reported offset 1, and typing two characters turned `sunavāma` into
 * `YsX`. A flat run is what an editing surface can map, and the same run is
 * what the reader, the print sheet, the PDF and the image export draw — so
 * there is one renderer rather than one for editing and one for everything
 * else.
 *
 * WHAT THIS FILE DOES NOT DO. It does not know about the DOM, React, CSS or
 * scripts' letterforms. It answers one question — where does the drawing
 * change — and every consumer builds its own elements from the answer.
 */
import type { Mark, MarkKind } from '@siksamitra/format';

/** The markings in force over a run, flattened for a renderer to read. */
export interface RunMarks {
  hold?: string;
  svara?: string;
  /** This run's letters replaced something; the value is what they replaced. */
  was?: string;
  cj?: string;
  /** A superscript after this run — the upadhmānīya `f`, and its kin. */
  sup?: string;
  /** Prose rather than recited text. `fill` when the reciter supplies it. */
  plain?: string | true;
  /** The name of the variable slot this run belongs to. */
  slot?: string;
}

/**
 * What a run holds, so it can be drawn as what it is.
 *
 * A daṇḍa is not a letter. The first version gave every run the letter class,
 * and the parity gate photographed the result: the daṇḍa in Mantra Puṣpam drew
 * in the letter colour with no space around it, because `.danda` and `.sp`
 * never matched anything. Structure breaks a run as surely as a marking does.
 */
export type RunKind = 'text' | 'danda' | 'bar' | 'num' | 'br';

const DANDA: ReadonlySet<string> = new Set(['।', '॥']);

export function runKindOf(ch: string): RunKind {
  if (ch === '\n') return 'br';
  /*
   * A SPACE IS TEXT. `.sp` carries no style at all — only `.danda` and `.bar`
   * do — and keeping the space inside its run is what lets one holding box
   * cross a word gap as a single rectangle, which is the whole reason runs
   * replaced a span per letter.
   */
  if (ch === '¦') return 'bar';
  if (DANDA.has(ch)) return 'danda';
  if (/^[0-9.]$/.test(ch)) return 'num';
  return 'text';
}

export interface Run {
  /** What this run holds — letters, or a piece of structure. */
  kind: RunKind;
  /** The characters, exactly as they appear in the verse's text. */
  text: string;
  /** Where the run starts in the verse's text. */
  from: number;
  to: number;
  marks: RunMarks;
  /** Point markings that sit at this run's START, in order. */
  before: Mark[];
  /** Point markings that sit at this run's END. Only ever on the last run. */
  after: Mark[];
}

/** The kinds that describe a stretch rather than a position. */
const SPAN_KINDS: ReadonlySet<MarkKind> =
  new Set<MarkKind>(['hold', 'svara', 'was', 'cj', 'sup', 'plain', 'slot']);

/**
 * The kinds where two equal neighbours are still two things.
 *
 * A holding is a property of a stretch, so two long holdings that meet are one
 * box. A substitution is not: two consecutive letters that each replaced a
 * visarga are two substitutions, and drawing them as one run says the pair of
 * them replaced a single letter — Śrī Rudram has three verses that do exactly
 * this. `MERGING_KINDS` in the model draws the same line for the same reason;
 * this is its half of it.
 */
const NEVER_FUSED: ReadonlySet<MarkKind> = new Set<MarkKind>(['was', 'cj', 'sup', 'plain']);

/**
 * Where the drawing changes.
 *
 * Every span marking contributes two: where it starts and where it ends. A run
 * boundary is also forced at a syllable edge and at a point marking, because a
 * pause has to be drawn between two runs rather than inside one, and because a
 * script that shapes clusters needs to know where a syllable began.
 */
function boundaries(marks: readonly Mark[], length: number): number[] {
  const at = new Set<number>([0, length]);
  for (const m of marks) {
    if (m.from === m.to) { at.add(m.from); continue; }
    if (!SPAN_KINDS.has(m.k)) continue;
    at.add(m.from);
    at.add(m.to);
  }
  return [...at].filter((n) => n >= 0 && n <= length).sort((a, b) => a - b);
}

/** The span markings covering a position, flattened. */
function marksAtPosition(marks: readonly Mark[], at: number): RunMarks {
  const out: RunMarks = {};
  for (const m of marks) {
    if (m.from === m.to || !SPAN_KINDS.has(m.k)) continue;
    if (m.from > at || m.to <= at) continue;
    if (m.k === 'hold') out.hold = m.v;
    else if (m.k === 'svara') out.svara = m.v;
    else if (m.k === 'was') out.was = m.v;
    else if (m.k === 'cj') out.cj = m.v;
    else if (m.k === 'sup') out.sup = m.v;
    else if (m.k === 'plain') out.plain = m.v ?? true;
    else if (m.k === 'slot') out.slot = m.v;
  }
  return out;
}

const sameMarks = (a: RunMarks, b: RunMarks): boolean =>
  a.hold === b.hold && a.svara === b.svara
  && a.was === b.was && a.cj === b.cj && a.sup === b.sup && a.plain === b.plain && a.slot === b.slot;

/**
 * A verse's text and markings, as the runs that draw it.
 *
 * Runs never span a line break: a `\n` ends one and the next begins after it,
 * so a caller can group them into lines without re-scanning the text.
 */
export function toRuns(text: string, marks: readonly Mark[]): Run[] {
  const edges = boundaries(marks, text.length);
  /* A line break is always its own boundary — a run that straddled one could
     not be drawn as a single element on either line. */
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') { edges.push(i, i + 1); }
  }
  /* Structure breaks a run as surely as a marking does. */
  for (let i = 1; i < text.length; i += 1) {
    if (runKindOf(text[i]!) !== runKindOf(text[i - 1]!)) edges.push(i);
  }
  const cuts = [...new Set(edges)].sort((a, b) => a - b);

  const points = new Map<number, Mark[]>();
  for (const m of marks) {
    if (m.from !== m.to) continue;
    points.set(m.from, [...(points.get(m.from) ?? []), m]);
  }

  /** A run may not fuse with the one before it if a distinct marking starts here. */
  const startsHere = new Set<number>();
  for (const m of marks) {
    if (m.from !== m.to && NEVER_FUSED.has(m.k)) startsHere.add(m.from);
  }

  const out: Run[] = [];
  for (let n = 0; n < cuts.length - 1; n += 1) {
    const from = cuts[n]!;
    const to = cuts[n + 1]!;
    if (to <= from) continue;
    /*
     * A line break is a separator, not something drawn. Giving it the markings
     * in force around it puts a holding on a run with no letters in it, and
     * every consumer then has to know to ignore that.
     */
    const body = text.slice(from, to);
    const kind = runKindOf(body[0] ?? '');
    const at = kind === 'br' ? {} : marksAtPosition(marks, from);
    const previous = out[out.length - 1];
    /*
     * Fuse with the run before it when nothing about the drawing changed and
     * no point marking sits between them. Boundaries are generated from every
     * marking's edges, so two markings that end at the same place would
     * otherwise leave a seam that draws as two elements.
     */
    if (previous !== undefined && previous.to === from && previous.kind === kind
      && sameMarks(previous.marks, at)
      && (points.get(from) ?? []).length === 0
      && !startsHere.has(from)
      && kind !== 'br') {
      previous.text += body;
      previous.to = to;
      continue;
    }
    out.push({
      kind,
      text: body,
      from,
      to,
      marks: at,
      before: points.get(from) ?? [],
      after: [],
    });
  }

  /* A point marking past the last letter belongs to the last run's end. */
  const last = out[out.length - 1];
  if (last !== undefined) last.after = points.get(text.length) ?? [];
  return out;
}

/**
 * The runs of one line, and the lines in order.
 *
 * The newline itself is dropped: it is a separator, not something drawn, and a
 * run holding it would put a stray character inside an element.
 */
export function toLines(runs: readonly Run[]): Run[][] {
  const lines: Run[][] = [[]];
  for (const run of runs) {
    if (run.text === '\n') { lines.push([]); continue; }
    lines[lines.length - 1]!.push(run);
  }
  return lines;
}
