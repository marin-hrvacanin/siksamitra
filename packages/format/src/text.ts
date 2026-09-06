/**
 * What a document SAYS — the operations every reader must agree on.
 *
 * These live in `format` rather than in a renderer because they are the
 * conformance surface: two independent implementations of the format have to
 * produce the same answers here, and an answer is only comparable if it is
 * DERIVED. A conformance fixture that asserts the tokens a document contains
 * tests nothing, because echoing the input satisfies it; a fixture that asserts
 * the recitation text, the holding spans and the resolved provenance cannot be
 * satisfied by echoing anything.
 *
 * Each function below is a reader obligation that a naive implementation gets
 * wrong in a specific, checkable way — which is exactly why they are here.
 */

import type {
  ChantDoc, ChantScriptKey, ChantSection, ChantToken, ChantUnit, ChantVerse,
} from './chant.js';

/**
 * The text as it is RECITED, in one script.
 *
 * Three obligations a reader can silently fail, each of which this encodes:
 *
 *   1. **A slot is transparent.** `{t:'slot'}` carries its own token list and a
 *      reader must descend into it. A reader that treats the union as flat
 *      drops the contents entirely — and slot contents are real syllables that
 *      are really chanted.
 *   2. **A placeholder is never emitted.** `{t:'text', fill:true,
 *      placeholder:true}` is the marker standing where a reciter has not yet
 *      supplied a name or a gotra. It is shown on screen and it is NOT text:
 *      leaking it puts "(your name)" into the recitation, into a copy, and into
 *      an export.
 *   3. **Numbering and rules are not speech.** `num` and `bar` are structure. A
 *      reader that concatenates every token with an `s` recites the verse
 *      numbers.
 */
export function recitationText(
  tokens: readonly ChantToken[],
  script: ChantScriptKey,
): string {
  let out = '';
  for (const t of tokens) {
    switch (t.t) {
      case 'syl':
        out += script === 'iast' ? t.iast : (t[script] ?? t.deva ?? t.iast);
        break;
      case 'text':
        // The one token whose CONTENT depends on whether it is a placeholder.
        if (t.placeholder === true) break;
        out += script === 'iast' ? t.s : (t[script] ?? t.s);
        break;
      case 'slot':
        out += recitationText(t.tokens, script);
        break;
      case 'sp':
        out += ' ';
        break;
      case 'br':
        out += '\n';
        break;
      case 'danda':
        out += t.s;
        break;
      case 'pause':
        // A pause is silence with a duration. It is part of the recitation and
        // has no glyph of its own, so it is written as a marker rather than
        // dropped — dropping it would make a short and a long pause identical.
        out += t.len === 'long' ? '‖' : '|';
        break;
      case 'num':
      case 'bar':
        // Structure, not speech.
        break;
    }
  }
  return out;
}

/** Every syllable, in order, descending into slots. */
export function syllablesOf(tokens: readonly ChantToken[]): ChantToken[] {
  const out: ChantToken[] = [];
  for (const t of tokens) {
    if (t.t === 'syl') out.push(t);
    else if (t.t === 'slot') out.push(...syllablesOf(t.tokens));
  }
  return out;
}

/** How many syllables a verse has. Counts inside slots — they are recited. */
export function syllableCount(tokens: readonly ChantToken[]): number {
  return syllablesOf(tokens).length;
}

/**
 * The holding boxes of a verse, as spans over its letters.
 *
 * A box spanning several letters is ONE `hg` shared by them, not one `hold` per
 * letter. A reader that draws a box per `hold` renders a multi-letter holding
 * as a row of little boxes — which is the difference between a conjunct marked
 * as one unit and marked as several, and it is visible on the page.
 *
 * Letters are numbered across the whole verse so a span can be stated without
 * reference to the token structure, which is what lets another implementation
 * compare its answer to this one.
 */
export interface HoldingSpan {
  readonly group: number | null;
  readonly len: 'short' | 'long';
  readonly from: number;
  readonly to: number;
  readonly letters: string;
}

export function holdingSpans(tokens: readonly ChantToken[]): HoldingSpan[] {
  const spans: HoldingSpan[] = [];
  let offset = 0; // letters counted across the verse, for stable span numbers

  for (const syl of syllablesOf(tokens)) {
    if (syl.t !== 'syl') continue;
    const units: readonly ChantUnit[] = syl.units;

    // A box is a CONTIGUOUS run of units sharing `hold` and `hg`, within one
    // syllable — `ChantUnit.hg` says so ("adjacent units sharing hold+hg share
    // ONE box") and the renderer scans exactly this way.
    //
    // Collecting every unit with a given `hg` and taking min/max instead is
    // wrong twice over: group ids repeat along a verse, so distant runs merge
    // into one span, and a run that ends and restarts becomes a single box
    // swallowing everything between. It produced an 80-letter "box" here before
    // this was checked against the renderer.
    let i = 0;
    while (i < units.length) {
      const u = units[i]!;
      if (u.hold === undefined) { i += 1; continue; }
      const len = u.hold;
      const group = u.hg;
      let j = i;
      while (j < units.length && units[j]!.hold === len && units[j]!.hg === group) j += 1;
      spans.push({
        group: group ?? null,
        len,
        from: offset + i,
        to: offset + j - 1,
        letters: units.slice(i, j).map((x) => x.c).join(''),
      });
      i = j;
    }
    offset += units.length;
  }

  return spans;
}

/**
 * The citation that applies to a verse.
 *
 * Provenance is INHERITABLE: a verse without its own resolves to its section's,
 * and a section without one to the document's. A reader that only looks at the
 * verse reports most of the corpus as having no source at all, which is the
 * quiet failure this makes checkable.
 */
export function resolveSource(
  doc: ChantDoc,
  section: ChantSection,
  verse: ChantVerse,
): { source: string | null; from: 'verse' | 'section' | 'document' | 'none' } {
  if (verse.source != null && verse.source !== '') {
    return { source: verse.source, from: 'verse' };
  }
  if (section.source != null && section.source !== '') {
    return { source: section.source, from: 'section' };
  }
  if (doc.source != null && doc.source !== '') {
    return { source: doc.source, from: 'document' };
  }
  return { source: null, from: 'none' };
}

/**
 * Are this verse's marks attested — that is, must they NOT be re-derived?
 *
 * Rule zero. A verse whose source layer is absent OR EMPTY came from a witness,
 * and regenerating its marks destroys evidence that recomputation cannot
 * restore.
 *
 * The "or empty" is the part that was inconsistent: the CLI treated an empty
 * `src.lines` as attested and the conformance gate treated only an absent `src`
 * that way, so the two disagreed about the single most important rule in the
 * format. One definition, exported, so callers cannot each invent their own.
 */
export function isAttested(verse: ChantVerse): boolean {
  const lines = verse.src?.lines;
  return lines === undefined || lines.length === 0;
}
