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
import { renderToken } from './token-renderers.js';

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
  { verse, script, showMarks }: {
    verse: ChantVerse; script: ChantScriptKey; showMarks: boolean;
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
  const ctx = { script, showMarks, fontStack: FONT_STACK };

  return (
    <>
      {lines.map((line, li) => (
        <div className="pada" data-line={li} key={li}>
          {line.map((t, ti) => renderToken(t, ti, ctx))}
        </div>
      ))}
    </>
  );
}

export function DocumentBlocks(
  { doc, script, showMarks, only }: {
    doc: ChantDoc;
    script: ChantScriptKey;
    showMarks: boolean;
    /** Render only these block ids — how the paged view draws one page. */
    only?: ReadonlySet<string>;
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
                <div className="verse" data-block-id={id} key={verse.id}>
                  {verse.n != null && <span className="verse__n" aria-hidden>{verse.n}</span>}
                  <VerseLines verse={verse} script={script} showMarks={showMarks} />
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </>
  );
}
