/**
 * EVERY SCRIPT, AGAINST LINES NOBODY CHOSE — random letters, Latin words,
 * digits, daṇḍas and brackets, with random markings placed by the edit
 * package's own commands, written to Word in Devanāgarī, Telugu and Tamil and
 * read back. Seeded, so a failure is a line that can be named and replayed.
 *
 * Nothing may come back different, and nothing may be refused: a line a
 * person can make in the add-in is a line every script can hold. This is what
 * found the candrabindu typed after a space (a space and a mark are ONE
 * grapheme to Unicode) and the one typed on a consonant inside a conjunct.
 *
 * The expectation is the IAST writer's reading of the same line — a
 * different path from the one under test.
 */
import { describe, expect, it } from 'vitest';
import type { MarkCommand } from '@siksamitra/edit';
import { applyCommand } from '@siksamitra/edit';
import type { TextAndMarks } from '@siksamitra/format';
import { decodeRuns, paragraphRuns } from '../../apps/word-addin/src/model/paragraph.js';

const LETTERS = ['a', 'ā', 'i', 'ī', 'u', 'ū', 'ṛ', 'ṝ', 'ḷ', 'e', 'ai', 'o', 'au', 'ṁ', 'ṃ', 'ḥ', 'k', 'kh', 'g', 'gh', 'ṅ',
  'c', 'ch', 'j', 'jh', 'ñ', 'ṭ', 'ṭh', 'ḍ', 'ḍh', 'ṇ', 't', 'th', 'd', 'dh', 'n', 'p', 'ph', 'b', 'bh', 'm', 'y', 'r', 'l',
  'v', 'ś', 'ṣ', 's', 'h', 'ḻ', "'", 'm̐'];
const WORDS = ['oṁ', 'namaḥ', 'śivāya', 'agnim', 'īḻe', 'purohitam', 'yajñasya', 'ṛtvijam', 'kṛṣṇa', 'saṁskṛtam',
  'Invocation', '(ityu)', 'x-y', '12', '॥', '।', '|', 'tvam', 'ahaṁ'];
const COMMANDS: MarkCommand[] = [
  { k: 'hold', v: 'short' }, { k: 'hold', v: 'long' }, { k: 'svara', v: 'svarita' }, { k: 'svara', v: 'anudatta' },
  { k: 'svara', v: 'dirgha-svarita' }, { k: 'was', v: 'ṁ' }, { k: 'was', v: 'ḥ' }, { k: 'sbhakti' },
  { k: 'pause', v: 'short' }, { k: 'pause', v: 'long' }, { k: 'combining', v: '̐' },
] as MarkCommand[];

function lines(seed: number, n: number): TextAndMarks[] {
  let s = seed;
  const rnd = (): number => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const out: TextAndMarks[] = [];
  for (let i = 0; i < n; i += 1) {
    const words = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => (rnd() < 0.6
      ? pick(WORDS) : Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => pick(LETTERS)).join('')));
    let tm: TextAndMarks = { text: words.join(' '), marks: [] };
    for (let m = 0; m < 3; m += 1) {
      const from = Math.floor(rnd() * tm.text.length);
      const to = Math.min(tm.text.length, from + 1 + Math.floor(rnd() * 3));
      try {
        const r = applyCommand(tm, from, to, pick(COMMANDS));
        tm = { text: r.text ?? tm.text, marks: r.marks };
      } catch { /* the command refused there, as it would in the add-in */ }
    }
    out.push(tm);
  }
  return out;
}

const canon = (tm: TextAndMarks): string =>
  JSON.stringify([tm.text, tm.marks.map(({ by: _b, ...m }) => JSON.stringify(m)).sort()]);

describe('random lines, in every script', () => {
  for (const seed of [1, 77]) {
    const sample = lines(seed, 150);
    for (const script of ['deva', 'tel', 'tam'] as const) {
      it(`come back exactly, and none is refused — ${script}, seed ${seed}`, () => {
        const wrong: string[] = [];
        for (const tm of sample) {
          const iast = canon(decodeRuns(paragraphRuns(tm, 'iast')[0] ?? []));
          let back: string;
          try { back = canon(decodeRuns(paragraphRuns(tm, script)[0] ?? [], script)); } catch (e) { back = `threw: ${(e as Error).message}`; }
          if (back !== iast) wrong.push(JSON.stringify(tm.text));
        }
        expect(wrong).toEqual([]);
      });
    }
  }
});
