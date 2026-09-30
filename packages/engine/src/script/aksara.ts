/**
 * ONE SYLLABLE IN A SCRIPT — the akṣara builder, out of `index.ts` at the
 * module gate. `index.ts` is the whole-text transliterator and the reader back
 * to IAST; this is the one function every syllable of every document is drawn
 * with, and the spans that say which characters each letter became.
 */
import {
  ANU, PRANAVA, VIS, VIRAMA_TICK, ZWJ, ZWNJ, cjControl, isConsonant, isVowel,
} from '../alphabet.js';
import { ACCENT_MARKS, BY_IAST, SIGN_BY_IAST, letterFor, signFor } from './tables.js';
import type { ScriptKey } from './tables.js';
import { formOf } from './module.js';
import { splitRiding } from './riding.js';
import { requireScript } from './registry.js';
import { selectorFor } from './lossless.js';
import { qualifiersOut } from './qualifiers.js';
import { romanisationLossless } from './romanisation.js';

/**
 * Transliteration options.
 *
 * `lossless` appends a variation selector wherever the target script cannot
 * tell two IAST letters apart (Tamil `க` = k/kh/g/gh). It renders as nothing
 * and makes the reverse conversion exact. OFF by default, because plain output
 * must stay byte-identical to the eleven shipped documents. See ./lossless.ts.
 */
export interface ScriptOptions {
  lossless?: boolean;
}

const ACCENTS = new Set(ACCENT_MARKS);
/**
 * What counts as the pranava on the way IN.
 *
 * Imported rather than redeclared. There were two of these — this file had
 * {'oṁ','oṃ','om'} and `alphabet.ts` had {'oṁ','oṃ','auṁ','om'} — so `auṁ`
 * was the pranava to the marking rules and an ordinary diphthong to the
 * transliterator, which rendered it `औं` instead of `ॐ`. One definition, one
 * home.
 */
export const PRANAVA_IAST = PRANAVA;

/** One letter of a syllable, as the transliterator needs to see it. */
export interface ScriptUnit {
  /** The IAST letter, after sandhi. */
  c: string;
  /** A conjunct boundary AFTER this letter. */
  cj?: 'split' | 'join';
  /** The Vedic candrabindu. Rendered as a sign; the `sup` aid is IAST-only. */
  candra?: boolean;
}

/**
 * Strip what is DATA or IAST-only notation rather than script text.
 *
 *   - the accents and the candrabindu — drawn by the renderer, never glyphs;
 *   - the `ˎ` virāma tick — Devanāgarī already writes that final consonant with
 *     its own halanta, so there is nothing for the tick to add;
 *   - the conjunct controls — they become the `cj` flag;
 *   - the `:` of the special visarga `ḥ:` (MARKING-RULES §5, `ḥ` before `kṣ`)
 *     — an ASCII notation for IAST, not a character any Indic script writes.
 *     Verified: the corpus renders `maḥ:` as `मः` / `మః`, with no colon.
 */
export function bare(s: string): string {
  let out = '';
  for (const ch of s) {
    if (ACCENTS.has(ch) || ch === VIRAMA_TICK || ch === ZWNJ || ch === ZWJ) continue;
    if (ch === ':') continue;
    out += ch;
  }
  return out;
}

/**
 * Build one akṣara from a syllable's units.
 *
 * The shape of a syllable is: onset consonants, a vowel nucleus, then (on a
 * word's last syllable) coda consonants. Onset consonants before the last take
 * the virāma; the last carries the vowel sign. With no onset the independent
 * vowel form is used.
 */
export function transliterateSyllable(
  units: readonly ScriptUnit[],
  script: ScriptKey,
  opts?: ScriptOptions,
): string {
  return transliterateSyllableSpans(units, script, opts).text;
}

/** One syllable in a script, and which characters each IAST unit became. */
export interface SyllableSpans {
  readonly text: string;
  /**
   * Per unit of the input, `[from, to)` in `text` — or `null` for a unit that
   * writes nothing (an accent, a tick: data the renderer draws). Where a
   * script writes the whole syllable as one form (the praṇava, the Ṛgvedic
   * overline, a lossless romanisation) every unit is given the whole of it.
   */
  readonly spans: readonly (readonly [number, number] | null)[];
}

/**
 * `transliterateSyllable`, telling which characters each unit produced — so a
 * writer can put a sign after the letter it belongs to (the candrabindu after
 * its `m`, inside a conjunct). ONE function builds both: the plain form is
 * this one's `text`.
 */
export function transliterateSyllableSpans(
  units: readonly ScriptUnit[],
  script: ScriptKey,
  opts?: ScriptOptions,
): SyllableSpans {
  const whole = (text: string): SyllableSpans => ({
    text, spans: units.map((u) => (bare(u.c) === '' ? null : [0, text.length] as const)),
  });
  const module = requireScript(script);
  // A romanisation writes its vowels in line — no matras to fold into an onset
  // — so the forms concatenate: IAST, ITRANS and any romanisation added later.
  if (module.kind === 'romanisation') {
    // In lossless mode the conjunct choice is written out, because otherwise a
    // romanisation drops it: Devanagari distinguishes `क्त्य` from `क्‌त्य`
    // and IAST spells both `ktya`. This is the same mechanism the Indic scripts
    // use for their own ambiguities — a marker that survives the round trip —
    // and without it "IAST" is a one-way export rather than an exchange form.
    if (opts?.lossless === true) return whole(romanisationLossless(units, module));
    let text = '';
    const spans = units.map((u) => {
      const from = text.length;
      const form = formOf(module, u.c)?.form ?? u.c;
      // ZWNJ / ZWJ, not the ASCII `_` / `+`: zero-width format characters, invisible, inert in collation
      // and search, stepped over by every rule (they are in `ANNOTATION`), and
      // already the canonical internal form — `normalize` rewrites the ASCII
      // into these before anything else runs. The ASCII pair is a TYPING
      // convenience for an author, not the representation; emitting it here
      // would put a visible `_` into text meant to read as Sanskrit, and would
      // make the same information two different characters depending on which
      // end of the pipeline produced it.
      text += u.cj === undefined ? form : form + cjControl(u.cj);
      return [from, text.length] as const;
    });
    return { text, spans };
  }
  const ride = splitRiding(units); // the Ṛgvedic overline: see riding.ts
  if (ride !== null) return whole(transliterateSyllable(ride.bare, script, opts) + ride.riding);
  const virama = module.virama;
  const sel = (c: string): string =>
    opts?.lossless === true ? selectorFor(c, script) : '';

  // The praṇava, when a script has its own ligature for it.
  const plain = units.map((u) => u.c).join('');
  if (PRANAVA_IAST.has(bare(plain)) && module.pranava !== null) return whole(module.pranava);

  // Partition into onset / nucleus / coda — remembering where each unit came from.
  const spans: ([number, number] | null)[] = units.map(() => null);
  const seq = units.map((u, at) => ({ u, at })).filter((x) => bare(x.u.c) !== '');
  const nucleusAt = seq.findIndex((x) => isVowel(bare(x.u.c)));
  const onset = nucleusAt < 0 ? seq : seq.slice(0, nucleusAt);
  const nucleus = nucleusAt < 0 ? null : seq[nucleusAt]!;
  const coda = nucleusAt < 0 ? [] : seq.slice(nucleusAt + 1);

  /**
   * Does this script have a mātrā for the nucleus?
   *
   * Tamil has no vowel sign for the vocalic `ṛ ṝ ḷ ḹ`, so `kṛ` cannot be
   * written as `க` + a sign. The onset then closes with a virāma and the vowel
   * is written in FULL (`க்` + `ரு`). Without this the vowel silently vanished
   * and `kṛṣṇa` came out as `கஷ்ண` — read back as `kaṣṇa`.
   */
  const nucleusSign = nucleus === null ? undefined : SIGN_BY_IAST.get(bare(nucleus.u.c));
  const nucleusSignGlyph = nucleusSign === undefined ? null : signFor(nucleusSign, script);
  /*
   * A vowel is a SIGN only on a consonant. After a bracket, a quotation mark
   * or anything else that is not a letter of the script it is written in
   * full: `(ityu…` is `(इत्यु…`. Counting any onset at all put the sign on
   * the bracket — `(ि` — in the app's own Devanāgarī, Telugu and Tamil.
   */
  const lastOnset = onset[onset.length - 1];
  const lastLetter = lastOnset === undefined ? undefined : BY_IAST.get(bare(lastOnset.u.c));
  const onConsonant = lastLetter !== undefined && lastLetter.type === 'consonant' && letterFor(lastLetter, script) !== null;
  const spellNucleusInFull = nucleus !== null && onConsonant && nucleusSignGlyph === null;

  let out = '';
  const span = (at: number, from: number): void => { spans[at] = [from, out.length]; };

  // ── onset ────────────────────────────────────────────────────────────────
  onset.forEach(({ u, at }, k) => {
    const from = out.length;
    const p = BY_IAST.get(bare(u.c));
    if (p === undefined) {
      out += u.c;
      span(at, from);
      return;
    }
    const base = letterFor(p, script);
    if (base === null) {
      out += u.c;
      span(at, from);
      return;
    }
    out += base + sel(bare(u.c));
    // A `special` letter (avagraha) is not a consonant and never takes a
    // virāma: `'si` is `ऽसि`, not `ऽ्सि`.
    if (p.type !== 'consonant') { span(at, from); return; }
    const isLast = k === onset.length - 1;
    if (!isLast || nucleus === null || spellNucleusInFull) {
      // A medial onset consonant, a cluster with no vowel at all, or a nucleus
      // this script has no mātrā for: virāma, plus the conjunct control when
      // the author chose a split or a join.
      out += virama + cjControl(u.cj);
    }
    span(at, from);
  });

  // ── nucleus ──────────────────────────────────────────────────────────────
  if (nucleus !== null) {
    const from = out.length;
    const v = bare(nucleus.u.c);
    if (!onConsonant || spellNucleusInFull) {
      const p = BY_IAST.get(v);
      const base = p === null || p === undefined ? null : letterFor(p, script);
      out += (base ?? v) + (base === null ? '' : sel(v));
    } else {
      out += nucleusSignGlyph ?? '';
    }
    span(nucleus.at, from);
  }

  // ── coda ─────────────────────────────────────────────────────────────────
  for (const { u, at } of coda) {
    const from = out.length;
    const c = bare(u.c);
    const p = BY_IAST.get(c);
    if (p === undefined) {
      out += c;
      span(at, from);
      continue;
    }
    const base = letterFor(p, script);
    if (base === null) {
      out += c;
      span(at, from);
      continue;
    }
    if (c === ANU) {
      // Devanāgarī and Telugu write a sign, which takes no virāma.
      out += base;
    } else if (c === VIS) {
      out += base;
    } else if (isConsonant(c)) {
      out += base + sel(c) + virama + cjControl(u.cj);
    } else {
      out += base;
    }
    span(at, from);
  }

  /* The qualifiers belong at the end of the cluster, not after the bare
     consonant they were composed onto. See `ScriptModule.qualifiers`. */
  if (module.qualifiers === undefined) return { text: out, spans };
  const text = qualifiersOut(out, module.qualifiers);
  /*
   * Moving a qualifier moves characters, so the spans are FOLLOWED to where
   * each character went: `qualifiersOut` only moves qualifiers, so the other
   * characters keep their order and so do the qualifiers, and a stable match
   * of equal characters recovers every one's new place. A letter then spans
   * from its first character to its last — a consonant whose qualifier hopped
   * over a vowel sign (`க³` + `ே` → `கே³`) spans the sign too.
   */
  const moved = followMoves(out, text, module.qualifiers);
  const exact = spans.map((sp) => {
    if (sp === null) return null;
    if (sp[0] === sp[1]) { const at = moved[sp[0]] ?? text.length; return [at, at] as const; }
    const at = [...Array(sp[1] - sp[0]).keys()].map((d) => moved[sp[0] + d]!);
    return [Math.min(...at), Math.max(...at) + 1] as const;
  });
  return { text, spans: exact };
}

/**
 * Where each character of `from` went in `to`, a reordering of it by
 * `qualifiersOut` — which moves only the qualifiers, so the other characters
 * keep their order and so do the qualifiers: the i-th of each class in `from`
 * is the i-th of the same class in `to`. Linear, in UTF-16 units as the spans
 * are; matching each character by search was quadratic, and a syllable of a
 * hundred thousand letters did not finish.
 */
function followMoves(from: string, to: string, qualifiers: string): number[] {
  const isQ = (c: string): boolean => qualifiers.includes(c);
  const q: number[] = [];
  const p: number[] = [];
  for (let i = 0; i < to.length; i += 1) (isQ(to[i]!) ? q : p).push(i);
  let nq = 0;
  let np = 0;
  return from.split('').map((c) => (isQ(c) ? (q[nq++] ?? -1) : (p[np++] ?? -1)));
}
