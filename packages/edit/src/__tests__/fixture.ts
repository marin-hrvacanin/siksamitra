/**
 * A document built by the real engine, for the editing tests.
 *
 * Built by DERIVING, not by hand-writing tokens. A hand-written fixture is a
 * second implementation of `emit` — it drifts, and then the tests pass against
 * a document shape the program never produces. This is the same lesson the
 * conformance suite learned the expensive way.
 */
import { derive } from '@siksamitra/engine';
import type { ChantDoc, ChantSection, ChantVerse } from '@siksamitra/format';

export function verse(id: string, lines: string[], n?: string): ChantVerse {
  const d = derive({ lines }, undefined, { verseId: id, trace: false });
  return {
    id,
    ...(n === undefined ? {} : { n }),
    tokens: d.tokens,
    src: { lines: [...d.srcMap.lines] },
  };
}

/** A verse with NO source layer: transcribed, and rule zero applies to it. */
export function attested(id: string, lines: string[]): ChantVerse {
  const { src: _dropped, ...rest } = verse(id, lines);
  return rest;
}

/**
 * A transcribed verse the engine CANNOT reproduce.
 *
 * `attested` takes a derived verse and removes its source layer, so the engine
 * reproduces it perfectly — which made it useless for testing `adoptSource`.
 * Every fixture adopted with zero witnesses, the refusal branch never ran, and
 * three separate mutations proved it: deleting the witness loop, deleting the
 * whole-stream check, and swapping `invertVerse` for `linesFromTokens` each
 * left all 812 tests green.
 *
 * This one carries marks a derivation will not produce. `hand` names the
 * letters to force a holding onto, by index across the verse's letters; the
 * engine will disagree about those, so the witness loop has work to do and
 * step four has something to verify.
 */
export function handMarked(
  id: string,
  lines: string[],
  hand: readonly number[],
): ChantVerse {
  const base = attested(id, lines);
  let i = -1;
  const tokens = base.tokens.map((t) => {
    if (t.t !== 'syl') return t;
    return {
      ...t,
      units: t.units.map((u) => {
        i += 1;
        if (!hand.includes(i)) return u;
        /* A group of its own, so it is one box and the invariants hold. */
        return { ...u, hold: 'long' as const, hg: 900 + i };
      }),
    };
  });
  return { ...base, tokens };
}

export function section(id: string, verses: ChantVerse[]): ChantSection {
  return { id, title: id, verses };
}

export function doc(sections: ChantSection[]): ChantDoc {
  return {
    title: 'test',
    titleForms: { iast: 'test' },
    sections,
    version: 4,
  };
}

/** The ordinary case: one section, three derived verses. */
export const sample = (): ChantDoc => doc([
  section('s1', [
    verse('v-1', ['agnim īḷe purohitaṁ'], '1'),
    verse('v-2', ['yajñasya devam ṛtvijam'], '2'),
    verse('v-3', ['hotāraṁ ratnadhātamam'], '3'),
  ]),
]);
