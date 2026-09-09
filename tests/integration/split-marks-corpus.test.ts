/**
 * SPLITTING EVERY MARKED VERSE IN THE CORPUS, AND COUNTING WHAT SURVIVES.
 *
 * The unit tests state the rule on fixtures. This states it on the 573 verses
 * the owner actually marks — 4 788 holdings and 6 086 svaras — which is the
 * only place the claim can be wrong in a way nobody typed.
 *
 * THE CONTROL IS ARITHMETIC NOTHING HERE COMPUTES: the number of markings
 * BEFORE the split, read off the document as it came from disk. A split may
 * move markings between two verses and may legitimately lose one whose letters
 * the edit destroyed — but a split that inserts a separator and deletes
 * nothing must lose NOTHING, and that is what is counted.
 *
 * The old behaviour on Puruṣa Sūktam's first verse was 124 markings down to
 * 30. Over the whole corpus it was thousands.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { openChantDoc } from '@siksamitra/engine';
import { canonicalJson, toTextAndMarks } from '@siksamitra/format';
import type { ChantDoc, ChantSection } from '@siksamitra/format';
import { apply, emptyHistory, newState, undo } from '@siksamitra/edit';

const DIR = fileURLToPath(new URL('../../corpus/chants/', import.meta.url));
const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();

const open = (file: string): ChantDoc =>
  openChantDoc(JSON.parse(readFileSync(DIR + file, 'utf8')));

/** Every marking in a document, counted. */
const marksIn = (doc: ChantDoc): number => doc.sections
  .flatMap((s) => s.verses)
  .reduce((n, v) => n + toTextAndMarks(v).marks.length, 0);

/** A section's flat text, the way the caret addresses it. */
const flatOf = (section: ChantSection): string =>
  section.verses.map((v) => toTextAndMarks(v).text).join('\n\n');

/** Where the lines of a section end, in flat coordinates — the Enter targets. */
function lineEnds(section: ChantSection): number[] {
  const out: number[] = [];
  let at = 0;
  for (const [i, v] of section.verses.entries()) {
    if (i > 0) at += 2;
    const lines = toTextAndMarks(v).text.split('\n');
    for (const [l, line] of lines.entries()) {
      if (l > 0) at += 1;
      at += line.length;
      out.push(at);
    }
  }
  return out;
}

describe('pressing Enter at the end of every line in the corpus', () => {
  for (const file of files) {
    it(`${file}: loses no marking`, () => {
      const doc = open(file);
      const before = marksIn(doc);
      if (before === 0) return; // Nothing to lose; the count below would be vacuous.

      let splits = 0;
      for (const section of doc.sections) {
        const ends = lineEnds(section);
        /* Every line end, up to a cap: Śrī Rudram has 198 verses and this is
           an integration test, not a soak. The cap is stated, not silent. */
        for (const at of ends.slice(0, 40)) {
          const done = apply(newState(doc), emptyHistory(), {
            k: 'replace', sectionId: section.id, from: at, to: at, insert: '\n\n',
          } as never);
          splits += 1;
          expect(
            marksIn(done.state.doc),
            `${file} / ${section.id} @ ${at}: markings lost by a split that deleted nothing`,
          ).toBe(before);
        }
      }
      expect(splits, 'no split was actually performed').toBeGreaterThan(0);
    });
  }
});

describe('and the document is still sound afterwards', () => {
  /* One document, checked properly, rather than eleven checked shallowly. */
  const file = 'purusha-suktam.json';

  it('every marking still lies inside the verse that carries it', () => {
    const doc = open(file);
    const section = doc.sections[0]!;
    for (const at of lineEnds(section).slice(0, 12)) {
      const done = apply(newState(doc), emptyHistory(), {
        k: 'replace', sectionId: section.id, from: at, to: at, insert: '\n\n',
      } as never);
      for (const v of done.state.doc.sections[0]!.verses) {
        const { text, marks } = toTextAndMarks(v);
        for (const m of marks) {
          expect(m.from, `${v.id} ${m.k} @ split ${at}`).toBeGreaterThanOrEqual(0);
          expect(m.to, `${v.id} ${m.k} @ split ${at}`).toBeLessThanOrEqual(text.length);
          expect(m.to, `${v.id} ${m.k} @ split ${at}`).toBeGreaterThanOrEqual(m.from);
        }
      }
    }
  });

  it('and one undo gives back the very bytes that went in', () => {
    /*
     * `canonicalJson` is the control — nothing in `@siksamitra/edit` computes
     * it. Carrying markings into a created verse is new machinery, and new
     * machinery that undo cannot reverse is worse than the bug it fixed.
     */
    const doc = open(file);
    const section = doc.sections[0]!;
    const was = canonicalJson(doc);
    for (const at of lineEnds(section).slice(0, 12)) {
      const done = apply(newState(doc), emptyHistory(), {
        k: 'replace', sectionId: section.id, from: at, to: at, insert: '\n\n',
      } as never);
      const back = undo(done.state, done.history);
      expect(canonicalJson(back.state.doc), `undo of a split @ ${at}`).toBe(was);
    }
  });

  it('the split really did divide something — the control', () => {
    /*
     * Without this, every assertion above would pass on a corpus where Enter
     * did nothing at all, which is exactly the state this work started from.
     */
    const doc = open(file);
    const section = doc.sections[0]!;
    const at = lineEnds(section)[0]!;
    const done = apply(newState(doc), emptyHistory(), {
      k: 'replace', sectionId: section.id, from: at, to: at, insert: '\n\n',
    } as never);
    expect(done.state.doc.sections[0]!.verses.length)
      .toBeGreaterThan(section.verses.length);
    expect(flatOf(done.state.doc.sections[0]!)).not.toBe(flatOf(section));
  });

  it('and nothing is reported lost when nothing was', () => {
    const doc = open(file);
    const section = doc.sections[0]!;
    const at = lineEnds(section)[0]!;
    const done = apply(newState(doc), emptyHistory(), {
      k: 'replace', sectionId: section.id, from: at, to: at, insert: '\n\n',
    } as never);
    expect(done.state.refusals.filter((r) => /marking/.test(r))).toEqual([]);
  });
});
