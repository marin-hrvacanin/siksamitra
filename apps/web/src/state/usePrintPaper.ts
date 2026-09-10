/**
 * THE PAPER THE PRINT DIALOG OFFERS.
 *
 * `Print / PDF` is `window.print()` — the browser's own pipeline, on every
 * platform, with no PDF library in the bundle (see `FileGroup`). What the
 * browser could not know is which paper the document is FOR: the print dialog
 * defaults to the printer's own size, so a person working on A5 pressed Print
 * and got an A5-wide column of text on an A4 sheet with a hand's width of
 * white down two sides.
 *
 * `@page { size }` is how a document says so, and it is the one CSS property
 * that cannot be driven by a custom property — the page context resolves
 * before any element exists, so `var()` is not available there. So the rule is
 * written into a `<style>` element of its own and rewritten when the page size
 * changes. One element, one rule, and it is removed when the app unmounts.
 *
 * IN MILLIMETRES RATHER THAN BY NAME. `size: A5` would cover two of the three
 * sizes and not Letter, and a size added to `PAGE_SIZES` tomorrow would
 * silently fall back to the printer's default. The geometry is in points, which
 * is what `pageGeometry` holds, and the conversion is the one in
 * `@siksamitra/layout`.
 *
 * NO MARGINS HERE, and that is deliberate: `export.css` records what happened
 * when they were written into `@page` — a CSS page margin OVERRIDES the one the
 * print job was given, so `margin: 0` cancelled the 25 mm and every page
 * printed hard against the paper's edge. The margins are the document's, drawn
 * as the column's own padding.
 */
import { useEffect } from 'react';
import { MM_TO_PT, type PageGeometry } from '@siksamitra/layout';

/** A length in points, as millimetres with one decimal. */
const mm = (points: number): string => `${(points / MM_TO_PT).toFixed(1)}mm`;

/** The `@page` rule this geometry asks a printer for. */
export const printPaperRule = (page: PageGeometry): string =>
  `@page { size: ${mm(page.width)} ${mm(page.height)}; }`;

export function usePrintPaper(page: PageGeometry): void {
  useEffect(() => {
    const el = document.createElement('style');
    el.dataset['printPaper'] = page.id;
    el.textContent = printPaperRule(page);
    document.head.append(el);
    return () => { el.remove(); };
  }, [page]);
}
