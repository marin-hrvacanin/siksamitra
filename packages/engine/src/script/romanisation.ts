/**
 * The romanisations — IAST and ITRANS — read and written.
 *
 * A romanisation writes its vowels in line: there are no mātrās to fold into an
 * onset, so the forms concatenate and the syllable builder is not involved.
 * What it does need is a FORM BOUNDARY, because a romanisation's ambiguity is
 * at the sequence level rather than the glyph level — `sh` is both one
 * phoneme's form and the pair `s` + `h`.
 *
 * Split out of `index.ts` at the module gate. The Indic syllable builder is
 * there; this is the other half of the same table, for scripts that have no
 * akṣara to build.
 */
import { FORM_BOUNDARY, ZWJ, ZWNJ, cjControl } from '../alphabet.js';
import { formOf, type ScriptModule } from './module.js';
import { PHONEME_INVENTORY } from './phonemes.js';
import type { ScriptUnit, ToIastResult } from './index.js';


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
export function romanisationLossless(
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
export function romanisationToIast(text: string, module: ScriptModule): ToIastResult {
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
