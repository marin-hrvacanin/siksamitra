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

const DEVANAGARI = /[\u0900-\u097F]/u;

/**
 * ONE SOUND, TWO SPELLINGS — within a line. A source spells out what his texts
 * leave to the rules: where a svara stands (Devanāgarī sets it after the
 * visarga, `पुनः॑`; his IAST on the vowel it belongs to, `puna̍ḥ`); the y, v or
 * l an anusvāra nasalises (`श्लोकं॒-यँज॑मानाय`, his `śloka̱ṁ yaja̍mānāya`); and
 * a final n doubled for a vowel that is not on the line (`स॒माभ॑रन्न्`, his
 * `sa̱mābha̍ran`). Applied to BOTH sides, so two lines compare equal only where
 * they differ in these spellings and in no other way.
 */
const IN_A_LINE: readonly (readonly [RegExp, string])[] = [
  [/([ḥṁ])(\p{M}+)/gu, '$2$1'],
  [/([ṅṇn])\1(\p{M}*)$/u, '$1$2'],
  [/(ṁ[yvl](?:ai|au|[aāiīuūṛṝḷeo])\p{M}*)(?:ṁ|m̐)/gu, '$1'],
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
function lettersOf(line: string): string {
  const iast = normalize(DEVANAGARI.test(line) ? toIast(line, 'deva').iast : line).text.normalize('NFC');
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
  const same = spaced.length === lines.length;
  const pairs = same ? lines.map((l, i) => [strictLetters(l), strictLetters(spaced[i]!)] as const) : [[textOf(lines), textOf(spaced)] as const];
  for (let i = 0; i < pairs.length; i += 1) {
    const [want, got] = pairs[i]!;
    if (want === got || (first && i === 0 && dropsOpeningOm(want, got))) continue;
    let at = 0;
    while (at < want.length && want[at] === got[at]) at += 1;
    return `${same ? `line ${i + 1}` : 'its lines'}: spaced changes a letter at "${got.slice(Math.max(0, at - 8), at + 8)}" `
      + `where the source has "${want.slice(Math.max(0, at - 8), at + 8)}" — add only spaces, hyphens, apostrophes and daṇḍas`;
  }
  return null;
}
