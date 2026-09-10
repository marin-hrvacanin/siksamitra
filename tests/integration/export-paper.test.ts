/**
 * THE PAPER A PERSON CHOSE IS THE PAPER THEY GET.
 *
 * THE FAULT. `documentView` hard-coded `pageGeometry(DEFAULT_PAGE)` and the
 * app's `.docx` export never passed a page at all, so `exportWord` fell back
 * to A4 as well. Choose A5 or Letter in the ribbon, press Export, and the
 * sheet in the `.html`, the `sectPr` in the `.docx` and the paper the PDF
 * prints on were all A4 while the screen showed something else. It became
 * easier to hit the moment the page size started persisting between sessions:
 * a person who worked on A5 last week exports on A5 today without touching the
 * control.
 *
 * WHY THE COMPILER NOW ASKS. `page` is a REQUIRED option on both of the app's
 * export entry points. Optional, it is a mistake anybody can make again;
 * required, the call site has to say which paper — and the two call sites in
 * `FileGroup` read it from `ctx.pageSize`, which is what the ribbon's own Size
 * control sets.
 *
 * MEASURED AGAINST THE PAPER, not against the code: A4 is 210 x 297 mm, A5 is
 * 148 x 210, Letter is 8.5 x 11 inches. Word stores a page size in TWIPS —
 * twentieths of a point — so the expectations here are that arithmetic done by
 * hand.
 */
import { describe, expect, it } from 'vitest';
import { exportWord } from '@siksamitra/interop';
import { PAGE_SIZES, pageGeometry } from '@siksamitra/layout';
import { openChantDoc } from '@siksamitra/engine';
import { EXPORT_STYLES } from '@siksamitra/tokens/export-styles';
import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { documentView } from '../../apps/web/src/views/export-page.js';
import type { ChantDoc } from '@siksamitra/format';

const doc = (): ChantDoc =>
  openChantDoc(JSON.parse(readFileSync('corpus/chants/durga-suktam.json', 'utf8')) as never);

const style = EXPORT_STYLES.find((s) => s.id === 'veda-union')!;

/** The `<w:pgSz>` of a `.docx`, in twips. */
async function pgSz(page: string): Promise<{ w: number; h: number }> {
  const bytes = await exportWord({
    doc: doc(),
    page: pageGeometry(page),
    style,
    textStack: 'serif',
    uiStack: 'sans-serif',
    engine: 'test',
    slug: 'paper.docx',
    script: 'iast',
  });
  /* A `.docx` is a zip, so the part is inflated rather than searched for in
     the raw bytes — the same way `gate-word.mjs` reads one. */
  const text = strFromU8(unzipSync(bytes)['word/document.xml']!);
  const m = /<w:pgSz w:w="(\d+)" w:h="(\d+)"\/>/.exec(text);
  if (m === null) throw new Error('no <w:pgSz> in the exported .docx');
  return { w: Number(m[1]), h: Number(m[2]) };
}

/** Points to twips, Word's own unit for a page. */
const tw = (points: number): number => Math.round(points * 20);

describe('the .docx says which paper', () => {
  it('A4 is 11906 by 16838 twips', async () => {
    /* 210 mm is 595.276 pt is 11905.5 twips; Word writes 11906. */
    expect(await pgSz('a4')).toEqual({ w: 11906, h: 16838 });
  });

  it('A5 is half of it — the size that made this a bug', async () => {
    expect(await pgSz('a5')).toEqual({ w: tw(pageGeometry('a5').width), h: tw(pageGeometry('a5').height) });
    /* And it is not A4, which is what it used to be. */
    expect((await pgSz('a5')).w).toBeLessThan(11906);
  });

  it('and Letter is Letter', async () => {
    /* 8.5 x 11 inches is 612 x 792 pt is 12240 x 15840 twips. */
    expect(await pgSz('letter')).toEqual({ w: 12240, h: 15840 });
  });

  it('every page size this build has comes out as itself', async () => {
    /*
     * From the registry rather than a list here, so a page size added
     * tomorrow is exported as itself or fails this.
     */
    const seen = new Set<string>();
    for (const id of Object.keys(PAGE_SIZES)) {
      const { w, h } = await pgSz(id);
      expect(w, id).toBe(tw(pageGeometry(id).width));
      expect(h, id).toBe(tw(pageGeometry(id).height));
      seen.add(`${w}x${h}`);
    }
    /* THE CONTROL. Without it, a writer that ignored the argument and wrote
       A4 every time would satisfy nothing above but would satisfy a check
       that only looked at one size. */
    expect(seen.size).toBe(Object.keys(PAGE_SIZES).length);
  });
});

describe('the exported .html says which paper too', () => {
  /*
   * The same fault at the other end: `documentView` hard-coded
   * `pageGeometry(DEFAULT_PAGE)`, so the sheet in an exported page was A4
   * whatever the ribbon said. The sheet's width is written as an inline style
   * by `FlowView` — points times 96/72 — so the markup can be measured.
   */
  const widthOf = (page: string): number => {
    const html = documentView(doc(), style, 'iast', page);
    const m = /width:\s*([0-9.]+)px/.exec(html);
    if (m === null) throw new Error(`no sheet width in the exported page: ${html.slice(0, 200)}`);
    return Number(m[1]);
  };

  it('A4 is 793.7 px wide, which is 210 mm', () => {
    expect(widthOf('a4')).toBeCloseTo((210 * (72 / 25.4) * 96) / 72, 0);
  });

  it('and A5 is narrower — it used to be exactly as wide', () => {
    expect(widthOf('a5')).toBeLessThan(widthOf('a4'));
    expect(widthOf('a5')).toBeCloseTo((148 * (72 / 25.4) * 96) / 72, 0);
  });

  it('every size comes out as itself, and no two the same — the control', () => {
    const seen = new Set(Object.keys(PAGE_SIZES).map((id) => widthOf(id)));
    expect(seen.size).toBe(Object.keys(PAGE_SIZES).length);
  });
});

describe('and the text column follows the paper', () => {
  /*
   * A picture's width is a FRACTION of the column, resolved in EMU against the
   * section's own content box — so getting the paper wrong got every picture
   * wrong too, not only the sheet. The column is the sheet less both margins,
   * and A5's margins are 15 mm where A4's are 25.
   */
  it('A5 has a narrower content column than A4', () => {
    const a4 = pageGeometry('a4');
    const a5 = pageGeometry('a5');
    const column = (p: typeof a4): number => p.width - p.margins.left - p.margins.right;
    expect(column(a5)).toBeLessThan(column(a4));
  });
});
