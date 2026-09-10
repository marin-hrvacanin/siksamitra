/**
 * A WHOLE SECTION THROUGH LEXICAL AND BACK, and Enter pressed inside it.
 *
 * `lexical-bridge.test.ts` proves one VERSE survives the seam. This proves the
 * unit the caret is actually bounded by — a section, with its verse ids, its
 * lines and its markings — and then presses the keys that were broken, IN
 * LEXICAL, with no browser and no DOM.
 *
 * WHY THAT IS THE MEASUREMENT THAT MATTERS. The hand-written surface got Enter
 * wrong in a way no unit test could see, because the fault was in mapping a
 * model address onto a DOM node — four steps of arithmetic, one of them off by
 * one. Lexical has no such mapping: `insertNewAfter` returns the block the
 * caret goes into, and the framework puts it there. So the question this
 * answers is not "is the arithmetic right" but "does the tree still say what
 * the document said" — which is the only thing left for us to get wrong.
 *
 * THE CONTROL IS THE DOCUMENT ITSELF, read from disk with `openChantDoc` and
 * compared marking for marking. Nothing here is computed by the code under
 * test.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createHeadlessEditor } from '@lexical/headless';
import { $getRoot, $getSelection, $isRangeSelection, $createRangeSelection, $setSelection } from 'lexical';
import { toTextAndMarks, type ChantSection, type Mark } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import { MarkedTextNode } from '../../apps/web/src/editor/lexical/MarkedText.js';
import { PadaNode, VerseNode, $isPadaNode, $isVerseNode } from '../../apps/web/src/editor/lexical/blocks.js';
import {
  $readSection, $writeSection, pointMarksOf, sectionTextOf,
} from '../../apps/web/src/editor/lexical/section.js';

const DIR = 'corpus/chants';

const editorFor = () => createHeadlessEditor({
  namespace: 'section-test',
  nodes: [MarkedTextNode, PadaNode, VerseNode],
  onError: (e) => { throw e; },
});

/** A section in and out of a real Lexical editor state. */
function through(section: ChantSection): { id: string | null; text: string; marks: Mark[] }[] {
  const editor = editorFor();
  const text = sectionTextOf(section);
  const carried = pointMarksOf(text);
  let out: { id: string | null; text: string; marks: Mark[] }[] = [];
  editor.update(() => { $writeSection(text); }, { discrete: true });
  editor.getEditorState().read(() => { out = $readSection(carried).verses; });
  return out;
}

/** Every section of every document, with its name, for a table-driven run. */
function sections(): { doc: string; section: ChantSection }[] {
  const out: { doc: string; section: ChantSection }[] = [];
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
    const doc = openChantDoc(JSON.parse(readFileSync(join(DIR, file), 'utf8')));
    for (const section of doc.sections) out.push({ doc: file, section });
  }
  return out;
}

describe('every section of the corpus survives the tree', () => {
  const all = sections();

  it('there are sections to measure', () => {
    expect(all.length).toBeGreaterThan(20);
  });

  it('every verse comes back with its id, in order', () => {
    for (const { doc, section } of all) {
      const back = through(section);
      expect(back.map((v) => v.id), `${doc} / ${section.id}`)
        .toEqual(section.verses.map((v) => v.id));
    }
  });

  it('every verse comes back with the same text, byte for byte', () => {
    for (const { doc, section } of all) {
      const back = through(section);
      for (const [i, verse] of section.verses.entries()) {
        expect(back[i]?.text, `${doc} / ${verse.id}`).toBe(toTextAndMarks(verse).text);
      }
    }
  });

  it('and with the same markings, marking for marking', () => {
    let verses = 0;
    let marks = 0;
    for (const { doc, section } of all) {
      const back = through(section);
      for (const [i, verse] of section.verses.entries()) {
        const was = toTextAndMarks(verse).marks;
        expect(back[i]?.marks, `${doc} / ${verse.id}`).toEqual(was);
        verses += 1;
        marks += was.length;
      }
    }
    /* Said out loud, because a run over an empty corpus would pass every
       assertion above. */
    expect(verses).toBeGreaterThan(500);
    expect(marks).toBeGreaterThan(20000);
  });
});

describe('the tree has the shape the page needs', () => {
  const [first] = sections();

  it('a verse is a VerseNode carrying its id', () => {
    const editor = editorFor();
    editor.update(() => { $writeSection(sectionTextOf(first!.section)); }, { discrete: true });
    editor.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      expect(children.length).toBe(first!.section.verses.length);
      for (const [i, child] of children.entries()) {
        expect($isVerseNode(child)).toBe(true);
        expect((child as VerseNode).getVerseId()).toBe(first!.section.verses[i]!.id);
      }
    });
  });

  it('and a pāda is a PadaNode, one per recitation line', () => {
    const editor = editorFor();
    editor.update(() => { $writeSection(sectionTextOf(first!.section)); }, { discrete: true });
    editor.getEditorState().read(() => {
      for (const [i, child] of $getRoot().getChildren().entries()) {
        const lines = toTextAndMarks(first!.section.verses[i]!).text.split('\n');
        const padas = (child as VerseNode).getChildren();
        expect(padas.every($isPadaNode), `verse ${i}`).toBe(true);
        expect(padas.length, `verse ${i}`).toBe(lines.length);
      }
    });
  });
});

describe('Enter, in Lexical', () => {
  /*
   * THE KEYS THAT WERE BROKEN, pressed on the tree.
   *
   * `insertParagraph` is what the browser sends on Enter and what Lexical's
   * rich-text handler turns into `insertNewAfter` on the block the caret is
   * in. No source map, no DOM position, no arithmetic of ours.
   */
  const sectionOf = (verses: { id: string; text: string; marks: Mark[] }[]) => ({ verses });

  /** Put the caret at `offset` inside the first run of a verse's first pāda. */
  const caretInto = (verseAt: number, offset: number): void => {
    const verse = $getRoot().getChildren()[verseAt] as VerseNode;
    const pada = verse.getChildren()[0] as PadaNode;
    const run = pada.getChildren()[0]!;
    const selection = $createRangeSelection();
    selection.anchor.set(run.getKey(), offset, 'text');
    selection.focus.set(run.getKey(), offset, 'text');
    $setSelection(selection);
  };

  it('splits a pāda in two, in the same verse', () => {
    const editor = editorFor();
    const text = sectionOf([
      { id: 'v-1', text: 'agnim īḷe purohitaṁ\nyajñasya devam', marks: [] },
    ]);
    editor.update(() => { $writeSection(text); }, { discrete: true });
    editor.update(() => {
      caretInto(0, 14);
      const selection = $getSelection();
      if ($isRangeSelection(selection)) selection.insertParagraph();
    }, { discrete: true });

    let lines: string[] = [];
    let verses = 0;
    editor.getEditorState().read(() => {
      verses = $getRoot().getChildrenSize();
      const verse = $getRoot().getChildren()[0] as VerseNode;
      lines = verse.getChildren().map((p) => p.getTextContent());
    });
    expect(verses).toBe(1);
    expect(lines).toEqual(['agnim īḷe puro', 'hitaṁ', 'yajñasya devam']);
  });

  it('and the CARET is in the new pāda — which is the whole point', () => {
    /*
     * The hand-written surface computed this and got it wrong by one line.
     * Here nothing computes it: `insertNewAfter` returns the block and Lexical
     * puts the caret in it, so the assertion is about the framework doing what
     * it says rather than about our arithmetic.
     */
    const editor = editorFor();
    editor.update(() => {
      $writeSection(sectionOf([{ id: 'v-1', text: 'agnim īḷe purohitaṁ', marks: [] }]));
    }, { discrete: true });
    editor.update(() => {
      caretInto(0, 14);
      const selection = $getSelection();
      if ($isRangeSelection(selection)) selection.insertParagraph();
    }, { discrete: true });

    let where = { pada: -1, offset: -1, text: '' };
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const node = selection.anchor.getNode();
      const pada = node.getParent();
      const verse = pada?.getParent();
      where = {
        pada: pada === null || verse === null || verse === undefined
          ? -1 : verse.getChildren().indexOf(pada),
        offset: selection.anchor.offset,
        text: pada?.getTextContent() ?? '',
      };
    });
    expect(where.pada).toBe(1);
    expect(where.offset).toBe(0);
    expect(where.text).toBe('hitaṁ');
  });

  it('a marking on the tail half goes with it, and keeps its letters', () => {
    /*
     * The same property `split-marks.test.ts` holds for the document, asked of
     * the tree: the holding was on `devam`, and after the split it is still on
     * `devam` — in the pāda that moved.
     */
    /*
     *   0         1         2         3
     *   0123456789012345678901234567890123
     *   agnim īḷe purohitaṁ\nyajñasya devam
     *
     * `devam` is 29..34, counted off the string above — not read back out of
     * anything.
     */
    const body = 'agnim īḷe purohitaṁ\nyajñasya devam';
    expect(body.slice(29, 34)).toBe('devam');

    const editor = editorFor();
    const marks: Mark[] = [
      { k: 'hold', from: 29, to: 34, v: 'long', stage: 'holdings', by: 'hand' } as Mark,
    ];
    editor.update(() => {
      $writeSection(sectionOf([{ id: 'v-1', text: body, marks }]));
    }, { discrete: true });

    /* Enter in the middle of the FIRST pāda, so the marked pāda is the one
       that moves down the verse. */
    editor.update(() => {
      caretInto(0, 14);
      const selection = $getSelection();
      if ($isRangeSelection(selection)) selection.insertParagraph();
    }, { discrete: true });

    let out: { id: string | null; text: string; marks: Mark[] }[] = [];
    editor.getEditorState().read(() => { out = $readSection().verses; });
    const held = out[0]!.marks.filter((m) => m.k === 'hold');
    expect(held).toHaveLength(1);
    /* The offsets moved — a line break went in above it — and the LETTERS did
       not, which is what a marking is. */
    expect(held[0]!.from).not.toBe(29);
    expect(out[0]!.text.slice(held[0]!.from, held[0]!.to)).toBe('devam');
  });
});

describe('a svara does not spread, and Lexical is the one asking', () => {
  it('a run carrying a svara refuses text at its edge', () => {
    /*
     * `canInsertTextBefore` is Lexical's question and `LETTER_KINDS` is our
     * answer. Asserted through the node itself, so the policy is checked where
     * the framework will read it.
     */
    const editor = editorFor();
    let refused = { svara: true, hold: false };
    editor.update(() => {
      $writeSection({
        verses: [{
          id: 'v-1',
          text: 'agnim',
          marks: [
            { k: 'svara', from: 0, to: 1, v: 'anudatta', stage: 'svara', by: 'hand' } as Mark,
            { k: 'hold', from: 2, to: 5, v: 'long', stage: 'holdings', by: 'hand' } as Mark,
          ],
        }],
      });
    }, { discrete: true });
    editor.getEditorState().read(() => {
      const verse = $getRoot().getChildren()[0] as VerseNode;
      const runs = (verse.getChildren()[0] as PadaNode).getChildren() as MarkedTextNode[];
      const svara = runs.find((r) => r.getMarks().svara !== undefined)!;
      const hold = runs.find((r) => r.getMarks().hold !== undefined)!;
      refused = {
        svara: svara.canInsertTextBefore(),
        hold: hold.canInsertTextBefore(),
      };
    });
    expect(refused.svara, 'a svara must not take in a letter typed beside it').toBe(false);
    /* And the control: a holding still does, or typing inside a held word
       would leave a hole in its box. */
    expect(refused.hold, 'a holding is a span and must').toBe(true);
  });
});
