/**
 * BETWEEN THE BROWSER'S SELECTION AND OURS.
 *
 * The document on screen is a projection of the source: `agnim īḷe` in the
 * file becomes syllable boxes with holdings around them and accents above the
 * line, and the anusvāra may be drawn as `gṁ`. So the browser's idea of "the
 * caret is here" is a position in the PROJECTION, and every command needs a
 * position in the SOURCE. This module is that translation, in both directions.
 *
 * WHY THE BROWSER OWNS THE CARET AND THE SELECTION.
 *
 * NOT FOR SPEED. That was the first answer and the measurement did not support
 * it, which is worth recording so nobody reaches for it again. Dragging a
 * selection across Śrī Rudram — 198 verses, about 15,000 inline boxes — costs
 * roughly 45 ms per mouse-move. The profile blames the engine's own layout, so
 * the old hand-drawn caret's `getBoundingClientRect` looked guilty. The
 * control says otherwise: the same drag in READ mode, with no editor code
 * running and not one `contenteditable` element on the page, costs about
 * 54 ms. The browser pays that cost either way; the remedy is to stop
 * rendering a whole 198-verse document at once, which is not done. On the
 * documents this program is usually pointed at — Durgā Sūktam, 788 letters —
 * a drag costs 10 ms a move against 8 ms of harness overhead, which is to say
 * it costs nothing.
 *
 * THE REASON IS CORRECTNESS. A caret is not a rectangle. It is the I-beam
 * pointer, drag-select, double-click for a word, triple-click for a line,
 * shift-click to extend, arrows that know where a line wrapped, word motion
 * that knows the font, Home and End, an accessible cursor, and an IME — which
 * is also how half the diacritics in this program get typed. Every one of
 * those had to be written here, most were written badly, and none of them is
 * ours to own.
 *
 * `tools/perf-selection.mjs` is the measurement, so the numbers above can be
 * re-run rather than believed.
 *
 * WHAT WE STILL OWN: the document. The DOM is never allowed to be edited — see
 * `EditorSurface`, which refuses every `beforeinput` and applies the change to
 * the model instead. The browser may select; only we may change.
 */
import type { SrcMap } from '@siksamitra/engine';
import { addressAt, type CaretAddress, type FlatSource } from '@siksamitra/edit';
import { addressOfUnit, type UnitHit } from './unit-map.js';

/** Where in the projection a DOM position falls. */
export interface DomPoint {
  readonly node: Node;
  readonly offset: number;
}

/**
 * The letter a DOM position is in, and which side of it.
 *
 * A `[data-u]` element is ATOMIC: it may be one Latin letter, or an akṣara
 * standing for three units, and the caret cannot land inside a shaped
 * conjunct. So the only question is which side, and the answer is whether the
 * position is at the very start of the element's text.
 */
export function hitAtDom(point: DomPoint): UnitHit | null {
  const { node, offset } = point;
  const el = elementAt(node, offset);
  if (el === null) return null;

  const letter = el.closest<HTMLElement>('[data-u]');
  /*
   * ABOVE THE VERSES AS WELL AS INSIDE THEM.
   *
   * Ctrl+A puts the selection's ends on the editable host itself, which is an
   * ancestor of every verse and inside none — so `closest` found nothing and
   * the whole position was reported as unmappable. The model then kept a stale
   * caret from before while the browser showed the entire document
   * highlighted: a highlight that told the eye one story and the document
   * another. Descending to the verse the position falls at answers it.
   */
  const verse = (letter ?? el).closest<HTMLElement>('[data-verse]') ?? verseNear(el, node, offset);
  if (verse === null) return null;

  const verseId = verse.dataset['verse'] ?? '';
  const sectionId = verse.dataset['section'] ?? '';
  const attested = verse.dataset['attested'] === '1';

  if (letter === null) {
    /*
     * Inside a verse but not on a letter — in a gap, on a verse number, past
     * the end of a line. The nearest letter BEFORE the position wins, because
     * that is where the caret visibly is; falling back to the start of the
     * verse moved it lines away from where it was put.
     */
    const near = nearestLetter(verse, node, offset);
    if (near === null) return { verseId, sectionId, unit: 0, span: 1, after: false, attested };
    return {
      verseId,
      sectionId,
      unit: Number(near.el.dataset['u'] ?? '0'),
      span: Number(near.el.dataset['un'] ?? '1'),
      after: near.after,
      attested,
    };
  }

  return {
    verseId,
    sectionId,
    unit: Number(letter.dataset['u'] ?? '0'),
    span: Number(letter.dataset['un'] ?? '1'),
    after: atEndOf(letter, node, offset),
    attested,
  };
}

/** A DOM position, as an address in the source. */
export function addressAtDom(
  point: DomPoint,
  srcMapIn: (sectionId: string, verseId: string) => SrcMap | null,
  flatFor: (sectionId: string) => FlatSource,
): { at: CaretAddress; sectionId: string } | null {
  const hit = hitAtDom(point);
  if (hit === null) return null;
  const map = srcMapIn(hit.sectionId, hit.verseId);
  const flat = flatFor(hit.sectionId);

  if (map !== null) {
    const at = addressOfUnit(hit.verseId, map, hit);
    if (at !== null) return { at, sectionId: hit.sectionId };
  }

  /*
   * A TRANSCRIBED VERSE HAS NO SOURCE MAP, AND IT DOES HAVE A PLACE.
   *
   * It has no `src`, so `srcMapFor` returns null and a unit cannot be turned
   * into a column. It is NOT absent from the flat source: `sourcesOf` falls
   * back to `linesFromTokens` for exactly these verses, which is how rule zero
   * finds them in order to refuse an edit that reaches one.
   *
   * An earlier version of this file believed otherwise — that such a verse
   * "contributes no lines" — and clamped the caret to the END OF THE PREVIOUS
   * VERSE. That was silent data loss: clicking anywhere in Durgā Sūktam's
   * third verse put the caret in the second, the status bar named the second,
   * rule zero saw an edit entirely inside an editable verse and allowed it,
   * and the letter landed several lines from where the person clicked.
   *
   * So the caret goes to the start of the LINE that was clicked, inside the
   * verse that was clicked. Not the exact letter — without a source map there
   * is no way to know which column a letter is at, and guessing would be the
   * same mistake in a smaller form. Rule zero then refuses any edit there and
   * names the right verse.
   */
  const at = addressAt(flat, lineStartOf(point, hit.verseId, flat));
  return at === null ? null : { at, sectionId: hit.sectionId };
}

/**
 * Where to put the browser's caret for one of our addresses.
 *
 * The inverse, used after every edit: React rebuilds the letters, which throws
 * the DOM selection away, and this puts it back where the model says it is.
 */
export function domPointOf(
  scroller: HTMLElement,
  sectionId: string,
  verseId: string,
  place: { unit: number; after: boolean },
): DomPoint | null {
  /*
   * SCOPED TO THE SECTION AND PAST THE PROBE, by iterating rather than by a
   * clever selector.
   *
   * The paged view renders the document TWICE — once off-screen, at
   * `left: -99999px`, to measure block heights — and the probe comes first in
   * document order. A `querySelector` with an alternation does not help: it
   * returns the first match in document order across the whole list, so the
   * unscoped alternative silently wins and the caret goes to x = −99985 where
   * nobody can see it. Walking the matches and rejecting anything inside the
   * probe is what the old `verseElement` did, correctly, and is what this
   * needs to do too.
   */
  const verse = [...scroller.querySelectorAll<HTMLElement>(
    `[data-verse="${cssEscape(verseId)}"]`,
  )].find((el) => (
    el.closest('.paged__probe') === null
    && (sectionId === '' || el.dataset['section'] === sectionId)
  ));
  if (verse === undefined) return null;

  const letter = verse.querySelector<HTMLElement>(`[data-u="${place.unit}"]`)
    ?? verse.querySelector<HTMLElement>('[data-u]');
  if (letter === null) return { node: verse, offset: 0 };

  const text = deepestText(letter, place.after);
  if (text === null) return { node: letter, offset: place.after ? letter.childNodes.length : 0 };
  return { node: text, offset: place.after ? text.data.length : 0 };
}

/* ── the small, dull parts ──────────────────────────────────────────────── */

/** `CSS.escape`, where it exists; an id of ours is safe without it. */
const cssEscape = (v: string): string => (
  typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(v) : v
);

/** The element a DOM position is inside, whether it names a text node or not. */
function elementAt(node: Node, offset: number): HTMLElement | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.parentElement as HTMLElement | null);
  }
  if (node instanceof HTMLElement) {
    const child = node.childNodes[Math.min(offset, node.childNodes.length - 1)];
    if (child instanceof HTMLElement) return child;
    if (child?.parentElement instanceof HTMLElement) return child.parentElement;
    return node;
  }
  return null;
}

/** Is this position at the end of the letter's text rather than its start? */
function atEndOf(letter: HTMLElement, node: Node, offset: number): boolean {
  if (node === letter) return offset >= letter.childNodes.length;
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node as Text;
    /* Half-way through a multi-character letter counts as after it: the letter
       is atomic, and rounding down would make the right half of an akṣara
       behave like its left. */
    return offset >= text.data.length || offset > 0;
  }
  return offset > 0;
}

/**
 * The last letter at or before a position inside a verse.
 *
 * Reached when the browser reports a position on a CONTAINER rather than on a
 * letter — a click in the gutter, on the verse number, or past the end of a
 * line. The DOM offset then counts child nodes, not characters, so the answer
 * is "which letter does this child index fall after".
 *
 * An earlier version compared document positions instead, and got it exactly
 * backwards for the commonest case: when the reported element CONTAINS the
 * letters, `compareDocumentPosition` says `CONTAINED_BY`, which is neither
 * `PRECEDING` nor `CONTAINS`, so the loop broke on its first step and returned
 * the verse's FIRST letter — moving the caret to the top of a four-line verse
 * whichever line was clicked. That is the regression `unit-map.ts` records
 * having already fixed once.
 */
function nearestLetter(
  verse: HTMLElement,
  node: Node,
  offset: number,
): { el: HTMLElement; after: boolean } | null {
  const letters = [...verse.querySelectorAll<HTMLElement>('[data-u]')];
  if (letters.length === 0) return null;

  /* An element position names a slot between its children, so the letters
     inside the children before that slot are the ones already passed. */
  if (node.nodeType !== Node.TEXT_NODE && node instanceof HTMLElement) {
    const upto = [...node.childNodes].slice(0, offset);
    const passed = upto.reduce(
      (n, child) => n + (child instanceof HTMLElement
        ? child.querySelectorAll('[data-u]').length + (child.hasAttribute('data-u') ? 1 : 0)
        : 0),
      0,
    );
    const before = [...verse.querySelectorAll<HTMLElement>('[data-u]')]
      .filter((l) => node.contains(l));
    const chosen = before[Math.min(Math.max(passed, 1), before.length) - 1] ?? letters[0];
    return { el: chosen as HTMLElement, after: passed > 0 };
  }

  /* A text node outside any letter — whitespace between them. The letter it
     follows is the last one before it in document order. */
  let last: HTMLElement | null = null;
  for (const letter of letters) {
    const where = node.compareDocumentPosition(letter);
    if ((where & Node.DOCUMENT_POSITION_PRECEDING) !== 0) { last = letter; continue; }
    break;
  }
  return last === null
    ? { el: letters[0] as HTMLElement, after: false }
    : { el: last, after: true };
}

/** The first or last text node under an element. */
function deepestText(el: HTMLElement, last: boolean): Text | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let found: Text | null = null;
  while (walker.nextNode() !== null) {
    found = walker.currentNode as Text;
    if (!last) return found;
  }
  return found;
}

/**
 * The start of the line a DOM position is in, within its own verse.
 *
 * The rendered line index is on the `.pada` element, and the flat source keeps
 * its lines in the same order, so the two line up without a source map. A
 * position that is not inside a `.pada` at all — the gutter, the verse number
 * — takes the verse's first line, which is inside the right verse and is the
 * only honest answer.
 */
function lineStartOf(point: DomPoint, verseId: string, flat: FlatSource): number {
  const lines = flat.lineStarts.filter((l) => l.verseId === verseId);
  const first = lines[0];
  if (first === undefined) return 0;

  const el = elementAt(point.node, point.offset);
  const pada = el?.closest<HTMLElement>('.pada') ?? null;
  const index = pada === null ? 0 : Number(pada.dataset['line'] ?? '0');
  return (lines[index] ?? first).at;
}

/**
 * The verse a position OUTSIDE any verse belongs to.
 *
 * There is a great deal of a document that is not a verse: a section heading,
 * a translation, a source line, an instruction, the space between two of them
 * — and Ctrl+A lands on two of those, one at each end. Reporting such a
 * position as unmappable left the model holding a stale caret while the
 * browser showed the whole document highlighted, which is a highlight that
 * tells the eye one story and the document another.
 *
 * So the nearest verse in DOCUMENT ORDER wins: the last one before the
 * position, or — for a position before any of them, such as the first
 * heading — the first one after it. That is what "select from here" means
 * when "here" is a heading.
 */
function verseNear(el: HTMLElement, node: Node, offset: number): HTMLElement | null {
  /* Scoped to the page it is in. A position with no `.doc` above it is not in
     a document at all — an element that has been detached, or a click in some
     other part of the window — and is not a position in the text. */
  const page = el.closest<HTMLElement>('.doc');
  if (page === null) return null;
  const verses = [...page.querySelectorAll<HTMLElement>('[data-verse]')];
  if (verses.length === 0) return null;

  /* Inside this element rather than beside it: a position on a container that
     holds verses names one of its own. */
  const inside = el.querySelectorAll<HTMLElement>('[data-verse]');
  if (inside.length > 0) {
    const atEnd = node.nodeType !== Node.TEXT_NODE && offset >= node.childNodes.length;
    return (atEnd ? inside[inside.length - 1] : inside[0]) ?? null;
  }

  let before: HTMLElement | null = null;
  for (const verse of verses) {
    const where = el.compareDocumentPosition(verse);
    if ((where & Node.DOCUMENT_POSITION_PRECEDING) !== 0) { before = verse; continue; }
    break;
  }
  return before ?? verses[0] ?? null;
}
