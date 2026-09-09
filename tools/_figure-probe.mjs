/**
 * SEEING A PICTURE THE WAY A PERSON DOES — shared by the gates that drive one.
 *
 * THE PICTURE A PERSON CAN SEE, AND NOT THE OTHER ONE, is the whole reason
 * these are not one-line `querySelector`s. The paged view lays the document out
 * a SECOND time, off-screen under `visibility: hidden`, to measure where the
 * pages break — so `.fig` matches the probe's copy first, and every
 * measurement made that way is of an element nobody can click. A drag once
 * measured against it. `checkVisibility` is the browser's own answer, and it is
 * the same test `figure-drag.ts` uses to decide what a drop may land on.
 *
 * Split out of `interaction-figure.mjs` at the 400-line module gate, where they
 * had also started being copied into the other gates that insert a picture.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

/** The browser's own "can this be seen", as a string to `eval` in the page. */
export const DRAWN = 'el => el.checkVisibility({ visibilityProperty: true })';

/**
 * A picture to insert: one solid colour, so it is unmistakable on the page.
 * Returns the path it was written to.
 */
export function probePicture(path, rgb = [210, 120, 60]) {
  mkdirSync('artifacts', { recursive: true });
  const png = new PNG({ width: 240, height: 160 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = rgb[0]; png.data[i + 1] = rgb[1]; png.data[i + 2] = rgb[2]; png.data[i + 3] = 255;
  }
  writeFileSync(path, PNG.sync.write(png));
  return path;
}

/** The helpers, bound to one puppeteer page. */
export function figureProbe(page) {
  const visibleFig = (extra = '') => page.evaluateHandle((args) => {
    const [sel, drawn] = args;
    // eslint-disable-next-line no-eval
    const ok = eval(drawn);
    return [...document.querySelectorAll(sel)].find(ok) ?? null;
  }, [`.fig${extra}`, DRAWN]);

  const countVisible = (sel) => page.evaluate((args) => {
    const [s, drawn] = args;
    // eslint-disable-next-line no-eval
    const ok = eval(drawn);
    return [...document.querySelectorAll(s)].filter(ok).length;
  }, [sel, DRAWN]);

  /** The middle of a DRAWN element, in viewport coordinates, scrolled to. */
  const centre = (selector) => page.evaluate((args) => {
    const [sel, drawn] = args;
    // eslint-disable-next-line no-eval
    const el = [...document.querySelectorAll(sel)].find(eval(drawn));
    if (el === undefined) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, [selector, DRAWN]);

  /**
   * The order of the document's blocks, as the DOM has them.
   *
   * Verses keep their own id — which does NOT change when a picture moves past
   * them — and everything else is reduced to its kind. So a picture moving is
   * visible as `F` changing place in a sequence whose other entries must not.
   */
  const blockOrder = () => page.evaluate((drawn) => [...document.querySelectorAll('[data-block-id]')]
    // eslint-disable-next-line no-eval
    .filter(eval(drawn))
    .map((el) => {
      const id = el.dataset.blockId;
      return id.startsWith('v:') ? id : id.slice(0, 1).toUpperCase();
    }), DRAWN);

  const selectedCount = () => countVisible('.fig.is-selected');
  const figureWidth = async () => {
    const h = await visibleFig();
    return h.evaluate((f) => (f === null ? 0 : f.getBoundingClientRect().width));
  };

  return { visibleFig, countVisible, centre, blockOrder, selectedCount, figureWidth };
}
