/**
 * DRAGGING A PICTURE TO SOMEWHERE ELSE IN THE DOCUMENT.
 *
 * The owner's words: "I can't select the photo to pull it to resize it and
 * freely move it around." Resizing is four corner handles and lives in the
 * renderer, because a width is a fact about the picture. WHERE a picture goes
 * is a fact about the document, so it lives here.
 *
 * WHAT "FREELY" MEANS IN A DOCUMENT, and why it is not x and y.
 *
 * A picture with a position in points from the corner of a page is a picture
 * that is in the wrong place the moment a verse above it grows by a line — and
 * these documents are re-derived, re-paginated and exported to five things
 * with different columns. Word's own answer is the same one: a picture is
 * ANCHORED to a paragraph and floats beside it. So a drag here picks the gap
 * between two blocks, and the drop rule shows exactly which one, the way a
 * text caret shows where a paste will land.
 *
 * The SIDE comes out of the same gesture: dropped in the left third of the
 * column a floating picture floats left, in the right third it floats right.
 * Word again — and a picture that is not floating is not MADE to float by
 * being dragged, because its wrap is a decision taken on the Picture tab.
 *
 * NOTHING IS COMMITTED UNTIL THE BUTTON COMES UP. What moves during the drag
 * is one absolutely positioned rule and the ghost of the picture; the document
 * hears about it once, so one drag is one Ctrl+Z.
 */
import { movedFigureIndex } from '@siksamitra/edit';
import type { ChantSection } from '@siksamitra/format';
import { blockId, itemsOf } from '../views/blocks.js';

/** A picture's anchor: which step, and which item of it. */
export interface FigureAt {
  readonly sectionId: string;
  readonly at: number;
}

/** Where a drag would put it, and which way it would face. */
export interface FigureDrop extends FigureAt {
  readonly side?: 'start' | 'end';
}

/** A gap a picture may be dropped into, and the block that marks it. */
interface Gap {
  readonly sectionId: string;
  readonly at: number;
  readonly el: HTMLElement;
  /** The gap is BELOW `el` rather than above it — the end of a step. */
  readonly after: boolean;
}

const num = (css: CSSStyleDeclaration, name: string, fallback: number): number => {
  const n = parseFloat(css.getPropertyValue(name));
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Is this element actually drawn? Asked of the browser, not inferred.
 *
 * The paged view lays the WHOLE document out a SECOND time to measure where
 * the pages break, off-screen under `visibility: hidden`, and that copy
 * carries every `data-block-id` the real pages do. `querySelector` finds the
 * probe's copy first, so a drag in Pages was measuring its drop against
 * rectangles nobody can see.
 *
 * `checkVisibility` is the browser's own answer to the question and it covers
 * `display`, `visibility` and `content-visibility` at once — where guessing
 * from `offsetParent` would say the probe is fine, because a
 * `visibility: hidden` element still has one.
 */
const isDrawn = (el: HTMLElement): boolean =>
  (typeof el.checkVisibility === 'function'
    ? el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })
    : el.getBoundingClientRect().height > 0);

/** The element drawing a block — the one a person can see. */
function contentBlock(id: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>('[data-block-id="' + CSS.escape(id) + '"]');
  for (const el of all) if (isDrawn(el)) return el;
  return null;
}

/**
 * Every gap in the document, with the element that marks it.
 *
 * Built from the DOCUMENT and looked up in the DOM, not the other way round: a
 * block's id is minted by `blocks.ts` from the item's position, so walking the
 * items is the only way to know which index a `[data-block-id]` stands for —
 * a verse's id does not carry its index at all.
 *
 * Blocks the current view is not drawing simply have no element and are
 * skipped. Dropping onto something that is not on the screen is not a gesture.
 */
function gapsIn(sections: readonly ChantSection[]): Gap[] {
  const out: Gap[] = [];
  for (const section of sections) {
    const items = itemsOf(section);
    let last: HTMLElement | null = null;
    items.forEach((item, at) => {
      const id = item.t === 'verse'
        ? blockId.verse(section.id, item.id)
        : item.t === 'figure'
          ? blockId.figure(section.id, at)
          : item.t === 'instruction'
            ? blockId.instruction(section.id, at)
            : null;
      if (id === null) return;
      const el = contentBlock(id);
      if (el === null) return;
      out.push({ sectionId: section.id, at, el, after: false });
      last = el;
    });
    /* And the gap after the last item, which no block begins. */
    if (last !== null) {
      out.push({ sectionId: section.id, at: items.length, el: last, after: true });
    }
  }
  return out;
}

/** The gap nearest the pointer, by the distance to the edge it stands for. */
function nearest(gaps: readonly Gap[], x: number, y: number): Gap | null {
  let best: Gap | null = null;
  let bestD = Infinity;
  for (const gap of gaps) {
    const r = gap.el.getBoundingClientRect();
    const edge = gap.after ? r.bottom : r.top;
    /* Horizontal distance counts too, or a drag over the page beside a narrow
       column picks a block in a column the pointer is nowhere near. */
    const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
    const d = Math.abs(y - edge) + dx;
    if (d < bestD) { bestD = d; best = gap; }
  }
  return best;
}

/** Which side of the column the pointer is on — the outer thirds, or neither. */
function sideAt(el: HTMLElement, x: number): 'start' | 'end' | undefined {
  const r = el.getBoundingClientRect();
  if (r.width <= 0) return undefined;
  const t = (x - r.left) / r.width;
  if (t < 1 / 3) return 'start';
  if (t > 2 / 3) return 'end';
  return undefined;
}

/** The scrolling ancestor, so a drag can reach a step that is off the screen. */
function scrollerOf(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p !== null; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/** What the gesture needs from the mousedown, and nothing React-shaped. */
export interface GrabPoint {
  readonly clientX: number;
  readonly clientY: number;
  readonly currentTarget: EventTarget | null;
}

/**
 * Run one drag, from the mousedown that began it.
 *
 * Returns immediately: the gesture lives on the window until the button comes
 * up, because a fast drag leaves the picture behind and a pointer that has
 * left the element still belongs to the gesture.
 *
 * `commit` is called only when the picture actually moves, so a click that
 * happens to wobble is a click.
 */
export function startFigureDrag(
  event: GrabPoint,
  sections: readonly ChantSection[],
  commit: (to: FigureDrop) => void,
): void {
  const figure = (event.currentTarget as HTMLElement | null)?.closest<HTMLElement>('.fig');
  if (figure === null || figure === undefined) return;
  const css = getComputedStyle(document.documentElement);
  const slop = num(css, '--fig-drag-slop', 4);
  const edge = num(css, '--fig-drag-edge', 48);
  const speed = num(css, '--fig-drag-speed', 14);

  const startX = event.clientX;
  const startY = event.clientY;
  const gaps = gapsIn(sections);
  const scroller = scrollerOf(figure);
  let dragging = false;
  let rule: HTMLElement | null = null;
  let target: FigureDrop | null = null;

  const draw = (gap: Gap, side: 'start' | 'end' | undefined): void => {
    if (rule === null) {
      rule = document.createElement('div');
      rule.className = 'fig-drop';
      rule.setAttribute('aria-hidden', 'true');
      document.body.append(rule);
    }
    const r = gap.el.getBoundingClientRect();
    /* Only as wide as the side it would take, so the rule SAYS which side —
       which is the other half of what the drop is about to do. */
    const width = side === undefined ? r.width : r.width / 2;
    const left = side === 'end' ? r.right - width : r.left;
    rule.style.top = String(gap.after ? r.bottom : r.top) + 'px';
    rule.style.left = String(left) + 'px';
    rule.style.width = String(width) + 'px';
  };

  const move = (ev: MouseEvent): void => {
    if (!dragging) {
      if (Math.abs(ev.clientX - startX) < slop && Math.abs(ev.clientY - startY) < slop) return;
      dragging = true;
      document.body.classList.add('is-moving-figure');
      figure.classList.add('is-moving');
    }
    /* Scroll while the pointer is held at the top or bottom of the column, so
       a picture can be carried to a step that is not on the screen. */
    if (scroller !== null) {
      const r = scroller.getBoundingClientRect();
      if (ev.clientY < r.top + edge) scroller.scrollTop -= speed;
      else if (ev.clientY > r.bottom - edge) scroller.scrollTop += speed;
    }
    const gap = nearest(gaps, ev.clientX, ev.clientY);
    if (gap === null) return;
    const side = sideAt(gap.el, ev.clientX);
    draw(gap, side);
    target = { sectionId: gap.sectionId, at: gap.at, ...(side === undefined ? {} : { side }) };
  };

  const up = (): void => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    document.body.classList.remove('is-moving-figure');
    figure.classList.remove('is-moving');
    rule?.remove();
    if (dragging && target !== null) commit(target);
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

/** Where the picture ends up — `movedFigureIndex`, so the two cannot disagree. */
export const dropLandsAt = (from: FigureAt, to: FigureDrop): FigureAt =>
  ({ sectionId: to.sectionId, at: movedFigureIndex(from, to) });
