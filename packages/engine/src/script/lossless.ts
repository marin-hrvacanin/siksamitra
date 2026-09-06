/**
 * Lossless interchange between scripts.
 *
 * THE PROBLEM. Devanāgarī and Telugu carry every distinction IAST does, so they
 * round-trip exactly. Tamil does not: its native orthography has no aspiration
 * and no voicing contrast, so `k`, `kh`, `g` and `gh` are all `க` — one glyph
 * standing for four sounds. Written Tamil is correct and it is lossy, and that
 * is a property of the script, not of our tables.
 *
 * THE ANSWER, and it is the same trick the conjunct boundary uses (01 §2.5):
 * encode what the glyph cannot show, in a character that renders as nothing.
 *
 * VARIATION SELECTORS (U+FE00–U+FE0F) are built for exactly this. The Unicode
 * standard defines a variation selector as affecting the APPEARANCE of the
 * preceding base character and nothing else, and a font with no such variation
 * sequence renders the base glyph unchanged. So `க` + VS1 is `kh`, `க` + VS2 is
 * `g`, `க` + VS3 is `gh`, and every one of them draws as a plain `க`.
 *
 * Why not the alternatives:
 *   - ZWNJ / ZWJ are already the conjunct controls, and worse, they CHANGE
 *     SHAPING — a ZWNJ after a consonant suppresses the ligature, so using them
 *     to carry an unrelated distinction would corrupt the rendering.
 *   - U+200B ZERO WIDTH SPACE is a line-break opportunity, so it can move a
 *     line break.
 *   - a combining mark has nowhere to go: above and below the letter are
 *     already occupied by svarita, dīrgha-svarita, anudātta and the box.
 *
 * WHERE THIS APPLIES. `lossless` is OPT-IN. Plain `tam` output must stay
 * byte-identical to the eleven shipped documents, so the default emits no
 * selectors. Lossless mode is for interchange: export, copy-paste, and a
 * round-trip test.
 *
 * WHAT IS ALREADY LOSSLESS WITHOUT IT. Inside the system, conversion is
 * lossless by construction: IAST is canonical, every syllable stores all script
 * forms DERIVED from it, and no derived form is ever the source. Switching the
 * reader from Devanāgarī to Tamil and back cannot lose anything, because the
 * Tamil is regenerated rather than parsed. Lossless mode matters when a Tamil
 * string leaves the system and has to come back.
 *
 * See specs/chant-editor/02-ENGINE.md §13.
 */
import { BY_IAST, PHONEMES, letterFor } from './tables.js';
import type { ScriptKey } from './tables.js';

/**
 * The "this is an approximation" marker — VS16, kept clear of the ordinals.
 *
 * A second kind of ambiguity exists alongside the glyph collisions. Tamil has
 * no vocalic `ṛ`, so it is written with the APPROXIMATION `ரு` — which is also
 * exactly what `r` + `u` produces. So the collision is not between two letters
 * sharing a glyph, it is between one letter's approximation and a legitimate
 * letter-plus-vowel-sign sequence, and an ordinal cannot express it.
 *
 * In lossless mode a multi-character approximation therefore carries VS16, and
 * the reverse parser matches such an approximation ONLY when the marker is
 * present. Plain mode emits nothing, so `புருஷ` stays exactly as it ships.
 */
export const VS_APPROX = String.fromCodePoint(0xfe0f);

/** U+FE00 … U+FE0F — fifteen usable selectors, VS1 through VS16. */
const VS_BASE = 0xfe00;
const VS_MAX = 15;

const VS_RE = /[︀-️]/;

/** Is this script's rendering of the phoneme an approximation rather than a
 *  letter of its own? */
export function isApproximation(
  p: { tam: string | null; tamApprox?: string },
  script: ScriptKey,
): boolean {
  return script === 'tam' && p.tam === null && p.tamApprox !== undefined;
}

/** Is this a variation selector? */
export function isVariationSelector(ch: string): boolean {
  const cp = ch.codePointAt(0);
  return cp !== undefined && cp >= VS_BASE && cp <= VS_BASE + VS_MAX;
}

/**
 * For one script: every glyph that stands for more than one IAST letter, and
 * the IAST letters it stands for, in table order.
 *
 * Computed from the tables, so adding a script or a letter cannot leave this
 * out of date.
 */
function collisionsFor(script: ScriptKey): Map<string, string[]> {
  const byGlyph = new Map<string, string[]>();
  for (const p of PHONEMES) {
    const g = letterFor(p, script);
    if (g === null || g === '') continue;
    const list = byGlyph.get(g);
    if (list === undefined) byGlyph.set(g, [p.iast]);
    else list.push(p.iast);
  }
  for (const [g, list] of [...byGlyph]) if (list.length < 2) byGlyph.delete(g);
  return byGlyph;
}

const COLLISIONS: Record<ScriptKey, Map<string, string[]>> = {
  iast: new Map(),
  deva: collisionsFor('deva'),
  tel: collisionsFor('tel'),
  tam: collisionsFor('tam'),
};

/** Which IAST letters a script cannot tell apart. Empty for a lossless script. */
export function ambiguitiesIn(script: ScriptKey): { glyph: string; letters: string[] }[] {
  return [...COLLISIONS[script]].map(([glyph, letters]) => ({ glyph, letters }));
}

/** Is this script lossless on its own, with no selectors? */
export function isLosslessScript(script: ScriptKey): boolean {
  return COLLISIONS[script].size === 0;
}

/**
 * The selector that disambiguates `iast` when written in `script`, or `''` when
 * none is needed — either the script is unambiguous here, or this letter is the
 * group's first member and therefore the unmarked default.
 *
 * The default is the FIRST table entry of the group, which is the unaspirated
 * voiceless letter (`k` of `k/kh/g/gh`). That is the conventional reading of a
 * bare Tamil glyph, so unmarked text reads correctly.
 */
export function selectorFor(iast: string, script: ScriptKey): string {
  const p = BY_IAST.get(iast);
  if (p === undefined) return '';
  const glyph = letterFor(p, script);
  if (glyph === null) return '';
  const group = COLLISIONS[script].get(glyph);
  if (group === undefined) {
    // No glyph collision — but a multi-character approximation still needs the
    // marker, or `ரு` (`ṛ`) is indistinguishable from `ர` + `ு` (`ru`).
    return isApproximation(p, script) && glyph.length > 1 ? VS_APPROX : '';
  }
  const ordinal = group.indexOf(iast);
  if (ordinal <= 0) return '';
  if (ordinal > VS_MAX) return ''; // no group is remotely this large
  return String.fromCodePoint(VS_BASE + ordinal - 1);
}

/**
 * Read a selector back: which IAST letter does `glyph` + `selector` mean?
 * Returns `null` when the pair is not a known variation sequence.
 */
export function letterFromSelector(
  glyph: string,
  selector: string,
  script: ScriptKey,
): string | null {
  const group = COLLISIONS[script].get(glyph);
  if (group === undefined) return null;
  if (selector === '') return group[0] ?? null;
  const cp = selector.codePointAt(0);
  if (cp === undefined || cp < VS_BASE || cp > VS_BASE + VS_MAX) return null;
  return group[cp - VS_BASE + 1] ?? null;
}

/** Strip every variation selector — for display, or for comparing against
 *  output that was produced without them. */
export function stripSelectors(text: string): string {
  return text.replace(new RegExp(VS_RE.source, 'g'), '');
}

/** Does this text carry any lossless-mode markers? */
export function hasSelectors(text: string): boolean {
  return VS_RE.test(text);
}
