/**
 * A LINE IN AN INDIC SCRIPT, READ AS IAST — the one reader.
 *
 * Out of `script-runs.ts` at the module gate. The writer there uses this to
 * check itself, and every document read goes through it, so what a line MEANS
 * is decided once. See `script-runs.ts` for how a line is written: styles
 * change only between clusters, an accent is in its cluster's run, and what a
 * cluster cannot show is said in a run of hidden text after it (`Said`).
 *
 * WHERE EACH LETTER CAME FROM. The reader records the Word offset each letter
 * was read at, so a caret in a Devanāgarī line can be followed into the IAST
 * and from there into the model (`iastPositions`) — the add-in's selection is
 * a Word offset, and a letter is where its cluster begins.
 */
import type { ChantSvara } from '@siksamitra/format';
import { typedLetter } from '@siksamitra/format';
import {
  CANDRA, CANDRA_SIGN, DEFAULT_PROFILE_KEY, detectScript, digitsFrom, holdingHostOf, isConsonant, isVowel,
  kampaOf, parseLetters, resolveProfile, scriptClusters, toIast, type Profile, type ScriptKey,
} from '@siksamitra/engine';
import { WORD_DEVANAGARI } from '@siksamitra/tokens/word';
import { mergeRuns, type WordRun } from '../docx-read.js';
import { isBluePause, splitPauseBars } from '../docx-pauses.js';
import { SCRIPT_SVARA_BY_CHAR, roleOf } from '../word-styles.js';
import { bareLetter, changedOf, holdOf, iastRunsOfLetters, type Letter } from './script-letters.js';

export type Read = Letter & { cluster: number; k: number };

/** What a hidden run of ours begins with: an invisible separator and our name. */
export const SAID = '⁣śm';

/**
 * What a cluster cannot show, said in the hidden run after it — each by the
 * index of the letter in the cluster it is about. Only what the plain reading
 * would get wrong is said, so most clusters have no hidden run at all.
 */
export interface Said {
  /** The letters the box is on. */
  h?: number[];
  /**
   * Which holding `h` means, when nothing drawn says it — a SPACE inside a
   * holding. His Devanāgarī marks a held akṣara with a sign before it and a
   * word gap with nothing at all, so a holding that crosses one (`m ṅ`) came
   * back as two, the space between them no longer held.
   */
  k?: 'short' | 'long';
  /** The letters the substitution is on. */
  c?: number[];
  /** Which letter each accent is on. */
  s?: [ChantSvara, number][];
  /** The letter the svarabhakti dot is before. */
  d?: number;
  /** Letters with the virāma tick, and with the `:` of `ḥ:`. */
  t?: number[];
  o?: number[];
  /** Raised reading aids, and letters spelt another way than the script reads them. */
  a?: [string, number][];
  l?: [string, number][];
  /** The last resort: the whole word, its clusters and its letters. */
  w?: { n: number; letters: Letter[] };
}

/**
 * A line's script runs, read as letters. Runs that are not script text (a
 * pause, a comment) pass through untouched.
 */
export class ScriptReader {
  readonly out: (Read | WordRun)[] = [];
  /** The Word offset each item of `out` was read at. */
  readonly from: number[] = [];
  private cluster = -1;
  /** What each cluster's own style said: its box, its substitution. */
  private readonly style: { hold: Letter['hold']; changed: boolean }[] = [];
  private atWordStart = true;
  private afterHyphen = false;
  /** Where in the line the run being read begins, in Word characters. */
  private at = 0;
  /** A svarabhakti dot seen, waiting for its cluster. */
  private dot = false;
  /** Clusters of a word whose letters came whole, in its hidden run, to pass over. */
  private skip = 0;
  /** His Devanāgarī holding mark, seen, waiting for the akṣara it stands before. */
  private pendingHold: Letter['hold'] = null;
  /** The first space of a pair was kept: words are two spaces apart in his Devanāgarī. */
  private keptSpace = false;

  constructor(
    private readonly script: ScriptKey,
    private readonly profile: Profile,
    /** Does a Word offset count hidden text? In the file it does. */
    private readonly countHidden = true,
  ) {}

  private lettersOf(c: number): Read[] {
    return this.out.filter((x): x is Read => 't' in x && x.cluster === c);
  }

  /** An accent on the last cluster, on its vowel — the plain reading. */
  private accent(svara: ChantSvara): void {
    const mine = this.lettersOf(this.cluster);
    const on = [...mine].reverse().find((l) => isVowel(l.t)) ?? [...mine].reverse().find((l) => !/^[ṁṃḥ]$/u.test(l.t));
    on?.svara.push(svara);
  }

  feed(r: WordRun): void {
    /* A pause and the changed letter beside it share the blue style, so Word
       merges them into ONE run — `|फ्म्ँश्` — and the bar is no longer lone.
       Its bars are split off first, each read as the pause it is. */
    const pieces = splitPauseBars(r);
    if (pieces.length > 1) { for (const piece of pieces) this.feed(piece); return; }
    const start = this.at;
    if (r.hidden !== true || this.countHidden) this.at += r.text.length;
    if (r.hidden === true && r.text.startsWith(SAID)) { this.said(r.text.slice(SAID.length), start); return; }
    const role = roleOf(r.rStyle);
    /* A LONE BAR IN THE BLUE STYLE IS A PAUSE, as the IAST reader has it
       (`docx-runs.ts`), and passes through as itself. Read as a changed
       cluster it lost its style — `|` is no letter — and every pause of a line
       in Devanāgarī, Telugu or Tamil came back as a plain bar in the text. */
    /* HIS DEVANĀGARĪ (`WORD_DEVANAGARI`): a holding is a mark before the akṣara,
       in `Hold` — U+0342 short, U+034C long; a reading aid is drawn, in
       `Phonetic`, after the akṣara it belongs to. */
    if (role === 'hold-mark') {
      for (const ch of r.text) {
        if (ch === WORD_DEVANAGARI.hold.short) this.pendingHold = 'short';
        else if (ch === WORD_DEVANAGARI.hold.long) this.pendingHold = 'long';
      }
      return;
    }
    if (role === 'aid') {
      const mine = this.lettersOf(this.cluster);
      const on = mine[mine.length - 1];
      if (on !== undefined && r.text.trim() !== '') on.aid.push(r.text.trim());
      return;
    }
    const pause = isBluePause(r);
    if (pause || (role !== null && role !== 'svara' && role !== 'change' && !role.startsWith('hold'))) {
      this.out.push(r);
      this.from.push(start);
      return;
    }
    /* A run in the accent's style, of accents and dots alone: the svarabhakti
       dot before a cluster, or an accent a person styled on its own. */
    /* A kampa, `३̱̍`, is ONE svara of the akṣara before it, read whole. */
    const kampa = role === 'svara' ? kampaOf(r.text.trim()) : undefined;
    if (kampa !== undefined) { this.accent(kampa); return; }
    if (role === 'svara' && [...r.text].every((ch) => SCRIPT_SVARA_BY_CHAR.has(ch) || ch === '·')) {
      for (const ch of r.text) {
        if (ch === '·') this.dot = true;
        const svara = SCRIPT_SVARA_BY_CHAR.get(ch);
        if (svara !== undefined) this.accent(svara);
      }
      return;
    }
    for (const { segment, index } of scriptClusters(r.text, this.script)) {
      if (this.skip > 0) { this.skip -= 1; continue; }
      /* TWO SPACES ARE ONE: his Devanāgarī sets every word gap as two (220 of
         220), and so does the writer. One is still one — a line written before
         reads as it did — and three are two. */
      if (segment === ' ' || segment === ' ') {
        if (this.keptSpace) { this.keptSpace = false; continue; }
        this.keptSpace = true;
      } else {
        this.keptSpace = false;
      }
      this.clusterOf(segment, r.rStyle, start + index);
    }
  }

  /** What the hidden run after a cluster says about it. */
  private said(json: string, at: number): void {
    let s: Said;
    try { s = JSON.parse(json) as Said; } catch { return; }
    if (s.w !== undefined) { this.wholeWord(s.w, at); return; }
    const mine = this.lettersOf(this.cluster);
    const style = this.style[this.cluster] ?? { hold: null, changed: false };
    const held = s.k ?? style.hold;
    if (s.h !== undefined) mine.forEach((l, k) => { l.hold = s.h!.includes(k) ? held : null; });
    /* The record says which letters are changed, coloured or not: his
       Devanāgarī does not colour a changed letter (`scriptWordRuns`). */
    if (s.c !== undefined) mine.forEach((l, k) => { l.changed = s.c!.includes(k); });
    if (s.s !== undefined) {
      for (const l of mine) l.svara = [];
      for (const [v, k] of s.s) mine[k]?.svara.push(v);
    }
    if (s.d !== undefined) mine.forEach((l, k) => { l.dot = k === s.d; });
    for (const k of s.t ?? []) if (mine[k] !== undefined) mine[k]!.tick = true;
    for (const k of s.o ?? []) if (mine[k] !== undefined) mine[k]!.colon = true;
    /* Where the record names the aids, it is exact: the plain reading of a
       drawn `Phonetic` run gives way to it rather than being added to. */
    if (s.a !== undefined) for (const l of mine) l.aid = [];
    for (const [a, k] of s.a ?? []) mine[k]?.aid.push(a);
    for (const [t, k] of s.l ?? []) if (mine[k] !== undefined) mine[k]!.t = t;
  }

  /**
   * THE LAST RESORT: a word whose letters and marks came whole, in the hidden
   * run after its first cluster — for a word no plain reading of the script
   * gives back (`scriptWordRuns`). Its other clusters are passed over.
   */
  private wholeWord(word: NonNullable<Said['w']>, at: number): void {
    if (!Array.isArray(word.letters) || typeof word.n !== 'number') return;
    /* The first cluster, read plainly, gives way to the word's own letters. */
    for (let i = this.out.length - 1; i >= 0; i -= 1) {
      const x = this.out[i]!;
      if (!('t' in x) || x.cluster !== this.cluster) break;
      this.out.splice(i, 1);
      this.from.splice(i, 1);
    }
    word.letters.forEach((l, k) => {
      this.out.push({ ...bareLetter(l.t), ...l, cluster: this.cluster, k });
      this.from.push(at);
      this.step(l.t);
    });
    this.skip = Math.max(0, word.n - 1);
  }

  private clusterOf(segment: string, rStyle: string | null, at: number): void {
    let visible = '';
    const accents: ChantSvara[] = [];
    for (const ch of segment) {
      const svara = SCRIPT_SVARA_BY_CHAR.get(ch);
      if (svara !== undefined) accents.push(svara); else visible += ch;
    }
    if (visible === '') { for (const a of accents) this.accent(a); return; }
    const letters = parseLetters(this.iastOf(visible));
    this.cluster += 1;
    const c = this.cluster;
    /* A box on the cluster, as the add-in once wrote it — or his mark before it,
       which a space does not take: the akṣara after it does. */
    let kind = holdOf(rStyle);
    if (kind === null && this.pendingHold !== null && /\S/.test(visible)) {
      kind = this.pendingHold;
      this.pendingHold = null;
    }
    const changed = changedOf(rStyle);
    this.style[c] = { hold: kind, changed };
    const consonants = letters.map((l, k) => (isConsonant(l) ? k : -1)).filter((k) => k >= 0);
    /* The plain reading of a box: on the consonant the holding rule would put
       it on — the first of its syllable's onset, in the rule's own words. */
    const host = consonants.length === 0 ? -1 : consonants[holdingHostOf(
      consonants.map((k) => letters[k]!), { wordInitial: this.atWordStart, afterHyphen: this.afterHyphen }, this.profile,
    )]!;
    letters.forEach((t, k) => {
      const blank = /^\s+$/.test(t);
      const held = kind !== null && (blank || k === host);
      const ch = changed && (blank || typedLetter(t) !== undefined);
      this.out.push({ ...bareLetter(t), hold: held ? kind : null, changed: ch, cluster: c, k });
      this.from.push(at);
    });
    if (this.dot) {
      /* The plain reading of a dot: between an r or l and the consonant after
         it (var·ṣa), since `र्ष` cannot be split; else before the cluster. */
      const k = /^[rl]$/.test(letters[0] ?? '') && isConsonant(letters[1] ?? '') ? 1 : 0;
      const mine = this.lettersOf(c);
      if (mine[k] !== undefined) mine[k]!.dot = true;
      this.dot = false;
    }
    for (const a of accents) this.accent(a);
    for (const t of letters) this.step(t);
  }

  /** A cluster's text in IAST — the candrabindu where it stands, as `m̐`. */
  private iastOf(text: string): string {
    const read = (t: string): string => toIast(digitsFrom(t, this.script), this.script, { lossless: true }).iast;
    const sign = CANDRA_SIGN[this.script];
    const at = text.indexOf(sign);
    if (at < 0) return read(text);
    const before = read(text.slice(0, at));
    /* After the praṇava `ॐ`, which reads back as `oṁ`, the sign makes that
       final ṁ the `m̐`: `om̐`, not `oṁm̐`. After a vowel it is an `m̐` of its own. */
    const onM = before.endsWith('m') ? before : before.endsWith('ṁ') ? `${before.slice(0, -1)}m` : `${before}m`;
    return `${onM}${CANDRA}${read(text.slice(at + sign.length))}`;
  }

  /** Where the next cluster stands: at a word's start, or inside one. */
  private step(t: string): void {
    this.afterHyphen = t === '-';
    if (/^\s+$/.test(t) || t === '-') { this.atWordStart = true; return; }
    /* An avagraha does not open a word: `namo'stu` boxes the `t`, as inside one. */
    if (/^['’ऽ]$/u.test(t) || isConsonant(t)) return;
    this.atWordStart = !(isVowel(t) || /^[ṁṃḥ]/u.test(t) || t.startsWith('m̐'));
  }
}

/** The scripts a Word line is written in: IAST and the three it is exact in. */
export const WORD_SCRIPTS: readonly ScriptKey[] = ['iast', 'deva', 'tel', 'tam'];

/** A script name from somewhere else — a manifest, a setting — as one of those, or IAST. */
export const wordScript = (s: string | undefined): ScriptKey =>
  ((WORD_SCRIPTS as readonly string[]).includes(s ?? '') ? s as ScriptKey : 'iast');

/** The register a line is read in when nothing says otherwise. */
export const plainProfile = (): Profile => resolveProfile([{ preset: DEFAULT_PROFILE_KEY }]);

/** A line's runs, written in `script`, as the IAST runs the reader reads. */
export function iastRunsOf(runs: readonly WordRun[], script: ScriptKey, profile: Profile = plainProfile()): WordRun[] {
  const reader = new ScriptReader(script, profile);
  for (const r of mergeRuns([...runs])) reader.feed(r);
  return iastRunsOfLetters(reader.out);
}

/**
 * The same, with where each Word offset of the line lands in the IAST: `at[w]`
 * for every `w` from 0 to the line's length. An offset at a cluster's start
 * is that cluster's first letter; one inside a cluster, or among the accents
 * after it, is the next cluster's — a letter is never split, and its accents
 * go with it. `countHidden` says whether the offsets count hidden text, as
 * the file does; Word's own `text` of a paragraph may not.
 */
export function iastPositions(
  runs: readonly WordRun[], script: ScriptKey, profile: Profile = plainProfile(), countHidden = true,
): { runs: WordRun[]; at: number[] } {
  const merged = mergeRuns([...runs]);
  const reader = new ScriptReader(script, profile, countHidden);
  for (const r of merged) reader.feed(r);
  const sizes: number[] = [];
  const iast = iastRunsOfLetters(reader.out, sizes);
  const length = merged.reduce((n, r) => n + (r.hidden === true && !countHidden ? 0 : r.text.length), 0);
  const starts: { word: number; iast: number }[] = [];
  let total = 0;
  reader.out.forEach((_x, i) => { starts.push({ word: reader.from[i]!, iast: total }); total += sizes[i]!; });
  const at: number[] = [];
  let j = 0;
  for (let w = 0; w <= length; w += 1) {
    while (j < starts.length && starts[j]!.word < w) j += 1;
    at.push(j < starts.length ? starts[j]!.iast : total);
  }
  return { runs: iast, at };
}

/**
 * The script a Word line is written in, by its LETTERS: the Vedic accents
 * (Devanāgarī's block, written in every script) and the daṇḍas are evidence
 * of nothing. A line that mixes two Indic scripts is read in the one most of
 * its words are in; a line with no letters at all is IAST.
 */
export function scriptOfLine(text: string): ScriptKey {
  const letters = [...text].filter((ch) => !SCRIPT_SVARA_BY_CHAR.has(ch)).join('');
  const whole = detectScript(letters);
  if (whole !== 'mixed') return whole === 'unknown' ? 'iast' : whole;
  const count = new Map<ScriptKey, number>();
  for (const word of letters.split(/\s+/)) {
    const s = detectScript(word);
    if (s !== 'mixed' && s !== 'unknown' && s !== 'iast') count.set(s, (count.get(s) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'iast';
}
