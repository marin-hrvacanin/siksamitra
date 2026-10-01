/**
 * TEXT AND MARKINGS, BACK INTO TOKENS — the other direction of `migrate.ts`.
 *
 * Split out of it at the 400-line module gate. `toTextAndMarks` and this are
 * one conversion and its inverse; they are checked against each other over
 * the whole corpus by `check:migrate`, and they share `TextAndMarks`.
 */
import type { ChantSyllable, ChantToken, ChantUnit } from './chant-tokens.js';
import { CANDRA, spaceToken, typedLetter } from './typed-letter.js';
import { type Mark } from './mark.js';
import type { TextAndMarks } from './migrate.js';

/** The markings that describe one letter. */
interface LetterMarks {
  hold?: string;
  svara?: string;
  candra?: boolean;
  sbhakti?: boolean;
  sup?: string;
  cj?: string;
  change?: boolean;
  was?: string;
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
  /**
   * The other scripts for one syllable.
   *
   * The UNITS come too, because that is what a real transliterator reads —
   * `transliterateSyllable` works from the letters and their marks, not from a
   * reassembled IAST string. The audit tool's speller looks the syllable up by
   * its IAST instead and ignores the second argument, which is why both fit
   * behind one signature.
   */
  spell: (iast: string, units: readonly ChantUnit[]) => Omit<ChantSyllable, 't' | 'units' | 'iast'>;
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
      /* Pushed, not spread: the same quadratic `normalise` had. */
      const here = points.get(m.from);
      if (here === undefined) points.set(m.from, [m]);
      else here.push(m);
      continue;
    }
    if (m.k === 'plain' || m.k === 'slot') { spans.push(m); continue; }
    /*
     * BOUNDED BY THE TEXT, and it was not: this walked `from` to `to` and
     * skipped every position the text does not have, so a stored span past the
     * end spun over nothing. A marking is stored as `[kind, from, SPAN]`, so a
     * corrupt or hand-edited file carrying a span of a trillion made
     * `openChantDoc` take about three-quarters of an hour with no exception
     * and no progress — a hang, which looks like a slow computer. Measured at
     * 20 million positions in 53 ms; `tests/security/hostile-document.test.ts`
     * holds the bound. A marking cannot cover a letter that is not there.
     */
    const stop = Math.min(m.to, at.length);
    for (let i = Math.max(0, m.from); i < stop; i += 1) {
      const cell = at[i];
      if (cell === undefined) continue;
      if (m.k === 'hold') cell.hold = m.v;
      else if (m.k === 'svara') cell.svara = m.v;
      else if (m.k === 'sup') cell.sup = m.v;
      else if (m.k === 'cj') cell.cj = m.v;
      else if (m.k === 'was') {
        cell.change = true;
        if (m.v !== undefined) cell.was = m.v;
      }
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
    emit({ t: 'syl', units, iast, ...spell(iast, units) } as ChantSyllable, sylAt);
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
      emit({ t: 'pause', len: m.v === 'long' ? 'long' : 'short', ...(m.by === 'rule' ? { rule: true as const } : {}) }, i);
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

    const space = spaceToken(ch);
    if (space !== null) { flush(); emit(space, i); continue; }
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
    /* Kept only where the table would guess otherwise — the anunāsika. */
    if (cell.change === true && cell.was !== undefined && cell.was !== (typedLetter(unit.c) ?? unit.c)) {
      unit.was = cell.was;
    }
    if (units.length === 0) sylAt = i;
    units.push(unit);
    iast += bare;
  }
  /* Anything at the very end: the last syllable, and a pause after it. */
  flush();
  for (const m of points.get(text.length) ?? []) {
    if (m.k === 'pause') emit({ t: 'pause', len: m.v === 'long' ? 'long' : 'short', ...(m.by === 'rule' ? { rule: true as const } : {}) }, text.length);
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
