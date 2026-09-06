/**
 * Anusvāra, visarga, and the gum — the substitutions.
 *
 * These REPLACE the letter with the one actually recited and paint it
 * `change`; they do not merely colour what is written. `paraṁ brahma` renders
 * `param brahma`. Every shipped chant does this, so they all agree.
 *
 * They run AFTER the holdings (MARKING-RULES §7). See also §4 (anusvāra by
 * recension) and §5 (visarga).
 *
 * Ported from `gen_marks.apply_anusvara` / `apply_visarga` /
 * `_mark_gum_change`, plus the two layers that were forked into individual
 * generators (`gen_vishnu.apply_vedic_anusvara`, `gen_puja._anusvara_before_vowel`)
 * and are folded in here as profile-gated rules.
 */
import {
  ANU, SHORT_VOWELS, SIBILANTS, SPECIAL_SEQUENCES, STOP_GROUP, VIS, VOICED,
  isVowel,
} from '../alphabet.js';
import { nextLetter } from '../lex.js';
import type { Elem } from '../lex.js';
import type { RuleCtx } from './types.js';

/** Does a special sequence (`jñ` / `ghn`) start at the letter after `i`? */
function startsSpecialSequence(elems: Elem[], i: number): boolean {
  const nx = nextLetter(elems, i);
  if (nx === null) return false;
  let after: string | null = null;
  let seen = false;
  for (let k = i + 1; k < elems.length; k += 1) {
    const e = elems[k]!;
    if (e.kind !== 'letter') continue;
    if (!seen) {
      seen = true;
      continue;
    }
    after = e.ch;
    break;
  }
  return SPECIAL_SEQUENCES.some(([a, b]) => a === nx.ch && b === after);
}

/** The vowel immediately before `i`, for the visarga's a/ā test. */
function prevVowelChar(elems: Elem[], i: number): string | null {
  for (let j = i - 1; j >= 0; j -= 1) {
    const e = elems[j]!;
    if (e.kind === 'pause' || e.kind === 'ompause' || e.kind === 'vpause') break;
    if (e.kind === 'letter' && e.vowel) return e.ch;
  }
  return null;
}

/**
 * The rule common to EVERY recension: `ṁ` assimilates to the homorganic nasal
 * before a stop of the k/c/ṭ/t/p class, and is otherwise kept.
 *
 * A praṇava or bīja anusvāra is never assimilated, and before `jñ`/`ghn` the
 * anusvāra is kept and only highlighted.
 */
export function applyAnusvara(ctx: RuleCtx): void {
  const { elems, wordIsBija } = ctx;
  elems.forEach((e, i) => {
    if (e.kind !== 'letter' || e.ch !== ANU) return;
    if (wordIsBija[e.word] === true) return;
    if (startsSpecialSequence(elems, i)) return; // jñ / ghn — kept, never assimilated
    const nx = nextLetter(elems, i);
    if (nx === null) return;
    for (const [nasal, group] of STOP_GROUP) {
      if (group.has(nx.ch)) {
        e.wasCh = e.ch;
        e.ch = nasal;
        e.change = true;
        ctx.trace(i, `anusvāra → ${nasal} before ${nx.ch}`, 'anusvara.homorganic', ANU, nasal);
        break;
      }
    }
  });
}

/**
 * `ṁ` before a VOWEL becomes a plain `m` — a word-final `-m` is never an
 * anusvāra.
 *
 * This lived in `gen_puja._anusvara_before_vowel`, one generator's private
 * pass, and so never applied to any other document. It belongs to every
 * recension.
 */
export function applyAnusvaraBeforeVowel(ctx: RuleCtx): void {
  const { elems } = ctx;
  elems.forEach((e, i) => {
    if (e.kind !== 'letter' || e.ch !== ANU) return;
    if (ctx.wordIsBija[e.word] === true) return;
    const nx = nextLetter(elems, i);
    if (nx === null || !nx.vowel) return;
    e.wasCh = e.ch;
    e.ch = 'm';
    e.change = true;
    ctx.trace(i, `anusvāra → m before the vowel ${nx.ch}`, 'anusvara.before-vowel', ANU, 'm');
  });
}

/**
 * The Taittirīya gum — profile-gated (`profile.gum`).
 *
 * Before `ś ṣ s h r` the Kṛṣṇa/Śukla Yajurveda recites the anusvāra as the
 * *gum*: `m̐` plus a superscript reading aid — `gṁ` when a vowel follows, `g`
 * when a consonant follows, `gg` when a consonant follows AND the preceding
 * vowel is a short `a i u`.
 *
 * FEED IT THE UNDERLYING `ṁ`, never a pre-formed `m̐`: the pass keys on the
 * anusvāra, so a candrabindu already in the source slips past it and ships a
 * gum with no reading aid. `normalize.ts` folds `ꣳ`/`ँ` → `ṁ` for exactly this
 * reason.
 *
 * A praṇava or bīja is never assimilated, and that guard has to be repeated
 * HERE — without it `oṁ śāntiḥ` came out as `om̐gṁ śāntiḥ`, which no witness
 * writes and which Puruṣa Sūktam contradicts.
 *
 * Was `gen_vishnu.apply_vedic_anusvara` — one generator's opt-in pass.
 */
export function applyGum(ctx: RuleCtx): void {
  const { elems, wordIsBija } = ctx;
  elems.forEach((e, i) => {
    if (e.kind !== 'letter' || e.ch !== ANU) return;
    if (wordIsBija[e.word] === true) return;
    const nx = nextLetter(elems, i);
    if (nx === null) return;
    if (!(SIBILANTS.has(nx.ch) || nx.ch === 'h' || nx.ch === 'r')) return;

    // What follows the trigger letter decides the aid.
    let after: Elem | null = null;
    let seen = false;
    for (let k = i + 1; k < elems.length; k += 1) {
      const q = elems[k]!;
      if (q.kind !== 'letter') continue;
      if (!seen) {
        seen = true;
        continue;
      }
      after = q;
      break;
    }
    const prev = prevVowelChar(elems, i);
    let aid: string;
    if (after === null || after.vowel) aid = 'gṁ';
    else aid = prev !== null && SHORT_VOWELS.has(prev) ? 'gg' : 'g';

    e.wasCh = e.ch;
    e.ch = 'm';
    e.candra = true;
    e.sup = aid;
    e.change = true;
    ctx.trace(i, `gum before ${nx.ch} — aid ${aid}`, 'anusvara.gum', ANU, `m̐${aid}`);
  });
}

/**
 * Before `v` / `l` / `y` the anusvāra is kept and takes the reading aid
 * `u` / `i` / `l`.
 */
const SEMIVOWEL_AID: ReadonlyArray<readonly [string, string]> = [
  ['v', 'u'],
  ['l', 'l'],
  ['y', 'i'],
];

export function applySemivowelAid(ctx: RuleCtx): void {
  const { elems, wordIsBija } = ctx;
  elems.forEach((e, i) => {
    if (e.kind !== 'letter' || e.ch !== ANU) return;
    if (wordIsBija[e.word] === true) return;
    const nx = nextLetter(elems, i);
    if (nx === null) return;
    const hit = SEMIVOWEL_AID.find(([c]) => c === nx.ch);
    if (hit === undefined || e.sup !== undefined) return;
    e.sup = hit[1];
    e.change = true;
    ctx.trace(i, `anusvāra keeps, aid ${hit[1]} before ${nx.ch}`, 'anusvara.semivowel-aid');
  });
}

/**
 * Visarga. Checked in this order — FIRST MATCH WINS.
 *
 * The voiced row is the WHOLE voiced series, not just the stops: `ḥ` before
 * `y r l v h` or a nasal other than `m` becomes `r` too. That is ordinary
 * visarga sandhi and the shipped chants depend on it — `vishnu-suktam.json`
 * turns `ḥ` to `r` before `n`, `v` and `y`; `puja-vidhi.json` before `n`, `v`,
 * `m` and `j`.
 */
export function applyVisarga(ctx: RuleCtx): void {
  const { elems } = ctx;
  elems.forEach((e, i) => {
    if (e.kind !== 'letter' || e.ch !== VIS) return;
    const nx = nextLetter(elems, i);
    if (nx === null) return;
    const n = nx.ch;
    const pvc = prevVowelChar(elems, i);
    const set = (to: string, note: string) => {
      e.wasCh = e.ch;
      e.ch = to;
      e.change = true;
      ctx.trace(i, note, 'visarga', VIS, to);
    };
    if (n === 'c' || n === 'ch') set('ś', `visarga → ś before ${n}`);
    else if (n === 'ṭ' || n === 'ṭh') set('ṣ', `visarga → ṣ before ${n}`);
    else if (n === 't' || n === 'th') set('s', `visarga → s before ${n}`);
    else if (SIBILANTS.has(n)) set(n, `visarga assimilates to ${n}`);
    else if (n === 'p' || n === 'ph') {
      // Upadhmānīya: the visarga is KEPT and takes a superscript `f`.
      e.sup = 'f';
      e.change = true;
      ctx.trace(i, 'upadhmānīya — visarga keeps, aid f', 'visarga.before-p');
    } else if ((VOICED.has(n) || isVowel(n)) && pvc !== 'a' && pvc !== 'ā') {
      set('r', `visarga → r before the voiced ${n}`);
    }
    // else retain ḥ, unmarked — including k/kh, and aḥ/āḥ before a voiced
    // consonant or a vowel.
  });
}

/**
 * The gum realises an underlying ANUSVĀRA before a sibilant or `h`, so it is a
 * sandhi variant and carries `change` — exactly as `purusha-suktam.json` stores
 * it (`dam̐gṁ sarvam`: the `m` has `change: true`). A word-final `m` that was
 * always an `m` does not.
 *
 * Separate from `applyGum` because an AUTHORED gum (text copied from a
 * hand-marked source, where the candrabindu is already in the letters) needs
 * the same colour without being re-derived.
 */
export function markGumChange(ctx: RuleCtx): void {
  const { elems } = ctx;
  elems.forEach((e, k) => {
    if (e.kind !== 'letter' || e.candra !== true) return;
    let nx: Elem | null = null;
    for (let j = k + 1; j < elems.length; j += 1) {
      const q = elems[j]!;
      if (q.kind === 'letter') {
        nx = q;
        break;
      }
    }
    if (nx !== null && (SIBILANTS.has(nx.ch) || nx.ch === 'h')) e.change = true;
  });
}
