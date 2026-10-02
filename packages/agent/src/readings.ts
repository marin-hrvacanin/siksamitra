/**
 * A WORD THE BASE EDITION HAS WRONG, READ AS ANOTHER WITNESS HAS IT.
 *
 * "Follow ONE base edition; depart from it only where another witness
 * corroborates the reading." Said in a prompt, it was a wish: a real run's
 * base edition wrote `aṣṭotara` for `aṣṭottara`, the model wrote the right
 * word, the program refused it — every letter is a source's — and the model
 * had no way through but to ship the typo (2026-10-02). So a correction is a
 * thing the program can hold: the word as the base edition has it, the word
 * as it is read, and the OTHER witness that has it. The program checks that
 * the witness has the word, puts it in, and says so to the reviewer.
 */
import { asIast, strictLetters } from './letters.js';
import type { Witness } from './workspace.js';

export interface Reading {
  /** The word as the base edition has it, as read_witness iast shows it. */
  readonly source: string;
  /** The word as it is read. */
  readonly read: string;
  /** The other witness that has it. */
  readonly witness: string;
}

/** The svara signs, which a word is found without. */
const SVARA = /[\u{0300}\u{0301}\u{0305}\u{030D}\u{030E}\u{0331}\u{0332}]/u;

/** A text's letters for "is this word there": every fold, no svara, no space. */
const bare = (s: string): string => strictLetters(s).normalize('NFD').replace(new RegExp(SVARA.source, 'gu'), '').normalize('NFC');

/** Where `word` stands in `line`, its svaras not counted — as offsets of the line. */
function find(line: string, word: string): { from: number; to: number } | null {
  const at: number[] = [];
  let plain = '';
  for (let i = 0; i < line.length; i += 1) {
    if (SVARA.test(line[i]!)) continue;
    at.push(i);
    plain += line[i];
  }
  const want = word.normalize('NFC').replace(new RegExp(SVARA.source, 'gu'), '');
  const k = plain.indexOf(want);
  if (want === '' || k < 0) return null;
  let to = at[k + want.length - 1]! + 1;
  while (to < line.length && SVARA.test(line[to]!)) to += 1;
  return { from: at[k]!, to };
}

/**
 * The verse's lines with each reading put in, in IAST — or why one cannot
 * be: the witness is the verse's own or is not kept, it does not have the
 * word, or the base edition's word is not in these lines.
 */
export function withReadings(
  lines: readonly string[], readings: readonly Reading[], witnesses: ReadonlyMap<string, Witness>, own?: string,
): string[] {
  let out = lines.map((l) => asIast(l));
  for (const r of readings) {
    const w = witnesses.get(r.witness);
    if (w === undefined) throw new Error(`a reading names "${r.witness}", which is no witness kept — fetch it first`);
    if (r.witness === own) throw new Error(`a reading is corroborated by ANOTHER witness, not by ${own}, which the verse is built from`);
    const word = bare(r.read);
    if (word === '' || !bare(w.lines.join(' ')).includes(word)) {
      throw new Error(`"${r.read}" is not in ${r.witness}: a reading is a word another witness has, letter for letter`);
    }
    let done = false;
    out = out.map((line) => {
      if (done) return line;
      const at = find(line, r.source.normalize('NFC'));
      if (at === null) return line;
      done = true;
      return `${line.slice(0, at.from)}${r.read.normalize('NFC')}${line.slice(at.to)}`;
    });
    if (!done) throw new Error(`"${r.source}" is not in the verse's lines — give the base edition's word as read_witness with iast: true shows it`);
  }
  return out;
}
