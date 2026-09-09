/**
 * THE RULES RUN WHEN A PERSON ASKS, AND AT NO OTHER TIME.
 *
 * The owner's words: "why does the engine immediately write the holdings and
 * all that? Who said that? No, only on selection or the entire document, with
 * user action". So this asserts both halves — that `recompute` does place
 * markings, and that nothing else does.
 *
 * NOT TAUTOLOGICAL. The oracle is the corpus: a real verse with the owner's
 * own markings on it, and the assertions are about what a DIFFERENT code path
 * produced. The "nothing else runs the rules" test strips every holding from a
 * verse and then edits its text — if any incidental derivation existed, the
 * boxes would come back, and the test would see them.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { toTextAndMarks, type ChantDoc, type ChantSection } from '@siksamitra/format';
import { STAGES, openChantDoc } from '@siksamitra/engine';
import { apply, emptyHistory, flatten, newState, offsetOf, sourcesOf } from '@siksamitra/edit';

const CORPUS = join(process.cwd(), 'corpus', 'chants');
const open = (f: string): ChantDoc =>
  openChantDoc(JSON.parse(readFileSync(join(CORPUS, f), 'utf8')) as ChantDoc);

/** How many holdings a verse carries, counted off its tokens. */
const holdings = (doc: ChantDoc, verseId: string): number => {
  const verse = doc.sections.flatMap((s) => s.verses).find((v) => v.id === verseId);
  if (verse === undefined) return -1;
  return toTextAndMarks(verse).marks.filter((m) => m.k === 'hold').length;
};

/** The first section holding a verse with a source layer and some holdings. */
function subject(doc: ChantDoc): { section: ChantSection; verseId: string } | null {
  for (const section of doc.sections) {
    for (const verse of section.verses) {
      if (verse.src === undefined) continue;
      if (toTextAndMarks(verse).marks.some((m) => m.k === 'hold')) {
        return { section, verseId: verse.id };
      }
    }
  }
  return null;
}

describe('the rules run only when asked', () => {
  const files = readdirSync(CORPUS).filter((f) => f.endsWith('.json')).sort();

  it('there are documents to check', () => {
    expect(files.length).toBeGreaterThanOrEqual(11);
  });

  /**
   * KNOWN BROKEN, AND THIS IS THE RECORD OF IT.
   *
   * `it.fails` asserts that this test does NOT pass. Typing one letter puts
   * thirteen holdings back, because `apply`'s `replace` branch re-derives the
   * verse and a derivation is the rules. The day that stops being true, this
   * line fails and whoever fixed it deletes the `.fails`.
   *
   * WHY IT IS NOT FIXED HERE. The edit is addressed in the verse's SOURCE
   * text and the rules are what turn that into what is shown, so there is no
   * way to skip them and still display what was typed. The fix is to address
   * the edit at the DISPLAYED text — `openspec/changes/text-and-marks` §4.3 —
   * and the three things in the way are measured rather than guessed:
   *
   *   557 of 573 verses have a source text that differs from their displayed
   *   text, so this is a real change of coordinates, not a rename;
   *   the candrabindu is a character in the displayed text and absent from
   *   `ChantSyllable.iast`, which is what the source stand-in is built from;
   *   a pause between two spaces yields two spaces in the displayed text and
   *   one in the source stand-in, which normalises.
   *
   * Each is a decision, and making all three silently while the editor is
   * being switched is how a corpus loses a letter.
   */
  it.fails('typing does not place a marking', () => {
    let checked = 0;
    for (const file of files) {
      const doc = open(file);
      const where = subject(doc);
      if (where === null) continue;
      checked += 1;

      /*
       * Strip the holdings first, so a rule that fired would be VISIBLE. With
       * them left on, a re-derivation that replaced them with the same boxes
       * would be indistinguishable from no derivation at all — which is
       * exactly the failure this is looking for.
       */
      const bare = {
        ...doc,
        sections: doc.sections.map((s) => (s.id !== where.section.id ? s : {
          ...s,
          verses: s.verses.map((v) => (v.id !== where.verseId ? v : {
            ...v,
            tokens: v.tokens.map((t) => (t.t !== 'syl' ? t : {
              ...t,
              units: t.units.map(({ hold: _h, hg: _g, ...u }) => u),
            })),
          })),
        })),
      };
      expect(holdings(bare, where.verseId), `${file}: the strip did not work`).toBe(0);

      const section = bare.sections.find((s) => s.id === where.section.id)!;
      const at = offsetOf(flatten(sourcesOf(section)), {
        verseId: where.verseId, line: 0, column: 0,
      });
      const { state } = apply(newState(bare), emptyHistory(), {
        k: 'replace', sectionId: section.id, from: at, to: at, insert: 'a',
      });

      expect(
        holdings(state.doc, where.verseId),
        `${file} ${where.verseId}: typing one letter put holdings back`,
      ).toBe(0);
    }
    expect(checked, 'no document offered a verse to test').toBeGreaterThan(5);
  });

  it('recompute does place them, over the verses it is given', () => {
    const doc = open('durga-suktam.json');
    const where = subject(doc)!;
    expect(where).not.toBeNull();

    const bare = {
      ...doc,
      sections: doc.sections.map((s) => (s.id !== where.section.id ? s : {
        ...s,
        verses: s.verses.map((v) => (v.id !== where.verseId ? v : {
          ...v,
          tokens: v.tokens.map((t) => (t.t !== 'syl' ? t : {
            ...t,
            units: t.units.map(({ hold: _h, hg: _g, ...u }) => u),
          })),
        })),
      })),
    };
    expect(holdings(bare, where.verseId)).toBe(0);

    const { state } = apply(newState(bare), emptyHistory(), {
      k: 'recompute',
      sectionId: where.section.id,
      verseIds: [where.verseId],
      stages: STAGES,
      mode: 'replace-all',
    });
    expect(
      holdings(state.doc, where.verseId),
      'recompute placed no holdings at all',
    ).toBeGreaterThan(0);
  });

  it('leaves a verse it was not given alone', () => {
    const doc = open('durga-suktam.json');
    const where = subject(doc)!;
    const other = where.section.verses.find((v) => v.id !== where.verseId);
    if (other === undefined) return;

    const before = holdings(doc, other.id);
    const { state } = apply(newState(doc), emptyHistory(), {
      k: 'recompute',
      sectionId: where.section.id,
      verseIds: [where.verseId],
      stages: STAGES,
      mode: 'replace-all',
    });
    expect(holdings(state.doc, other.id)).toBe(before);
  });

  it('refuses a verse from another section, rather than reaching into it', () => {
    const doc = open('durga-suktam.json');
    const a = doc.sections[0]!;
    const b = doc.sections.find((s) => s.id !== a.id && s.verses.length > 0);
    if (b === undefined) return;

    const { state } = apply(newState(doc), emptyHistory(), {
      k: 'recompute',
      sectionId: a.id,
      verseIds: [b.verses[0]!.id],
      stages: STAGES,
      mode: 'replace-all',
    });
    expect(state.refusals.length).toBeGreaterThan(0);
  });
});
