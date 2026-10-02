/**
 * THE PIECES A WORD BODY IS BUILT OF — the style each of the page's elements
 * is written in, one run, one paragraph, and where a space belongs to a box.
 * Out of `body.ts` at the module gate; that file is what is written where, and
 * this is what each thing is written as.
 */
import type { ChantToken, ChantUnit } from '@siksamitra/format';
import { ROLE_OF_ELEMENT } from '@siksamitra/tokens/document-type';
import { WORD_MARKS } from '@siksamitra/tokens/word';
import { xmlEscape } from '../xml.js';
import { PARA_STYLE_OF } from './styles.js';
import type { WordMedia } from './drawing.js';

/**
 * Which Word style each of the page's elements is written in.
 *
 * READ OFF THE PAGE, through the two tables that already exist:
 * `ROLE_OF_ELEMENT` says which type role a class name takes and
 * `PARA_STYLE_OF` says which of his paragraph styles that role is. So the
 * `.docx` cannot put a section heading at a different level from the one the
 * page draws it at — which it did, until this was measured: `doc__part` came
 * out as Heading2 where the page sets it as Heading3, two points larger and at
 * the wrong indent.
 */
export const styleOf = (element: keyof typeof ROLE_OF_ELEMENT): string => {
  const found = PARA_STYLE_OF[ROLE_OF_ELEMENT[element]];
  if (found === undefined) throw new Error(`no Word paragraph style for ${element}`);
  return found;
};

/**
 * The hold group a space falls inside, if it falls inside one.
 *
 * A `sp` written unstyled inside a holding closes the box and opens a new
 * one, so a box spanning two words draws as two rectangles. The space takes
 * the group's own style when the letters on both sides of it are in the
 * same group — which is the only case where one rectangle is what was
 * meant. Shared by every script's writer (`script-runs.ts`).
 */
export function bridging(tokens: readonly ChantToken[], at: number): ChantUnit | null {
  let before: ChantUnit | null = null;
  for (let k = at - 1; k >= 0; k -= 1) {
    const t = tokens[k]!;
    if (t.t === 'syl') { before = t.units[t.units.length - 1] ?? null; break; }
    if (t.t !== 'sp') return null;
  }
  for (let k = at + 1; k < tokens.length; k += 1) {
    const t = tokens[k]!;
    if (t.t === 'syl') {
      const after = t.units[0];
      if (before === null || after === undefined) return null;
      /* BOTH must be in the SAME NUMBERED group. Comparing only `hold`
         matched two ADJACENT boxes with no group id at all — `undefined`
         equals `undefined` — and the styled space between them was then
         swallowed by the importer, turning `dadan naḥ` into `dadannaḥ`. */
      return before.hold !== undefined && before.hg !== undefined
        && before.hold === after.hold && before.hg === after.hg ? before : null;
    }
    if (t.t !== 'sp') return null;
  }
  return null;
}

/** A unit's character-style signature, so a run covers only letters that agree. */
export const signature = (u: ChantUnit): string =>
  `${u.hold ?? '-'}/${u.hg ?? '-'}/${u.change === true ? 'c' : '-'}`;

/**
 * What a picture needs in order to be drawn: its bytes' place in the package,
 * and the column the five width steps are a fraction of.
 *
 * Optional as a whole, because two callers — the add-in's paragraph reader and
 * the determinism check — want the paragraphs and not the pictures. Without it
 * a figure writes its alternative text, which is what the page does for a
 * picture whose bytes are not there either.
 */
export interface WordPictures {
  /** Keyed by the picture's `src`, so one photograph is one part. */
  readonly media: ReadonlyMap<string, WordMedia>;
  /** The section's content width, in EMU. */
  readonly columnEmu: number;
}

/**
 * ONE RUN OF TEXT, in a character style.
 *
 * Module-level and exported, rather than a closure inside `documentXml`,
 * because the Word add-in needs it too: its style specimen has to write a run
 * in `VedicAnusvara`, which is a style this writer READS out of the owner's
 * file and never produces, so there is no marked text that would emit one. A
 * second helper over there would be a second answer to what a run is — and
 * `w:rPr`'s children are a schema SEQUENCE, so a second answer is a file Word
 * calls corrupted.
 */
export const styledRun = (text: string, rStyle: string | null, sup = false, hidden = false): string =>
  /* `w:rPr` is a schema SEQUENCE: `rStyle`, then `vanish`, then `vertAlign`. */
  `<w:r>${rStyle === null && !sup && !hidden ? '' : `<w:rPr>${rStyle === null ? '' : `<w:rStyle w:val="${rStyle}"/>`}${hidden ? '<w:vanish/>' : ''}${sup ? '<w:vertAlign w:val="superscript"/>' : ''}</w:rPr>`}`
  + `<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;

/**
 * A DAṆḌA, in his face. Not a style: his files set every daṇḍa in Mangal as
 * direct formatting (`w:hint="cs"` — it is a Devanāgarī character, so Word
 * reads the complex-script slot), and the paragraph's Arial has no daṇḍa at all,
 * so a plain run was drawn in whatever fallback Word found. `rFonts` is the
 * first child `CT_RPr` allows after `rStyle`.
 */
export const dandaRun = (text: string): string => {
  const face = xmlEscape(WORD_MARKS.danda.face);
  return `<w:r><w:rPr><w:rFonts w:ascii="${face}" w:hAnsi="${face}" w:cs="${face}" w:hint="cs"/></w:rPr>`
    + `<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
};

/**
 * A PAUSE, UPRIGHT. A pause the rules place is in the substitution blue, as in
 * his files — and that style, `Anusvara`, is italic, so the bar leaned like a
 * slash (the owner, 2026-10-01: "why are pauses here in italic? Not good").
 * The style stays — it is what says the bar is a pause, to every reader — and
 * the slant is taken off by direct formatting (`i`/`iCs` off, which `CT_RPr`
 * puts after `rStyle`).
 */
export const pauseRun = (text: string, rStyle: string): string =>
  `<w:r><w:rPr><w:rStyle w:val="${rStyle}"/><w:i w:val="0"/><w:iCs w:val="0"/></w:rPr>`
  + `<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;

/** One paragraph, in a paragraph style. Exported for the same reason. */
export const styledParagraph = (style: string | null, runs: string, keepNext?: boolean): string =>
  `<w:p>${style === null ? '' : `<w:pPr><w:pStyle w:val="${style}"/>${keepNext === undefined ? '' : keepNext ? '<w:keepNext/>' : '<w:keepNext w:val="0"/>'}</w:pPr>`}${runs}</w:p>`;
