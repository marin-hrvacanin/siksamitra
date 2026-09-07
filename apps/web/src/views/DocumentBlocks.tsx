/**
 * A document as a flat list of measurable blocks.
 *
 * ONE renderer, three views. Flow, paged and web all render THIS — the
 * difference between them is the container it sits in and the theme it sits
 * under, never how a mark is drawn. That is what makes the modes
 * interchangeable rather than three lookalikes that drift apart.
 *
 * Every block carries `data-block-id` so `useMeasure` can find it, and every
 * rendered line carries `data-line` so a long verse can be split between lines
 * rather than mid-line.
 *
 * WHAT A DOCUMENT IS MADE OF, and it is more than verses. This drew section
 * headings and verses and nothing else, so a page of Durgā Sūktam showed nine
 * verses and dropped all eighteen translations on the floor — and a page of
 * the pūjā manual dropped 212 instructions and 54 part headings with them.
 * The document says what it holds; the renderer's job is to draw all of it, in
 * the order `items` gives, which is the format's canonical order.
 *
 * STILL NOT DRAWN: figures and embeds. They are declared in the format and
 * carried through the file untouched, but nothing here renders them yet — so a
 * document with figures is faithful in text and incomplete on the page. Named
 * here rather than silently skipped.
 */

import { Fragment, memo, type ReactNode } from 'react';
import type {
  ChantDoc, ChantItem, ChantScriptKey, ChantSection, ChantToken, ChantVerse,
} from '@siksamitra/format';
import { renderToken, unitsBefore, type TokenContext } from './token-renderers.js';

export interface BlockRef {
  readonly id: string;
  readonly kind: 'heading' | 'verse' | 'part' | 'instruction';
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
  verse: (sectionId: string, verseId: string): string => `v:${sectionId}:${verseId}`,
  source: (sectionId: string): string => `c:${sectionId}`,
} as const;

/** Prefixes of blocks that must not be left alone at the foot of a page. */
export const KEEP_WITH_NEXT = ['p:', 'h:', 'i:'];

/** The section's contents, in canonical order, whichever field holds them. */
function itemsOf(section: ChantSection): readonly ChantItem[] {
  if (section.items !== undefined && section.items.length > 0) return section.items;
  return section.verses.map((v) => ({ t: 'verse', ...v }) as ChantItem);
}

/** The heading text of a section: its printed number and its name. */
function headingOf(section: ChantSection): string | undefined {
  const title = section.title ?? section.label;
  if (title === undefined || title === '') return undefined;
  return section.n === undefined ? title : `${section.n}. ${title}`;
}

/** Where the section's words come from, if it says. */
function sourceOf(section: ChantSection): string | undefined {
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

const FONT_STACK = 'var(--doc-verse-face)';

/**
 * One verse, split into lines at its `br` tokens.
 *
 * The lines matter for two reasons: pagination splits between them, and a
 * recitation line is a breath — so it is a real unit of the text and not a
 * consequence of the column width.
 */
function VerseLines(
  { verse, script, showMarks, addressable, number }: {
    verse: ChantVerse; script: ChantScriptKey; showMarks: boolean; addressable: boolean;
    /** The page's own verse number, drawn in the gutter of the FIRST line. */
    number?: string;
  },
): ReactNode {
  // Split at `br`: a recitation line is a BREATH, so it is a real unit of the
  // text and not a consequence of the column width. Pagination splits between
  // these, never inside one.
  const lines: ChantToken[][] = [[]];
  for (const t of verse.tokens) {
    if (t.t === 'br') lines.push([]);
    else lines[lines.length - 1]!.push(t);
  }
  const ctx: TokenContext = {
    script, showMarks, fontStack: FONT_STACK, ...(addressable ? { addressable } : {}),
  };

  /*
   * The unit counter runs over the WHOLE verse, not per line: `SrcMap.units`
   * is one entry per letter of the verse in token order, and a `br` contributes
   * none. A per-line counter would address every letter after the first break
   * to the wrong source offset — the mark would land a line early.
   */
  let offset = 0;
  return (
    <>
      {lines.map((line, li) => {
        const base = offset;
        offset += unitsBefore(line, line.length);
        return (
          <div className="pada" data-line={li} key={li}>
            {/*
              INSIDE the first line, not floating beside the verse. Positioned
              absolutely against the verse it sat on its own tiny line box, a
              third of a line above the text it numbers — which reads as a
              footnote marker. On the line, its baseline is the line's baseline,
              because it is the same line.
            */}
            {li === 0 && number !== undefined && (
              <span className="verse__n" aria-hidden>{number}</span>
            )}
            {line.map((t, ti) => renderToken(t, ti, ctx, base + unitsBefore(line, ti)))}
          </div>
        );
      })}
    </>
  );
}

/**
 * MEMOISED, and this is the difference between an editor and a slideshow.
 *
 * The caret and the selection are drawn imperatively — a rectangle, and a
 * class toggle on the letters in range — precisely so that moving the caret
 * does not touch the document. But the component was re-created on every
 * render anyway, so a single arrow key rebuilt all 198 verses of Śrī Rudram
 * through `renderSyl`: measured at 377–438 ms per keystroke, in long tasks of
 * 300–470 ms. Holding an arrow key down blocked the main thread.
 *
 * The props are all primitives or stable references, so this comparison is
 * exact rather than a guess.
 */
function DocumentBlocksInner(
  { doc, script, showMarks, only, addressable = false }: {
    doc: ChantDoc;
    script: ChantScriptKey;
    showMarks: boolean;
    /** Render only these block ids — how the paged view draws one page. */
    only?: ReadonlySet<string>;
    /**
     * The editor is drawing: letters carry `data-u` and verses `data-verse`.
     *
     * ALL of it is gated on this, not just `data-u`. The paged view renders
     * the document twice — the second copy is an off-screen probe used to
     * measure block heights — and while the probe carried `data-verse` it won
     * every `querySelector`, so the caret was drawn at x = −99985 and the
     * selection highlight never appeared.
     */
    addressable?: boolean;
  },
): ReactNode {
  const wanted = (id: string): boolean => only === undefined || only.has(id);
  /* A part heading is drawn where the part CHANGES — it names a run of steps,
     not a step, so repeating it above each one would be noise. */
  let part: string | undefined;

  return (
    <>
      {doc.sections.map((section) => {
        const partHere = section.part !== undefined && section.part !== part
          ? section.part
          : undefined;
        /* A section with no part ends the run, so the next section that names
           the same part heads a NEW run and gets its heading again. */
        part = section.part;
        const heading = headingOf(section);
        return (
          <Fragment key={section.id}>
            {partHere !== undefined && wanted(blockId.part(section.id)) && (
              <h2 className="doc__part" data-block-id={blockId.part(section.id)}>
                {partHere}
              </h2>
            )}
            {heading !== undefined && wanted(blockId.heading(section.id)) && (
              <h3 className="section__title" data-block-id={blockId.heading(section.id)}>
                {heading}
              </h3>
            )}
            {itemsOf(section).map((item, at) => {
              if (item.t === 'instruction') {
                const id = blockId.instruction(section.id, at);
                if (!wanted(id)) return null;
                return (
                  <p className="doc__instruction" data-block-id={id} key={id}>
                    {item.instruction.text.en}
                  </p>
                );
              }
              if (item.t !== 'verse') return null;
              const id = blockId.verse(section.id, item.id);
              if (!wanted(id)) return null;
              return (
                <div
                  className="verse"
                  data-block-id={id}
                  {...(addressable
                    ? {
                      'data-verse': item.id,
                      'data-section': section.id,
                      ...(item.src === undefined ? { 'data-attested': '1' } : {}),
                    }
                    : {})}
                  key={item.id}
                >
                  {/*
                    A COPIED VERSE SAYS SO, where it is.
                    The lock in the margin was a mystery — "what are those
                    little lock symbols?" — because a shape alone teaches
                    nothing. It is a real element now, so hovering it explains,
                    and a screen reader reads it.
                  */}
                  {addressable && item.src === undefined && (
                    <span
                      className="verse__locked"
                      title={'Copied from a marked source. Its marks record what someone '
                        + 'wrote by hand, so the text under them cannot be edited here.'}
                    >
                      <span className="u-only-read">Copied from a marked source</span>
                    </span>
                  )}
                  <VerseLines
                    verse={item}
                    script={script}
                    showMarks={showMarks}
                    addressable={addressable}
                    {...(item.n == null ? {} : { number: `${item.n}` })}
                  />
                  {(item.instructions ?? []).map((ins, k) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <p className="doc__instruction" key={k}>{ins.text.en}</p>
                  ))}
                  {item.translation !== undefined && (
                    <p className="doc__translation">{item.translation.en}</p>
                  )}
                  {item.source !== undefined && (
                    <p className="doc__source">{item.source}</p>
                  )}
                </div>
              );
            })}
            {/* A block of its own, with an id: an element the page map has
                never heard of would be drawn again on every page of the
                section rather than once, under it. */}
            {sourceOf(section) !== undefined && wanted(blockId.source(section.id)) && (
              <p className="doc__source" data-block-id={blockId.source(section.id)}>
                {sourceOf(section)}
              </p>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

export const DocumentBlocks = memo(DocumentBlocksInner);
