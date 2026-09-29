/**
 * THE ṚGVEDA'S SVARITA — how a svarita is LENGTHENED in Ṛgvedic recitation.
 *
 * v1's `applyRigvedaSvaritaRules` (`editor-quill.js` L9468-9560), MARKING-RULES
 * step 8, and — the evidence that decides every detail below — the owner's own
 * marked Ṛgveda: the two sections of the Veda Union sādhanā that carry the
 * overline (ṚV 10.191; "Vigour and stamina", ṚV 8.81) and agnimīḻe sūktam.
 * After the svaras are placed, each svarita is looked at once:
 *
 *   1. ON A LONG VOWEL it becomes a dīrgha-svarita.
 *        `viśvā̎ni` · `manā̎ṁsi` · `pūrve̎` · `tvā̎` · `martā̎so`
 *   2. ON A SHORT VOWEL IMMEDIATELY FOLLOWED, IN THE SAME WORD, BY A NASAL
 *      THAT IS ITSELF FOLLOWED BY A CONSONANT OR ENDS THE WORD, it moves to
 *      that nasal as a dīrgha-svarita — whether the nasal was typed or is an
 *      anusvāra the rules replaced.
 *        `kṣumanta*ñ̎` · `ditsan̎tam` · `rayan̎te` · `svarājam̎`
 *      A nasal that simply opens the next syllable does not take it:
 *        `dakṣi̅̍ṇena`, where `ṇ` is the onset of `ṇe`.
 *   3. ON ANY OTHER SHORT VOWEL the vowel takes the overline (the `Long`
 *      style, U+0305) — UNLESS the consonant that follows begins a held
 *      cluster, which already lengthens it.
 *        `yu̅̍vase` · `bha̅̍ra` · `va̅̍dadhvam` · `gṛ̅̍bhāya` · `na̅̍ indra`
 *        but `sami̍[dh]yase` · `ga̍[c]chadhvam` · `vasva̍[s] svarājam`
 *
 * It runs after the holdings (rule 3 reads them) and after the svaras, and
 * before the author's overrides, which still have the last word.
 *
 * `lengthening` in the register turns it off: the anukramaṇī of ṚV 10.191 in
 * the sādhanā is accented but carries none of it (`śatata̍maṁ`), and that is
 * recorded as data on those verses, not as an exception here.
 */
import type { TextAndMarks } from '@siksamitra/format';
import { LONG_VOWELS, isConsonant } from '../alphabet.js';

/** U+0305, the overline rule 3 lays on a short vowel. */
const OVERLINE = '̅';
import type { Elem } from '../lex.js';
import type { RuleCtx } from './types.js';

/** The nasals a svarita can move onto. `ṁ` is written `ṁ` or as what replaced it. */
const NASALS = new Set(['ṁ', 'n', 'ñ', 'ṅ', 'ṇ', 'm']);

const isLong = (e: Elem): boolean => LONG_VOWELS.has(e.ch);

/** Letters that only ever CLOSE a syllable: a visarga, an anusvāra, the tick. */
const CODA = new Set(['ḥ', 'ṁ', 'ˎ']);

/**
 * The next letter after `i` in the same word — a hyphen does not end the word
 * here: `sa̱tyama-ṅ̎giraḥ` moves the svarita across it, as a joined word does.
 */
function nextInWord(elems: readonly Elem[], i: number): Elem | undefined {
  const here = elems[i]!;
  for (let k = i + 1; k < elems.length; k += 1) {
    const e = elems[k]!;
    if (e.kind === 'hyphen') continue;
    return e.kind === 'letter' && (e.word === here.word || elems[k - 1]?.kind === 'hyphen') ? e : undefined;
  }
  return undefined;
}

/**
 * Is the cluster that opens the NEXT syllable held? The letters after the
 * vowel up to the next vowel — past the syllable's own coda (`viśvata̍ḥᶠ
 * ▫pari`: the visarga closes `taḥ`, and `p` opens the next) — across a word
 * boundary, but not a pause or a line. Held if ANY letter of it is: `saca̍
 * s▫vā` boxes the `v` of `sv`.
 */
function nextClusterHeld(elems: readonly Elem[], i: number): boolean {
  const line = elems[i]!.line;
  for (let k = i + 1; k < elems.length; k += 1) {
    const e = elems[k]!;
    if (e.line !== line || e.kind === 'pause' || e.kind === 'vpause' || e.kind === 'ompause') return false;
    if (e.kind !== 'letter') continue;
    if (e.vowel) return false;
    if (CODA.has(e.wasCh ?? e.ch) && k === i + 1) continue;
    if (e.hold !== undefined) return true;
  }
  return false;
}

export function applyRigvedaSvarita(ctx: RuleCtx): void {
  const { elems } = ctx;
  for (const [i, e] of elems.entries()) {
    if (e.kind !== 'letter' || !e.vowel || e.svara !== 'svarita') continue;

    if (isLong(e)) {
      e.svara = 'dirgha-svarita';
      ctx.trace(i, 'svarita on a long vowel → dīrgha-svarita', 'svara.rigveda.long', 'svarita', 'dirgha-svarita');
      continue;
    }

    const after = nextInWord(elems, i);
    const beyond = after === undefined ? undefined : nextInWord(elems, elems.indexOf(after));
    if (after !== undefined && !after.vowel && NASALS.has(after.ch)
      && (beyond === undefined || !beyond.vowel)) {
      e.svara = undefined;
      after.svara = 'dirgha-svarita';
      ctx.trace(elems.indexOf(after), 'svarita moved onto the nasal as dīrgha-svarita',
        'svara.rigveda.nasal', 'svarita', 'dirgha-svarita');
      continue;
    }

    if (!nextClusterHeld(elems, i)) {
      e.dirgha = true;
      ctx.trace(i, 'short svarita, next cluster not held → overline', 'svara.rigveda.overline');
    }
  }
}

/**
 * THE INVERSE, for reading a marked Ṛgveda back to what was typed: the accent
 * a person writes is the plain svarita on the vowel. A dīrgha-svarita on a
 * long vowel becomes a svarita; one on a nasal moves back to the short vowel
 * before it; the overline goes. Pure over one syllable-unit list, so the
 * inverter and its tests call exactly this.
 */
export interface AccentUnit { c: string; svara?: string; candra?: boolean; change?: boolean }
export function unlengthen(units: AccentUnit[]): AccentUnit[] {
  const out = units.map((u) => ({ ...u, c: u.c.replace(/̅/g, '') }));
  /* The anunāsika back to the `n` it was: in the Ṛgveda a replaced `m` with a
     candrabindu has no other source (no g-forms are made). */
  for (const u of out) {
    if (u.c === 'm' && u.candra === true && u.change === true) {
      u.c = 'n';
      delete u.candra;
      delete u.change;
    }
  }
  for (const [i, u] of out.entries()) {
    if (u.svara !== 'dirgha-svarita') continue;
    const base = u.c.normalize('NFC');
    if (NASALS.has(base) && i > 0 && out[i - 1]!.svara === undefined) {
      out[i - 1]!.svara = 'svarita';
      delete u.svara;
    } else if (LONG_VOWELS.has(base)) {
      u.svara = 'svarita';
    }
  }
  return out;
}

/**
 * THE ANUNĀSIKA — `-ān` before a vowel is recited `-ām̐` (Ṛgveda Prātiśākhya
 * 4.80), in the owner's own words beside agnimīḻe 1.1.2: "ān + vowel = ām̐ +
 * vowel", printed `sa devām̐ eha` with the `m̐` in the blue of a letter the rules
 * replaced. So a word-final `n` after `ā`, followed on the line by a word that
 * begins with a vowel, is shown as `m` with a candrabindu, and records the `n`.
 */
export function applyAnunasika(ctx: RuleCtx): void {
  const { elems } = ctx;
  for (const [i, e] of elems.entries()) {
    if (e.kind !== 'letter' || e.ch !== 'n') continue;
    const before = elems[i - 1];
    if (before === undefined || before.kind !== 'letter' || before.word !== e.word || before.ch !== 'ā') continue;
    const next = elems.slice(i + 1).find((x) => x.kind !== 'hyphen');
    if (next === undefined || next.kind !== 'letter' || next.word === e.word || next.line !== e.line || !next.vowel) continue;
    e.wasCh = 'n';
    e.ch = 'm';
    e.candra = true;
    e.change = true;
    ctx.trace(i, 'ān before a vowel → ām̐', 'sandhi.rigveda.anunasika', 'n', 'm̐');
  }
}

/**
 * Does a marked line show the Ṛgveda's lengthening — a mark no other register
 * makes? The overline (rule 3) is one, and an accent on a consonant (rule 2's
 * nasal) is the other; a dīrgha-svarita on a long vowel is not, because the
 * Taittirīya types those. EVIDENCE, NOT PROOF: a Ṛgvedic text with the
 * lengthening switched off may carry overlines it was given by hand, so the
 * register a document RECORDS always wins, and this speaks only where none is
 * recorded.
 */
export function showsLengthening(tm: TextAndMarks): boolean {
  if (tm.text.includes(OVERLINE)) return true;
  return tm.marks.some((m) => m.k === 'svara' && isConsonant(tm.text.slice(m.from, m.to)));
}
