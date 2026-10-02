/**
 * A SOURCE'S LINE, AS HIS PAGE WRITES IT — what is taken off a line before it
 * becomes a verse, and the number each verse ends with.
 *
 * A web text carries its own apparatus in the line: sanskritdocuments' TA
 * ends a passage with `॥ ०। १०। ३५। ५३॥ ॥ ३५॥` — prapāṭhaka, anuvāka,
 * running verse, and the anuvāka again — and opens a paragraph with its
 * running number (`५३ ओजो…`). The bot delivered the Gāyatrī with all of it
 * still in the verse. None of it is the text: it is taken off here, every
 * time, and the verse is numbered as he numbers his: `॥ 1॥`, from one, in the
 * document's own order — and a text of one verse ends with `॥` alone.
 *
 * And a consonant that ends a word before a daṇḍa is clipped as his page
 * clips it, with the virāma tick and no space before the daṇḍa —
 * `samābharanˎ॥`, `ajūryāmˎ।`, `pracodayātˎ॥` — where the Devanāgarī writes
 * the letter with a halanta (`समाभ॑रन्`) and an IAST source has it bare. His
 * sādhanā does it 90 times in 117 (the 27 without are its Rudram), and his
 * newer single documents every time. The tick is text, not a mark: the rules
 * do not place it (`docs/authoring/MARKING-RULES.md`, "Virāma").
 */

import { WRITTEN_GUM } from '@siksamitra/engine';

const DIGIT = '[0-9०-९]';
/** A reference: two or more numbers, each closed by a daṇḍa or a bar. */
const REFERENCE = new RegExp(`(?:\\s*[।॥|]{0,2}\\s*${DIGIT}+(?:\\s*[।|.]\\s*${DIGIT}+)+\\s*[।॥|]{1,2})+(?:\\s*[॥|]{1,2}\\s*${DIGIT}+\\s*[॥|]{1,2})?\\s*$`, 'u');
/** A running number opening a line: `५३ ओजो…`, `22 ānuśravika…`. */
const LEADING_NUMBER = new RegExp(`^${DIGIT}+\\s+(?=\\S)`, 'u');
/** The end of a verse as the source wrote it: daṇḍas, maybe a number between. */
const ENDING = new RegExp(`\\s*(?:[।॥|]{1,2}\\s*${DIGIT}*\\s*[।॥|]{0,2})\\s*$`, 'u');
/** A word's last consonant, right before a daṇḍa — an accent of his on it
 *  (agnimīḻe's `devamṛtvijam̎ˎ।`) stays with it, before the tick. */
const FINAL_STOP = /([kgcjṭḍtdpbṅñṇnmyrlvśṣs])(\p{M}*)[ \t]*(?=[।॥|])/gu;
export const VIRAMA_TICK = 'ˎ';

/** Each word-final consonant before a daṇḍa, clipped with the tick. */
export const clipped = (line: string): string => line.replace(FINAL_STOP, `$1$2${VIRAMA_TICK}`);

/**
 * A source's line with its apparatus taken off — and the Taittirīya gum, when
 * the source writes it out (`pratīcīmenāgm̐`), back to the anusvāra the rules
 * make it from (`WRITTEN_GUM`): kept as letters, it was marked bare once and
 * with its reading aid the next time.
 */
export function cleanLine(line: string): string {
  let l = line.trim().replace(WRITTEN_GUM, 'ṁ');
  const hadReference = REFERENCE.test(l);
  l = l.replace(REFERENCE, '').replace(LEADING_NUMBER, '').trim();
  /* A reference closed the verse; the closing stays — numbered below. */
  return clipped(hadReference && l !== '' && !/[।॥|]$/u.test(l) ? `${l} ॥` : l);
}

/** How his page sets a verse's lines: ONE paragraph, its lines after the first
 *  hanging in; a paragraph per HALF-verse; or each line FLUSH at the margin. */
export type VerseLayout = 'hang' | 'halves' | 'flush';

/** A line's syllables: its vowels, `ai` and `au` one each, its svaras not. */
export const syllablesOf = (line: string): number =>
  (line.normalize('NFC').replace(/[̀-ͯ]/gu, '').match(/ai|au|[aāiīuūṛṝḷḹeo]/gu) ?? []).length;

/**
 * The layout his page gives a verse, when the outline does not say. A STANZA
 * of four or six pādas, a pāda a line — seven to thirteen syllables, the
 * gāyatrī's eight to the jagatī's twelve — is set a half-verse a paragraph:
 * bhū sūktam 8 and 12. Anything else is one paragraph: two lines; a passage
 * whose lines carry daṇḍas inside them, or run longer than a pāda — the prose
 * of sūryopaniṣat 1, 2, 5, 6 and 7; a litany of ten.
 */
export function layoutOf(lines: readonly string[]): VerseLayout {
  const prose = lines.some((l) => /[।॥|][ \t]*[^\s।॥|0-9०-९]/u.test(l));
  const padas = lines.every((l) => { const n = syllablesOf(l); return n >= 7 && n <= 13; });
  return (lines.length === 4 || lines.length === 6) && padas && !prose ? 'halves' : 'hang';
}

/** A verse's lines as his paragraphs, each the lines it holds. */
export function paragraphsIn(lines: readonly string[], layout: VerseLayout): string[][] {
  const size = layout === 'flush' ? 1 : layout === 'halves' ? 2 : Math.max(1, lines.length);
  const out: string[][] = [];
  for (let i = 0; i < lines.length; i += size) out.push(lines.slice(i, i + size));
  return out;
}

/** Lines in paragraphs of the counts given — when the counts are all of them. */
export function groupedBy<T>(lines: readonly T[], counts: readonly number[] | undefined): T[][] | undefined {
  if (counts === undefined || counts.length === 0 || counts.some((n) => !Number.isInteger(n) || n < 1)
    || counts.reduce((a, b) => a + b, 0) !== lines.length) return undefined;
  const out: T[][] = [];
  let at = 0;
  for (const n of counts) { out.push(lines.slice(at, at + n)); at += n; }
  return out;
}

/**
 * A verse he leaves unnumbered keeps the ending its source gave it — the
 * vyāhṛti of sūryopaniṣat ends `suvaḥ ।`, the closing śānti `॥` — and is
 * closed with `॥` only when it has none.
 */
export function unnumbered(lines: readonly string[]): string[] {
  if (lines.length === 0) return [];
  const last = lines[lines.length - 1]!;
  return [...lines.slice(0, -1), /[।॥|]$/u.test(last) ? last : clipped(`${last} ॥`)];
}

/**
 * The verse's lines, its last one closed as his are: `॥ n॥`, or `॥` alone
 * when the text is one verse long (`total`). Whatever ending the source gave
 * it is replaced, so a document numbers its verses one way, from one.
 */
export function numbered(lines: readonly string[], n: number, total = 2): string[] {
  if (lines.length === 0) return [];
  const last = lines[lines.length - 1]!.replace(ENDING, '');
  /* No space after the tick: `pracodayātˎ॥`. */
  const sep = last.endsWith(VIRAMA_TICK) ? '' : ' ';
  return [...lines.slice(0, -1), clipped(total === 1 ? `${last}${sep}॥` : `${last}${sep}॥ ${n}॥`)];
}
