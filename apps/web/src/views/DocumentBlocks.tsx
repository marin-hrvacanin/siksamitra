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
 */

import { Fragment, type ReactNode } from 'react';
import type { ChantDoc, ChantScriptKey, ChantToken, ChantVerse } from '@siksamitra/format';
import { renderToken, unitsBefore, type TokenContext } from './token-renderers.js';

export interface BlockRef {
  readonly id: string;
  readonly kind: 'heading' | 'verse';
  readonly sectionId: string;
  readonly verseId?: string;
}

/** The block list, in document order. Shared by the views and the exporter. */
export function blockRefs(doc: ChantDoc): BlockRef[] {
  const out: BlockRef[] = [];
  for (const section of doc.sections) {
    const title = section.title ?? section.label;
    if (title !== undefined && title !== '') {
      out.push({ id: `h:${section.id}`, kind: 'heading', sectionId: section.id });
    }
    for (const verse of section.verses) {
      out.push({
        id: `v:${section.id}:${verse.id}`,
        kind: 'verse',
        sectionId: section.id,
        verseId: verse.id,
      });
    }
  }
  return out;
}

const FONT_STACK = 'var(--font-body)';

/**
 * One verse, split into lines at its `br` tokens.
 *
 * The lines matter for two reasons: pagination splits between them, and a
 * recitation line is a breath — so it is a real unit of the text and not a
 * consequence of the column width.
 */
function VerseLines(
  { verse, script, showMarks, addressable }: {
    verse: ChantVerse; script: ChantScriptKey; showMarks: boolean; addressable: boolean;
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
            {line.map((t, ti) => renderToken(t, ti, ctx, base + unitsBefore(line, ti)))}
          </div>
        );
      })}
    </>
  );
}

export function DocumentBlocks(
  { doc, script, showMarks, only, addressable = false }: {
    doc: ChantDoc;
    script: ChantScriptKey;
    showMarks: boolean;
    /** Render only these block ids — how the paged view draws one page. */
    only?: ReadonlySet<string>;
    /** The editor is drawing: letters carry `data-u`, verses `data-verse`. */
    addressable?: boolean;
  },
): ReactNode {
  const wanted = (id: string): boolean => only === undefined || only.has(id);

  return (
    <>
      {doc.sections.map((section) => {
        const title = section.title ?? section.label;
        const headingId = `h:${section.id}`;
        return (
          <Fragment key={section.id}>
            {title !== undefined && title !== '' && wanted(headingId) && (
              <h2 className="section__title" data-block-id={headingId}>{title}</h2>
            )}
            {section.verses.map((verse) => {
              const id = `v:${section.id}:${verse.id}`;
              if (!wanted(id)) return null;
              return (
                <div
                  className="verse"
                  data-block-id={id}
                  data-verse={verse.id}
                  data-section={section.id}
                  {...(verse.src === undefined ? { 'data-attested': '1' } : {})}
                  key={verse.id}
                >
                  {verse.n != null && <span className="verse__n" aria-hidden>{verse.n}</span>}
                  <VerseLines
                    verse={verse}
                    script={script}
                    showMarks={showMarks}
                    addressable={addressable}
                  />
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </>
  );
}
