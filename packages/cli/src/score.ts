/**
 * THE measurement: re-derive every verse and compare the result with what the
 * document already says, letter by letter.
 *
 * One function, three views. `diff` reads the holdings out of it, `profile`
 * ranks candidate profiles by it, `roundtrip` prints all of it. They cannot
 * disagree about what "reproduced" means, because there is only one answer to
 * compare against — which is why it lives here rather than in the command that
 * happened to need it first.
 *
 * Split out of `main.ts`, which had reached 984 lines. The commands are thin
 * by design: everything they do is a function in a module they call.
 */
import { derive, invertVerse, resolveProfile } from '@siksamitra/engine';
import type { Profile } from '@siksamitra/engine';
import { profileChain } from '@siksamitra/edit';
import type { ChantDoc, ChantSection, ChantVerse } from '@siksamitra/format';

/** Every verse of a document, with where it lives. */
export function verses(doc: ChantDoc): { s: ChantSection; v: ChantVerse }[] {
  return doc.sections.flatMap((s) => s.verses.map((v) => ({ s, v })));
}

/**
 * The PRE-sandhi letters of a verse.
 *
 * `invertVerse` in the engine, which is the one implementation — this file had
 * its own copy, and a second reconstruction of the source is exactly the
 * two-producers-one-answer problem the rules forbid. `held` stays here because
 * only `diff` wants it.
 */
export function invert(v: ChantVerse): { lines: string[]; held: string[] } {
  const held: string[] = [];
  for (const t of v.tokens) {
    if (t.t !== 'syl') continue;
    for (const u of t.units) if (u.hold !== undefined) held.push(`${u.c}:${u.hold}`);
  }
  return { lines: invertVerse(v.tokens).lines, held };
}

/**
 * THE measurement: re-derive every verse and compare the result with what the
 * document already says, letter by letter.
 *
 * One function, three views. `diff` reads the holdings out of it, `profile`
 * ranks candidate profiles by it, `roundtrip` prints all of it. They cannot
 * disagree about what "reproduced" means, because there is only one answer to
 * compare against.
 */
export interface Score {
  /** Syllables compared, including those only one side has. */
  syllables: number;
  /** Syllables identical in every compared field and mark. */
  matched: number;
  /** Holdings alone — the coarse metric, kept because it is comparable to the
   *  Python generator's own self-test. */
  holdings: { agree: number; theirs: number; mine: number };
  /** Divergence kind → up to six examples, in document order. */
  divergences: Map<string, { count: number; examples: string[] }>;
  /** Svaras skipped because the verse is transcribed and they are attested. */
  attested: number;
}

export interface ScoreOptions {
  /** Compare the Tamil column too. Off by default: the corpus's Tamil has
   *  never been checked by the owner, so a disagreement there says nothing
   *  about the engine. */
  tamil?: boolean;
}

const SCORED_MARKS = ['hold', 'hg', 'svara', 'change', 'sup', 'candra', 'sbhakti'] as const;

export function score(doc: ChantDoc, profile: Profile, opts?: ScoreOptions): Score {
  const fields = opts?.tamil === true
    ? (['iast', 'deva', 'tel', 'tam'] as const)
    : (['iast', 'deva', 'tel'] as const);
  const divergences = new Map<string, { count: number; examples: string[] }>();
  const note = (key: string, example: string): void => {
    const row = divergences.get(key) ?? { count: 0, examples: [] };
    row.count += 1;
    if (row.examples.length < 6) row.examples.push(example);
    divergences.set(key, row);
  };
  const out: Score = {
    syllables: 0, matched: 0,
    holdings: { agree: 0, theirs: 0, mine: 0 },
    divergences, attested: 0,
  };

  type Syl = {
    iast: string; deva: string; tel?: string; tam?: string;
    units: Record<string, unknown>[];
  };

  for (const { s: section, v } of verses(doc)) {
    const { lines } = invert(v);
    if (lines.length === 0) continue;
    /*
     * THE DOCUMENT'S OWN PARAMETRIZATION, when it declares one.
     *
     * It used to score every document under one profile passed in from the
     * command line, and that was wrong in a way that only showed once the
     * documents started declaring theirs: a text whose bīja takes no pause was
     * being measured against rules that give it one, and the gate read 78%
     * where the document reproduces exactly. `profileChain` is the editor's,
     * so the gate and the editor cannot disagree about which rules apply.
     */
    const forVerse = doc.profile === undefined
      && section.profile === undefined
      && v.profile === undefined
      && v.svaraRegister === undefined
      ? profile
      : resolveProfile([
        { patch: profile as unknown as Record<string, unknown> },
        ...profileChain(v, section, doc.profile),
      ]);
    // A verse with no source layer is TRANSCRIBED: its svaras came off an
    // accented witness and exist nowhere in its letters. Comparing them
    // against a derivation measures rule zero, not the engine.
    const derivable = v.src?.lines !== undefined && v.src.lines.length > 0;
    const d = derive(
      {
        lines,
        ...(v.src?.accented === undefined ? {} : { accented: [...v.src.accented] }),
      },
      forVerse,
      { verseId: v.id, trace: false, overrides: doc.overrides ?? [] },
    );
    const want = v.tokens.filter((t) => t.t === 'syl') as unknown as Syl[];
    const got = d.tokens.filter((t) => t.t === 'syl') as unknown as Syl[];

    for (const [a, b] of align(want, got, (x) => x.iast)) {
      out.syllables += 1;
      for (const u of a?.units ?? []) if (u['hold'] !== undefined) out.holdings.theirs += 1;
      for (const u of b?.units ?? []) if (u['hold'] !== undefined) out.holdings.mine += 1;
      if (a === null) { note('the engine adds a syllable', `${v.id}: "${b!.iast}"`); continue; }
      if (b === null) { note('the engine drops a syllable', `${v.id}: "${a.iast}"`); continue; }

      let clean = true;
      for (const f of fields) {
        const x = a[f];
        const y = b[f];
        // A column the file does not carry is not a divergence: the older
        // fragment tables shipped without `tel` and `tam`.
        if (x === undefined || y === undefined) continue;
        if (x !== y) { note(f, `${v.id} "${a.iast}": file "${x}" ≠ derived "${y}"`); clean = false; }
      }
      if (a.units.length !== b.units.length) {
        note('letters per syllable',
          `${v.id} "${a.iast}": ${a.units.length} letters in the file, ${b.units.length} derived`);
        clean = false;
      } else {
        for (let u = 0; u < a.units.length; u += 1) {
          const ua = a.units[u]!;
          const ub = b.units[u]!;
          const c = String(ua['c']);
          if (ua['c'] !== ub['c']) {
            note('letter', `${v.id} "${a.iast}": "${c}" ≠ "${String(ub['c'])}"`);
            clean = false;
          }
          for (const m of SCORED_MARKS) {
            // `hg` is a group id: what matters is whether the letter is in a
            // group, not which number the renumberer handed it.
            const x = m === 'hg' ? (ua['hg'] === undefined ? undefined : true) : ua[m];
            const y = m === 'hg' ? (ub['hg'] === undefined ? undefined : true) : ub[m];
            if (x === y) {
              if (m === 'hold' && x !== undefined) out.holdings.agree += 1;
              continue;
            }
            if (m === 'svara' && !derivable) { out.attested += 1; continue; }
            note(m, `${v.id} "${a.iast}" letter "${c}":`
              + ` file ${JSON.stringify(x)} ≠ derived ${JSON.stringify(y)}`);
            clean = false;
          }
        }
      }
      if (clean) out.matched += 1;
    }
  }
  return out;
}

/** Flatten a score's divergences for `--json` and for printing. */
export function divergenceRows(s: Score): [string, { count: number; examples: string[] }][] {
  return [...s.divergences].sort((a, b) => b[1].count - a[1].count);
}

/**
 * Align two syllable sequences by their IAST, longest-common-subsequence.
 *
 * Index-by-index comparison is worthless here: one extra syllable near the
 * start of a verse — an avagraha the PDF transcription set apart, say — shifts
 * everything after it and reports forty divergences for one. Aligning first
 * means an insertion is reported as an insertion, and the letters on either
 * side of it are still compared.
 */
export function align<T>(a: readonly T[], b: readonly T[], key: (x: T) => string):
  [T | null, T | null][] {
  const n = a.length;
  const m = b.length;
  // lcs[i][j] = length of the LCS of a[i..] and b[j..]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i]![j] = key(a[i]!) === key(b[j]!)
        ? lcs[i + 1]![j + 1]! + 1
        : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: [T | null, T | null][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (key(a[i]!) === key(b[j]!)) { out.push([a[i]!, b[j]!]); i += 1; j += 1; }
    else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) { out.push([a[i]!, null]); i += 1; }
    else { out.push([null, b[j]!]); j += 1; }
  }
  while (i < n) { out.push([a[i]!, null]); i += 1; }
  while (j < m) { out.push([null, b[j]!]); j += 1; }
  return out;
}
