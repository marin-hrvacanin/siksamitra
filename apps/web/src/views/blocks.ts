/**
 * WHAT A DOCUMENT IS MADE OF, as a flat list of addressable blocks.
 *
 * The block list is not the drawing. `DocumentBlocks` draws; this says what
 * there is, in the format's canonical order, and what each piece is called —
 * and four things read it that never render anything: the pagination
 * (`useMeasure` finds `[data-block-id]`), the page map, the navigation panel's
 * outline, and the exporter.
 *
 * Split out of `DocumentBlocks.tsx` when that file crossed the 400-line limit
 * `check:modules` holds new code to. The division is the honest one: an id is a
 * fact about the document, and a `<figure>` element is a fact about the page.
 */
import { figureItem } from '@siksamitra/format';
import type {
  ChantDoc, ChantFigure, ChantItem, ChantSection, FigureItemRead,
} from '@siksamitra/format';

export interface BlockRef {
  readonly id: string;
  readonly kind: 'heading' | 'verse' | 'part' | 'instruction' | 'figure';
  readonly sectionId: string;
  readonly verseId?: string;
}

/**
 * The ids, in one place.
 *
 * Pagination reads the PREFIX to decide what may be orphaned (`isHeading` in
 * `PagedView`), so the prefixes are part of the contract and not decoration.
 */
export const blockId = {
  part: (sectionId: string): string => `p:${sectionId}`,
  heading: (sectionId: string): string => `h:${sectionId}`,
  instruction: (sectionId: string, at: number): string => `i:${sectionId}:${at}`,
  /* A picture is addressed by WHERE IT IS, not by its own id: the same drawing
     is used at five steps of the pūjā manual through `ref`, so an id would name
     five blocks at once and the page map would put all five on one page. */
  figure: (sectionId: string, at: number): string => `f:${sectionId}:${at}`,
  verse: (sectionId: string, verseId: string): string => `v:${sectionId}:${verseId}`,
  source: (sectionId: string): string => `c:${sectionId}`,
} as const;

/** Prefixes of blocks that must not be left alone at the foot of a page. */
export const KEEP_WITH_NEXT = ['p:', 'h:', 'i:'];

/** The section's contents, in canonical order, whichever field holds them. */
export function itemsOf(section: ChantSection): readonly ChantItem[] {
  if (section.items !== undefined && section.items.length > 0) return section.items;
  return section.verses.map((v) => ({ t: 'verse', ...v }) as ChantItem);
}

/**
 * The figure an item draws, whether it carries one or points at one.
 *
 * A drawing used at five steps of the pūjā manual ships once in
 * `ChantDoc.figures` and is addressed by `ref`, so resolving the reference is
 * part of reading the item — not an optimisation a renderer may skip.
 *
 * `figureItem` FROM THE FORMAT does the resolving now, and the reason is what
 * this comment used to say: "a `ref` that resolves to nothing draws nothing …
 * inventing a placeholder for a figure with no alt text would be inventing the
 * alt text too." Drawing nothing is not the alternative to inventing alt text
 * — SAYING SO is. Six pieces of code resolved a ref and five of them dropped
 * the miss in silence, so a document naming a picture it does not have showed
 * a manual with a step missing and no way to find out why.
 */
export const figureOf = (
  item: Extract<ChantItem, { t: 'figure' }>,
  library: ReadonlyMap<string, ChantFigure>,
): FigureItemRead => figureItem(item, library);

/** The heading text of a section: its printed number and its name. */
export function headingOf(section: ChantSection): string | undefined {
  const title = section.title ?? section.label;
  if (title === undefined || title === '') return undefined;
  return section.n === undefined ? title : `${section.n}. ${title}`;
}

/** Where the section's words come from, if it says. */
export function sourceOf(section: ChantSection): string | undefined {
  return section.source == null || section.source === '' ? undefined : section.source;
}

/** The block list, in document order. Shared by the views and the exporter. */
export function blockRefs(doc: ChantDoc): BlockRef[] {
  const out: BlockRef[] = [];
  let part: string | undefined;
  for (const section of doc.sections) {
    /* A section with no part ends the run — see `outlineOf`, which draws the
       same tree and must agree with this list. */
    if (section.part === undefined) part = undefined;
    else if (section.part !== part) {
      out.push({ id: blockId.part(section.id), kind: 'part', sectionId: section.id });
      part = section.part;
    }
    if (headingOf(section) !== undefined) {
      out.push({ id: blockId.heading(section.id), kind: 'heading', sectionId: section.id });
    }
    itemsOf(section).forEach((item, at) => {
      if (item.t === 'verse') {
        out.push({
          id: blockId.verse(section.id, item.id),
          kind: 'verse',
          sectionId: section.id,
          verseId: item.id,
        });
      } else if (item.t === 'instruction') {
        out.push({
          id: blockId.instruction(section.id, at),
          kind: 'instruction',
          sectionId: section.id,
        });
      } else if (item.t === 'figure') {
        out.push({
          id: blockId.figure(section.id, at),
          kind: 'figure',
          sectionId: section.id,
        });
      }
    });
    if (sourceOf(section) !== undefined) {
      out.push({
        id: blockId.source(section.id),
        kind: 'instruction',
        sectionId: section.id,
      });
    }
  }
  return out;
}
