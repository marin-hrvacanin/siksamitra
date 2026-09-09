/**
 * What a picture of an exported page is a picture OF, and how the vector form
 * is wrapped.
 *
 * Two hosts rasterise: the command line, through a headless browser it starts
 * itself, and the window, through an iframe it already has. Both need the same
 * two answers, and neither should hold its own copy of them — the first time
 * they disagreed, one of them would be producing an image of something the
 * other never showed.
 *
 * Neither of these draws anything. Which element to clip to is a fact about the
 * frames in `export.css`; the SVG envelope is string assembly around markup the
 * host serialised.
 */
import type { ExportFrame } from '@siksamitra/tokens/export-styles';

/**
 * The element each frame's picture is of.
 *
 *   `page`   the SHEET. The desk it lies on is chrome, and nobody wants 300 px
 *            of grey around an A4 page they asked for.
 *   `web`    the reading column.
 *   `card`   the MAT, not the card — the band belongs to the picture. It is
 *            what keeps the rounded corner and the card's shadow inside the
 *            image instead of clipped off at its edge.
 *   `bare`   the text, and nothing else.
 */
export const CLIP_SELECTOR: Readonly<Record<ExportFrame, string>> = {
  page: '.flow__column',
  web: '.web__column',
  card: '.export--card',
  bare: '.export--bare',
};

/**
 * Set on the root element while a picture is being taken.
 *
 * `export.css` uses it to stop the frame filling the window: a page being read
 * is at least as tall as the window, and a page being photographed is exactly
 * as tall as its contents. Never present in a file anyone opens.
 */
export const RASTER_ATTR = 'data-raster';

export interface SvgParts {
  /** The clipped element, serialised with `XMLSerializer` — see below. */
  body: string;
  /** Every stylesheet on the page, concatenated. */
  css: string;
  /** The chrome axis and the mode, off the page's root element. */
  chrome: string;
  mode: string;
  /** The document theme's id — the style's `doc`. See below for why it cannot
   *  be read off the clipped element. */
  doc: string;
  width: number;
  height: number;
}

/**
 * The element, its stylesheet and its embedded faces, inside a `<foreignObject>`.
 *
 * It scales without resampling and it opens in any browser. It is NOT an
 * editable drawing: a vector editor will show it empty, because everything
 * inside a `foreignObject` is HTML.
 *
 * XML, NOT HTML, and both of these were found the same way — the file opening
 * as the browser's parse-error page:
 *
 *   the STYLE is wrapped in CDATA, because an XML parser reads a `<style>`
 *   element's contents as markup. `editor.css` opens by mentioning a
 *   `<textarea>` in prose, and that sentence became an unclosed element
 *   reported 5 800 lines further down.
 *   the BODY must come from `XMLSerializer`, not `outerHTML`, which the caller
 *   does because only it has the element. `outerHTML` writes HTML — a void
 *   element as `<br>`, an entity XML has never heard of — and neither is
 *   well-formed.
 *
 * TWO WRAPPERS, NOT ONE, and the theme is why. The generated stylesheet says
 * `[data-mode="light"] [data-doc="word"]` — a DESCENDANT combinator, because in
 * a real page the mode is on `<html>` and the document theme is on the canvas.
 * Both on one element matches neither half of it.
 *
 * And `data-doc` has to be PASSED IN rather than read off the clipped element,
 * because for the sheet frames the clip is `.flow__column`, which is a child of
 * the element carrying it: serialising the sheet alone left the attribute
 * behind, and a PNG of the Veda Union style came back set in the default
 * theme's serif with the wrong mark colours, its gutter numbers printed and no
 * hanging indent. It looked like a page. It was not his page.
 *
 * `data-raster` goes on as well, so the frame sizes itself to its contents
 * exactly as it did when it was measured.
 */
export function svgDocument(p: SvgParts): string {
  const w = Math.ceil(p.width);
  const h = Math.ceil(p.height);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" `
    + `viewBox="0 0 ${w} ${h}"><foreignObject width="100%" height="100%">`
    + `<div xmlns="http://www.w3.org/1999/xhtml" ${RASTER_ATTR}="" data-chrome="${p.chrome}" `
    + `data-mode="${p.mode}"><style><![CDATA[${p.css}]]></style>`
    + `<div data-doc="${p.doc}">${p.body}</div>`
    + '</div></foreignObject></svg>\n';
}
