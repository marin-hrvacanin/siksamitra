/**
 * The editing surface, in a DOM.
 *
 * What this tier is for: the part the pure editing tests cannot reach — the
 * translation between a position in the RENDERED page and a position in the
 * source. That translation is where an editor is either trustworthy or
 * maddening: a click that lands one letter off makes every later edit wrong,
 * and no amount of correct editing logic saves it.
 *
 * IT DRIVES WHAT THE PROGRAM DRIVES. The previous version of this file tested
 * `hitAt`/`paintSelection`, an x-coordinate hit test and a class painter — and
 * went on passing after the surface stopped calling either of them, because
 * the browser took over the caret and the selection. A green test for code the
 * product no longer runs is worse than no test: it is confidence pointing at
 * nothing. Every assertion here now goes through `hitAtDom`, `addressAtDom`
 * and `domPointOf`, which are the functions a keystroke actually reaches.
 *
 * A happy side effect of the change: a DOM position needs no layout, so these
 * no longer have to hand jsdom a fake rectangle and hope it resembles a
 * browser's.
 */
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { derive } from '@siksamitra/engine';
import { flatten, offsetOf, type FlatSource } from '@siksamitra/edit';
import { DocumentBlocks } from '../../apps/web/src/views/DocumentBlocks.js';
import { addressOfUnit, unitOfAddress } from '../../apps/web/src/editor/unit-map.js';
import {
  addressAtDom, domPointOf, hitAtDom,
} from '../../apps/web/src/editor/dom-selection.js';
import { selectedUnits } from '../../apps/web/src/editor/selection.js';
import type { ChantDoc } from '@siksamitra/format';
import type { SrcMap } from '@siksamitra/engine';

/** A real document, derived by the real engine. */
function build(lines: string[]): { doc: ChantDoc; srcMap: SrcMap } {
  const d = derive({ lines }, undefined, { verseId: 'v-1', trace: false });
  return {
    doc: {
      title: 'test',
      titleForms: { iast: 'test' },
      sections: [{
        id: 's1',
        title: 's1',
        verses: [{ id: 'v-1', tokens: d.tokens, src: { lines: [...d.srcMap.lines] } }],
      }],
    } as ChantDoc,
    srcMap: d.srcMap,
  };
}

/**
 * Render the blocks into the document, the way the app does.
 *
 * The host carries `doc` as well as `canvas`, because that is what the views
 * render and what the mapping scopes itself to — a position with no `.doc`
 * above it is not a position in a document at all. Mounting without it made
 * these tests a slightly different program from the one that ships.
 */
function mount(doc: ChantDoc): HTMLElement {
  const host = document.createElement('div');
  host.className = 'canvas doc';
  host.innerHTML = renderToString(
    <DocumentBlocks doc={doc} script="iast" showMarks addressable />,
  );
  document.body.append(host);
  return host;
}

/** The lookups the surface hands to the mapping. */
const lookups = (srcMap: SrcMap | null, flat: FlatSource) => ({
  srcMapIn: () => srcMap,
  flatFor: () => flat,
});

/** A DOM position at the start or the end of a letter's own text. */
function inLetter(el: HTMLElement, where: 'start' | 'end'): { node: Node; offset: number } {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let text: Text | null = null;
  while (walker.nextNode() !== null) {
    text = walker.currentNode as Text;
    if (where === 'start') break;
  }
  if (text === null) return { node: el, offset: where === 'start' ? 0 : el.childNodes.length };
  return { node: text, offset: where === 'start' ? 0 : text.data.length };
}

describe('addressability', () => {
  it('every letter carries its unit index, and only when the editor asks', () => {
    const { doc, srcMap } = build(['agnim īḷe purohitaṁ']);
    const on = mount(doc);
    expect([...on.querySelectorAll('[data-u]')].length).toBe(srcMap.units.length);

    const off = document.createElement('div');
    off.innerHTML = renderToString(
      <DocumentBlocks doc={doc} script="iast" showMarks addressable={false} />,
    );
    expect(off.querySelectorAll('[data-u]')).toHaveLength(0);
  });
});

describe('a position in the page, as a position in the source', () => {
  /*
   * These assert the LETTER, not the arithmetic. An earlier generation checked
   * `at.column === srcMap.units[6].start`, which is literally what
   * `addressOfUnit` computes — so collapsing every source span to `[0, 0)`
   * left them passing. What a click has to get right is which letter it named,
   * and that is checked against the letter's own rendered glyph.
   */
  it('the start of a letter addresses that letter in the source', () => {
    const { doc, srcMap } = build(['agnim īḷe purohitaṁ']);
    const host = mount(doc);
    const el = host.querySelector<HTMLElement>('[data-u="6"]')!;
    const glyph = el.textContent ?? '';

    const hit = hitAtDom(inLetter(el, 'start'))!;
    expect(hit.after).toBe(false);
    expect(hit.verseId).toBe('v-1');

    const at = addressOfUnit('v-1', srcMap, hit)!;
    expect(srcMap.lines[at.line]!.slice(at.column, at.column + glyph.length)).toBe(glyph);
  });

  it('the end of a letter addresses the position just past it', () => {
    const { doc, srcMap } = build(['agnim īḷe']);
    const host = mount(doc);
    const el = host.querySelector<HTMLElement>('[data-u="2"]')!;
    const glyph = el.textContent ?? '';

    const hit = hitAtDom(inLetter(el, 'end'))!;
    expect(hit.after).toBe(true);
    const at = addressOfUnit('v-1', srcMap, hit)!;
    /* The letter is BEHIND the caret, not in front of it. */
    expect(srcMap.lines[at.line]!.slice(at.column - glyph.length, at.column)).toBe(glyph);
  });

  it('a position past the end of a line stays on THAT line', () => {
    /* It used to go to the start of the verse, which on a four-line verse
       moved the caret three lines away from where it was put. */
    const { doc, srcMap } = build(['agnim īḷe', 'purohitaṁ yajñasya']);
    const host = mount(doc);
    const second = host.querySelectorAll<HTMLElement>('.pada')[1]!;

    const hit = hitAtDom({ node: second, offset: second.childNodes.length })!;
    const at = addressOfUnit('v-1', srcMap, hit)!;
    expect(at.line).toBe(1);
    expect(at.column).toBe(srcMap.lines[1]!.length);
  });

  it('a position outside any verse still belongs to the nearest one', () => {
    /*
     * Ctrl+A anchors in a section HEADING and ends in a source line — neither
     * is inside a verse. Reporting those as unmappable left the model holding
     * a stale caret while the page showed everything highlighted, so a
     * position above the verses resolves to the one it falls at.
     */
    const host = mount(build(['agnim īḷe'])!.doc);
    const heading = host.querySelector<HTMLElement>('.section__title')!;
    expect(hitAtDom({ node: heading, offset: 0 })?.verseId).toBe('v-1');
  });

  it('a position in no document at all is not a position', () => {
    const orphan = document.createElement('div');
    expect(hitAtDom({ node: orphan, offset: 0 })).toBeNull();
  });

  it('a verse with no source map lands in THAT verse, on the line clicked', () => {
    /*
     * THE BUG THIS EXISTS FOR was silent data loss. A transcribed verse has no
     * source map, and an earlier version concluded it had no place in the
     * source either and clamped the caret to the end of the PREVIOUS verse —
     * which is editable, so rule zero allowed the edit and the letter landed
     * in the wrong verse with no warning at all.
     */
    const { doc, srcMap } = build(['agnim īḷe', 'purohitaṁ yajñasya']);
    const host = mount(doc);
    const flat = flatten([{ id: 'v-1', lines: [...srcMap.lines] }]);
    const second = host.querySelectorAll<HTMLElement>('.pada')[1]!;
    const letter = second.querySelector<HTMLElement>('[data-u]')!;

    /* `srcMapIn` answers null, exactly as it does for a verse with no `src`. */
    const found = addressAtDom(inLetter(letter, 'start'), ...[
      lookups(null, flat).srcMapIn, lookups(null, flat).flatFor,
    ] as const)!;
    expect(found.at.verseId).toBe('v-1');
    expect(found.at.line).toBe(1);
    expect(found.at.column).toBe(0);
  });
});

describe('the caret and the source agree in both directions', () => {
  it('every unit round-trips: unit → address → unit', () => {
    const { doc, srcMap } = build(['agnim īḷe purohitaṁ yajñasya devam']);
    mount(doc);
    let checked = 0;
    for (const unit of srcMap.units.keys()) {
      const at = addressOfUnit('v-1', srcMap, { unit, span: 1, after: false })!;
      expect(unitOfAddress(srcMap, at)).toEqual({ unit, after: false });
      checked += 1;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('an address round-trips back to the letter it names, through the DOM', () => {
    /*
     * The loop the editor closes after every edit: the model's address becomes
     * a DOM position, and reading that position back gives the same address.
     * Its failure is a caret that drifts one letter per keystroke.
     */
    const { doc, srcMap } = build(['agnim īḷe purohitaṁ']);
    const host = mount(doc);
    const flat = flatten([{ id: 'v-1', lines: [...srcMap.lines] }]);
    const { srcMapIn, flatFor } = lookups(srcMap, flat);

    for (const unit of [0, 3, 7, srcMap.units.length - 1]) {
      const point = domPointOf(host, 's1', 'v-1', { unit, after: false })!;
      expect(point, `unit ${unit}`).not.toBeNull();
      const back = addressAtDom(point, srcMapIn, flatFor)!;
      expect(unitOfAddress(srcMap, back.at), `unit ${unit}`).toEqual({ unit, after: false });
    }
  });

  it('a caret past the last letter of a line belongs to the last letter', () => {
    const { srcMap } = build(['agnim īḷe']);
    const last = srcMap.units.length - 1;
    const end = srcMap.units[last]!;
    expect(unitOfAddress(srcMap, { verseId: 'v-1', line: 0, column: end.end + 5 }))
      .toEqual({ unit: last, after: true });
  });
});

describe('selection', () => {
  it('names exactly the letters in range, and none for a bare caret', () => {
    const { doc, srcMap } = build(['agnim īḷe purohitaṁ']);
    mount(doc);
    const flat = flatten([{ id: 'v-1', lines: [srcMap.lines[0]!] }]);

    const from = { verseId: 'v-1', line: 0, column: srcMap.units[2]!.start };
    const to = { verseId: 'v-1', line: 0, column: srcMap.units[5]!.end };
    expect(selectedUnits(flat, { anchor: from, head: to }, () => srcMap))
      .toEqual([{ verseId: 'v-1', from: 2, to: 5 }]);

    /* A caret selects nothing, rather than the letter it sits on. */
    expect(selectedUnits(flat, { anchor: from, head: from }, () => srcMap)).toEqual([]);
  });

  it('a selection across two verses names both', () => {
    const d1 = derive({ lines: ['agnim īḷe'] }, undefined, { verseId: 'v-1', trace: false });
    const d2 = derive({ lines: ['yajñasya devam'] }, undefined, { verseId: 'v-2', trace: false });
    const maps: Record<string, SrcMap> = { 'v-1': d1.srcMap, 'v-2': d2.srcMap };
    const flat = flatten([
      { id: 'v-1', lines: [...d1.srcMap.lines] },
      { id: 'v-2', lines: [...d2.srcMap.lines] },
    ]);
    const from = { verseId: 'v-1', line: 0, column: d1.srcMap.units[1]!.start };
    const to = { verseId: 'v-2', line: 0, column: d2.srcMap.units[2]!.end };
    const ranges = selectedUnits(flat, { anchor: from, head: to }, (id) => maps[id] ?? null);
    expect(ranges.map((r) => r.verseId)).toEqual(['v-1', 'v-2']);
    expect(offsetOf(flat, from)).toBeLessThan(offsetOf(flat, to)!);
  });
});
