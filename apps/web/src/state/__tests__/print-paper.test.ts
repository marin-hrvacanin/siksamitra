/**
 * WHICH PAPER THE PRINT DIALOG OFFERS.
 *
 * `Print / PDF` is `window.print()` — the browser's own pipeline, which is the
 * right answer and the reason there is no PDF library in the bundle. What the
 * browser could not know is which paper the document is FOR, so the dialog
 * offered the printer's own size: a person working on A5 pressed Print and got
 * an A5-wide column on an A4 sheet with a hand's width of white down two
 * sides.
 *
 * `@page { size }` is the one CSS property that cannot be driven by a custom
 * property — the page context resolves before any element exists — so the rule
 * is written out, and this is the arithmetic that writes it.
 */
import { describe, expect, it } from 'vitest';
import { PAGE_SIZES, pageGeometry } from '@siksamitra/layout';
import { printPaperRule } from '../usePrintPaper.js';

describe('the @page rule', () => {
  it('A4 is 210 by 297 millimetres', () => {
    /* Done by hand from the paper, not read back out of the geometry: A4 is
       210 x 297 mm and that is a fact about paper. */
    expect(printPaperRule(pageGeometry('a4'))).toBe('@page { size: 210.0mm 297.0mm; }');
  });

  it('A5 is half of it, which is the size that made this necessary', () => {
    expect(printPaperRule(pageGeometry('a5'))).toBe('@page { size: 148.0mm 210.0mm; }');
  });

  it('and Letter is Letter, which is why it is not written by NAME', () => {
    /*
     * `size: A5` would cover two of the three and not this one, and a size
     * added to `PAGE_SIZES` tomorrow would silently fall back to the
     * printer's default. 612 x 792 pt is 215.9 x 279.4 mm.
     */
    expect(printPaperRule(pageGeometry('letter'))).toBe('@page { size: 215.9mm 279.4mm; }');
  });

  it('every page size this build has gets a rule with two real lengths', () => {
    /* From the registry, so adding a page size cannot leave it printing on
       whatever the printer had loaded. */
    for (const id of Object.keys(PAGE_SIZES)) {
      const rule = printPaperRule(pageGeometry(id));
      expect(rule, id).toMatch(/^@page \{ size: \d+\.\d+mm \d+\.\d+mm; \}$/);
    }
  });

  it('and the sizes differ from each other — the control', () => {
    /*
     * Without this, a rule that always wrote A4 would satisfy the shape check
     * above and be exactly the bug.
     */
    const rules = Object.keys(PAGE_SIZES).map((id) => printPaperRule(pageGeometry(id)));
    expect(new Set(rules).size).toBe(rules.length);
  });

  it('NO MARGINS are written into it', () => {
    /*
     * `export.css` records what happened when they were: a CSS page margin
     * OVERRIDES the one the print job was given, so `margin: 0` cancelled the
     * 25 mm and every page printed hard against the paper's edge — the first
     * baseline 14 pt from the top where Word puts it at 70.87. The margins are
     * the document's, drawn as the column's own padding.
     */
    for (const id of Object.keys(PAGE_SIZES)) {
      expect(printPaperRule(pageGeometry(id)), id).not.toContain('margin');
    }
  });
});
