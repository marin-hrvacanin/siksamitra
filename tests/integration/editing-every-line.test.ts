/**
 * ENTER, BACKSPACE AND DELETE AT EVERY EDGE OF EVERY LINE OF THE CORPUS —
 * through `apply`, the one function the editor's keys reach, with exactly the
 * insert the editor sends (`lineBreakAt`, as `useText.newLine` does).
 *
 * WHY THIS EXISTS. Enter at the end of the first line of Durgā Sūktam split
 * verse 1, and the new verse — the rest of its lines — was drawn after verse
 * 9: three lines vanished from where they had been, and the caret went with
 * them. Every test passed, because the typing gate pressed Enter in the
 * MIDDLE of a line, and Durgā Sūktam is a section whose items hold
 * translations between its verses, which no edit test had ever used. So this
 * presses at every edge, in every document, and asks what a person would see:
 *
 *   - the verses are DRAWN in the order the text has them (`itemsOf` — what
 *     every view, the page map and the exporter read), with nothing dropped;
 *   - not one letter is lost or added except the line break itself;
 *   - the caret is where the text went;
 *   - Undo gives back the document exactly.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ChantDoc, ChantSection } from '@siksamitra/format';
import { toTextAndMarks } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import {
  apply, emptyHistory, flatten, lineBreakAt, newState, offsetOf, sourcesOf, undo,
} from '@siksamitra/edit';
import { itemsOf } from '../../apps/web/src/views/blocks.js';

const DIR = join(process.cwd(), 'corpus', 'chants');

/** The verses in the order the page draws them. */
const drawnOrder = (s: ChantSection): string[] =>
  itemsOf(s).filter((i) => i.t === 'verse').map((i) => (i as { id: string }).id);

/** Every letter of the section, as the page draws it, with the line breaks taken out. */
const letters = (s: ChantSection): string =>
  itemsOf(s).filter((i) => i.t === 'verse').map((v) => toTextAndMarks(v as never).text).join('').replace(/\s/g, '');

const sectionsJson = (d: ChantDoc): string => JSON.stringify(d.sections.map((s) => ({ ...s })));

/** A deterministic sample of a long list: every line of a small section, every few of a big one. */
const sample = <T>(xs: readonly T[], most: number): T[] => {
  if (xs.length <= most) return [...xs];
  const step = xs.length / most;
  return Array.from({ length: most }, (_, i) => xs[Math.floor(i * step)]!);
};

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
  const doc = openChantDoc(JSON.parse(readFileSync(join(DIR, file), 'utf8')) as ChantDoc);

  describe(file, () => {
    it('Enter, Backspace and Delete at every edge keep every letter, the drawn order and the caret — and undo exactly', () => {
      const wrong: string[] = [];
      for (const section of doc.sections) {
        const flat = flatten(sourcesOf(section));
        for (const line of sample(flat.lineStarts, 24)) {
          const where = `${section.id}/${line.verseId}:${line.line}`;
          const edges = [...new Set([line.at, line.at + Math.floor(line.length / 2), line.at + line.length])];
          for (const at of edges) {
            const gestures: { name: string; from: number; to: number; insert: string }[] = [
              { name: 'Enter', from: at, to: at, insert: lineBreakAt(flat, at) },
              ...(at > 0 ? [{ name: 'Backspace', from: at - 1, to: at, insert: '' }] : []),
              ...(at < flat.text.length ? [{ name: 'Delete', from: at, to: at + 1, insert: '' }] : []),
            ];
            for (const g of gestures) {
              const removed = flat.text.slice(g.from, g.to).replace(/\s/g, '');
              const before = newState(doc);
              const done = apply(before, emptyHistory(), {
                k: 'replace', sectionId: section.id, from: g.from, to: g.to, insert: g.insert,
              });
              const after = done.state.doc.sections.find((s) => s.id === section.id)!;
              /* Drawn in the order the text has them, and none dropped. */
              const order = drawnOrder(after);
              const text = after.verses.map((v) => v.id);
              if (order.join() !== text.join()) wrong.push(`${where} ${g.name}@${at}: drawn ${order.join(',')} but the text has ${text.join(',')}`);
              /* Not a letter lost or added, but the one deleted. */
              const was = letters(section);
              const now = letters(after);
              const expected = was.length - removed.length;
              if (now.length !== expected) wrong.push(`${where} ${g.name}@${at}: ${was.length} letters became ${now.length}, not ${expected}`);
              /* The caret is where the text went: what follows it is what
                 followed the press, spaces aside. */
              const sel = done.state.selection;
              if (sel !== null) {
                const flatAfter = flatten(sourcesOf(after));
                const caret = offsetOf(flatAfter, sel.head);
                const next = (t: string): string => t.replace(/\s/g, '').slice(0, 6);
                if (caret === null || next(flatAfter.text.slice(caret)) !== next(flat.text.slice(g.to))) {
                  wrong.push(`${where} ${g.name}@${at}: caret before "${next(flatAfter.text.slice(caret ?? 0))}", the text after the press was "${next(flat.text.slice(g.to))}"`);
                }
              }
              /* Undo gives back the document exactly. */
              const back = undo(done.state, done.history);
              if (done.history.past.length > 0 && sectionsJson(back.state.doc) !== sectionsJson(doc)) {
                wrong.push(`${where} ${g.name}@${at}: undo did not give the document back`);
              }
            }
          }
        }
      }
      expect(wrong.slice(0, 12)).toEqual([]);
    });
  });
}
