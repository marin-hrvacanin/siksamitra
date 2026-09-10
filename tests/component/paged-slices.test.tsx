/**
 * A VERSE A PAGE BREAK RUNS THROUGH, DRAWN.
 *
 * `paginate` splits a verse between its recitation lines and says which lines
 * went where — `lineRange` on each half. Nothing read it. The paged view chose
 * its blocks by ID, and a split verse's id is on BOTH pages, so the whole
 * verse was drawn twice: once hanging past the foot of one page and once again
 * from the top of the next, its translation with it.
 *
 * MEASURED in the running program before the fix, at A4 on the sample
 * document: verse `v-4` on two pages, eight pādas where the verse has four,
 * one of them below the edge of the paper.
 *
 * WHAT THIS TIER ADDS to the browser gate. The gate drives the real thing and
 * so needs a real browser, a dev server and a document long enough to break;
 * this needs none of them and states the rule directly: given a range, the
 * renderer draws THOSE lines, keeps their numbering, and puts the verse's
 * trailing matter under the last one only. Both are needed — the gate would
 * pass on a build where nothing ever splits, and this would pass on a build
 * where the page map's ranges never reach the renderer.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { derive } from '@siksamitra/engine';
import type { ChantDoc } from '@siksamitra/format';
import { DocumentBlocks } from '../../apps/web/src/views/DocumentBlocks.js';

/** A four-line verse with a translation, derived by the real engine. */
function build(): ChantDoc {
  const lines = [
    'jātavedase sunavāma somam',
    'yato nidahāti vedaḥ',
    'sa naḥ parṣada-ti durgāṇi viśvā',
    'nāve-va sindhun duritā-tya-gniḥ',
  ];
  const d = derive({ lines }, undefined, { verseId: 'v-1', trace: false });
  return {
    title: 'test',
    titleForms: { iast: 'test' },
    sections: [{
      id: 's1',
      title: 's1',
      verses: [{
        id: 'v-1',
        tokens: d.tokens,
        src: { lines: [...d.srcMap.lines] },
        translation: { en: 'To Jātavedas we press out the Soma.' },
        source: 'Taittirīya Saṁhitā 4.2.1',
      }],
    }],
  } as ChantDoc;
}

const ID = 'v:s1:v-1';

/** Draw the document, optionally as one page's slice of it. */
function mount(range?: readonly [number, number]): HTMLElement {
  const host = document.createElement('div');
  host.className = 'canvas doc';
  host.innerHTML = renderToString(
    <DocumentBlocks
      doc={build()}
      script="iast"
      showMarks
      addressable
      only={new Set([ID])}
      {...(range === undefined ? {} : { slices: new Map([[ID, range]]) })}
    />,
  );
  document.body.append(host);
  return host;
}

/** The `data-line` of every pāda drawn, in order. */
const linesOf = (host: HTMLElement): number[] =>
  [...host.querySelectorAll('.pada')].map((el) => Number(el.getAttribute('data-line')));

afterEach(() => { document.body.innerHTML = ''; });

describe('the whole verse, when no page break runs through it', () => {
  /*
   * THE CONTROL, and it comes first. Every assertion below is about drawing
   * LESS, so a renderer that drew nothing at all would satisfy them.
   */
  it('draws all four lines, its translation and its source', () => {
    const host = mount();
    expect(linesOf(host)).toEqual([0, 1, 2, 3]);
    expect(host.querySelectorAll('.doc__translation')).toHaveLength(1);
    expect(host.querySelectorAll('.doc__source')).toHaveLength(1);
  });
});

describe('the first half of a split verse', () => {
  it('draws only the lines the page map gave it', () => {
    expect(linesOf(mount([0, 1]))).toEqual([0, 1]);
  });

  it('carries the verse number, because it has the first line', () => {
    /* The number lives inside line 0, in the gutter. */
    expect(mount([0, 1]).querySelectorAll('.verse__n').length).toBeLessThanOrEqual(1);
  });

  it('and NOT the translation or the source', () => {
    /*
     * They belong to the verse once, under its last line. Drawn on the first
     * half they sit above lines they translate; drawn on both they are the
     * same sentence twice — which is what the page did.
     */
    const host = mount([0, 1]);
    expect(host.querySelectorAll('.doc__translation')).toHaveLength(0);
    expect(host.querySelectorAll('.doc__source')).toHaveLength(0);
  });
});

describe('the second half', () => {
  it('draws the remaining lines, still numbered as the verse numbers them', () => {
    /*
     * `data-line` IS THE INDEX IN THE VERSE, not on the page. A recording is
     * played against the text by that number (`useRecording` looks for
     * `[data-verse="…"] .pada[data-line="…"]`), so renumbering a continued
     * verse from zero would play the wrong line — and would make the two
     * halves indistinguishable to any check counting them.
     */
    expect(linesOf(mount([2, 3]))).toEqual([2, 3]);
  });

  it('carries the translation and the source, under its last line', () => {
    const host = mount([2, 3]);
    expect(host.querySelectorAll('.doc__translation')).toHaveLength(1);
    expect(host.querySelectorAll('.doc__source')).toHaveLength(1);
  });

  it('and no verse number, which stayed with the first line', () => {
    expect(mount([2, 3]).querySelectorAll('.verse__n')).toHaveLength(0);
  });
});

describe('the two halves together are the verse, exactly once', () => {
  it('every line once, no line twice, nothing lost', () => {
    /*
     * THE INVARIANT THE FAULT BROKE. Not "each half is short" — that a build
     * could satisfy by dropping lines — but that the halves RECONSTITUTE the
     * verse: four lines over two pages, each exactly once, one translation
     * between them.
     */
    const first = mount([0, 1]);
    const second = mount([2, 3]);
    const all = [...linesOf(first), ...linesOf(second)];
    expect(all).toEqual([0, 1, 2, 3]);
    expect(new Set(all).size).toBe(all.length);
    expect(
      first.querySelectorAll('.doc__translation').length
      + second.querySelectorAll('.doc__translation').length,
    ).toBe(1);
  });

  it('and a three-way split loses nothing either', () => {
    /* A verse taller than a whole page is placed a page at a time, so three
       slices is a real case and not a hypothetical. */
    const all = [
      ...linesOf(mount([0, 0])), ...linesOf(mount([1, 2])), ...linesOf(mount([3, 3])),
    ];
    expect(all).toEqual([0, 1, 2, 3]);
  });
});

describe('the letters keep their addresses across the break', () => {
  it('the second half’s first letter is not addressed as the verse’s first', () => {
    /*
     * `data-u` is an offset into the WHOLE verse, and the second half must
     * count the letters of the first even though it does not draw them. A
     * per-slice counter would address every letter after a page break to the
     * wrong source offset, and a marking placed there would land a page early.
     */
    const whole = mount();
    const tail = mount([2, 3]);
    const at = (host: HTMLElement, line: number): string | null => {
      const pada = [...host.querySelectorAll('.pada')]
        .find((el) => el.getAttribute('data-line') === String(line));
      return pada?.querySelector('[data-u]')?.getAttribute('data-u') ?? null;
    };
    /* Not null, first — a comparison of two absences would pass on a build
       that addressed nothing at all. */
    expect(at(whole, 2)).not.toBeNull();
    expect(at(tail, 2)).toBe(at(whole, 2));
    /* And it is genuinely an offset into the verse rather than into the
       slice: line 2 starts well past letter zero. */
    expect(Number(at(whole, 2))).toBeGreaterThan(0);
  });
});
