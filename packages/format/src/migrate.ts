/**
 * TOKENS ⇄ TEXT AND MARKINGS — the conversion, and the proof that it loses
 * nothing.
 *
 * The corpus is stored as a token stream: one object per letter, four script
 * spellings per syllable, marks as fields on units. It is becoming one text and
 * a list of markings over it (`openspec/changes/text-and-marks`). This file is
 * both directions of that conversion, together in one place, because the only
 * thing that makes the change safe is that they are inverses — and two
 * functions that must be inverses belong where a reader can see both.
 *
 * THE ROUND TRIP IS THE GATE. `tools/migrate-audit.mjs` runs every verse of
 * every document through `toTextAndMarks` and back through `toTokens`, and
 * compares the result with what it started from, field for field. The owner's
 * requirement is exact: "if there is even 0.001% loss, then fix the logic and
 * algorithms so that it's exactly 0%".
 *
 * WHAT IS DELIBERATELY NOT RECOMPUTED. Syllable division and the four script
 * spellings are derived — the lossless gate already proves the spellings are
 * recomputable at 15 881 of 15 881 — but this conversion does NOT recompute
 * them, because a conversion that also re-derives cannot tell a conversion
 * fault from a derivation fault. Boundaries are carried across as markings and
 * the spellings are recomputed by the renderer, at draw time, from the text.
 */
import type { ChantSyllable, ChantToken, ChantUnit } from './chant-tokens.js';
import type { ChantVerse } from './chant-verse.js';
import { mark, type Mark } from './mark.js';
import { normalise } from './mark-ops.js';

/** What a verse looks like in the new model. */
export interface TextAndMarks {
  text: string;
  marks: Mark[];
}

/**
 * The guess table the old inverter used, and the only reason it is still here.
 *
 * A unit with `change: true` records that a rule replaced a letter and NOT what
 * it replaced — that is the gap the new model closes. For legacy data there is
 * nothing else to go on: a changed nasal was an anusvāra, a changed sibilant a
 * visarga. It runs ONCE, during migration, and its output is written down as a
 * `was` marking so that nothing ever has to guess again.
 */
const NASALS = new Set(['ṅ', 'ñ', 'ṇ', 'n', 'm', 'ṁ']);
const SIBILANTS = new Set(['ś', 'ṣ', 's', 'r', ':']);
const ANUSVARA = 'ṁ';
/** U+0310, the combining candrabindu — a character in the text, not a mark. */
export const CANDRA = '̐';
const VISARGA = 'ḥ';

const typedAs = (u: ChantUnit): string => {
  if (u.change !== true) return u.c;
  if (u.c === ANUSVARA || u.c === VISARGA) return u.c;
  if (NASALS.has(u.c)) return ANUSVARA;
  if (SIBILANTS.has(u.c)) return VISARGA;
  return u.c;
};

/** The characters a non-syllable token contributes to the text. */
function structuralText(t: ChantToken): string | null {
  switch (t.t) {
    case 'sp': return ' ';
    case 'br': return '\n';
    case 'danda': return t.s;
    case 'num': return t.s;
    case 'bar': return '¦';
    case 'text': return t.placeholder === true ? '' : t.s;
    default: return null;
  }
}

/**
 * A verse's tokens as one text and a list of markings.
 *
 * Every marking it produces is `by: 'hand'`. That is not a default, it is the
 * meaning: these are the markings the document arrived carrying, and nothing
 * may regenerate them without being asked.
 */
export function toTextAndMarks(verse: ChantVerse): TextAndMarks {
  let text = '';
  const marks: Mark[] = [];

  /** An open run per kind, so equal adjacent values become ONE marking. */
  const open = new Map<string, Mark>();
  const close = (k: string): void => {
    const run = open.get(k);
    if (run !== undefined) { marks.push(run); open.delete(k); }
  };
  const closeAll = (): void => { for (const k of [...open.keys()]) close(k); };
  const put = (k: Mark['k'], v: string | undefined, from: number, to: number): void => {
    const run = open.get(k);
    if (run !== undefined && run.v === v && run.to === from) { run.to = to; return; }
    close(k);
    open.set(k, mark({ k, from, to, ...(v === undefined ? {} : { v }) }));
  };

  const walk = (tokens: readonly ChantToken[]): void => {
    for (const t of tokens) {
      if (t.t === 'syl') {
        const start = text.length;
        for (const u of t.units) {
          const at = text.length;
          text += u.c;

          /*
           * A CANDRABINDU IS A CHARACTER, not a marking.
           *
           * The token shape stores it as a boolean on the letter, and the old
           * renderer put it back by appending U+0310 to the glyph. As a
           * marking it could not be drawn at all by the run renderer, whose
           * element holds one text node and no room for a combining mark laid
           * over it — the parity gate showed it simply absent. It belongs in
           * the text, which is also where an author types it, and
           * `splitsCharacter` already forbids a marking boundary falling
           * between a letter and its combining mark.
           */
          if (u.candra === true) text += CANDRA;
          const end = text.length;

          if (u.change === true) marks.push(mark({ k: 'was', from: at, to: end, v: typedAs(u) }));
          if (u.hold !== undefined) put('hold', u.hold, at, end); else close('hold');
          if (u.svara !== undefined) put('svara', u.svara, at, end); else close('svara');
          if (u.cj !== undefined) marks.push(mark({ k: 'cj', from: at, to: end, v: u.cj }));
          if (u.sbhakti === true) marks.push(mark({ k: 'sbhakti', from: at, to: at }));
          if (u.sup !== undefined) marks.push(mark({ k: 'sup', from: at, to: end, v: u.sup }));
        }
        /*
         * WHERE THE SYLLABLE ENDED. Carried rather than recomputed — see the
         * header. A boundary is a point marking, and the one at the very start
         * of the verse is implied, so only the ends are written.
         */
        marks.push(mark({ k: 'syl', from: text.length, to: text.length }));
        if (start === text.length) marks.pop();
        continue;
      }

      /* Any non-syllable token ends every open run: a holding does not span a
         space unless somebody drew it that way, and this is the OLD data. */
      closeAll();

      if (t.t === 'slot') {
        const at = text.length;
        walk(t.tokens);
        marks.push(mark({ k: 'slot', from: at, to: text.length, v: t.name }));
        continue;
      }
      if (t.t === 'pause') {
        marks.push(mark({ k: 'pause', from: text.length, to: text.length, v: t.len }));
        continue;
      }
      const s = structuralText(t);
      if (s === null) continue;
      const at = text.length;
      text += s;
      /* A `text` token is prose inside a marked stream and has to come back as
         one; a daṇḍa and a number are recognisable from the characters alone. */
      if (t.t === 'text') {
        marks.push(mark({
          k: 'plain',
          from: at,
          to: text.length,
          ...(t.fill === true ? { v: 'fill' } : {}),
        }));
      }
    }
  };

  walk(verse.tokens);
  closeAll();
  return { text, marks: normalise(marks) };
}

/* ── and back ─────────────────────────────────────────────────────────────── */

/** The markings that describe one letter. */
interface LetterMarks {
  hold?: string;
  svara?: string;
  candra?: boolean;
  sbhakti?: boolean;
  sup?: string;
  cj?: string;
  change?: boolean;
}

/**
 * Text and markings back into a token stream.
 *
 * The inverse of `toTextAndMarks`, and the reason both live here. It exists to
 * be run against the first: a conversion nobody can invert is a conversion
 * nobody can check, and this one is checked over all 573 verses before the old
 * shape is deleted.
 *
 * It does NOT re-derive. Syllable boundaries come from the `syl` markings, and
 * the two things it cannot know — how the text divides into LETTERS, and how a
 * syllable is spelt in the other scripts — are supplied by the caller. Both
 * belong to the engine, which sits above this package; and asking this
 * function to derive them as well would mean a difference between the two
 * could not be attributed to either.
 *
 * `split` matters more than it looks. A letter is not a character: `bh` is one
 * letter written with two, and the first version of this walked the text
 * character by character and turned every aspirate into its plain consonant —
 * `{"c":"bh"}` came back `{"c":"b"}` in 573 of 573 verses.
 */
export interface TokenHelp {
  /** The other scripts for one syllable's IAST. */
  spell: (iast: string) => Omit<ChantSyllable, 't' | 'units' | 'iast'>;
  /** The text, divided into LETTERS: `bha` is `['bh', 'a']`. */
  split: (text: string) => string[];
}

export function toTokens(
  { text, marks }: TextAndMarks,
  { spell, split }: TokenHelp,
): ChantToken[] {
  /** Per position: what covers it. Built once; the walk below is then linear. */
  const at: LetterMarks[] = Array.from({ length: text.length }, () => ({}));
  const boundaries = new Set<number>();
  const points = new Map<number, Mark[]>();
  const spans: Mark[] = [];

  for (const m of marks) {
    if (m.k === 'syl') { boundaries.add(m.from); continue; }
    if (m.from === m.to) {
      points.set(m.from, [...(points.get(m.from) ?? []), m]);
      continue;
    }
    if (m.k === 'plain' || m.k === 'slot') { spans.push(m); continue; }
    for (let i = m.from; i < m.to; i += 1) {
      const cell = at[i];
      if (cell === undefined) continue;
      if (m.k === 'hold') cell.hold = m.v;
      else if (m.k === 'svara') cell.svara = m.v;
      else if (m.k === 'sup') cell.sup = m.v;
      else if (m.k === 'cj') cell.cj = m.v;
      else if (m.k === 'was') cell.change = true;
    }
  }
  for (const [pos, list] of points) {
    for (const m of list) {
      if (m.k !== 'sbhakti') continue;
      const cell = at[pos];
      if (cell !== undefined) cell.sbhakti = true;
    }
  }

  /** Group ids, minted per syllable exactly as the old shape numbered them. */
  let group = 0;

  const out: ChantToken[] = [];
  /** Where each emitted token began in the text, so slots can be rebuilt. */
  const startedAt: number[] = [];
  let units: ChantUnit[] = [];
  let iast = '';

  /** Where the syllable being built began. */
  let sylAt = 0;
  const emit = (token: ChantToken, at: number): void => {
    out.push(token);
    startedAt.push(at);
  };
  const flush = (): void => {
    if (units.length === 0) return;
    emit({ t: 'syl', units, iast, ...spell(iast) } as ChantSyllable, sylAt);
    units = [];
    iast = '';
  };

  const plainAt = (i: number): Mark | undefined =>
    spans.find((m) => m.k === 'plain' && m.from <= i && m.to > i);

  /*
   * Walk LETTERS, not characters. The offsets stay in characters — every
   * marking is addressed in them — so the loop carries `i` alongside.
   */
  const letters = split(text);
  /*
   * The update expression advances `i`, and `continue` runs it — which is the
   * point. The first version incremented `i` inside each branch, the space and
   * daṇḍa branches were missed, and every offset after the first space was
   * wrong: a pause at 3 was read at 5, so `sp PAUSE sp` came back as
   * `sp sp syl(p) PAUSE` in 204 verses.
   */
  for (let n = 0, i = 0; n < letters.length; i += letters[n]!.length, n += 1) {
    const ch = letters[n]!;

    /* A boundary at `i` ends the syllable BEFORE it. Checked here rather than
       after the letter, so that a boundary and a pause at the same offset come
       out in the order the stream had them. */
    if (boundaries.has(i)) flush();
    for (const m of points.get(i) ?? []) {
      if (m.k !== 'pause') continue;
      flush();
      emit({ t: 'pause', len: m.v === 'long' ? 'long' : 'short' }, i);
    }

    const cell = at[i] ?? {};
    const prose = plainAt(i);

    if (prose !== undefined) {
      flush();
      const last = out[out.length - 1];
      if (last !== undefined && last.t === 'text' && prose.from < i) last.s += ch;
      else emit({ t: 'text', s: ch, ...(prose.v === 'fill' ? { fill: true } : {}) }, i);
      continue;
    }

    if (ch === ' ') { flush(); emit({ t: 'sp' }, i); continue; }
    if (ch === '\n') { flush(); emit({ t: 'br' }, i); continue; }
    if (ch === '¦') { flush(); emit({ t: 'bar' }, i); continue; }
    if (ch === '।' || ch === '॥') { flush(); emit({ t: 'danda', s: ch }, i); continue; }
    /* A verse number is digits and the dots between them: `1.2` is one
       token, and matching a single digit split 37 of them into three. */
    if (/^[0-9]$/.test(ch) || (ch === '.' && out[out.length - 1]?.t === 'num')) {
      flush();
      const last = out[out.length - 1];
      if (last !== undefined && last.t === 'num') last.s += ch;
      else emit({ t: 'num', s: ch }, i);
      continue;
    }

    /* The combining candrabindu rides on the letter before it — it is one
       character to a reader and `split` keeps it with its base. */
    const bare = ch.endsWith(CANDRA) ? ch.slice(0, -CANDRA.length) : ch;
    const unit: ChantUnit = { c: bare };
    if (bare !== ch) unit.candra = true;
    if (cell.hold !== undefined) {
      /* A new box wherever the run started; the same one while it continues. */
      const before = at[i - 1];
      const same = before !== undefined && before.hold === cell.hold && !boundaries.has(i);
      if (!same) group += 1;
      unit.hold = cell.hold as ChantUnit['hold'];
      unit.hg = group;
    }
    if (cell.svara !== undefined) unit.svara = cell.svara as ChantUnit['svara'];
    if (cell.candra === true) unit.candra = true;
    if (cell.sbhakti === true) unit.sbhakti = true;
    if (cell.sup !== undefined) unit.sup = cell.sup;
    if (cell.cj !== undefined) unit.cj = cell.cj as ChantUnit['cj'];
    if (cell.change === true) unit.change = true;
    if (units.length === 0) sylAt = i;
    units.push(unit);
    iast += bare;
  }
  /* Anything at the very end: the last syllable, and a pause after it. */
  flush();
  for (const m of points.get(text.length) ?? []) {
    if (m.k === 'pause') emit({ t: 'pause', len: m.v === 'long' ? 'long' : 'short' }, text.length);
  }

  /*
   * Slots last, because a slot CONTAINS tokens: the stream is built flat and
   * the tokens whose text falls inside a slot's range are then folded into it.
   * Building them inline would mean the walk had to know it was inside one.
   */
  const slots = spans.filter((m) => m.k === 'slot').sort((a, b) => b.from - a.from);
  for (const slot of slots) {
    const first = startedAt.findIndex((x) => x >= slot.from);
    if (first === -1) continue;
    let last = first;
    while (last + 1 < startedAt.length && startedAt[last + 1]! < slot.to) last += 1;
    const inside = out.splice(first, last - first + 1);
    startedAt.splice(first, inside.length, slot.from);
    out.splice(first, 0, { t: 'slot', name: slot.v ?? '', tokens: inside });
  }
  flush();
  return out;
}
