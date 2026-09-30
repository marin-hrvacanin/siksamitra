/**
 * THE SIGNS A SCRIPT WRITES THAT ARE NOT LETTERS — per script, once.
 *
 * The candrabindu and the digits. Both used to live in the app's renderer, and
 * the Word writer needs the same answers: a candrabindu `ँ` drawn on the page
 * and a different one written into a `.docx` is two programs disagreeing about
 * one document. They are script DATA, so they are the engine's, beside the
 * letter tables, and the renderer reads them from here.
 */
import type { ScriptKey } from './tables.js';
import { getScript } from './registry.js';
import { isVariationSelector } from './lossless.js';
import { toIast } from './index.js';

/**
 * The candrabindu, per script.
 *
 * TAMIL BORROWS THE GRANTHA SIGN, U+11300, because Tamil has none of its own —
 * exactly as this text already borrows the Grantha letters `ஜ ஷ ஸ ஹ ஶ`, which
 * is what Tamil Sanskrit has always done. It used to fall back to the IAST
 * combining mark U+0310, which Noto Serif Tamil has no glyph for, so the gum in
 * `தே³வீ` drew as an empty box on the page. Measured against a control, of the
 * four candidates only U+0310 fails in the shipped face.
 */
export const CANDRA_SIGN: Readonly<Record<ScriptKey, string>> = {
  iast: '̐', deva: 'ँ', tel: 'ఀ', tam: '\u{11300}',
};

/** Digits per script — a verse number is written in the script it is in. */
export const SCRIPT_DIGITS: Readonly<Record<ScriptKey, string>> = {
  iast: '0123456789',
  deva: '०१२३४५६७८९',
  tel: '౦౧౨౩౪౫౬౭౮౯',
  tam: '௦௧௨௩௪௫௬௭௮௯',
};

/** A number's digits in a script, and back to ASCII. */
export const digitsIn = (s: string, script: ScriptKey): string =>
  s.replace(/[0-9]/g, (d) => SCRIPT_DIGITS[script][Number(d)] ?? d);
export const digitsFrom = (s: string, script: ScriptKey): string => {
  const table = [...SCRIPT_DIGITS[script]];
  return [...s].map((c) => { const k = table.indexOf(c); return k < 0 ? c : String(k); }).join('');
};

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * A script text's CLUSTERS — the pieces a style may not cut inside.
 *
 * The platform's extended grapheme clusters, which keep an Indic conjunct whole
 * (`र्ष`, `న్ధు`) since Unicode 15.1 — with what they do not know about THIS
 * program's writing added: a Tamil qualifier (`க³`) and a lossless selector
 * are clusters of their own to Unicode, and mean nothing apart from the letter
 * before them, so each goes with it. A Word writer that styled `³` apart from
 * `க` put the next vowel's accent between them.
 */
export function scriptClusters(text: string, script: ScriptKey): { segment: string; index: number }[] {
  const qualifiers = getScript(script)?.qualifiers ?? '';
  const out: { segment: string; index: number }[] = [];
  const read = (t: string): string => toIast(t, script, { lossless: true }).iast;
  for (const grapheme of graphemes.segment(text)) {
    /* A mark with no letter under it — a candrabindu typed after a space —
       is one grapheme WITH the space, to Unicode, and the space went with
       it: `saṁskṛtam ̐ḥ` came back as one word. The space stands alone. */
    const lone = /^\s\p{M}/u.test(grapheme.segment);
    const pieces = lone
      ? [{ segment: grapheme.segment[0]!, index: grapheme.index }, { segment: grapheme.segment.slice(1), index: grapheme.index + 1 }]
      : [grapheme];
    for (const { segment, index } of pieces) {
      const first = segment[0] ?? '';
      const prev = out[out.length - 1];
      /*
       * A boundary is kept only where reading the two sides APART gives what
       * reading them together does. A qualifier or a selector never stands
       * alone, and neither does whatever a script writes in context — Tamil's
       * vocalic ṛ is the approximation `ரு` and an apostrophe, `ரு'`, and the
       * two read apart are `ru'`. Checked pairwise, as the text is walked, so
       * a line costs a reading per cluster and not per pair of them. Nothing
       * joins a space.
       */
      const tail = prev !== undefined && !/^\s+$/u.test(prev.segment)
        && (qualifiers.includes(first) || isVariationSelector(first)
          || read(prev.segment + segment) !== read(prev.segment) + read(segment));
      if (tail) prev!.segment += segment;
      else out.push({ segment, index });
    }
  }
  return out;
}
