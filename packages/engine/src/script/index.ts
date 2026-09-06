/**
 * Transliteration — our own, table-driven, because the custom requirements are
 * the whole point.
 *
 * A general library cannot do what this needs:
 *   - emit ZWNJ / ZWJ at a virāma to preserve the conjunct split (01 §2.5);
 *   - keep the accents as DATA and never emit them as glyphs;
 *   - treat the `ˎ` virāma tick as text in IAST and drop it in Indic scripts,
 *     where the halanta already writes that final consonant;
 *   - build the gum from `m` + candra + a `g`-run, one letter;
 *   - render the praṇava as the ligature a script actually has.
 *
 * VERIFIED against the shipped corpus: every syllable of all 11 documents, in
 * DEVANĀGARĪ AND TELUGU — 15 881 syllables, 31 762 assertions, two per
 * syllable. That is the gate, and it is what licenses trusting those two
 * tables.
 *
 * NOT Tamil. The owner has confirmed the Tamil forms in the shipped chants were
 * never reviewed, so fitting the tables to them would bake in their errors;
 * `gates/transliteration.ts` excludes it and the module is registered
 * `verified: false`. This comment used to claim "all three Indic scripts",
 * which was a third more verification than exists.
 */
import {
  ANU, DIGRAPHS, FORM_BOUNDARY, PRANAVA, VIS, VIRAMA_TICK, ZWJ, ZWNJ,
  isConsonant, isVowel,
} from '../alphabet.js';
import {
  ACCENT_MARKS, BY_IAST, SIGN_BY_IAST,
  letterFor, signFor,
} from './tables.js';
import type { ScriptKey } from './tables.js';
import { formOf, type ScriptModule } from './module.js';
import { PHONEME_INVENTORY } from './phonemes.js';
import { getScript, registeredScripts, requireScript } from './registry.js';
import {
  VS_APPROX, isApproximation, isVariationSelector, letterFromSelector, selectorFor,
} from './lossless.js';

export type { ScriptKey, AnyScriptKey } from './tables.js';
export { PHONEMES, VOWEL_SIGNS, VIRAMA, PRANAVA_FORMS } from './tables.js';
export {
  ambiguitiesIn, isLosslessScript, hasSelectors, stripSelectors,
} from './lossless.js';

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
const PRANAVA_IAST = PRANAVA;

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
function bare(s: string): string {
  let out = '';
  for (const ch of s) {
    if (ACCENTS.has(ch) || ch === VIRAMA_TICK || ch === ZWNJ || ch === ZWJ) continue;
    if (ch === ':') continue;
    out += ch;
  }
  return out;
}

/** Split a bare IAST string into letters (digraphs are one letter). */
function letters(s: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const two = s.slice(i, i + 2);
    if ((DIGRAPHS as readonly string[]).includes(two)) {
      out.push(two);
      i += 2;
      continue;
    }
    out.push(s[i]!);
    i += 1;
  }
  return out;
}

/** The control character a conjunct boundary emits after the virāma. */
function cjControl(cj: 'split' | 'join' | undefined): string {
  if (cj === 'split') return ZWNJ;
  if (cj === 'join') return ZWJ;
  return '';
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
  const module = requireScript(script);
  // A romanisation writes its vowels in line: there are no matras to fold into
  // an onset, so the forms concatenate. This used to read `if (script ===
  // 'iast')`, which is the privilege this refactor exists to remove — the same
  // path now serves ITRANS and any romanisation added later.
  if (module.kind === 'romanisation') {
    // In lossless mode the conjunct choice is written out, because otherwise a
    // romanisation drops it: Devanagari distinguishes `क्त्य` from `क्‌त्य`
    // and IAST spells both `ktya`. This is the same mechanism the Indic scripts
    // use for their own ambiguities — a marker that survives the round trip —
    // and without it "IAST" is a one-way export rather than an exchange form.
    if (opts?.lossless === true) return romanisationLossless(units, module);
    return units.map((u) => {
      const form = formOf(module, u.c)?.form ?? u.c;
      if (u.cj === undefined) return form;
      // ZWNJ / ZWJ, not the ASCII `_` / `+`.
      //
      // They are zero-width format characters: invisible, inert in collation
      // and search, stepped over by every rule (they are in `ANNOTATION`), and
      // already the canonical internal form — `normalize` rewrites the ASCII
      // into these before anything else runs. The ASCII pair is a TYPING
      // convenience for an author, not the representation; emitting it here
      // would put a visible `_` into text meant to read as Sanskrit, and would
      // make the same information two different characters depending on which
      // end of the pipeline produced it.
      return form + cjControl(u.cj);
    }).join('');
  }
  const virama = module.virama;
  const sel = (c: string): string =>
    opts?.lossless === true ? selectorFor(c, script) : '';

  // The praṇava, when a script has its own ligature for it.
  const plain = units.map((u) => u.c).join('');
  if (PRANAVA_IAST.has(bare(plain)) && module.pranava !== null) return module.pranava;

  // Partition into onset / nucleus / coda.
  const seq = units.filter((u) => bare(u.c) !== '');
  const nucleusAt = seq.findIndex((u) => isVowel(bare(u.c)));
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
  const nucleusSign = nucleus === null ? undefined : SIGN_BY_IAST.get(bare(nucleus.c));
  const nucleusSignGlyph = nucleusSign === undefined ? null : signFor(nucleusSign, script);
  const spellNucleusInFull = nucleus !== null && onset.length > 0 && nucleusSignGlyph === null;

  let out = '';

  // ── onset ────────────────────────────────────────────────────────────────
  onset.forEach((u, k) => {
    const p = BY_IAST.get(bare(u.c));
    if (p === undefined) {
      out += u.c;
      return;
    }
    const base = letterFor(p, script);
    if (base === null) {
      out += u.c;
      return;
    }
    out += base + sel(bare(u.c));
    // A `special` letter (avagraha) is not a consonant and never takes a
    // virāma: `'si` is `ऽसि`, not `ऽ्सि`.
    if (p.type !== 'consonant') return;
    const isLast = k === onset.length - 1;
    if (!isLast || nucleus === null || spellNucleusInFull) {
      // A medial onset consonant, a cluster with no vowel at all, or a nucleus
      // this script has no mātrā for: virāma, plus the conjunct control when
      // the author chose a split or a join.
      out += virama + cjControl(u.cj);
    }
  });

  // ── nucleus ──────────────────────────────────────────────────────────────
  if (nucleus !== null) {
    const v = bare(nucleus.c);
    if (onset.length === 0 || spellNucleusInFull) {
      const p = BY_IAST.get(v);
      const base = p === null || p === undefined ? null : letterFor(p, script);
      out += (base ?? v) + (base === null ? '' : sel(v));
    } else {
      out += nucleusSignGlyph ?? '';
    }
  }

  // ── coda ─────────────────────────────────────────────────────────────────
  for (const u of coda) {
    const c = bare(u.c);
    const p = BY_IAST.get(c);
    if (p === undefined) {
      out += c;
      continue;
    }
    const base = letterFor(p, script);
    if (base === null) {
      out += c;
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
  }

  return out;
}

/**
 * Transliterate a whole IAST string — a word, a lemma, a title.
 *
 * Used for the grammar `forms`, `titleForms` and anything that is not a marked
 * syllable. Splits on word boundaries, syllabifies each word the same way the
 * engine does, and builds each akṣara.
 */
/**
 * Does this script write each phoneme as its own identifier?
 *
 * True for IAST, whose forms and the phoneme ids coincide. Asking the question
 * of the DATA rather than hardcoding the answer means a second such scheme —
 * or a change to IAST's own table — is handled without editing this file.
 */
function isIdentityMapping(module: ScriptModule): boolean {
  return PHONEME_INVENTORY.every((p) => module.letters[p.id] === p.id);
}

export function transliterate(iast: string, script: ScriptKey, opts?: ScriptOptions): string {
  // A romanisation whose forms are the phoneme ids themselves is already the
  // answer. Stated as a property of the module rather than as `script ===
  // 'iast'`, so a second such scheme needs no second branch.
  const target = requireScript(script);
  if (target.kind === 'romanisation' && isIdentityMapping(target)) return iast;
  let out = '';
  for (const chunk of iast.split(/(\s+)/)) {
    if (chunk.trim() === '') {
      out += chunk;
      continue;
    }
    out += transliterateWord(chunk, script, opts);
  }
  return out;
}

function transliterateWord(word: string, script: ScriptKey, opts?: ScriptOptions): string {
  const src = bare(word.replace(/ṃ/g, ANU));
  const pranava = getScript(script)?.pranava ?? null;
  if (PRANAVA_IAST.has(src) && pranava !== null) return pranava;
  const ls = letters(src);
  // Punctuation and anything unmapped passes through.
  const isLetter = (c: string) => isVowel(c) || isConsonant(c);
  let out = '';
  let i = 0;
  while (i < ls.length) {
    if (!isLetter(ls[i]!)) {
      const p = BY_IAST.get(ls[i]!);
      const mapped = p === undefined ? null : letterFor(p, script);
      out += mapped ?? ls[i]!;
      i += 1;
      continue;
    }
    // Collect one akṣara: onset consonants, a nucleus, and any coda that is not
    // followed by a vowel (so it belongs to this syllable rather than the next).
    const units: ScriptUnit[] = [];
    while (i < ls.length && isConsonant(ls[i]!) && !isVowel(ls[i]!)
           && ls[i] !== ANU && ls[i] !== VIS) {
      units.push({ c: ls[i]! });
      i += 1;
    }
    if (i < ls.length && isVowel(ls[i]!)) {
      units.push({ c: ls[i]! });
      i += 1;
      while (i < ls.length && (ls[i] === ANU || ls[i] === VIS)) {
        units.push({ c: ls[i]! });
        i += 1;
      }
    } else if (units.length === 0) {
      units.push({ c: ls[i]! });
      i += 1;
    }
    out += transliterateSyllable(units, script, opts);
  }
  return out;
}

/**
 * Which script is this text written in?
 *
 * By Unicode block. `mixed` when more than one Indic block appears, `unknown`
 * when nothing recognisable does. Latin with IAST diacritics reads as `iast`;
 * bare ASCII is ambiguous and also reads as `iast`, which the import report
 * flags rather than deciding silently.
 */
export function detectScript(text: string): ScriptKey | 'mixed' | 'unknown' {
  const seen = new Set<ScriptKey>();
  // Every script that claims Unicode ranges, asked in registration order. This
  // was a chain of hardcoded block comparisons, which meant a newly registered
  // writing system was invisible to detection until someone remembered to add
  // a branch for it.
  const claimants = registeredScripts()
    .filter((m): m is typeof m & { blocks: readonly (readonly [number, number])[] } =>
      m.blocks !== undefined && m.blocks.length > 0);
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    // `।` and `॥` live in the Devanāgarī block but are used by every script and
    // by IAST, so they are not evidence of anything.
    if (cp === 0x0964 || cp === 0x0965) continue;
    const owner = claimants.find((m) => m.blocks.some(([lo, hi]) => cp >= lo && cp <= hi));
    if (owner !== undefined) seen.add(owner.id as ScriptKey);
    else if ((cp >= 0x0041 && cp <= 0x007a) || (cp >= 0x0100 && cp <= 0x1eff)) {
      // Latin with diacritics. The romanisations share this range and are not
      // told apart by codepoint, so it reads as the default romanisation.
      seen.add('iast');
    }
  }
  const indic = [...seen].filter((s) => s !== 'iast');
  if (indic.length > 1) return 'mixed';
  if (indic.length === 1) return indic[0]!;
  if (seen.has('iast')) return 'iast';
  return 'unknown';
}

/**
 * Reverse: an Indic script back to IAST.
 *
 * Needed because the editor lets the author type in whichever script is on
 * screen. IAST is canonical, so input is folded at the boundary, and anything
 * lossy is reported rather than silently kept (a Tamil `க` could be `k`, `kh`,
 * `g` or `gh` — Tamil does not distinguish them, so the reverse mapping picks
 * the unaspirated voiceless letter and says so).
 *
 * Pass `{ lossless: true }` when the text was PRODUCED in lossless mode: the
 * conversion is then exact and nothing is reported. See ./lossless.ts.
 */
export interface ToIastResult {
  iast: string;
  /** Positions where the mapping was ambiguous, for the import report. */
  ambiguous: { at: number; from: string; chose: string; alternatives: string[] }[];
}

/**
 * Write a romanisation so it can be read back exactly.
 *
 * Longest-match decoding is deterministic but not automatically faithful: in
 * ITRANS `sh` is both one phoneme and `s` + `h`, and `aa` is both one vowel and
 * `a` + `a`, so the pair silently reads back as the single letter. The corpus
 * happens to contain neither sequence, which is precisely the kind of luck that
 * should not be mistaken for a property.
 *
 * So each form is appended, the result re-read, and where the reading has
 * changed a zero-width non-joiner is inserted to break the merge. ZWNJ is the
 * right character for it: invisible, inert, and already meaning "these do not
 * combine" — the same thing it means after a halanta.
 */
function romanisationLossless(
  units: readonly ScriptUnit[],
  module: ScriptModule,
): string {
  let out = '';
  const intended: string[] = [];
  for (const u of units) {
    const form = formOf(module, u.c)?.form ?? u.c;
    intended.push(u.c);
    const candidate = out + form;
    // Would appending this form change how anything already written reads?
    if (romanisationToIast(candidate, module).iast !== intended.join('')) {
      out += FORM_BOUNDARY + form;
    } else {
      out = candidate;
    }
    if (u.cj !== undefined) out += cjControl(u.cj);
  }
  return out;
}

/**
 * Read a romanisation back, by longest match over its own forms.
 *
 * A romanisation has no virama and no matras: it writes vowels in line, so the
 * abugida decoder below is simply the wrong machine for it. Run against ITRANS
 * it inserted the inherent vowel after every consonant — `prā` came back as
 * `parā`, `gnim` as `ganima` — and 29 % of the corpus failed to round-trip.
 *
 * Longest match first, so a two-character form is read as itself before its
 * first character is read alone. That makes the decode DETERMINISTIC. Where a
 * form is also spellable as a sequence of shorter forms (ITRANS `sh` is both
 * one phoneme and `s` + `h`) determinism is not the same as faithfulness: the
 * longer reading wins and the sequence reading cannot be expressed. Such
 * scripts are reported by `sequenceAmbiguitiesIn` and registered
 * `reversible: false`.
 */
function romanisationToIast(text: string, module: ScriptModule): ToIastResult {
  const forms = PHONEME_INVENTORY
    .map((p) => ({ id: p.id, form: formOf(module, p.id)?.form }))
    .filter((e): e is { id: string; form: string } => e.form !== undefined && e.form !== '')
    .sort((a, b) => b.form.length - a.form.length);

  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    // The conjunct controls are carried through untouched: they are the same
    // characters on both sides and mean the same thing.
    // A form boundary did its job at parse time and is not part of the text.
    if (ch === FORM_BOUNDARY) { i += 1; continue; }
    // The conjunct controls ARE part of it: same characters, same meaning.
    if (ch === ZWNJ || ch === ZWJ) { out += ch; i += 1; continue; }
    const hit = forms.find((e) => text.startsWith(e.form, i));
    if (hit === undefined) { out += ch; i += 1; continue; }
    out += hit.id;
    i += hit.form.length;
  }
  return { iast: out, ambiguous: [] };
}

export function toIast(
  text: string,
  from: ScriptKey,
  opts?: ScriptOptions,
): ToIastResult {
  const source0 = requireScript(from);
  if (source0.kind === 'romanisation') {
    if (isIdentityMapping(source0)) return { iast: text, ambiguous: [] };
    return romanisationToIast(text, source0);
  }
  // Losslessness is a property of the ENCODING, so the decoder has to be told
  // which encoding it is reading — like a character set. In lossless text the
  // ABSENCE of a selector is itself meaningful: it positively says "the group's
  // default member". Without that, a word like `puruṣa`, every one of whose
  // letters happens to be its group's default, emits no selectors at all and is
  // indistinguishable from plain text.
  const lossless = opts?.lossless === true;
  const source = requireScript(from);
  const virama = source.virama;
  // The praṇava ligatures are single glyphs standing for a whole syllable, so
  // they are matched before anything else. Telugu has no ligature and reverses
  // through the ordinary letter + sign path.
  const pranava = source.pranava;
  if (pranava !== null && pranava !== '' && pranava.length === 1) {
    text = text.split(pranava).join(' OM ');
  }
  // Longest-first so a two-character sign is matched before its first half.
  const letterEntries = [...BY_IAST.values()]
    .map((p) => ({
      iast: p.iast,
      glyph: letterFor(p, from),
      // An approximation is a FORWARD-only mapping unless it is marked: see
      // `VS_APPROX` in ./lossless.ts.
      approx: isApproximation(p.id, from),
    }))
    .filter((e): e is { iast: string; glyph: string; approx: boolean } =>
      e.glyph !== null && e.glyph !== '')
    .sort((a, b) => b.glyph.length - a.glyph.length);
  const signEntries = [...SIGN_BY_IAST.values()]
    .map((s) => ({ iast: s.iast, glyph: signFor(s, from) }))
    .filter((e): e is { iast: string; glyph: string } => e.glyph !== null && e.glyph !== '')
    .sort((a, b) => b.glyph.length - a.glyph.length);

  // A Tamil glyph that stands for several IAST letters: record the alternatives.
  const alternativesFor = (glyph: string): string[] =>
    letterEntries.filter((e) => e.glyph === glyph).map((e) => e.iast);
  /** A multi-character approximation matches only when VS16 follows it. */
  const matchable = (e: { glyph: string; approx: boolean }, at: number): boolean => {
    if (!e.approx || e.glyph.length === 1) return true;
    return text.startsWith(e.glyph + VS_APPROX, at);
  };

  const ambiguous: ToIastResult['ambiguous'] = [];
  let out = '';
  let i = 0;
  let pendingConsonant = false;

  while (i < text.length) {
    if (virama !== '' && text.startsWith(virama, i)) {
      // A virāma suppresses the inherent `a`. What follows may be a conjunct
      // control, which becomes the `cj` flag rather than a character.
      i += virama.length;
      if (text[i] === ZWNJ || text[i] === ZWJ) {
        // Emit the control itself, not its ASCII spelling: what comes out of a
        // reverse conversion has to be what goes back in.
        out += text[i];
        i += 1;
      }
      pendingConsonant = false;
      continue;
    }
    const sign = signEntries.find((e) => text.startsWith(e.glyph, i));
    if (sign !== undefined && pendingConsonant) {
      out += sign.iast;
      i += sign.glyph.length;
      pendingConsonant = false;
      continue;
    }
    if (text.startsWith(' OM ', i)) {
      if (pendingConsonant) out += 'a';
      out += 'oṁ';
      pendingConsonant = false;
      i += 4;
      continue;
    }
    const letter = letterEntries.find((e) => text.startsWith(e.glyph, i) && matchable(e, i));
    if (letter !== undefined) {
      if (pendingConsonant) out += 'a'; // the inherent vowel
      i += letter.glyph.length;
      const alts = alternativesFor(letter.glyph);
      // A variation selector resolves the ambiguity EXACTLY (./lossless.ts).
      const vs = text[i] !== undefined && isVariationSelector(text[i]!) ? text[i]! : '';
      if (vs !== '') i += 1;
      if (vs === VS_APPROX && alts.length === 1) {
        out += letter.iast;
        pendingConsonant = false;
        continue;
      }
      let chosen: string;
      if (alts.length > 1) {
        chosen = letterFromSelector(letter.glyph, vs, from) ?? alts[0]!;
        if (vs === '' && !lossless) {
          // Plain text: the bare glyph reads as the group's default, and the
          // caller is TOLD so rather than left to assume it was exact.
          ambiguous.push({
            at: out.length, from: letter.glyph, chose: chosen, alternatives: alts,
          });
        }
      } else {
        chosen = letter.iast;
      }
      out += chosen;
      const p = BY_IAST.get(chosen);
      pendingConsonant = p !== undefined && p.type === 'consonant';
      continue;
    }
    if (pendingConsonant) {
      out += 'a';
      pendingConsonant = false;
    }
    out += text[i]!;
    i += 1;
  }
  if (pendingConsonant) out += 'a';
  return { iast: out, ambiguous };
}
