/**
 * A VERSE IN AN INDIC SCRIPT, AS WORD RUNS — and back to IAST, losslessly.
 *
 * IAST is the one form every marking is kept in; Devanāgarī, Telugu and Tamil
 * are written FROM it, one syllable at a time, by the engine's own
 * transliterator (`transliterateSyllableSpans`) — the forms the app draws.
 * Every script is exact in both directions: IAST → Devanāgarī → IAST gives the
 * same bytes, and so does any path through the four.
 *
 * STYLES CHANGE ONLY BETWEEN CLUSTERS. Word shapes a conjunct within a run of
 * one formatting; give `र्` one style and `ष` another and `र्ष` falls apart on
 * the page. So a word is cut into its clusters (`scriptClusters`) and a mark
 * is drawn on the WHOLE cluster its letter is in — the box round `र्ष`, the
 * substitution blue over it — which is how the app draws them in its
 * Devanāgarī view. AN ACCENT IS IN ITS CLUSTER'S OWN RUN (U+0951 / U+0952 /
 * U+1CDA), in the cluster's colour: in a run of its own Word cannot attach it
 * to a Devanāgarī letter and draws it on a dotted circle — measured, in
 * Word's own PDF.
 *
 * WHAT A CLUSTER CANNOT SHOW IS SAID IN HIDDEN TEXT. Which consonant of `र्ष`
 * the box is on; which letter an accent is on, when it is not the vowel; the
 * virāma tick and the `:` of `ḥ:`, which only IAST writes; a raised reading
 * aid, which only IAST draws. A run of Word's own hidden text (`w:vanish`)
 * after the cluster says each (`Said`): kept in the file, neither drawn nor
 * printed. Invisible CHARACTERS were tried first, and Word draws them: one
 * variation selector after a letter is hidden, a second in a row — and every
 * TAG character — is a box on the page.
 *
 * THE IAST WRITER IS THE TRUTH, and there is no second statement of what a
 * mark looks like. A word is written in IAST by `body.ts`, read into letters
 * (`lettersOfIast`); written in the script with no markers, read back by the
 * very reader a document is read with (`ScriptReader`); and wherever a letter
 * came back differently, a marker is added — then it is read again, and a
 * word that still does not come back exact is an ERROR, never a silent loss.
 */
import type { ChantSvara, ChantToken } from '@siksamitra/format';
import {
  CANDRA_SIGN, scriptClusters, transliterateSyllableSpans, type Profile, type ScriptKey,
} from '@siksamitra/engine';
import { mergeRuns, type WordRun } from '../docx-read.js';
import { WORD_DEVANAGARI } from '@siksamitra/tokens/word';
import { SCRIPT_SVARA_CHAR } from '../word-styles.js';
import { sameLetter, type Letter } from './script-letters.js';
import { SAID, ScriptReader, plainProfile, type Read, type Said } from './script-reader.js';

export { lettersOfIast, type Letter } from './script-letters.js';
export {
  SAID, WORD_SCRIPTS, iastPositions, iastRunsOf, scriptOfLine, wordScript, type Said,
} from './script-reader.js';

type Syllable = Extract<ChantToken, { t: 'syl' }>;

/** A word — consecutive syllables — in the script, with no marks. */
export function wordInScript(syllables: readonly Syllable[], script: ScriptKey): string {
  let text = '';
  for (const syl of syllables) {
    const r = transliterateSyllableSpans(syl.units.map((u) => ({
      c: u.c, ...(u.cj === undefined ? {} : { cj: u.cj }), ...(u.candra === true ? { candra: true } : {}),
    })), script, { lossless: true });
    /* THE CANDRABINDU GOES RIGHT AFTER ITS `m`, inside the text, before the
       text is cut into clusters — as the app writes it after the syllable. Put
       after the CLUSTER instead, the `m` of `sam̐hitā`, which is in `म्हि`, got
       its sign after the `i` and came back as `samhim̐tā`. */
    let syllable = r.text;
    const spans = r.spans.map((x) => (x === null ? null : [x[0], x[1]] as [number, number]));
    for (let k = syl.units.length - 1; k >= 0; k -= 1) {
      if (syl.units[k]!.candra !== true) continue;
      /* A candrabindu typed as a mark of its own writes no letter, and rides
         on the letter before it. */
      let on = k;
      while (on >= 0 && (spans[on] === null || spans[on] === undefined)) on -= 1;
      const sp = on < 0 ? null : spans[on]!;
      if (sp === null) continue;
      const at = sp[1];
      const sign = CANDRA_SIGN[script];
      syllable = syllable.slice(0, at) + sign + syllable.slice(at);
      spans.forEach((o, j) => {
        if (o === null) return;
        if (j === on) o[1] += sign.length;
        else if (o[0] >= at) { o[0] += sign.length; o[1] += sign.length; }
      });
    }
    text += syllable;
  }
  return text;
}

/* ── the writer ─────────────────────────────────────────────────────────── */

const said = (s: Said): WordRun => ({ text: SAID + JSON.stringify(s), rStyle: null, superscript: false, hidden: true });

/** What `runs` read back as, by the one reader. */
function readBack(runs: readonly WordRun[], script: ScriptKey, profile: Profile): Read[] {
  const reader = new ScriptReader(script, profile);
  for (const r of mergeRuns([...runs])) reader.feed(r);
  return reader.out.filter((x): x is Read => 't' in x);
}

/**
 * One word's runs in `script`, which read back to exactly `truth` — the
 * letters the IAST writer gave the same word.
 */
export function scriptWordRuns(
  syllables: readonly Syllable[], script: ScriptKey, truth: readonly Letter[], profile: Profile = plainProfile(),
): WordRun[] {
  const text = wordInScript(syllables, script);
  /* A word the script writes nothing for — a candrabindu standing alone —
     is written as its own letters, which read back as themselves. */
  const parts = text === '' ? [truth.map((l) => l.t).join('')] : scriptClusters(text, script).map((p) => p.segment);
  /* Which cluster each letter is in: the plain text, read by the one reader. */
  const where = readBack(parts.map((p) => ({ text: p, rStyle: null, superscript: false })), script, profile);
  const exact = (runs: readonly WordRun[]): boolean => {
    const got = readBack(runs, script, profile);
    return got.length === truth.length && got.every((g, i) => sameLetter(truth[i]!, g));
  };
  /* THE LAST RESORT, never a loss and never a refusal: a word whose letters the
     script's plain reading cannot give back — a candrabindu on a consonant
     inside a conjunct — carries its letters and marks whole, hidden, after its
     first cluster. Its marks are not drawn in Word; they are all there. */
  const whole = (): WordRun[] => {
    const rest = parts.slice(1).join('');
    const n = 1 + (rest === '' ? 0 : scriptClusters(rest, script).length);
    const runs: WordRun[] = [
      { text: parts[0]!, rStyle: null, superscript: false }, said({ w: { n, letters: [...truth] } }),
      ...(rest === '' ? [] : [{ text: rest, rStyle: null, superscript: false }]),
    ];
    if (!exact(runs)) throw new Error(`the ${script} of “${truth.map((l) => l.t).join('')}” could not be written even whole`);
    return runs;
  };
  if (where.length !== truth.length) return whole();
  const plans = parts.map(() => ({
    held: [] as number[], kind: null as Letter['hold'], changed: [] as number[], changeLetter: '',
    svara: [] as [ChantSvara, number][], aid: [] as [string, number][], dot: null as number | null,
    tick: [] as number[], colon: [] as number[], letter: [] as [string, number][],
  }));
  truth.forEach((t, i) => {
    const { cluster, k } = where[i]!;
    const P = plans[cluster]!;
    if (t.hold !== null) { P.held.push(k); P.kind ??= t.hold; }
    if (t.changed) { P.changed.push(k); if (P.changeLetter === '') P.changeLetter = t.t; }
    for (const s of t.svara) P.svara.push([s, k]);
    for (const a of t.aid) P.aid.push([a, k]);
    if (t.dot) P.dot = k;
    if (t.tick) P.tick.push(k);
    if (t.colon) P.colon.push(k);
    /* Another spelling of the same sound — `ṃ` for `ṁ` — is said as well. */
    if (where[i]!.t !== t.t) P.letter.push([t.t, k]);
  });
  const explicit = parts.map(() => new Set<'held' | 'changed' | 'svara' | 'dot' | 'aid'>());
  /*
   * AS HIS DEVANĀGARĪ IS WRITTEN (`WORD_DEVANAGARI`), never a box: a box round
   * a conjunct falls apart on the page. A holding is his small raised mark
   * standing BEFORE the akṣara — U+0342 short, U+034C long — in `Hold`; the
   * accents follow the akṣara in a run of their own, in `Svara`; a reading aid
   * is drawn, small and raised, in `Phonetic`; and the IAST's hyphen is not
   * written — it is hidden text, so it is read back and nothing is lost. What
   * the plain reading of all that does not give back exactly — which letter
   * of a conjunct is held, which an aid follows — is in the hidden record.
   */
  const D = WORD_DEVANAGARI;
  const emit = (): WordRun[] => parts.flatMap((segment, c) => {
    const P = plans[c]!;
    const E = explicit[c]!;
    const out: WordRun[] = [];
    if (P.dot !== null) out.push({ text: '·', rStyle: 'Svara', superscript: false });
    if (/^-+$/.test(segment)) return [...out, { text: segment, rStyle: null, superscript: false, hidden: true }];
    if (P.kind !== null) out.push({ text: P.kind === 'long' ? D.hold.long : D.hold.short, rStyle: D.hold.style, superscript: false });
    /* A changed letter is not coloured in his Devanāgarī — the aid drawn after
       it says what is recited — so which letters are changed is in the record. */
    out.push({ text: segment, rStyle: null, superscript: false });
    if (P.svara.length > 0) out.push({ text: P.svara.map(([s]) => SCRIPT_SVARA_CHAR.get(s) ?? '').join(''), rStyle: 'Svara', superscript: false });
    if (P.aid.length > 0) out.push({ text: P.aid.map(([a]) => a).join(''), rStyle: D.aid.style, superscript: false });
    const s: Said = {
      ...(E.has('held') ? { h: P.held } : {}), ...(E.has('changed') ? { c: P.changed } : {}),
      ...(E.has('svara') ? { s: P.svara } : {}), ...(E.has('dot') && P.dot !== null ? { d: P.dot } : {}),
      ...(P.tick.length > 0 ? { t: P.tick } : {}), ...(P.colon.length > 0 ? { o: P.colon } : {}),
      ...(E.has('aid') ? { a: P.aid } : {}), ...(P.letter.length > 0 ? { l: P.letter } : {}),
    };
    if (Object.keys(s).length > 0) out.push(said(s));
    return out;
  });
  for (let pass = 0; pass < 3; pass += 1) {
    const runs = emit();
    const got = readBack(runs, script, profile);
    const wrong = truth.map((t, i) => ({ t, g: got[i], i })).filter(({ t, g }) => g === undefined || !sameLetter(t, g));
    if (wrong.length === 0) return runs;
    for (const { t, g, i } of wrong) {
      const E = explicit[where[i]!.cluster]!;
      if (g === undefined) continue;
      if (t.hold !== g.hold) E.add('held');
      if (t.changed !== g.changed) E.add('changed');
      if (t.svara.join() !== g.svara.join()) E.add('svara');
      if (t.dot !== g.dot) E.add('dot');
      if (t.aid.join('\u0000') !== g.aid.join('\u0000')) E.add('aid');
    }
  }
  return whole();
}
