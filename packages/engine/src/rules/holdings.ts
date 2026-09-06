/**
 * Holdings — where the box goes.
 *
 * A holding marks a consonant that is HELD in recitation. It is not a
 * per-syllable ornament and not free choice: it is derived. The derivation is
 * subtle, and four specific ways of getting it wrong have all shipped at some
 * point — they are pinned by the regression suite, so read
 * docs/MARKING-RULES.md §2.1 (including "The four ways this has been got
 * wrong") before touching anything here.
 *
 * Ported from `gen_marks.apply_holdings` and its helpers, itself a port of
 * `sanskrit_rules.js` L523–731 with the owner's 2026-08 rulings folded in.
 *
 * Agreement with the owner's own marks: 510 of his 534 boxes (95.5 %), and
 * 3847/3888 letters counted in both directions. A change here may not lower
 * either number — `measureAgreement` is the gate.
 */
import {
  HOLD_SKIP_MARKS, LONG_VOWELS, SIBILANTS, SKIP, VARGA, VIS, unaspirated,
} from '../alphabet.js';
import type { Elem } from '../lex.js';
import type { Profile } from '../profile.js';
import type { RuleCtx } from './types.js';

/** One member of a saṁyukta: its index, the element, and whether a word
 *  boundary falls immediately BEFORE it. */
interface Comp {
  index: number;
  elem: Elem;
  /** A word boundary falls between this member and the PREVIOUS MEMBER OF THE
   *  CLUSTER — so it is false on the first member by construction, and it is
   *  what tells the host rule that the cluster spans a join. */
  boundaryBefore: boolean;
  /** This letter opens its word. True on a first member that begins a word,
   *  where `boundaryBefore` cannot be. */
  wordInitial: boolean;
}

/**
 * The maximal run of consonants beginning at `i`.
 *
 * Whitespace does NOT break the run — it only marks the following component as
 * starting a new word, and the crossing is remembered — but a pause mark DOES.
 * A line break behaves exactly like a word space: treating it as a barrier was
 * measured and costs 8 of the owner's boxes.
 */
/** Is this letter the first of its word? */
function opensWord(elems: Elem[], i: number): boolean {
  const at = elems[i]!;
  for (let k = i - 1; k >= 0; k -= 1) {
    const e = elems[k]!;
    if (e.kind !== 'letter') continue;
    return e.word !== at.word;
  }
  return true;
}

export function collectSamyukta(elems: Elem[], i: number): { comps: Comp[]; next: number } {
  const comps: Comp[] = [];
  const n = elems.length;
  let j = i;
  let boundary = false;
  while (j < n) {
    const e = elems[j]!;
    if (e.kind !== 'letter' || !e.cons) break;
    comps.push({ index: j, elem: e, boundaryBefore: boundary, wordInitial: opensWord(elems, j) });
    let k = j + 1;
    while (k < n && elems[k]!.kind === 'br') k += 1;
    if (k >= n) {
      j = k;
      break;
    }
    const nxt = elems[k]!;
    if (nxt.kind !== 'letter') {
      // a pause ends the saṁyukta
      j = k;
      break;
    }
    if (!nxt.cons) {
      j = k;
      break;
    }
    boundary = nxt.word !== e.word;
    j = k;
  }
  return { comps, next: j };
}

/**
 * THE RULE (the owner, 2026-08), in his words:
 *
 *   "if we have consonant cluster with the same (c+c, t+t) or (t+th, c+ch) and
 *    so on, then it always goes on the first one… even if the consonant cluster
 *    is split between two words."
 *
 * ONE predicate, not two: dvivarcana is the degenerate case of a pair sharing a
 * point of articulation. The word boundary is irrelevant — it applies inside a
 * word and across a join alike.
 *
 * Modes are selectable so MARKING-RULES §2.3's measurements stay reproducible:
 *   `aspirate`   (SHIPPED, 510/534) identical, or differing only by aspiration
 *   `homorganic` also counts VOICING (t+d, k+g) — an exact tie, unruled
 *   `all`        not a point-of-articulation test at all (487/534, REJECTED)
 *   `false`      identical pairs only (507/534) — the pre-ruling behaviour
 */
export function samePoint(
  mode: Profile['holdings']['crosswordHost'],
  a: string,
  b: string,
): boolean {
  if (a === b) return true; // c+c, t+t
  if (mode === false || mode === 'all') return false;
  const va = VARGA.get(a);
  if (va === undefined || va !== VARGA.get(b)) return false; // not two stops of one varga
  if (mode === 'homorganic') return true; // …including t+d, k+g
  return unaspirated(a) === unaspirated(b); // t+th, c+ch, d+dh
}

/**
 * Which member of a saṁyukta hosts the box.
 *
 * `sanskrit_rules.js` treats dvivarcana as a special case and decides a
 * cross-word cluster the same way as an intra-word one; the owner does neither.
 */
export function selectHoldingComponent(comps: Comp[], profile: Profile): number {
  if (comps.length < 2) return -1;
  const mode = profile.holdings.crosswordHost;
  // The word boundary, if the cluster crosses one.
  const b = comps.findIndex((c) => c.boundaryBefore);

  // 1. SAME POINT OF ARTICULATION → the FIRST of the pair, wherever it sits.
  //    `tac|chaṁ`, `śarad|dhaviḥ`, `karma`… and no skip-walk follows: the
  //    owner's rule names the host outright.
  for (let k = 0; k < comps.length - 1; k += 1) {
    if (samePoint(mode, comps[k]!.elem.ch, comps[k + 1]!.elem.ch)) return k;
  }

  let cand: number;
  if (mode === 'all' && b > 0) {
    // The broad reading — ANY differing cross-word pair hosts on the first
    // word's final. Measured and rejected; kept only to reproduce §2.3.
    cand = b - 1;
  } else {
    // 2. otherwise a cluster split across words hosts on the SECOND word's
    //    initial; an intra-word cluster on its first consonant.
    cand = b >= 0 ? b : 0;
  }

  // 3. step forward over consonants that cannot host — UNLESS it is a sibilant
  //    that BEGINS A WORD, which can. A WORD-FINAL visarga cannot host either
  //    (`durgiḥ pracodayāt` boxes the `p`); inside a word it can (`duḥkha`),
  //    which is why `ḥ` is not in SKIP.
  //
  //    `wordInitial` is NOT consulted, and the choice is unresolved rather
  //    than settled — see specs/chant-editor/00-OVERVIEW.md §5.6. Counted over
  //    the shipped corpus, a word-initial sibilant cluster that carries a box
  //    at all hosts on the SIBILANT 67 times (`daivī svastir`) and on the
  //    second consonant 28 (`prāṇāya svāhā`). Letting the sibilant host would
  //    win the majority, but `svāhā` is one of the owner's OWN hand-marked
  //    files and those outrank a PDF transcription of the same text, so the
  //    shipped behaviour stands until he rules.
  while (cand < comps.length) {
    const c = comps[cand]!;
    const skip = SKIP.has(c.elem.ch) || (c.elem.ch === VIS && cand < b);
    if (!skip || (c.boundaryBefore && SIBILANTS.has(c.elem.ch))) break;
    cand += 1;
  }

  // 4. everything was skipped → fall back to the LAST consonant.
  if (cand >= comps.length) cand = comps.length - 1;
  return cand;
}

/**
 * `findPreviousVowel` (`sanskrit_rules.js` L487–518).
 *
 * Returns the value, whether a word space blocked the search, and the position.
 * The value may be a vowel or one of `ṁ ṃ ḥ` — which the engine returns like a
 * vowel so the caller can step over them. Pause marks are stepped over; a word
 * space blocks unless `blockAtSpace` is off.
 */
function findPrevVowel(
  elems: Elem[],
  idx: number,
  blockAtSpace = true,
): { value: string; blocked: boolean; pos: number } {
  const at = elems[idx];
  let right = at !== undefined && at.kind === 'letter' ? at.word : null;
  for (let i = idx - 1; i >= 0; i -= 1) {
    const e = elems[i]!;
    if (e.kind !== 'letter') continue; // pause marks are stepped over
    if (blockAtSpace && right !== null && e.word !== right) {
      return { value: '', blocked: true, pos: -1 };
    }
    if (HOLD_SKIP_MARKS.has(e.ch)) return { value: e.ch, blocked: false, pos: i };
    if (e.vowel) return { value: e.ch, blocked: false, pos: i };
    right = e.word;
  }
  return { value: '', blocked: false, pos: -1 };
}

/**
 * The vowel that decides long vs short — looked up from the HOST letter, never
 * from the cluster's start. Measuring from the cluster's first member gives the
 * wrong vowel whenever the host is not the first member, which after step 3 is
 * most cross-word clusters.
 *
 * If a word space blocked the search, retry across it; step over `ṁ ṃ ḥ`. An
 * empty result means `short` (the engine's default).
 */
export function holdingVowel(elems: Elem[], idx: number): string {
  let r = findPrevVowel(elems, idx);
  if (r.blocked) r = findPrevVowel(elems, idx, false);
  while (r.value && HOLD_SKIP_MARKS.has(r.value)) {
    r = findPrevVowel(elems, r.pos, false);
  }
  return r.value;
}

/** Indices of the first LETTER of every line — the fragment's first, and the
 *  first after each `//`. */
function lineFirstLetters(elems: Elem[]): Set<number> {
  const out = new Set<number>();
  let need = true;
  elems.forEach((e, k) => {
    if (e.kind !== 'letter') {
      if (e.kind === 'br') need = true;
      return;
    }
    if (need) {
      out.add(k);
      need = false;
    }
  });
  return out;
}

/**
 * One holding per saṁyukta, on one letter.
 *
 * `hg` is numbered per fragment (== per rendered line) and renumbered
 * canonically on emit, so identical input always produces identical bytes.
 */
export function applyHoldings(ctx: RuleCtx): void {
  const { elems, profile } = ctx;
  const lineFirst = lineFirstLetters(elems);
  let hg = 0;
  let i = 0;
  while (i < elems.length) {
    const e = elems[i]!;
    if (e.kind !== 'letter' || !e.cons) {
      i += 1;
      continue;
    }
    const { comps, next } = collectSamyukta(elems, i);
    const step = next > i ? next : i + 1;

    // Fewer than two consonants → no holding. A single consonant between
    // vowels never gets a box; this is the rule most often broken by hand.
    if (comps.length < 2) {
      i = step;
      continue;
    }

    // OWNER'S RULING: "we never box the initial clusters" — a cluster that
    // OPENS a verse or a line stays bare (`tripādūrdhva`, `brāhmaṇo`,
    // `prajāpatiś`, `hrīś`, `pratnoṣi`, `prātar`). The cluster must BEGIN at
    // the line's first letter; one that merely reaches into the first word from
    // a preceding word-final consonant is an ordinary cross-word cluster and is
    // boxed normally. Not in `sanskrit_rules.js` — his rule on top of it.
    if (profile.holdings.noInitialBox && lineFirst.has(comps[0]!.index)) {
      i = step;
      continue;
    }

    const k = selectHoldingComponent(comps, profile);
    if (k >= 0) {
      const { index, elem } = comps[k]!;
      hg += 1;
      elem.hold = LONG_VOWELS.has(holdingVowel(elems, index)) ? 'long' : 'short';
      elem.hg = hg;
      ctx.trace(index, `holding ${elem.hold} on ${elem.ch}`, 'holdings.host');
    }
    i = step;
  }
}
