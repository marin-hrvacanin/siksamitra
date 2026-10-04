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
export const PLAN_MARK: ReadonlyMap<string, ChantSvara> = new Map([
  ['̍', 'svarita'],
  ['̱', 'anudatta'],
  ['̎', 'dirgha-svarita'],
]);

export const MARK_CHAR: ReadonlyMap<ChantSvara, string> = new Map(
  [...PLAN_MARK.entries()].map(([c, m]) => [m, c]),
);

/**
 * THE KAMPA — an undulation, two of a svara's kinds, as his śikṣā writes them
 * ("śikṣā — the science of pronunciation" v5, the kampas): a DIGIT after the
 * vowel that undulates, carrying the line below and the stroke above —
 * `1̱̍` the hrasva (ucca-nīca) kampa, `3̱̍` the dīrgha (nīca-ucca-nīca) one;
 * `१॒॑`, `३॒॑` in a Devanāgarī edition. Its mark is the digit and the two
 * strokes together, so it is one svara of the vowel, not a letter and not a
 * verse's number.
 *
 * Kept apart from `PLAN_MARK`: a plan string is positions and marks, and a
 * mark with a digit in it would read as a position.
 */
const BELOW = String.fromCodePoint(0x0331);
const ABOVE = String.fromCodePoint(0x030d);
export const KAMPA_MARKS = `${BELOW}${ABOVE}`;
export const KAMPA_CHAR: ReadonlyMap<ChantSvara, string> = new Map<ChantSvara, string>([
  ['kampa', `1${KAMPA_MARKS}`], ['dirgha-kampa', `3${KAMPA_MARKS}`],
]);

/** The kampa a piece of text is, as a source may write it — or nothing. Its
 *  digit in Latin or Devanāgarī, its two marks in either order, as IAST's
 *  strokes or Devanāgarī's own (U+0952, U+0951). */
const KAMPA = /^([13१३])(?:[\u0331\u0952][\u030d\u0951]|[\u030d\u0951][\u0331\u0952])$/u;
export function kampaOf(text: string): ChantSvara | undefined {
  const m = KAMPA.exec(text);
  if (m === null) return undefined;
  return m[1] === '1' || m[1] === '१' ? 'kampa' : 'dirgha-kampa';
}

/** Is this svara a kampa — drawn as its digit, not as a stroke? */
export const isKampa = (s: ChantSvara | undefined): boolean => s === 'kampa' || s === 'dirgha-kampa';

/** Every svara as the text writes it: a mark, or a kampa's digit and marks. */
export const SVARA_TEXT: ReadonlyMap<ChantSvara, string> = new Map([...MARK_CHAR, ...KAMPA_CHAR]);

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
  /* Measured off his Lalitā v9.3.1 and Rudram v1.622 dhyānas, 8 pādas agreeing (2026-10-04). */
  sragdhara: {
    id: 'sragdhara',
    label: 'Sragdharā (21)',
    unit: 'pada',
    count: 21,
    positions: parsePlan('1̱2̱15̱17̱19̍21̱'),
    even: { count: 21, positions: parsePlan('1̱15̱17̱20̍') },
    verified: 'owner-file',
    source: "lalita-sahasranama v9.3.1 dhyāna + rudram v1.622 dhyāna (= sādhanā v9.1.13) — 8 pādas, two files",
  },
  /* HIS TRIMETRES AND KIN, one scheme read off his Kanakadhārā, Devī Māhātmyam
     and Lalitā (2026-10-04) — see `trimetre`. Śālinī and mandākrāntā are in no
     file of his and take the plan of their syllable count, at his asking. */
  upajati: trimetre('upajati', 'Upajāti (11)', 11, true, 'kanakadhārā v1.29 + devī māhātmyam v6.62 — 26 lines'),
  salini: trimetre('salini', 'Śālinī (11)', 11, true, "no file of his: upajāti's plan, its syllable count"),
  vasantatilaka: trimetre('vasantatilaka', 'Vasantatilakā (14)', 14, true, 'kanakadhārā v1.29 — 70 lines'),
  rucira: trimetre('rucira', 'Rucirā (13)', 13, true, 'kanakadhārā v1.29 — 2 lines'),
  prthvi: trimetre('prthvi', 'Pṛthvī (17)', 17, false, 'lalitā v9.3.1 dhyāna — 4 pādas'),
  mandakranta: trimetre('mandakranta', 'Mandākrāntā (17)', 17, false, "no file of his: pṛthvī's plan, its syllable count"),
  vamsastha: {
    id: 'vamsastha',
    label: 'Vaṁśastha (12)',
    unit: 'pada',
    count: 12,
    positions: parsePlan('1̱2̱12̱'),
    even: { count: 12, positions: parsePlan('1̱8̱10̍') },
    verified: 'owner-file',
    source: 'devī māhātmyam v6.62 — vaṁśastha 2 lines, indravaṁśā 2 lines, alike',
  },
} as Record<MeterKey, SvaraPlan>);

/** His trimetre scheme for a pāda of n syllables — odd: 1̱ 2̱ (n−3)̱ (n−2)̍ ṉ̱, even:
 *  1̱ (n−3)̱ (n−1)̍. Upajāti 26 lines, vasantatilakā 70, rucirā 2; pṛthvī (no 2̱) his Lalitā's. */
function trimetre(id: MeterKey, label: string, n: number, second: boolean, source: string): SvaraPlan {
  return {
    id, label, unit: 'pada', count: n,
    positions: parsePlan(`1̱${second ? '2̱' : ''}${n - 3}̱${n - 2}̍${n}̱`),
    even: { count: n, positions: parsePlan(`1̱${n - 3}̱${n - 1}̍`) },
    verified: 'owner-file',
    source,
  };
}

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
  /** Closed by a line break with no daṇḍa before it — a line the page wrapped, perhaps. */
  wrapped?: true;
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
  const flush = (wrapped = false) => {
    if (cur.length > 0) out.push({ nuclei: dropLeadingPranava(elems, cur), ...(wrapped ? { wrapped: true as const } : {}) });
    cur = [];
  };
  elems.forEach((e, i) => {
    if (e.kind === 'br') {
      flush(true);
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

  const most = (count: number | readonly number[]): number =>
    (typeof count === 'number' ? count : Math.max(...count));

  // Verify EVERY segment before marking ANY of them.
  const jobs: { nuclei: number[]; positions: readonly SvaraPosition[] }[] = [];
  for (let s = 0, k = 0; s < segs.length; s += 1, k += 1) {
    const isEven = k % 2 === 1;
    const spec = isEven && plan.even !== undefined ? plan.even : plan;
    /* A half-verse the page wrapped is still one: read on to the next line while
       short of the plan — a source whose pādas scan a line each reads as before. */
    let nuclei = segs[s]!.nuclei;
    while (!accepts(spec.count, nuclei.length) && segs[s]!.wrapped === true
      && s + 1 < segs.length && nuclei.length < most(spec.count)) {
      s += 1;
      nuclei = [...nuclei, ...segs[s]!.nuclei];
    }
    /* Two pādas on one line, as his half-verses are set: each pāda in turn. */
    const each = typeof spec.count === 'number' ? spec.count : 0;
    if (plan.unit === 'pada' && each > 0 && nuclei.length > each && nuclei.length % each === 0) {
      for (let at = 0, j = 0; at < nuclei.length; at += each, j += 1) {
        const part = (k + j) % 2 === 1 && plan.even !== undefined ? plan.even : plan;
        jobs.push({ nuclei: nuclei.slice(at, at + each), positions: part.positions });
      }
      k += nuclei.length / each - 1;
      continue;
    }
    /* A half-verse one syllable over (ārṣa: `vinayo jayaḥ`, `vina` as one): the first two as one. */
    if (plan.unit === 'half-verse' && each > 0 && nuclei.length === each + 1) {
      jobs.push({ nuclei: nuclei.slice(1), positions: spec.positions });
      continue;
    }
    if (!accepts(spec.count, nuclei.length)) {
      ctx.warn(
        'svara.does-not-scan',
        `segment ${k + 1} has ${nuclei.length} nuclei, the ${plan.id} plan expects ${String(spec.count)} — the whole verse is left unmarked`,
      );
      return false;
    }
    jobs.push({ nuclei, positions: spec.positions });
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
