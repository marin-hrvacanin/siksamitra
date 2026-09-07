/**
 * THE FILE VIEW — Word's backstage.
 *
 * A whole-window place for everything that is about the FILE rather than about
 * the text: what you have open, what you had open, what the program ships
 * with, and where a document goes next. It replaces a dropdown of chant names
 * in the ribbon, which was the wrong control twice over — a `<select>` is for
 * choosing a value inside a document, not for opening one, and it showed a
 * single line of the thing you were trying to choose between.
 *
 * It covers the editor completely, on purpose. Opening a file is not something
 * you do WHILE writing, and a half-covered document behind a panel invites the
 * question of which one the next keystroke belongs to.
 *
 * The way back is the arrow, Escape, or opening something — the three ways
 * every backstage in every program of this shape closes.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import type { ChantDoc } from '@siksamitra/format';
import { Icon } from '../ui/Icon.js';
import type { RecentDocument } from './useRecents.js';

export function Backstage(
  { doc, documents, slug, recents, onSlug, onClose, actions, onAbout }: {
    doc: ChantDoc | null;
    documents: readonly { slug: string; title: string }[];
    slug: string;
    recents: readonly RecentDocument[];
    onSlug: (slug: string) => void;
    onClose: () => void;
    /** Open / save / export / print — the same ones the ribbon shows. */
    actions: ReactNode;
    /** The About page. A placeholder until there is something to say. */
    onAbout: () => void;
  },
): ReactNode {
  const back = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    /* The keyboard lands on the way out, so Escape and Tab both work from the
       moment it opens rather than after a click somewhere. */
    back.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);

  const when = (iso: string): string => {
    const then = new Date(iso);
    const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    return then.toLocaleDateString();
  };

  return (
    <div className="bs" role="dialog" aria-label="File" aria-modal>
      <header className="bs__head">
        <button
          type="button"
          className="bs__back"
          ref={back}
          onClick={onClose}
          aria-label="Back to the document"
          title="Back to the document (Esc)"
        >
          <Icon name="chevron" size="md" className="bs__back-arrow" />
          <span>Back</span>
        </button>
        <h1 className="bs__title">{doc?.title ?? 'No document'}</h1>
      </header>

      <div className="bs__body">
        <section className="bs__col">
          <h2 className="bs__lbl">Do</h2>
          <div className="bs__actions">{actions}</div>

          <h2 className="bs__lbl bs__lbl--second">Info</h2>
          {/*
            A PLACEHOLDER, and honest about it. What belongs here is what a
            document says about itself — where its text came from, which
            profile derived it, how much of it is copied rather than derived,
            when it was last written. None of that is wired up yet, and a page
            of invented facts would be worse than a page that says so.
          */}
          <div className="bs__info">
            <p className="bs__note">
              {doc === null
                ? 'Nothing open.'
                : `${doc.sections.length} section${doc.sections.length === 1 ? '' : 's'}, `
                  + `${doc.sections.reduce((n, x) => n + x.verses.length, 0)} verses.`}
            </p>
            <p className="bs__note">
              What a document says about itself — its sources, what derived it,
              what was copied — will live here.
            </p>
            <button type="button" className="bs__about" onClick={onAbout}>
              About śikṣāmitra
            </button>
          </div>
        </section>

        <section className="bs__col bs__col--wide">
          <h2 className="bs__lbl">Recent</h2>
          {recents.length === 0 && (
            <p className="bs__empty">
              Nothing yet. What you open appears here, most recent first.
            </p>
          )}
          {recents.map((r) => (
            <button
              type="button"
              key={r.slug}
              className={r.slug === slug ? 'bs__item is-on' : 'bs__item'}
              onClick={() => { onSlug(r.slug); onClose(); }}
            >
              <Icon name="document" size="md" />
              <span className="bs__item-name">{r.title}</span>
              <span className="bs__item-when">{when(r.at)}</span>
            </button>
          ))}

          <h2 className="bs__lbl bs__lbl--second">Library</h2>
          <p className="bs__note">The documents that come with the program.</p>
          {documents.map((d) => (
            <button
              type="button"
              key={d.slug}
              className={d.slug === slug ? 'bs__item is-on' : 'bs__item'}
              onClick={() => { onSlug(d.slug); onClose(); }}
            >
              <Icon name="document" size="md" />
              <span className="bs__item-name">{d.title}</span>
              {d.slug === slug && <span className="bs__item-when">open</span>}
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
