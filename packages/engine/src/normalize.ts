/**
 * Input normalisation — any input, one canonical IAST.
 *
 * Every transformation that CHANGES a character is reported, so an import can
 * be audited rather than trusted. Silent normalisation is how a defect ships:
 * `mantra-pushpam.json` went out with a bare candrabindu and no reading aid
 * because accented Devanāgarī writes the gum as U+A8F3 and nothing folded it.
 *
 * See docs/MARKING-RULES.md §1 and specs/chant-editor/02-ENGINE.md §4.
 */
import { ANU, ZWJ, ZWNJ } from './alphabet.js';

export interface Normalisation {
  /** A stable id, so a report can group and count them. */
  rule: string;
  from: string;
  to: string;
  count: number;
  /** Shown to the author when the change is not self-evidently safe. */
  note?: string;
}

export interface NormalizeResult {
  text: string;
  changes: Normalisation[];
}

interface Fold {
  rule: string;
  from: RegExp;
  to: string;
  label: string;
  note?: string;
}

/**
 * Ordered. The Vedic-anusvāra fold must run before anything that reads an
 * anusvāra, which is why it is not left to the caller.
 */
const FOLDS: readonly Fold[] = [
  // Devanāgarī accent signs → the IAST combining marks (sanskrit_rules.js ~L293).
  { rule: 'svara.udatta-sign', from: /॑/g, to: '̍', label: '॑ → ◌̍' },
  { rule: 'svara.anudatta-sign', from: /[̡॒̲̠]/g, to: '̱', label: '॒ → ◌̱' },
  { rule: 'svara.dirgha-sign', from: /[᳚́]/g, to: '̎', label: '᳚ → ◌̎' },
  // One anusvāra spelling.
  { rule: 'anusvara.mm', from: /ṃ/g, to: ANU, label: 'ṃ → ṁ' },
  /**
   * THE TRAP. Accented Devanāgarī writes the gum as U+A8F3 `ꣳ` (sometimes
   * `ँ`). Transliterated straight it yields a pre-formed `m̐`, which the gum
   * rule then SKIPS — because that pass keys on an underlying `ṁ` — and the
   * result ships a candrabindu with no reading aid at all, visibly wrong beside
   * every other Taittirīya text in the Library.
   */
  {
    rule: 'anusvara.vedic-sign',
    from: /[ꣳँ]/g,
    to: ANU,
    label: 'ꣳ / ँ → ṁ',
    note: 'the Vedic anusvāra sign is folded to the underlying ṁ so the gum can be derived',
  },
  // Dravidian orthography's long marks.
  { rule: 'vowel.o-macron', from: /ō/g, to: 'o', label: 'ō → o' },
  { rule: 'vowel.e-macron', from: /ē/g, to: 'e', label: 'ē → e' },
  // Śikṣāmitra's own input convention for the gum.
  { rule: 'anusvara.paren-gm', from: /\((?:g|gg)\)m/g, to: ANU, label: '(g)m → ṁ' },
  /**
   * The conjunct controls, from their ASCII authoring forms. Folded BEFORE the
   * daṇḍa rules so `_`/`+` can never be read as anything else, and before the
   * hyphen→space collapse below.
   */
  { rule: 'conjunct.split', from: /_/g, to: ZWNJ, label: '_ → ZWNJ' },
  { rule: 'conjunct.join', from: /\+/g, to: ZWJ, label: '+ → ZWJ' },
  // Daṇḍa normalisation. `..` first, or `.` eats it.
  { rule: 'danda.double', from: /\.\./g, to: '॥', label: '.. → ॥' },
  { rule: 'danda.single', from: /\./g, to: '।', label: '. → ।' },
];

/**
 * The `ॐ` ligature cannot carry an accent, and printed editions exploit that:
 * U+0950 is one glyph with no room for U+0951/U+0952/U+1CDA, so an edition that
 * sets `oṁ` as `ॐ` silently drops any accent the syllable has in recitation.
 * Mantra Puṣpam carries a dīrgha-svarita on every one of its six praṇavas in
 * the recitation witnesses, and importing from the ligature lost all six.
 */
const OM_LIGATURE = /ॐ/g;

/**
 * Fold input to canonical IAST, reporting every change.
 *
 * Lower-casing, comma → space and whitespace collapse are `gen_marks.norm` and
 * are NOT reported: they alter no letter's identity.
 *
 * THE HYPHEN IS KEPT. `gen_marks.norm` collapsed it to a space, which is right
 * for every rule — it is orthographic, it neither adds nor resets a syllable
 * count, and it is not a saṁyukta barrier because a space is not one either —
 * but collapsing it in `norm` DELETED it, and the shipped corpus carries 469 of
 * them as coda units (`rā-` in `chaṁyorā-vṛṇīmahe`). Re-deriving such a verse
 * silently lost the hyphen. It is now lexed as its own element, treated exactly
 * as a word boundary by the rules, and written back by `emit`.
 */
export function normalize(input: string): NormalizeResult {
  let text = input;
  const changes: Normalisation[] = [];

  const om = text.match(OM_LIGATURE);
  if (om) {
    text = text.replace(OM_LIGATURE, 'oṁ');
    changes.push({
      rule: 'pranava.ligature',
      from: 'ॐ',
      to: 'oṁ',
      count: om.length,
      note:
        'the ॐ ligature cannot carry an accent — check an accented recitation ' +
        'witness before assuming these syllables are unaccented',
    });
  }

  for (const f of FOLDS) {
    const hits = text.match(f.from);
    if (!hits) continue;
    text = text.replace(f.from, f.to);
    changes.push({ rule: f.rule, from: f.label.split(' → ')[0]!, to: f.to, count: hits.length, ...(f.note ? { note: f.note } : {}) });
  }

  text = text.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  return { text, changes };
}

/**
 * `gen_marks.norm` exactly — for parity tests and internal callers.
 *
 * The conjunct controls are folded here too, so a caller that skips
 * `normalize()` still gets them: they are zero-width and must never survive as
 * `_`/`+`, which would be lexed as letters.
 */
export function norm(s: string): string {
  return s
    .replace(/_/g, ZWNJ)
    .replace(/\+/g, ZWJ)
    .toLowerCase()
    .replace(/ṃ/g, ANU)
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
