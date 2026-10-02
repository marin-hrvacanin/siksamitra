/**
 * THE LETTERS OF A LINE, AS `spaced` IS HELD TO THEM.
 *
 * The bot never retypes a mantra: where his page separates words that a
 * source runs together, the model may give a verse's lines again with his
 * word breaks — and only if every letter and svara is the source's own. This
 * is what "the same letters" means, and it is the whole of what the model is
 * allowed to change. Kept apart from the tools so it can be read, and tested,
 * as one rule.
 */
import { normalize, toIast } from '@siksamitra/engine';
import { cleanLine } from './lines.js';

/* Its letters: an IAST line has daṇḍas and digits of the block too. */
const DEVANAGARI = /[\u0900-\u0963\u0970-\u097F]/u;

/**
 * ONE SOUND, TWO SPELLINGS — within a line. A source spells out what his texts
 * leave to the rules: where a svara stands (Devanāgarī sets it after the
 * visarga, `पुनः॑`; his IAST on the vowel it belongs to, `puna̍ḥ`); the y, v or
 * l an anusvāra nasalises (`श्लोकं॒-यँज॑मानाय`, his `śloka̱ṁ yaja̍mānāya`); and
 * a final n doubled for a vowel that is not on the line (`स॒माभ॑रन्न्`, his
 * `sa̱mābha̍ran`); and the n a ś before it makes palatal, spelt so
 * (vishvasa's `पृश्ञि॑`, his `pṛśni̍r`). Applied to BOTH sides, so two lines
 * compare equal only where they differ in these spellings and in no other way.
 */
const IN_A_LINE: readonly (readonly [RegExp, string])[] = [
  [/([ḥṁ])(\p{M}+)/gu, '$2$1'],
  [/([ṅṇn])\1(\p{M}*)$/u, '$1$2'],
  [/(ṁ[yvl](?:ai|au|[aāiīuūṛṝḷeo])\p{M}*)(?:ṁ|m̐)/gu, '$1'],
  [/ś(\p{M}*)ñ/gu, 'ś$1n'],
];

/**
 * ONE SOUND, TWO SPELLINGS — at a junction, which may be between his lines
 * where the source has one (`…ajū̱ryām ।` / `pra̱tīcī̍me-nāṁ`, from one line of
 * vignanam's). A source writes the junction as it is said — `आ-ऽयङ्गौः`,
 * `शान्ति॒-श्शान्ति॒` — where his texts write the words, `ā'yaṁ gauḥ`,
 * `śānti̱ḥ śānti̱ḥ`, and leave how they are said to the anusvāra's and the
 * visarga's treatments. So a nasal before a consonant reads as ṁ, and a
 * sibilant a visarga became, as ḥ.
 */
const AT_A_JUNCTION: readonly (readonly [RegExp, string])[] = [
  [/[ṅñṇnm](?=[kgcjṭḍtdpbmnyrlvśṣsh])/gu, 'ṁ'],
  [/([śṣs])(?=\p{M}*\1)/gu, 'ḥ'],
  [/ś(?=\p{M}*ch?)/gu, 'ḥ'],
];

const folded = (s: string, folds: readonly (readonly [RegExp, string])[]): string =>
  folds.reduce((t, [spelt, as]) => t.replace(spelt, as), s);

/**
 * A line's letters and svaras, in IAST — with what his word breaks add set
 * aside (spaces, hyphens, the apostrophe of a vowel junction, the virāma
 * tick, daṇḍas and numbers) and the engine's own fold applied (Devanāgarī's
 * accent signs to IAST's, ꣳ and a written-out gum to ṁ), so a source in either
 * script compares. The spellings of one sound within the line are folded too.
 */
/** A line in IAST, svaras and all, as the program reads it — what `read_witness` shows when asked. */
export const asIast = (line: string): string =>
  normalize(DEVANAGARI.test(line) ? toIast(line, 'deva').iast : line).text.normalize('NFC');

function lettersOf(line: string): string {
  const iast = asIast(line);
  return folded(iast.replace(/[\s\-'’ʼˎ।॥|0-9०-९]/gu, ''), IN_A_LINE);
}

/** One line's letters, as `spaced` is compared by: every fold applied. */
export const strictLetters = (line: string): string => folded(lettersOf(line), AT_A_JUNCTION);

/** Lines' letters as one text — his lines may break where the source's do not. */
const textOf = (lines: readonly string[]): string => folded(lines.map(lettersOf).join(''), AT_A_JUNCTION);

/**
 * HIS TEXTS BEGIN WITH THE TEXT. A source may set an oṁ before it — alone,
 * `ओम् ॥`, and again joined to the first word, `ओ-म्भूमि॑र्भू॒म्ना` — where his
 * bhū sūktam begins `bhūmi̍r bhū̱mnā`. Leaving those out is the one change
 * `spaced` may make to a source's letters; adding one is not. A real request
 * thought 166 000 characters over whether it might, and was cut off with
 * nothing done (2026-10-02). His closing śānti keeps its oṁ: it does not
 * begin a verse taken from a source line that has another before it.
 */
function dropsOpeningOm(want: string, got: string): boolean {
  let rest = want;
  for (let m = /^o[mṁṃ]/u.exec(rest); m !== null; m = /^o[mṁṃ]/u.exec(rest)) {
    rest = rest.slice(m[0].length);
    if (rest === got) return true;
  }
  return false;
}

/**
 * Where `spaced` changes a letter of `lines`, or null when it changes none.
 * Line by line when it keeps the source's lines — the clearest answer — and
 * as one text when it sets them otherwise. `first`: these lines begin the
 * text, where an opening oṁ may be left out.
 */
export function letterChange(lines: readonly string[], spaced: readonly string[], first = true): string | null {
  const d = letterDifference(lines, spaced, first);
  return d === null ? null
    : `${d.where}: spaced changes a letter at "${d.have}" where the source has "${d.source}" — add only spaces, hyphens, apostrophes and daṇḍas`;
}

/** Where two texts' letters part: which line, and a few letters either side, on each. */
export interface LetterDifference { readonly where: string; readonly have: string; readonly source: string }

/**
 * The same comparison, as a place — for `check`, which says it in its own
 * words. Said EXACTLY: a check that printed the first ninety letters of each
 * side, which agreed, sent a real run round its build eleven times looking
 * for the difference (2026-10-02).
 */
export function letterDifference(lines: readonly string[], spaced: readonly string[], first = true): LetterDifference | null {
  /* The verse's letters AS ONE TEXT first: where its lines break is not a
     letter, and the program sets it (`fitLine`). Compared line by line, a
     verse given in as many lines as the source's but broken elsewhere was
     "a changed letter" — and a real run spent its steps on TITUS breaking
     bhū sūktam 1 after `upasthe` (2026-10-02). */
  const whole = [textOf(lines), textOf(spaced)] as const;
  if (whole[0] === whole[1] || (first && dropsOpeningOm(whole[0], whole[1]))) return null;
  /* A letter does differ: said at its line when the lines are the source's. */
  const same = spaced.length === lines.length;
  const pairs = [
    ...(same ? lines.map((l, i) => [strictLetters(l), strictLetters(spaced[i]!), `line ${i + 1}`] as const) : []),
    [whole[0], whole[1], 'its lines'] as const,
  ];
  for (let i = 0; i < pairs.length; i += 1) {
    const [want, got, where] = pairs[i]!;
    if (want === got || (first && i === 0 && dropsOpeningOm(want, got))) continue;
    let at = 0;
    while (at < want.length && want[at] === got[at]) at += 1;
    const near = (s: string): string => s.slice(Math.max(0, at - 10), at + 10);
    return { where, have: near(got), source: near(want) };
  }
  return null;
}

/** Are these the source's own lines — the same letters, broken where it breaks them? */
function sourceLines(lines: readonly string[], spaced: readonly string[]): boolean {
  return lines.length === spaced.length && lines.every((l, i) => {
    const want = strictLetters(l);
    const got = strictLetters(spaced[i]!);
    return want === got || (i === 0 && dropsOpeningOm(want, got));
  });
}


/* ── the svaras, carried from the source ─────────────────────────────────── */

/** The svara signs, as his IAST writes them — udātta, anudātta, dīrgha svarita
 *  — with the overline the Ṛgveda's rules draw and a low line, which a model
 *  copying a marked page may bring along. */
const SVARA_SIGN = /[\u0305\u030D\u030E\u0331\u0332]/u;
/** A pluta's numeral: the vowel it lengthens, its svaras after it too, are one
 *  bearer — vignanam's `वो॒३॒॑ऽ`, `vo̱३̱̍'`. A real run was refused ten builds
 *  because the svaras after the ३ were nobody's (2026-10-02). */
const PLUTA = /[३3]/u;
const VOWEL = /[aāiīuūṛṝḷḹeo]/u;

/** Each vowel of a text with the svaras on it, and each gum that bears one. */
interface Bearers {
  readonly vowels: readonly { readonly letter: string; readonly marks: string }[];
  readonly gums: readonly { readonly after: number; readonly marks: string }[];
}

/** Walks a text by its svara-bearers; `put` says what each bearer's marks become. */
function walk(text: string, put?: (bearer: 'vowel' | 'gum', at: number, own: string) => string): { bearers: Bearers; text: string } {
  const vowels: { letter: string; marks: string }[] = [];
  const gums: { after: number; marks: string }[] = [];
  let out = '';
  let i = 0;
  const marksFrom = (j: number): string => {
    let m = '';
    while (j < text.length && SVARA_SIGN.test(text[j]!)) m += text[j++]!;
    if (j < text.length && PLUTA.test(text[j]!)) { m += text[j++]!; while (j < text.length && SVARA_SIGN.test(text[j]!)) m += text[j++]!; }
    return m;
  };
  while (i < text.length) {
    const two = text.slice(i, i + 2);
    const len = two === 'ai' || two === 'au' ? 2 : VOWEL.test(text[i]!) ? 1 : 0;
    if (len > 0) {
      const letter = text.slice(i, i + len);
      const own = marksFrom(i + len);
      out += letter + (put === undefined ? own : put('vowel', vowels.length, own));
      vowels.push({ letter, marks: own });
      i += len + own.length;
      continue;
    }
    if (text[i] === 'ṁ') {
      const own = marksFrom(i + 1);
      out += 'ṁ' + (put === undefined ? own : put('gum', vowels.length, own));
      if (own !== '') gums.push({ after: vowels.length, marks: own });
      i += 1 + own.length;
      continue;
    }
    out += text[i];
    i += 1;
  }
  return { bearers: { vowels, gums }, text: out };
}

/**
 * HIS WORD BREAKS, THE SOURCE'S SVARAS. The model writes a verse's lines again
 * with his breaks and his spellings — and, retyping a mantra, it drops a svara
 * now and then: a real run lost five, a build each (2026-10-02). The svaras are
 * not the model's to write. They are carried here from the source onto each
 * vowel of `spaced`, vowel by vowel — every spelling of one sound keeps the
 * vowels as they are, so they count alike — and a gum's own svara onto the
 * first ṁ after the same vowel. Null where the vowels do not count alike: then
 * the letters differ, and `letterChange` says where. An opening oṁ the line
 * leaves out is counted out of the source first.
 */
export function withSourceSvaras(lines: readonly string[], spaced: readonly string[]): string[] | null {
  const source = walk(lines.map(asIast).join(' ').normalize('NFC')).bearers;
  const given = spaced.join('\n').normalize('NFC');
  const count = walk(given).bearers.vowels.length;
  const skip = source.vowels.length - count;
  if (skip < 0 || skip > 2 || source.vowels.slice(0, skip).some((v) => v.letter !== 'o')) return null;
  const vowels = source.vowels.slice(skip);
  const gums = source.gums.map((g) => ({ ...g, after: g.after - skip }));
  const used = new Set<number>();
  const { text } = walk(given, (bearer, at, own) => {
    if (bearer === 'vowel') return vowels[at]?.marks ?? own;
    const g = gums.findIndex((x, k) => x.after === at && !used.has(k));
    if (g < 0) return '';
    used.add(g);
    return gums[g]!.marks;
  });
  return text.split('\n');
}

/**
 * THE SOURCE'S DAṆḌAS, WHERE HIS LINES END WITH THEM. A source ends a
 * half-verse with a daṇḍa and his line ends with it too (`mahi̱tvā ।`); the
 * model, retyping the line with his breaks, left it out — daṇḍas are no
 * letters, so nothing said so (2026-10-02). Carried where the lines are the
 * source's own; the last line's close is the builder's, with its number.
 */
export function withSourceDandas(lines: readonly string[], spaced: readonly string[]): string[] {
  /* Only over the source's own line ends: lines broken elsewhere carry their own. */
  if (!sourceLines(lines, spaced)) return [...spaced];
  return spaced.map((s, i) => {
    if (i === spaced.length - 1 || /[।॥|]\s*$/u.test(s)) return s;
    const end = /([।॥|])[\s।॥|0-9०-९]*$/u.exec(cleanLine(lines[i]!));
    return end === null ? s : `${s.trimEnd()} ${end[1] === '|' ? '।' : end[1]}`;
  });
}
