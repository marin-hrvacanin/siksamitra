/**
 * Lexing — source text to a flat element list, with the offsets that make
 * WYSIWYG editing possible.
 *
 * Every letter records where it came from (`line`, `start`, `end`), so the
 * editor can map a caret in the rendered marked text back to a position in the
 * source string and back again. That map is the whole reason the editor can be
 * a projection of the source rather than a rich-text tree.
 *
 * Ported from `gen_marks.build` + `apply_hiatus_pauses`.
 *
 * OFFSETS ARE INTO THE NORMALISED LINE. `norm()` lower-cases, turns hyphens and
 * commas into spaces and collapses whitespace, so offsets into the raw input
 * would drift. The source layer (01 §2.3) stores lines already in canonical
 * form, and `lex` returns the normalised lines so a caller can persist them.
 *
 * A LINE BREAK IS NOT A BARRIER. It breaks neither a saṁyukta nor an anusvāra
 * context — measured: treating it as a barrier costs 8 of the owner's boxes,
 * and `durga-suktam` v-2 assimilates an anusvāra across one. So a whole verse
 * is lexed in ONE call. `gen_vishnu.py` marks per line and `vishnu-suktam.json`
 * is missing two boxes because of it.
 *
 * See specs/chant-editor/02-ENGINE.md §3.
 */
import {
  ANU, BIJA, CANDRA, LONG_VOWELS, PRANAVA, SHORT_VOWELS, ZWJ, ZWNJ,
  isConsonant, isVowel, parseLetters,
} from './alphabet.js';
import { norm } from './normalize.js';
import type { ChantSvara } from '@siksamitra/format';
import { DEFAULT_PROFILE } from './profile.js';
import type { Profile } from './profile.js';

/** Where an element came from in the source. */
export interface SrcSpan {
  line: number;
  start: number;
  end: number;
}

export type ElemKind =
  | 'letter'
  /** An authored daṇḍa / bar: `|` or `||`. Ends a saṁyukta. */
  | 'pause'
  /** An authored line break: `//`. Ends nothing. */
  | 'br'
  /** The short pause a praṇava or bīja takes. Ends a saṁyukta. */
  | 'ompause'
  /** A vowel-hiatus pause. */
  | 'vpause'
  /** An orthographic hyphen. A word boundary for every rule — exactly as the
   *  space it used to be collapsed into — but it survives to `emit`, which
   *  writes it back as a coda of the syllable before it. */
  | 'hyphen';

/** One element of the flat list the rules operate on. Mutable during a run. */
export interface Elem {
  kind: ElemKind;
  /** The letter, in IAST. A digraph and the whole gum run are ONE element. */
  ch: string;
  /** For `pause` the raw text (`|` / `||`); for `vpause` the length. */
  text?: string;
  src: SrcSpan;
  /** Word index within the fragment; -1 for non-letters. */
  word: number;
  /** Line index within the fragment. */
  line: number;
  vowel: boolean;
  cons: boolean;
  /* ---- marks, filled in by the rules ---- */
  hold?: 'short' | 'long';
  hg?: number;
  change?: boolean;
  sup?: string;
  candra?: boolean;
  sbhakti?: boolean;
  svara?: ChantSvara;
  dirgha?: boolean;
  /** A conjunct boundary AFTER this letter (01 §2.5). `split` = virāma + ZWNJ
   *  (a visible halanta), `join` = virāma + ZWJ. Absent = default shaping. */
  cj?: 'split' | 'join';
  /** Set when a rule REPLACED the letter, so the editor can show both. */
  wasCh?: string;
  /** Indices into `Derivation.trace` for the rules that touched this element. */
  trace?: number[];
}

export interface LexResult {
  elems: Elem[];
  /** Per word index: is this word a bīja? Its anusvāra is never assimilated. */
  wordIsBija: boolean[];
  /** The normalised lines the offsets refer to. */
  lines: string[];
}

/** Anything that already constitutes a break, so no pause is added against it. */
const CLOSERS = new Set(['|', '/', '।', '॥']);

function allIn(s: string, set: Set<string>): boolean {
  for (const c of s) if (!set.has(c)) return false;
  return s.length > 0;
}

interface Part {
  text: string;
  line: number;
  start: number;
}

/** Split lines into space-separated parts, keeping each part's offset. */
function parts(lines: string[]): { parts: Part[]; normalised: string[] } {
  const out: Part[] = [];
  const normalised: string[] = [];
  lines.forEach((raw, li) => {
    const line = norm(raw);
    normalised.push(line);
    if (li > 0) out.push({ text: '//', line: li, start: 0 });
    // Split on spaces AND hyphens, keeping the hyphen as its own part so it
    // can be written back. A run of hyphens is one separator.
    let piece = '';
    const flush = (at: number): void => {
      if (piece !== '') out.push({ text: piece, line: li, start: at - piece.length });
      piece = '';
    };
    for (let k = 0; k < line.length; k += 1) {
      const ch = line[k]!;
      if (ch === ' ') { flush(k); continue; }
      if (ch === '-') { flush(k); out.push({ text: '-', line: li, start: k }); continue; }
      piece += ch;
    }
    flush(line.length);
  });
  return { parts: out, normalised };
}

function makeLetter(ch: string, word: number, line: number, start: number): Elem {
  let base = ch;
  let candra = false;
  let sup: string | undefined;
  // The gum arrives as one letter `m` + U+0310 (+ `g`/`gg`) (+ `ṁ`): the base
  // letter is `m`, the nasal becomes `candra`, and the g-run becomes the
  // IAST-only superscript reading aid.
  if (ch.startsWith('m' + CANDRA)) {
    const tail = ch.slice(2);
    base = 'm';
    candra = true;
    if (tail) sup = tail;
  }
  const e: Elem = {
    kind: 'letter',
    ch: base,
    src: { line, start, end: start + ch.length },
    word,
    line,
    vowel: isVowel(base),
    cons: isConsonant(base),
  };
  if (candra) e.candra = true;
  if (sup !== undefined) e.sup = sup;
  return e;
}

/**
 * Lex a fragment.
 *
 * The praṇava's short pause goes in HERE, before holdings run, because a pause
 * ends a saṁyukta (MARKING-RULES §2.1): `oṁ | sumukhāya` therefore gets NO
 * holding on that `s`, while `upavītaṁ samarpayāmi` — the same ṁ + space + s
 * with no pause between — does.
 */
/**
 * `profile.pauses` decides whether the two DERIVED pauses are placed. Both are
 * on in every shipped preset; the switches exist because a document generated
 * before the rule existed reproduces only with them off, and `vu-chant profile`
 * needs to be able to say so instead of reporting a false disagreement.
 */
export function lex(lines: string[], profile: Profile = DEFAULT_PROFILE): LexResult {
  const { parts: ps, normalised } = parts(lines);
  const elems: Elem[] = [];
  const wordIsBija: boolean[] = [];
  let wid = -1;

  ps.forEach((p, i) => {
    if (allIn(p.text, new Set(['|']))) {
      elems.push({
        kind: 'pause', ch: '', text: p.text,
        src: { line: p.line, start: p.start, end: p.start + p.text.length },
        word: -1, line: p.line, vowel: false, cons: false,
      });
      return;
    }
    if (p.text === '-') {
      // A word boundary that leaves a visible trace. `wid` is NOT bumped here:
      // the next letter run bumps it itself, exactly as it would after a space.
      elems.push({
        kind: 'hyphen', ch: '', text: '-',
        src: { line: p.line, start: p.start, end: p.start + 1 },
        word: -1, line: p.line, vowel: false, cons: false,
      });
      return;
    }
    if (allIn(p.text, new Set(['/']))) {
      elems.push({
        kind: 'br', ch: '', text: p.text,
        src: { line: p.line, start: p.start, end: p.start + p.text.length },
        word: -1, line: p.line, vowel: false, cons: false,
      });
      return;
    }
    wid += 1;
    wordIsBija.push(BIJA.has(p.text));
    let col = p.start;
    for (const ch of parseLetters(p.text)) {
      // The conjunct controls are ANNOTATION, not letters: they attach to the
      // letter they follow and emit no element of their own, so the saṁyukta
      // scan, the nucleus count and the long/short look-back never see them.
      if (ch === ZWNJ || ch === ZWJ) {
        const prev = elems[elems.length - 1];
        if (prev !== undefined && prev.kind === 'letter') {
          prev.cj = ch === ZWNJ ? 'split' : 'join';
          prev.src.end = col + ch.length;
        }
        col += ch.length;
        continue;
      }
      elems.push(makeLetter(ch, wid, p.line, col));
      col += ch.length;
    }

    // A praṇava that CLOSES the line takes no pause — `… suvar oṁ ||` ends the
    // recitation, and a pause after it would hang. What counts as "nothing
    // follows" must include the DEVANĀGARĪ daṇḍas, not just the ASCII ones:
    // `harir oṁ ।` kept getting a pause because `।` is not in `|/`, and the
    // owner reported the hanging pause twice.
    const rest = ps.slice(i + 1).filter((q) => q.text && !allIn(q.text, CLOSERS));
    // …and a praṇava with a break ALREADY WRITTEN after it takes none either.
    // `oṁ | aparādha…` was rendering the praṇava, the automatic short pause AND
    // the authored daṇḍa — two marks for one break. One rule for both: never
    // add a pause where a break is already there.
    const nxt = ps.slice(i + 1).find((q) => q.text);
    const alreadyBroken = nxt !== undefined && allIn(nxt.text, CLOSERS);
    // A praṇava carrying the gum is still a praṇava: `om̐gṁ` → `om`.
    const bare = p.text.includes(CANDRA)
      ? p.text.replace(new RegExp(CANDRA, 'g'), '').replace(/[gṁ]+$/, '')
      : p.text;
    // EVERY bīja takes the short pause, not only the praṇava: the sādhana and
    // the Rudram prastāvanā both print `guṁ | gurubhyo namaḥ` and
    // `paṁ | parama gurubhyo namaḥ` — the seed syllable stands on its own
    // before the words it opens.
    const isSeed = PRANAVA.has(p.text) || PRANAVA.has(bare) || BIJA.has(p.text);
    if (isSeed && profile.pauses.bija && rest.length > 0 && !alreadyBroken) {
      const end = p.start + p.text.length;
      elems.push({
        kind: 'ompause', ch: '', text: '|',
        src: { line: p.line, start: end, end },
        word: -1, line: p.line, vowel: false, cons: false,
      });
    }
  });

  return {
    elems: profile.pauses.hiatus ? applyHiatusPauses(elems) : elems,
    wordIsBija,
    lines: normalised,
  };
}

/**
 * The vowel-hiatus pauses — `findAllPauses` rules 2 and 3.
 *
 *   2. a LONG vowel, a word boundary, then a SHORT vowel  → LONG pause
 *   3. any other vowel + word boundary + vowel            → SHORT pause
 *
 * Two vowels meeting across a word join without coalescing. `vāyur vā apām`
 * holds `ā` and `a` apart, and because the first is long and the second short
 * it takes the long pause; `ya evaṁ` and `tapata āyatanaṁ` take the short one.
 * The test is on the two vowels themselves, in that order — not on which word
 * is longer, and not on whether sandhi could have applied.
 *
 * Corroborated by the owner's own marked chants, 35 of 35, with no
 * disagreement. Runs BEFORE holdings, because a pause is a saṁyukta barrier and
 * the barrier has to be in place before the scan.
 */
export function applyHiatusPauses(elems: Elem[]): Elem[] {
  const out: Elem[] = [];
  elems.forEach((e, k) => {
    out.push(e);
    if (e.kind !== 'letter' || !e.vowel) return;
    const after = elems[k + 1];
    // A break or pause already separates them.
    if (after === undefined || after.kind !== 'letter') return;
    if (!after.vowel || after.word === e.word) return;
    const longThenShort = LONG_VOWELS.has(e.ch) && SHORT_VOWELS.has(after.ch);
    out.push({
      kind: 'vpause', ch: '', text: longThenShort ? 'long' : 'short',
      src: { line: e.src.line, start: e.src.end, end: e.src.end },
      word: -1, line: e.line, vowel: false, cons: false,
    });
  });
  return out;
}

/** The next letter after `idx`, not crossing a pause. */
export function nextLetter(elems: Elem[], idx: number): Elem | null {
  for (let i = idx + 1; i < elems.length; i += 1) {
    const e = elems[i]!;
    if (e.kind === 'pause' || e.kind === 'ompause' || e.kind === 'vpause') return null;
    if (e.kind === 'letter') return e;
  }
  return null;
}

/** Is this element one of the three pause kinds? */
export function isPause(e: Elem): boolean {
  return e.kind === 'pause' || e.kind === 'ompause' || e.kind === 'vpause';
}

export { ANU };
