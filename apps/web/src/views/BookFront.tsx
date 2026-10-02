/**
 * A BOOK'S FIRST TWO PAGES — its title page and its table of contents, as his
 * sādhanā opens: the title large and centred well down the first page, and on
 * the second the contents, a part to a line and its chants under it.
 *
 * The contents are DRAWN FROM THE DOCUMENT, the way Word's own `TOC` field is
 * made from the headings, never stored: a contents page that could disagree
 * with the chapters it lists would be a second copy of them. On a page the
 * page numbers are the page map's (`folios`); a flow has no pages and shows
 * none.
 */
import type { ReactNode } from 'react';
import type { ChantDoc } from '@siksamitra/format';
import { blockId, headingOf } from './blocks.js';

/** The contents: each part where it changes, and the sections under it. */
export function contentsOf(doc: ChantDoc): { level: 'part' | 'section'; text: string; sectionId: string }[] {
  const out: { level: 'part' | 'section'; text: string; sectionId: string }[] = [];
  let part: string | undefined;
  for (const s of doc.sections) {
    if (s.part !== undefined && s.part !== part) out.push({ level: 'part', text: s.part, sectionId: s.id });
    part = s.part;
    const h = headingOf(s);
    /* His contents list two levels — Word's `TOC \o "2-3"` — so a step
       inside a chant is not in it. */
    if (h !== undefined && s.sub !== true) out.push({ level: 'section', text: h, sectionId: s.id });
  }
  return out;
}

export function BookFront(
  { doc, wanted, folios }: {
    doc: ChantDoc;
    wanted: (id: string) => boolean;
    /** The page each section starts on, when there are pages. */
    folios?: ReadonlyMap<string, number>;
  },
): ReactNode {
  return (
    <>
      {doc.cover !== undefined && wanted(blockId.cover()) && (
        <section className="doc__cover" data-block-id={blockId.cover()}>
          <h1 className="doc__cover-title">
            {doc.cover.lines.map((line, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <span className="doc__cover-line" key={i}>{line}</span>
            ))}
          </h1>
        </section>
      )}
      {doc.contents !== undefined && wanted(blockId.contents()) && (
        <nav className="doc__contents" data-block-id={blockId.contents()} aria-label={doc.contents.title}>
          <h2 className="doc__contents-title">{doc.contents.title}</h2>
          {contentsOf(doc).map((e, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <p className={`doc__contents-entry doc__contents-entry--${e.level}`} key={i}>
              <span className="doc__contents-text">{e.text}</span>
              {e.level === 'section' && folios?.get(e.sectionId) !== undefined && (
                <span className="doc__contents-page">{folios.get(e.sectionId)}</span>
              )}
            </p>
          ))}
        </nav>
      )}
    </>
  );
}
