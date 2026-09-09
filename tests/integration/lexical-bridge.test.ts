/**
 * A VERSE THROUGH LEXICAL AND BACK.
 *
 * Adopting an editor framework has exactly one architectural risk: the seam
 * between the document and the editor becomes a second source of truth. The
 * document is one text and a list of markings; Lexical holds a tree. If a
 * verse can go in and come back different, every edit is built on sand.
 *
 * So this runs the REAL corpus through the real bridge, headlessly — no
 * browser, no DOM — and compares what comes back with what went in, marking
 * for marking. It is the same discipline as `tools/migrate-audit.mjs`, which
 * proved `tokens ⇄ text + markings` at 573 of 573, and it is deliberately the
 * same shape: a conversion nobody can invert is a conversion nobody can check.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createHeadlessEditor } from '@lexical/headless';
import { $getRoot } from 'lexical';
import { normalizeChantDoc, toTextAndMarks, type Mark } from '@siksamitra/format';
import { MarkedTextNode } from '../../apps/web/src/editor/lexical/MarkedText.js';
import { $paragraphsOf, $verseOf, pointMarks } from '../../apps/web/src/editor/lexical/bridge.js';
import { openChantDoc } from '@siksamitra/engine';

const DIR = 'corpus/chants';

/** A verse in and out of a real Lexical editor state. */
function through(verse: { text: string; marks: Mark[] }): { text: string; marks: Mark[] } {
  const editor = createHeadlessEditor({
    namespace: 'bridge-test',
    nodes: [MarkedTextNode],
    onError: (e) => { throw e; },
  });
  const carried = pointMarks(verse.marks);
  let out = { text: '', marks: [] as Mark[] };
  editor.update(() => {
    const root = $getRoot();
    root.clear();
    for (const p of $paragraphsOf(verse)) root.append(p);
  }, { discrete: true });
  editor.getEditorState().read(() => {
    out = $verseOf($getRoot().getChildren(), carried);
  });
  return out;
}

/** Comparable, and with the fields that only describe provenance removed. */
const shape = (marks: readonly Mark[]) =>
  [...marks]
    .map((m) => ({ k: m.k, from: m.from, to: m.to, v: m.v ?? null }))
    .sort((a, b) => a.from - b.from || a.to - b.to || a.k.localeCompare(b.k));

describe('a verse survives the editor', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();

  it('every verse of every document comes back unchanged', () => {
    let checked = 0;
    const wrong: string[] = [];

    for (const file of files) {
      const doc = openChantDoc(JSON.parse(readFileSync(join(DIR, file), 'utf8')));
      for (const section of doc.sections) {
        for (const verse of section.verses) {
          if (verse.tokens === undefined) continue;
          const before = toTextAndMarks(verse);
          /*
           * The syllable boundaries are carried by the migration and are not
           * runs — they describe where a syllable ends, which the editor has
           * no node for. They travel with the point markings.
           */
          const back = through(before);
          checked += 1;
          if (back.text !== before.text) {
            wrong.push(`${file} ${verse.id}: the text changed`);
            continue;
          }
          const a = shape(before.marks);
          const b = shape(back.marks);
          if (JSON.stringify(a) !== JSON.stringify(b)) {
            const first = a.findIndex((m, i) => JSON.stringify(m) !== JSON.stringify(b[i]));
            wrong.push(`${file} ${verse.id}: marking ${first} `
              + `${JSON.stringify(a[first])} -> ${JSON.stringify(b[first])}`);
          }
        }
      }
    }

    expect(checked).toBeGreaterThan(500);
    expect(wrong.slice(0, 8)).toEqual([]);
  });
});
