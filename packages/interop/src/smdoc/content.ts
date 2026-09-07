/**
 * Reading v1's marked HTML into a v2 SOURCE, plus a record of what v1 drew.
 *
 * THE INVERSION. v1 stored a marking as a CSS-classed `<span>`: the document
 * *was* its presentation, which is why "is this holding correct?" had nowhere
 * to be asked. This module reads that presentation back into the two things v2
 * keeps instead — the letters, and a list of the marks that were on them — and
 * then the ENGINE decides what the marks should be. Where the two agree, the
 * import is a derivation; where they disagree, v1's decision is recorded as an
 * override with its provenance. Neither is guessed at.
 *
 * It does NOT re-mark anything. That would be a second marking engine, which
 * the rules forbid and which is exactly how v1 came to have four.
 *
 * THE VOCABULARY, measured across the owner's whole Library rather than taken
 * from v1's own spec, which is out of date on almost every name:
 *
 *   ql-holding-short / ql-holding-long   the box, over the letters it contains
 *   ql-change-style                      a letter produced by anusvāra/visarga
 *                                        sandhi — and, inside a `<sup>`, the
 *                                        reading aid instead
 *   ql-svara-true / ql-svara-char        an accent, as the combining mark
 *                                        itself; `·` in one of them is the
 *                                        svarabhakti dot, not an accent
 *   ql-short-pause / ql-long-pause       a pause, containing a literal `|`
 *   soft-break (on `<br>`)               a line break inside the verse
 *   ql-doc-title / -subtitle / -comment / -section / -subsection / -translation
 *   ql-audio-attachment (on `<audio>`)   base64 audio, inline. 39 MB of it in
 *                                        Puruṣa Sūktam alone
 */
import { parseLetters } from '@siksamitra/engine';
import type { ChantSvara } from '@siksamitra/format';
import { tokenizeSmdocHtml } from './html.js';

/** What v1 drew on one letter. Its decisions, not ours. */
export interface SmdocMark {
  /** Letter index within the line — the same counting `SrcMap.units` uses. */
  at: number;
  hold?: 'short' | 'long';
  change?: boolean;
  svara?: ChantSvara;
  sbhakti?: boolean;
  sup?: string;
}

export interface SmdocLine {
  /** The pre-sandhi letters, ready for `derive`. */
  source: string;
  /** The same letters with the accents as combining marks. */
  accented: string;
  marks: SmdocMark[];
  /** Whether any accent was found — a prose text has none. */
  accents: number;
}

export type SmdocBlock =
  | { kind: 'heading'; level: 'title' | 'subtitle' | 'comment' | 'section' | 'subsection'; text: string }
  | { kind: 'translation'; text: string }
  | { kind: 'verse'; lines: SmdocLine[] }
  | { kind: 'audio'; id: string; mime: string; base64: string };

const SVARA_MARK: ReadonlyMap<string, ChantSvara> = new Map([
  ['̍', 'svarita'],
  ['̎', 'dirgha-svarita'],
  ['̱', 'anudatta'],
  // v1 also wrote the udātta sign; v2 leaves udātta unmarked, so it becomes no
  // accent at all rather than a mark nothing can draw.
  ['́', 'svarita'],
]);

/** The svarabhakti dot, which v1 put in a svara span. */
const SBHAKTI = '·';

const NASALS = new Set(['ṅ', 'ñ', 'ṇ', 'n', 'm']);
const SIBILANTS = new Set(['ś', 'ṣ', 's', 'r']);

const HEADINGS: Record<string, 'title' | 'subtitle' | 'comment' | 'section' | 'subsection'> = {
  'ql-doc-title': 'title',
  'ql-doc-subtitle': 'subtitle',
  'ql-doc-comment': 'comment',
  'ql-doc-section': 'section',
  'ql-doc-subsection': 'subsection',
};

/** The inline state a span can put us in. */
interface Style {
  hold?: 'short' | 'long';
  change: boolean;
  pause?: 'short' | 'long';
  svara: boolean;
  sup: boolean;
}

const styleOf = (classes: readonly string[], from: Style): Style => ({
  hold: classes.includes('ql-holding-short') ? 'short'
    : classes.includes('ql-holding-long') ? 'long' : from.hold,
  change: from.change || classes.includes('ql-change-style'),
  pause: classes.includes('ql-short-pause') ? 'short'
    : classes.includes('ql-long-pause') ? 'long' : from.pause,
  svara: from.svara
    || classes.includes('ql-svara-true') || classes.includes('ql-svara-char'),
  sup: from.sup,
});

/**
 * A line under construction.
 *
 * Two strings and a mark list, built letter by letter so an index means the
 * same thing in all three.
 */
class LineBuilder {
  private source = '';
  private accented = '';
  private index = 0;
  private accents = 0;
  private readonly marks: SmdocMark[] = [];
  /** Set by a svarabhakti dot, consumed by the NEXT letter. */
  private pendingSbhakti = false;

  letter(ch: string, style: Style): void {
    /*
     * A `change` letter goes back to its TRIGGER. The holdings run before the
     * anusvāra and visarga substitutions, so the recited letter is the wrong
     * input to the engine — `invertVerse` undoes the same two things for the
     * same reason.
     */
    const plain = style.change
      ? (NASALS.has(ch) ? 'ṁ' : SIBILANTS.has(ch) ? 'ḥ' : ch)
      : ch;
    this.source += plain;
    this.accented += plain;

    const mark: SmdocMark = { at: this.index };
    if (style.hold !== undefined) mark.hold = style.hold;
    if (style.change) mark.change = true;
    if (this.pendingSbhakti) {
      mark.sbhakti = true;
      this.pendingSbhakti = false;
    }
    if (Object.keys(mark).length > 1) this.marks.push(mark);
    this.index += 1;
  }

  /** An accent, which belongs to the letter BEFORE it. */
  accent(mark: ChantSvara): void {
    if (this.index === 0) return; // an accent before any letter is not one.
    const existing = this.marks.find((m) => m.at === this.index - 1);
    if (existing !== undefined) existing.svara = mark;
    else this.marks.push({ at: this.index - 1, svara: mark });
    this.accented += [...SVARA_MARK].find(([, v]) => v === mark)?.[0] ?? '';
    this.accents += 1;
  }

  /** The svarabhakti dot: it precedes the letter it belongs to. */
  sbhakti(): void {
    this.pendingSbhakti = true;
  }

  /** A superscript reading aid, which belongs to the letter before it. */
  superscript(text: string): void {
    if (this.index === 0 || text === '') return;
    const existing = this.marks.find((m) => m.at === this.index - 1);
    if (existing !== undefined) existing.sup = text;
    else this.marks.push({ at: this.index - 1, sup: text });
  }

  /** Text that is not a letter: a space, a daṇḍa, a verse number. */
  raw(text: string): void {
    this.source += text;
    this.accented += text;
  }

  get empty(): boolean { return this.source.trim() === ''; }

  build(): SmdocLine {
    return {
      source: this.source,
      accented: this.accented,
      marks: this.marks,
      accents: this.accents,
    };
  }
}

/**
 * Turn v1's structural punctuation into the source's own spelling.
 *
 * `।` → `|` and `॥` → `||`, EXCEPT between digits: `॥ 1।1॥` is a verse number
 * whose inner `।` separates the anuvāka from the verse, and reading it as a
 * daṇḍa would split the number in half and lose both.
 */
function punctuation(text: string): string {
  return text
    .replace(/(?<=[0-9])।(?=[0-9])/g, '.')
    .replace(/॥/g, ' || ')
    .replace(/।/g, ' | ');
}

/**
 * Is this a letter, as opposed to structure?
 *
 * Whitespace, the daṇḍa bars, the dot inside a verse number, and digits in any
 * of the four scripts are structure. Digits especially: a verse number is not
 * speech, and letting one take a mark index would shift every mark after it.
 */
const isLetterish = (ch: string): boolean => !/[\s|.0-9०-९౦-౯௦-௯¦]/u.test(ch);

/** Read the content HTML into blocks. */
export function parseSmdocContent(html: string): SmdocBlock[] {
  const nodes = tokenizeSmdocHtml(html);
  const blocks: SmdocBlock[] = [];

  let lines: LineBuilder[] = [];
  let line = new LineBuilder();
  let paragraph: string[] = [];
  let heading: keyof typeof HEADINGS | null = null;
  let translation = false;
  const styles: Style[] = [{ change: false, svara: false, sup: false }];
  const top = (): Style => styles[styles.length - 1]!;
  /** Inside an `<audio>`, whose fallback text is not part of the recitation. */
  let inAudio = false;

  const endParagraph = (): void => {
    if (heading !== null) {
      const text = paragraph.join('').trim();
      if (text !== '') blocks.push({ kind: 'heading', level: HEADINGS[heading]!, text });
    } else if (translation) {
      const text = paragraph.join('').trim();
      if (text !== '') blocks.push({ kind: 'translation', text });
    } else {
      const all = [...lines, line].filter((l) => !l.empty);
      if (all.length > 0) blocks.push({ kind: 'verse', lines: all.map((l) => l.build()) });
    }
    lines = [];
    line = new LineBuilder();
    paragraph = [];
    heading = null;
    translation = false;
  };

  for (const node of nodes) {
    if (node.t === 'open') {
      if (node.tag === 'p' || node.tag === 'div') {
        const found = node.classes.find((c) => c in HEADINGS) as keyof typeof HEADINGS | undefined;
        heading = found ?? null;
        translation = node.classes.includes('ql-doc-translation');
        continue;
      }
      if (node.tag === 'sup') {
        styles.push({ ...top(), sup: true });
        continue;
      }
      if (node.tag === 'audio') {
        /*
         * v1 stored audio INLINE as a base64 data URI, which is why Puruṣa
         * Sūktam is a 39 MB document. v2 references assets and never inlines
         * one, so the bytes come out here and the verse keeps a reference.
         */
        const found = audioBlock(node.attrs, blocks.length);
        if (found !== null) blocks.push(found);
        inAudio = true;
        styles.push(top());
        continue;
      }
      styles.push(styleOf(node.classes, top()));
      continue;
    }

    if (node.t === 'close') {
      if (node.tag === 'p' || node.tag === 'div') { endParagraph(); continue; }
      if (node.tag === 'audio') { inAudio = false; styles.pop(); continue; }
      styles.pop();
      continue;
    }

    if (node.t === 'void') {
      if (node.tag !== 'br') continue;
      /*
       * A `<br>` inside a paragraph is a LINE of the verse — a breath — and a
       * bare `<br>` in an otherwise empty paragraph is v1's blank line, which
       * carries nothing. Both look identical in the markup; the difference is
       * whether anything was written before it.
       */
      if (heading !== null || translation) continue;
      lines.push(line);
      line = new LineBuilder();
      continue;
    }

    // ── text ────────────────────────────────────────────────────────────────
    // An `<audio>` element's content is its fallback for a browser that cannot
    // play it. It is not text of the document.
    if (inAudio) continue;
    const style = top();
    if (heading !== null || translation) { paragraph.push(node.s); continue; }

    if (style.sup) {
      // The reading aid, verbatim: `u`, `g`, `gṁ`, `f`, `i`.
      line.superscript(node.s.trim());
      continue;
    }
    if (style.pause !== undefined) {
      /*
       * A pause is DROPPED, not carried into the source.
       *
       * v1's pauses were placed by its own rule engine, and v2 derives them
       * from the same rules — so re-emitting one as `|` would put an authored
       * daṇḍa where the text has a computed pause, and the two would then both
       * appear. Where v2's rules disagree about a pause, the import reports it.
       */
      continue;
    }
    if (style.svara) {
      for (const ch of node.s) {
        if (ch === SBHAKTI) { line.sbhakti(); continue; }
        const mark = SVARA_MARK.get(ch);
        if (mark !== undefined) line.accent(mark);
      }
      continue;
    }

    for (const letter of parseLetters(punctuation(node.s))) {
      if (isLetterish(letter)) line.letter(letter, style);
      else line.raw(letter);
    }
  }

  endParagraph();
  return blocks;
}

/** One `<audio>`'s bytes, from the data URI v1 inlined them in. */
function audioBlock(
  attrs: Record<string, string>,
  index: number,
): Extract<SmdocBlock, { kind: 'audio' }> | null {
  const src = attrs['src'] ?? '';
  const m = /^data:([^;]+);base64,(.*)$/s.exec(src);
  if (m === null) return null;
  return {
    kind: 'audio',
    id: attrs['data-audio-id'] ?? `audio-${index + 1}`,
    mime: m[1]!,
    base64: m[2]!,
  };
}
