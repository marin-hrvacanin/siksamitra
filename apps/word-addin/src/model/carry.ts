/**
 * WHAT WORD CAN AND CANNOT CARRY.
 *
 * A `.docx` body says a marking by naming a CHARACTER STYLE on a run, and the
 * vocabulary is the eleven styles in `packages/interop/src/word-styles.ts` —
 * his own. Five of the model's kinds have no style in it, and the honest thing
 * is to say which before writing rather than to let them evaporate. Each is
 * listed with what actually happens to it, and `notCarried` hands the list to
 * the task pane so a person is told.
 *
 * The whole of the loss, measured over the corpus by
 * `__tests__/round-trip.test.ts`: it is `cj` and `slot`, and neither occurs in
 * a marked verse of the eleven documents.
 *
 * NOTE FOR THE LOSSLESS PATH. None of this applies to a `.docx` written by
 * `exportWord`, which carries the document itself in a custom XML part
 * (`packages/interop/src/word/parts.ts`) and is exact. It applies to the BODY —
 * the runs a person sees and edits — which is the only thing an add-in marking
 * a paragraph can write.
 */
import type { Mark, MarkKind } from '@siksamitra/format';

export interface NotCarried {
  k: MarkKind;
  from: number;
  to: number;
  why: string;
}

/**
 * A marking Word's run vocabulary has no way to state, and what becomes of it.
 *
 * `syl` is absent from this list on purpose: a syllable boundary is DERIVED —
 * `syllabify` rebuilds it from the letters on the way back in — so dropping it
 * costs nothing. Everything here costs something.
 */
function loss(m: Mark): string | null {
  if (m.k === 'hold' && m.v === 'none') {
    return 'a suppressed holding has no style — Word can only draw a box, not '
      + 'the absence of one, so this is lost on save';
  }
  if (m.k === 'cj') {
    return 'a conjunct choice belongs to an Indic script and a .docx carries '
      + 'the IAST — the letters keep their text, the choice is lost';
  }
  if (m.k === 'slot') {
    return 'a variable slot has no style — its letters are written as ordinary '
      + 'text and it stops being a variable';
  }
  if (m.k === 'plain') {
    return 'prose inside a marked line is written as an ordinary run and reads '
      + 'back as recited text';
  }
  return null;
}

/** Everything in this list Word cannot state, with what happens to each. */
export function notCarried(marks: readonly Mark[]): NotCarried[] {
  const out: NotCarried[] = [];
  for (const m of marks) {
    const why = loss(m);
    if (why !== null) out.push({ k: m.k, from: m.from, to: m.to, why });
  }
  return out;
}

/**
 * The markings that survive being written as runs.
 *
 * A `hold: none` MUST be filtered rather than passed through: `documentXml`
 * reads any `hold` as a box and would draw a thin one, so "there is no holding
 * here" would print as a holding. `slot` is filtered so its letters stay in the
 * stream — the exporter skips a slot token whole, and its text would disappear
 * from the page.
 */
export function carriable(marks: readonly Mark[]): Mark[] {
  return marks.filter((m) => !(m.k === 'hold' && m.v === 'none') && m.k !== 'slot');
}
