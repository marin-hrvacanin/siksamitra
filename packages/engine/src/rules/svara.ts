/**
 * Svara — the three registers, and the parametrized positional generator.
 *
 * The generator is ported from Śikṣāmitra's `dialog-autosvara.html` (its plan
 * strings, its preset list and its `parseAutoSvaraPlan`) and
 * `editor-quill.js:applyAutomaticSvaras()` (its segmentation), then extended
 * with the two presets MARKING-RULES §3.2a measured off the owner's own PDFs —
 * which need an odd/even distinction his rule model has no room for.
 *
 * THE SANCTION AND ITS LIMIT. The owner has sanctioned *inventing* svara for
 * Purāṇic / stotra material: that register has no accent to transcribe, so the
 * pattern IS the tradition. The sanction stops dead at attested Vedic text,
 * which may never be marked by convention however well it scans.
 *
 * See docs/MARKING-RULES.md §3 and specs/chant-editor/02A-MARKS.md Part D.
 */
import type { ChantSvara } from '@siksamitra/format';
import { isVowel, parseLetters } from '../alphabet.js';
import type { MeterKey } from '../profile.js';
import type { Elem } from '../lex.js';
import type { RuleCtx } from './types.js';

/** A position within the plan's unit, 1-based, counted in vowel nuclei. */
export interface SvaraPosition {
  pos: number;
  mark: ChantSvara;
}

export interface SvaraPlan {
  id: MeterKey | 'custom';
  label: string;
  /** What ONE application of `positions` covers. */
  unit: 'pada' | 'half-verse';
  /** The required nucleus count of that unit. An array accepts several. */
  count: number | readonly number[];
  positions: readonly SvaraPosition[];
  /**
   * Metres whose EVEN-indexed units differ. Real, not noise: it is in the same
   * places in every witness, and it is the anuṣṭubh half-verse alternation
   * showing up per pāda.
   */
  even?: {
    count: number | readonly number[];
    positions: readonly SvaraPosition[];
  };
  /** How far this plan is trusted. Gates application (S08). */
  verified: 'owner-file' | 'siksamitra-preset' | 'user';
  source?: string;
}

/** The combining marks a plan string may use. */
const PLAN_MARK: ReadonlyMap<string, ChantSvara> = new Map([
  ['̍', 'svarita'],
  ['̱', 'anudatta'],
  ['̎', 'dirgha-svarita'],
]);

const MARK_CHAR: ReadonlyMap<ChantSvara, string> = new Map(
  [...PLAN_MARK.entries()].map(([c, m]) => [m, c]),
);

/**
 * Parse a plan string — `parseAutoSvaraPlan` exactly.
 *
 * `2̍4̍6̱8̍9̱11̱14̍` is position 2 svarita, 4 svarita, 6 anudātta, 8 svarita,
 * 9 anudātta, 11 anudātta, 14 svarita. Positions ≤ 0 are dropped, LATER
 * entries at the same position overwrite earlier ones, and the result is sorted
 * ascending. Unknown marks are ignored rather than an error.
 */
export function parsePlan(plan: string): SvaraPosition[] {
  const byPos = new Map<number, ChantSvara>();
  const re = /(\d+)([̱̍̎ˎ·])/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(plan)) !== null) {
    const pos = Number.parseInt(m[1]!, 10);
    const mark = PLAN_MARK.get(m[2]!);
    if (!Number.isFinite(pos) || pos <= 0 || mark === undefined) continue;
    byPos.set(pos, mark);
  }
  return [...byPos.entries()]
    .map(([pos, mark]) => ({ pos, mark }))
    .sort((a, b) => a.pos - b.pos);
}

/** Serialise back to a plan string, so a custom plan round-trips. */
export function formatPlan(positions: readonly SvaraPosition[]): string {
  return positions
    .slice()
    .sort((a, b) => a.pos - b.pos)
    .map((p) => `${p.pos}${MARK_CHAR.get(p.mark) ?? ''}`)
    .join('');
}

/**
 * The shipped plans.
 *
 * `anustubh` and `tristubh` were checked position by position against the
 * owner's own marked Lalitā Sahasranāma, and the harness reproduces the
 * anuṣṭubh table from 35 of his half-verses, 35/35.
 *
 * `gayatri` and `jagati` come from Śikṣāmitra's presets and have NOT been
 * cross-checked against a marked file of his — hence `siksamitra-preset`,
 * which requires an explicit opt-in to apply.
 *
 * `sardulavikridita` and `pushpitagra` were MEASURED off his PDFs
 * (MARKING-RULES §3.2a): 8 pādas across two independent files agree letter for
 * letter for the first; the second rests on ONE verse, four pādas, and must be
 * widened before it is applied to a verse he has not marked.
 */
export const SVARA_PLANS: Readonly<Record<MeterKey, SvaraPlan>> = Object.freeze({
  anustubh: {
    id: 'anustubh',
    label: 'Anuṣṭubh (16 | 16)',
    unit: 'half-verse',
    count: 16,
    positions: parsePlan('2̍4̍6̱8̍9̱11̱14̍'),
    verified: 'owner-file',
    source: "the owner's marked Lalitā Sahasranāma; 35/35 half-verses",
  },
  gayatri: {
    id: 'gayatri',
    label: 'Gāyatrī (8 | 8)',
    unit: 'pada',
    count: 8,
    positions: parsePlan('2̍4̍6̱8̍'),
    verified: 'siksamitra-preset',
    source: 'dialog-autosvara.html — NOT cross-checked against a marked file',
  },
  tristubh: {
    id: 'tristubh',
    label: 'Triṣṭubh (11 | 11)',
    unit: 'pada',
    count: 11,
    positions: parsePlan('2̍4̍6̱8̍9̱11̍'),
    verified: 'owner-file',
    source: "checked against the owner's own marked material",
  },
  jagati: {
    id: 'jagati',
    label: 'Jagatī (12 | 12)',
    unit: 'pada',
    count: 12,
    positions: parsePlan('2̍4̍6̱8̍9̱11̍12̱'),
    verified: 'siksamitra-preset',
    source: 'dialog-autosvara.html — NOT cross-checked against a marked file',
  },
  sardulavikridita: {
    id: 'sardulavikridita',
    label: 'Śārdūlavikrīḍita (19)',
    unit: 'pada',
    count: 19,
    // odd pādas (1, 3)
    positions: parsePlan('1̱2̱13̱15̱17̍19̱'),
    // even pādas (2, 4)
    even: { count: 19, positions: parsePlan('1̱13̱15̱17̍') },
    verified: 'owner-file',
    source: "sri-rudram-iast.pdf dhyānam + veda-union-sadhana-iast.pdf — 8 pādas, two files",
  },
  pushpitagra: {
    id: 'pushpitagra',
    label: 'Puṣpitāgrā (12 | 13)',
    unit: 'pada',
    count: 12,
    positions: parsePlan('1̱9̱10̍12̱'),
    even: { count: 13, positions: parsePlan('1̱10̱12̍') },
    verified: 'owner-file',
    source: 'shankaracharya-stotrani-iast.pdf — ONE verse, four pādas; widen before reuse',
  },
} as Record<MeterKey, SvaraPlan>);

/**
 * A metrical segment of a verse: a run of nuclei the plan applies to.
 *
 * Segmentation, ported from `applyAutomaticSvaras`: split on LINE BREAKS, then
 * on DAṆḌAS (the separator being `[।॥|]+` plus any run of whitespace and
 * digits — a verse number is not part of the metre), trim, and count nuclei.
 * Pieces with no nuclei are discarded.
 */
export interface Segment {
  /** Indices into the element list, of the vowel nuclei, in order. */
  nuclei: number[];
}

/** A leading praṇava stands OUTSIDE the metre — exclude it, or a 16-syllable
 *  hemistich reads as 17 and matches nothing. */
function dropLeadingPranava(elems: Elem[], nuclei: number[]): number[] {
  const first = nuclei[0];
  if (first === undefined) return nuclei;
  const w = elems[first]!.word;
  // `oṁ` is one word and one nucleus.
  const letters = elems.filter((e) => e.kind === 'letter' && e.word === w);
  const text = letters.map((e) => e.ch).join('');
  if (text === 'oṁ' || text === 'om' || text === 'auṁ') return nuclei.slice(1);
  return nuclei;
}

export function segments(elems: Elem[]): Segment[] {
  const out: Segment[] = [];
  let cur: number[] = [];
  const flush = () => {
    if (cur.length > 0) out.push({ nuclei: dropLeadingPranava(elems, cur) });
    cur = [];
  };
  elems.forEach((e, i) => {
    if (e.kind === 'br') {
      flush();
      return;
    }
    if (e.kind === 'pause') {
      // An authored daṇḍa / bar closes a metrical segment.
      flush();
      return;
    }
    if (e.kind === 'letter' && e.vowel) cur.push(i);
  });
  flush();
  return out.filter((s) => s.nuclei.length > 0);
}

/**
 * Apply a positional plan to a verse.
 *
 * ALL-OR-NOTHING. If any segment fails to scan, nothing in the verse is marked
 * and a warning is emitted: a half-marked śloka reads as a bug. The count check
 * is a VERIFICATION, not a classifier — the metre must be declared on the verse
 * (`āsanaṁ samarpayāmi` counts 8 and would falsely match gāyatrī, but it is a
 * prose offering formula).
 *
 * Idempotent: it clears the svara of every untargeted nucleus in a segment it
 * marks, so udātta is a real outcome rather than a leftover.
 */
export function applySvaraPlan(ctx: RuleCtx, plan: SvaraPlan, opts?: { allowUnverified?: boolean }): boolean {
  const { elems, profile } = ctx;
  const register = profile.svara.register;

  if (register === 'attested') {
    ctx.warn(
      'svara.refuse-attested',
      'attested Vedic text: svara is transcribed from an accented source, never derived',
    );
    return false;
  }
  if (register === 'vedic-refuse') {
    ctx.warn(
      'svara.refuse-vedic',
      'this verse is Vedic with no accented source — it ships unmarked, and a positional preset may never be applied to it',
    );
    return false;
  }
  if (register === 'prose') {
    ctx.warn('svara.refuse-prose', 'prose register: holdings + anusvāra + visarga only');
    return false;
  }
  if (plan.verified !== 'owner-file' && opts?.allowUnverified !== true) {
    ctx.warn(
      'svara.unverified-plan',
      `the ${plan.id} plan has not been cross-checked against a marked file of the owner's — applying it needs an explicit opt-in`,
    );
    return false;
  }

  const segs = segments(elems);
  const accepts = (count: number | readonly number[], n: number): boolean =>
    typeof count === 'number' ? count === n : count.includes(n);

  // Verify EVERY segment before marking ANY of them.
  const jobs: { nuclei: number[]; positions: readonly SvaraPosition[] }[] = [];
  for (let s = 0; s < segs.length; s += 1) {
    const seg = segs[s]!;
    const isEven = s % 2 === 1;
    const spec = isEven && plan.even !== undefined ? plan.even : plan;
    if (!accepts(spec.count, seg.nuclei.length)) {
      ctx.warn(
        'svara.does-not-scan',
        `segment ${s + 1} has ${seg.nuclei.length} nuclei, the ${plan.id} plan expects ${String(spec.count)} — the whole verse is left unmarked`,
      );
      return false;
    }
    jobs.push({ nuclei: seg.nuclei, positions: spec.positions });
  }

  for (const job of jobs) {
    const want = new Map(job.positions.map((p) => [p.pos, p.mark]));
    job.nuclei.forEach((elemIndex, k) => {
      const e = elems[elemIndex]!;
      const mark = want.get(k + 1);
      if (mark === undefined) {
        delete e.svara; // udātta is unmarked — and is a real outcome
        return;
      }
      e.svara = mark;
      ctx.trace(elemIndex, `${mark} at position ${k + 1} (${plan.id})`, 'svara.preset');
    });
  }
  return true;
}

/**
 * Carry accents from an accented witness onto the verse's own word-split.
 *
 * Transcribing combining marks by hand is the one step in the pipeline with no
 * safety net, so this matches NUCLEUS FOR NUCLEUS, per line, and refuses a
 * line whose counts disagree rather than sliding the accents along it. A
 * silent off-by-one here moves every accent in a verse, and the result still
 * looks like a marked text.
 *
 * WHAT THIS DOES AND DOES NOT PROVE. It used to compute the marks and then
 * assign none — a declared feature that nothing implemented, so an attested
 * verse could not be regenerated at all and had to stay frozen. It now
 * assigns them. What that buys is REGENERABILITY: a verse whose witness is
 * stored can be re-derived and get its accents back, so it can be edited. It
 * does not verify the transcription against a printed edition; only a reader
 * with the edition can do that, and `ChantVerseSource.departures` is where
 * such a decision is recorded.
 */
export function applyAttestedSvara(ctx: RuleCtx, accented: string[]): void {
  /**
   * Per line, one slot per nucleus in order; `null` where the witness leaves
   * the vowel bare, which is udātta and a real outcome rather than an absence.
   *
   * A mark belongs to the vowel BEFORE it, so it is written into the slot that
   * is already open. One before any vowel is a transcription error, not an
   * accent on nothing, and is dropped here — the count check below is what
   * then refuses the line.
   */
  const perLine: (ChantSvara | null)[][] = accented.map((line) => {
    const slots: (ChantSvara | null)[] = [];
    for (const letter of parseLetters(line)) {
      const mark = PLAN_MARK.get(letter);
      if (mark !== undefined) {
        if (slots.length > 0) slots[slots.length - 1] = mark;
        continue;
      }
      if (isVowel(letter)) slots.push(null);
    }
    return slots;
  });

  const nucleiByLine = new Map<number, number[]>();
  ctx.elems.forEach((e, i) => {
    if (e.kind !== 'letter' || !e.vowel) return;
    nucleiByLine.set(e.line, [...(nucleiByLine.get(e.line) ?? []), i]);
  });

  for (const [line, nuclei] of nucleiByLine) {
    const marks = perLine[line];
    if (marks === undefined) continue;
    if (marks.length !== nuclei.length) {
      ctx.warn(
        'svara.witness-mismatch',
        `line ${line} of the witness has ${marks.length} nuclei but the text has `
        + `${nuclei.length} — every difference must be a declared decision, so no `
        + 'accent from this line is applied',
        nuclei[0],
      );
      continue;
    }
    nuclei.forEach((elemIndex, k) => {
      const mark = marks[k] ?? null;
      const e = ctx.elems[elemIndex]!;
      if (mark === null) {
        delete e.svara;
        return;
      }
      e.svara = mark;
      ctx.trace(elemIndex, `${mark} from the accented witness`, 'svara.attested');
    });
  }
}

/**
 * The accented witness for a verse, from the marks it already carries.
 *
 * The inverse of the pass above, and the reason a shipped document can be
 * given a source layer at all: its accents exist only on its units, so they
 * have to be written back out as text before the text can be the source.
 *
 * One implementation, used by `sm attach-src` and by the round-trip gate.
 */
export function witnessLine(letters: readonly { c: string; svara?: ChantSvara }[]): string {
  let out = '';
  for (const u of letters) {
    out += u.c;
    if (u.svara !== undefined) out += MARK_CHAR.get(u.svara) ?? '';
  }
  return out;
}
