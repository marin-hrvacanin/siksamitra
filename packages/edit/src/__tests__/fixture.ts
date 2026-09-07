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
