/**
 * A WHOLE DOCUMENT THROUGH LEXICAL AND BACK.
 *
 * `lexical-bridge.test.ts` proves one verse survives and
 * `lexical-section.test.ts` proves a section's verses do. This is the level
 * where an editor usually loses things: a document is not a list of verses. It
 * has part headings that appear where the part CHANGES, section headings,
 * instructions, translations, source lines and pictures, and the thing that
 * matters about them is their ORDER.
 *
 * WHY THAT IS THE RISK AND NOT A DETAIL. `DocumentBlocks` learned this once
 * already: it drew headings and verses and nothing else, and a page of Durgā
 * Sūktam dropped all eighteen translations on the floor while a page of the
 * pūjā manual dropped 212 instructions and 54 part headings. An editor tree
 * that holds only the text would repeat that in the surface.
 *
 * SO THE COMPARISON IS THE WHOLE SEQUENCE, kind by kind and id by id, over the
 * real corpus — 11 documents, headlessly, no browser and no DOM. Plus every
 * verse's text byte for byte and every marking's kind, extent and value.
 *
 * The block ids are `views/blocks.ts`'s, which is what the page map, the
 * navigation outline and the exporter already use — so this also says the
 * editor's tree and the page's blocks agree about what there is.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createHeadlessEditor } from '@lexical/headless';
import { openChantDoc } from '@siksamitra/engine';
import type { ChantDoc, Mark } from '@siksamitra/format';
import { MarkedTextNode } from '../../apps/web/src/editor/lexical/MarkedText.js';
import { PadaNode, VerseNode } from '../../apps/web/src/editor/lexical/blocks.js';
import { DrawnBlockNode } from '../../apps/web/src/editor/lexical/DrawnBlock.jsx';
import {
  $readDocument, $writeDocument, docBlocksOf, pointMarksIn, type DocBlock,
} from '../../apps/web/src/editor/lexical/document.js';

const DIR = 'corpus/chants';
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();

const load = (file: string): ChantDoc =>
  openChantDoc(JSON.parse(readFileSync(join(DIR, file), 'utf8')) as never);

/** A document in and out of a real Lexical editor state. */
function through(blocks: readonly DocBlock[]): DocBlock[] {
  const editor = createHeadlessEditor({
    namespace: 'document-test',
    nodes: [MarkedTextNode, PadaNode, VerseNode, DrawnBlockNode],
    onError: (e) => { throw e; },
  });
  const carried = pointMarksIn(blocks);
  let out: DocBlock[] = [];
  editor.update(() => { $writeDocument(blocks); }, { discrete: true });
  editor.getEditorState().read(() => { out = $readDocument(carried); });
  return out;
}

/** The sequence, as a list a failure can be read out of. */
const shape = (blocks: readonly DocBlock[]): string[] => blocks.map(
  (b) => (b.t === 'verse'
    ? `verse:${b.verse.id}[${b.trailing.map((d) => d.kind).join('+')}]`
    : `${b.drawn.kind}:${b.drawn.blockId}`),
);

/** Comparable markings, with the fields that only describe provenance gone. */
const marksOf = (marks: readonly Mark[]): string[] =>
  [...marks]
    .map((m) => `${m.k}:${m.from}-${m.to}:${m.v ?? ''}`)
    .sort();

describe('the whole corpus, through the editor and back', () => {
  for (const file of FILES) {
    it(`${file} comes back the same document`, () => {
      const blocks = docBlocksOf(load(file));
      const back = through(blocks);

      /* THE ORDER FIRST, because it is what an editor loses. */
      expect(shape(back)).toEqual(shape(blocks));

      /* Then every verse, byte for byte and marking for marking. */
      for (const [i, block] of blocks.entries()) {
        if (block.t !== 'verse') continue;
        const other = back[i]!;
        expect(other.t, `${file} block ${i}`).toBe('verse');
        if (other.t !== 'verse') continue;
        expect(other.verse.text, `${file} ${block.verse.id} text`).toBe(block.verse.text);
        expect(marksOf(other.verse.marks), `${file} ${block.verse.id} marks`)
          .toEqual(marksOf(block.verse.marks));
      }
    });
  }
});

describe('what the corpus actually exercises', () => {
  /*
   * THE CONTROL FOR THE WHOLE FILE. Every assertion above is satisfied by a
   * corpus of plain verses — a document with no headings, no translations and
   * no pictures would round-trip perfectly while proving nothing about the
   * blocks this file exists for. So the counts are asserted.
   */
  const all = FILES.flatMap((f) => docBlocksOf(load(f)));
  const kinds = (kind: string): number =>
    all.filter((b) => b.t === 'drawn' && b.drawn.kind === kind).length
    + all.filter((b) => b.t === 'verse' && b.trailing.some((d) => d.kind === kind)).length;

  it('has verses, headings, instructions, translations and pictures in it', () => {
    expect(all.filter((b) => b.t === 'verse').length).toBeGreaterThan(500);
    expect(kinds('heading')).toBeGreaterThan(10);
    expect(kinds('instruction')).toBeGreaterThan(100);
    expect(kinds('translation')).toBeGreaterThan(50);
    expect(kinds('figure')).toBeGreaterThan(10);
  });

  it('and a part heading, which is drawn where the part CHANGES', () => {
    /*
     * Not once per section that names a part. The rule lives in
     * `DocumentBlocks` and in `blockRefs`; if this bridge repeated a part
     * heading per section the tree and the page would disagree about how many
     * blocks there are, and the page map would place one that is not drawn.
     */
    const parts = all.filter((b) => b.t === 'drawn' && b.drawn.kind === 'part');
    expect(parts.length).toBeGreaterThan(0);
    /* Fewer part headings than sections that name a part. */
    const sections = FILES.flatMap((f) => load(f).sections);
    const naming = sections.filter((s) => s.part !== undefined).length;
    expect(parts.length).toBeLessThan(naming);
  });
});

describe('a verse’s translation is not read back as a line of the mantra', () => {
  /*
   * THE FAULT THIS ARM EXISTS FOR. A verse's trailing matter is drawn INSIDE
   * `.verse`, so it is a child of `VerseNode` — and `$verseOf` walks the
   * verse's children as its LINES, joining them with `\n`. A decorator among
   * them contributes no text and must contribute no newline either, or every
   * translated verse comes back one blank line longer than it went in and the
   * markings after that point are off by one.
   */
  it('the text is the mantra and nothing else', () => {
    const doc = load('durga-suktam.json');
    const blocks = docBlocksOf(doc);
    const translated = blocks.filter(
      (b) => b.t === 'verse' && b.trailing.some((d) => d.kind === 'translation'),
    );
    expect(translated.length, 'durga-suktam has translated verses').toBeGreaterThan(5);

    const back = through(blocks);
    for (const [i, block] of blocks.entries()) {
      if (block.t !== 'verse') continue;
      const other = back[i]!;
      if (other.t !== 'verse') continue;
      expect(other.verse.text.endsWith('\n'), `${block.verse.id} gained a line`).toBe(false);
      expect(other.verse.text.split('\n').length, `${block.verse.id} line count`)
        .toBe(block.verse.text.split('\n').length);
    }
  });
});
