/**
 * Svarabhakti and the reading aids.
 *
 * Both are FLAGS on a letter, not characters inserted into the text, so they
 * are invisible to the saṁyukta scan and can never move a holding box. In
 * Śikṣāmitra they ARE characters, which is why it has to insert them before the
 * cluster scan reads the line; here the ordering does not matter and they run
 * after the holdings.
 *
 * The owner's own data proves the two treatments are equivalent: `bhavyam` in
 * `purusha-suktam.json` carries `sup:"u"` AND the holding on the same `v`, so
 * the raised letter never breaks the cluster it sits inside.
 *
 * See docs/MARKING-RULES.md §6 and §7 step 2.
 */
import { READING_AIDS, SBHAKTI_AFTER, SBHAKTI_TRIGGERS } from '../alphabet.js';
import type { Elem } from '../lex.js';
import type { RuleCtx } from './types.js';

/**
 * A dot on a `ś ṣ h` immediately preceded by `r`.
 *
 * The trigger set in `sanskrit_rules.js` is far too wide taken literally — it
 * would fire on `kṣ`, `sm`, `śś`, `ts` and the owner marks none of those.
 * Measured off his files instead: all 8 of his dots sit on a `ś ṣ h` directly
 * after an `r`, and no such contact in those files is left unmarked. 8 for 8,
 * with no counter-example available in the corpus.
 *
 * `gen_marks` did not implement svarabhakti at all for a long time, so every
 * generated chant lacked it; `puja-vidhi.json` still has three unmarked `r`+`ś`
 * contacts for that reason.
 */
export function applySvarabhakti(ctx: RuleCtx): void {
  let prev: Elem | null = null; // the last LETTER, across word spaces
  ctx.elems.forEach((e, i) => {
    if (e.kind !== 'letter') {
      // A pause or line break separates the two.
      prev = null;
      return;
    }
    if (SBHAKTI_TRIGGERS.has(e.ch) && prev !== null && prev.ch === SBHAKTI_AFTER) {
      e.sbhakti = true;
      ctx.trace(i, `svarabhakti before ${e.ch} after r`, 'svarabhakti.r-sibilant');
    }
    prev = e;
  });
}

/**
 * A superscript letter inside `jñ` (→ raised `g`) and `vy` (→ raised `u`),
 * within ONE word.
 *
 * `sv` → `u` is deliberately absent: measured 2 of 30 across his hand-marked
 * chants, so it is not the house habit, and adding it would put a raised `u` on
 * 28 letters he leaves bare. `ghn` takes no insertion either — it is in
 * `SPECIAL_SEQUENCES` for the anusvāra rule only.
 *
 * Never overwrites the gum's own reading aid.
 */
export function applyReadingAids(ctx: RuleCtx): void {
  const { elems, profile } = ctx;
  const enabled = new Map<string, boolean>([
    ['jñ', profile.aids.jna],
    ['vy', profile.aids.vy],
    ['sv', profile.aids.sv],
  ]);
  elems.forEach((e, i) => {
    if (e.kind !== 'letter') return;
    const nxt = elems[i + 1];
    if (nxt === undefined || nxt.kind !== 'letter' || nxt.word !== e.word) return;
    const hit = READING_AIDS.find(([[a, b]]) => a === e.ch && b === nxt.ch);
    if (hit === undefined) return;
    const pairKey = e.ch + nxt.ch;
    if (enabled.get(pairKey) === false) return;
    if (e.sup !== undefined) return;
    e.sup = hit[1];
    ctx.trace(i, `reading aid ${hit[1]} in ${pairKey}`, 'aids');
  });
}

/**
 * `sv` → raised `u`. Separate because it is OFF by default and gated on the
 * profile: it is the one aid the owner's files do not support.
 */
export function applySvAid(ctx: RuleCtx): void {
  const { elems } = ctx;
  elems.forEach((e, i) => {
    if (e.kind !== 'letter' || e.ch !== 's') return;
    const nxt = elems[i + 1];
    if (nxt === undefined || nxt.kind !== 'letter' || nxt.word !== e.word) return;
    if (nxt.ch !== 'v' || e.sup !== undefined) return;
    e.sup = 'u';
    ctx.trace(i, 'reading aid u in sv', 'aids.sv');
  });
}
