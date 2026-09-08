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
import { AccountPanel } from './AccountPanel.js';
import type { AccountApi } from '../account/useAccount.js';
import type { LibraryDoc } from './library.js';
import type { RecentDoc } from './useRecents.js';

export function Backstage(
  {
    doc, documents, openRef, dirty, recents, canReopen, onOpen, onClose, actions,
    onAbout, account,
  }: {
    doc: ChantDoc | null;
    documents: readonly LibraryDoc[];
    /** Where the open document lives, so its row can say so. `null` for one
     *  that has never been saved. */
    openRef: string | null;
    dirty: boolean;
    recents: readonly RecentDoc[];
    /** Whether a row can be opened again from here — see `canReopen` in
     *  `useDocFile`. A browser cannot reopen a file by name. */
    canReopen: (row: RecentDoc) => boolean;
    onOpen: (ref: string, kind: RecentDoc['kind']) => void;
    onClose: () => void;
    /** New / open / save / export / print — the same ones the ribbon shows. */
    actions: ReactNode;
    /** The About page. A placeholder until there is something to say. */
    onAbout: () => void;
    /** Signing in to Veda Union — see `AccountPanel`. */
    account: AccountApi;
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
        {dirty && <span className="bs__unsaved">unsaved changes</span>}
      </header>

      <div className="bs__body">
        <section className="bs__col">
          <h2 className="bs__lbl">Do</h2>
          <div className="bs__actions">{actions}</div>

          {/*
            ACCOUNT ABOVE INFO. It is about the person rather than about the
            document, and it is the thing somebody comes to this view looking
            for when they came looking for anything but a file.
          */}
          <h2 className="bs__lbl bs__lbl--second">Account</h2>
          <AccountPanel account={account} />

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
          {recents.map((r) => {
            /*
             * A ROW THAT CANNOT BE OPENED SAYS SO rather than disappearing.
             * A file picked in Safari or Firefox leaves no handle the page may
             * keep, so it cannot be reopened by name — but it is still the
             * document somebody was working on yesterday, and dropping it from
             * the list would make the list look broken instead of the browser
             * look limited.
             */
            const can = canReopen(r);
            return (
              <button
                type="button"
                key={r.ref}
                className={r.ref === openRef ? 'bs__item is-on' : 'bs__item'}
                disabled={!can}
                title={can ? r.name : `${r.name} — a browser cannot reopen a file by name; `
                  + 'choose it again with Open'}
                onClick={() => { onOpen(r.ref, r.kind); onClose(); }}
              >
                <Icon name="document" size="md" />
                <span className="bs__item-name">{r.title}</span>
                <span className="bs__item-when">{when(r.at)}</span>
              </button>
            );
          })}

          <h2 className="bs__lbl bs__lbl--second">Library</h2>
          <p className="bs__note">The documents that come with the program.</p>
          {documents.map((d) => (
            <button
              type="button"
              key={d.slug}
              className={d.slug === openRef ? 'bs__item is-on' : 'bs__item'}
              onClick={() => { onOpen(d.slug, 'library'); onClose(); }}
            >
              <Icon name="document" size="md" />
              <span className="bs__item-name">{d.title}</span>
              {d.slug === openRef && <span className="bs__item-when">open</span>}
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
