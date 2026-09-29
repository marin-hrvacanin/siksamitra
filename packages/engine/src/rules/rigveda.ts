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
import { LONG_VOWELS } from '../alphabet.js';
import type { Elem } from '../lex.js';
import type { RuleCtx } from './types.js';

/** The nasals a svarita can move onto. `ṁ` is written `ṁ` or as what replaced it. */
const NASALS = new Set(['ṁ', 'n', 'ñ', 'ṅ', 'ṇ', 'm']);

const isLong = (e: Elem): boolean => LONG_VOWELS.has(e.ch);

/** The next letter after `i` in the same word, skipping nothing else. */
function nextInWord(elems: readonly Elem[], i: number): Elem | undefined {
  const here = elems[i]!;
  const next = elems[i + 1];
  return next !== undefined && next.kind === 'letter' && next.word === here.word ? next : undefined;
}

/** The first consonant after `i`, across a word boundary but not a pause or line. */
function nextConsonant(elems: readonly Elem[], i: number): Elem | undefined {
  const line = elems[i]!.line;
  for (let k = i + 1; k < elems.length; k += 1) {
    const e = elems[k]!;
    if (e.line !== line || e.kind === 'pause' || e.kind === 'vpause' || e.kind === 'ompause') return undefined;
    if (e.kind !== 'letter') continue;
    if (e.vowel) return undefined;
    return e;
  }
  return undefined;
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

    const held = nextConsonant(elems, i)?.hold !== undefined;
    if (!held) {
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
export interface AccentUnit { c: string; svara?: string }
export function unlengthen(units: AccentUnit[]): AccentUnit[] {
  const out = units.map((u) => ({ ...u, c: u.c.replace(/̅/g, '') }));
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
