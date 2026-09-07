/**
 * The application shell.
 *
 * Tool chrome, not a landing page: one UI face, dense controls, hairlines, a
 * real status bar. The only reading face on screen is the text being edited.
 *
 * Deliberately thin. It builds the command context, wires the keyboard to the
 * command registry, and chooses a view — it contains no action logic of its
 * own, so adding a feature does not grow this file. That is the discipline the
 * module gate exists to keep: v1's editor reached 720 KB by having every
 * feature add "just a bit" to one place.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChantDoc, ChantScriptKey } from '@siksamitra/format';
import { anchorAt, scrollTopFor, type BlockOffset, type ViewKind } from '@siksamitra/layout';
import { FlowView } from './views/FlowView.js';
import { PagedView } from './views/PagedView.js';
import { StatusBar } from './shell/StatusBar.js';
import { AppTitleBar } from './shell/AppTitleBar.js';
import { NavPanel } from './shell/NavPanel.js';
import { DOCUMENTS, FileView } from './shell/FileView.js';
import { useRecents } from './shell/useRecents.js';
import { useAccount } from './account/useAccount.js';
import { Toolbar } from './shell/Toolbar.js';
import { Icon } from './ui/Icon.js';
import { handleKey, type CommandContext } from './shell/commands.js';
import { EditorSurface } from './editor/EditorSurface.js';
import { useSession } from './editor/useSession.js';
import { useRecording } from './audio/useRecording.js';
import { mapRecording } from './audio/map-in-browser.js';
import { AudioBar } from './shell/AudioGroup.js';
import { useViewState } from './state/useViewState.js';
import { useViewport } from './state/useViewport.js';
import { useElementWidth } from './state/useElementWidth.js';
import { useDocument } from './state/useDocument.js';
import { useAppearance } from './state/useAppearance.js';

/** A document-shaped nothing, so the session hook is never conditional. */
const EMPTY_DOC = { title: '', titleForms: {}, sections: [] };

export function App() {
  const viewport = useViewport();
  const look = useAppearance();
  const scroller = useRef<HTMLDivElement>(null);
  /*
   * The zoom fits the DOCUMENT's column, not the window. With the navigation
   * panel open the two differ by its width, and fitting to the window put a
   * 793px page into a 676px column with its right margin off the edge.
   */
  const canvasWidth = useElementWidth(scroller);
  const documentViewport = useMemo(
    () => ({
      width: canvasWidth > 0 ? canvasWidth : viewport.width,
      height: viewport.height,
    }),
    [canvasWidth, viewport],
  );
  const state = useViewState(documentViewport, look.mode);
  const [slug, setSlug] = useState(DOCUMENTS[0]!.slug);
  const fetched = useDocument(slug);
  /*
   * A document opened FROM A FILE outranks the one fetched by slug, until
   * another slug is picked. Two sources, one winner, and the rule stated here
   * rather than in the picker — otherwise "Open" and the document list would
   * each think they were in charge.
   */
  const [file, setFile] = useState<{ doc: ChantDoc; name: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const opened = file?.doc ?? fetched.doc;
  const error = file === null ? fetched.error : null;
  /*
   * The session owns the document from here on: what is on screen is the
   * EDITED document, not the one that was fetched. One source of truth, so a
   * view cannot show text the editor does not have.
   */
  const session = useSession(opened ?? EMPTY_DOC);
  const doc = opened === null ? null : session.doc;
  const [script, setScript] = useState<ChantScriptKey>('iast');
  const [showMarks, setShowMarks] = useState(true);
  /*
   * The shell's own state: which ribbon tab is front, whether the ribbon is
   * folded away (Ctrl+F1), and whether the navigation panel is open. Here
   * rather than in each component because all three survive a document change
   * — closing the panel and having it reopen when you open another chant is
   * the kind of small betrayal that stops a panel being used.
   */
  const [tab, setTab] = useState('home');
  /*
   * THE RECITATION, if there is one.
   *
   * The player is here rather than inside the Audio tab because the tab
   * unmounts when another tab is front, and a recording that stopped every
   * time somebody looked at the Marking tab would be useless. The document is
   * the session's, so the highlight follows an edit.
   */
  const audio = useRecording(doc);
  const mapAudio = useCallback((chosen: File) => {
    if (doc === null) return;
    setNote(`Listening to ${chosen.name}…`);
    void mapRecording(doc, chosen)
      .then((result) => { session.setRecording(result.doc); setNote(result.note); })
      .catch((e: unknown) => setNote(`Could not map ${chosen.name}: ${String(e)}`));
  }, [doc, session]);
  const [folded, setFolded] = useState(false);
  const [navOpen, setNavOpen] = useState(true);
  /* Which outline rows are expanded. HERE rather than in the panel, because
     the panel unmounts when it is hidden and would forget them. */
  const [navRows, setNavRows] = useState<ReadonlySet<string>>(new Set());
  /** The File view — a place, over the whole window, not a panel. */
  const [fileOpen, setFileOpen] = useState(false);

  const recents = useRecents(slug, doc?.title ?? null);
  /*
   * THE ACCOUNT LIVES HERE, not inside the File view.
   *
   * The File view unmounts when it closes, and a sign-in takes as long as it
   * takes somebody to find their browser — a person who closed the panel to
   * look at their document would come back to a sign-in that had been thrown
   * away mid-conversation.
   */
  const account = useAccount();
  /*
   * THE PANEL GETS OUT OF THE WAY, rather than being closed for good. Below
   * this width the navigator and an A4 column cannot both have room — at
   * 620px the panel took 224 of it and the page was cut off — so it hides
   * itself and comes back when the window does. The user's own choice is
   * remembered separately, which is why this is two values and not one:
   * closing it at 1400px must not reopen it at 1400px next time, and hiding it
   * at 600px must not look like the user closed it.
   */
  const navShown = navOpen && viewport.width >= 880;

  /** Scroll a block into view — what the navigation panel asks for. */
  const goToBlock = useCallback((id: string) => {
    const el = scroller.current;
    if (el === null) return;
    const block = [...el.querySelectorAll<HTMLElement>('[data-block-id]')]
      .find((b) => b.dataset['blockId'] === id && b.closest('.paged__probe') === null);
    if (block === undefined) return;
    /* Positioned, not `scrollIntoView`: the heading should land just under the
       top of the column with a little air, not flush against the ribbon. */
    const base = el.getBoundingClientRect().top - el.scrollTop;
    el.scrollTo({ top: block.getBoundingClientRect().top - base - 24, behavior: 'smooth' });
  }, []);

  /** Where each block sits in the CURRENT view, for anchoring. */
  const offsetsOf = useCallback((): BlockOffset[] => {
    const el = scroller.current;
    if (el === null) return [];
    const base = el.getBoundingClientRect().top - el.scrollTop;
    return [...el.querySelectorAll<HTMLElement>('[data-block-id]')].map((b) => {
      const r = b.getBoundingClientRect();
      return { id: b.dataset['blockId'] ?? '', top: r.top - base, height: r.height };
    });
  }, []);

  /**
   * Switch view, keeping the reader's place.
   *
   * Read the anchor BEFORE the switch, restore it after the new view has laid
   * out. Without this, toggling the view in a 700-verse document lands at the
   * top — the small betrayal that stops a feature being used at all.
   */
  const switchView = useCallback((next: ViewKind) => {
    const el = scroller.current;
    const anchor = el === null ? null : anchorAt(el.scrollTop, offsetsOf());
    state.setView(next);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const after = scroller.current;
      if (after !== null) after.scrollTop = scrollTopFor(anchor, offsetsOf());
    }));
  }, [state, offsetsOf]);

  const ctx: CommandContext = useMemo(() => ({
    view: state.view.kind,
    setView: switchView,
    cycleView: () => switchView(
      state.view.kind === 'flow' ? 'paged' : state.view.kind === 'paged' ? 'web' : 'flow',
    ),
    zoom: state.zoom,
    zoomIn: state.zoomIn,
    zoomOut: state.zoomOut,
    resetZoom: state.resetZoom,
    setZoomMode: state.setZoom,
    paginated: state.view.paginated,
    pageSize: state.page.id,
    setPageSize: state.setPageSize,
    script,
    setScript,
    showMarks,
    setShowMarks,
    theme: look.mode,
    setTheme: (m: string) => look.setMode(m === 'dark' ? 'dark' : 'light'),
    editing: session.editing,
  }), [state, switchView, script, showMarks, look, session.editing]);

  /** One keyboard handler, reading the registry. No shortcut lives elsewhere. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (handleKey(e, ctx)) e.preventDefault();
    };
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (e.deltaY < 0) ctx.zoomIn(); else ctx.zoomOut();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
    };
  }, [ctx]);

  /*
   * Escape leaves the mode — unless an IME is composing, in which case Escape
   * belongs to the IME and taking it discarded the composition and dropped the
   * author out of edit mode. The caret is placed by `EditorSurface`, which is
   * also what knows whether a composition is open.
   */
  const escape = useRef(session);
  escape.current = session;
  useEffect(() => {
    const onEscape = (e: KeyboardEvent): void => {
      const now = escape.current;
      if (e.key !== 'Escape' || !now.editing || now.composing()) return;
      /*
       * ONE THING AT A TIME. Escape closes what is OPEN before it leaves the
       * mode: with a menu up, one press was doing both — the popover closed
       * and the editor silently stopped accepting keys, which is what
       * "editing is still not working" looked like from the outside.
       */
      if (document.querySelector('.pop') !== null) return;
      now.setEditing(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  /*
   * THE REVISION IS IN THE KEY. The paged view re-measures when this changes,
   * and it used to be built from the document's NAME and the view settings —
   * so it never changed while typing, and the pages kept the heights they were
   * measured with before the edit. 480 characters went in and the page count
   * stayed at three.
   */
  const contentKey = useMemo(
    () => `${slug}|${script}|${showMarks}|${session.editing}|${session.revision}`,
    [slug, script, showMarks, session.editing, session.revision],
  );

  return (
    /*
     * Two independent axes, two attributes. The MODE sits on the root so a
     * media query and an explicit choice resolve in one place; the chrome and
     * the document each carry their own, so any shell can be worn with any
     * page — and the `web` view can pin the document theme without touching
     * the shell the author is working in.
     */
    <div
      className="app"
      data-chrome={look.chrome}
      data-mode={look.mode}
      data-density={look.density}
    >
      <AppTitleBar doc={doc} file={file} session={session} />

      <Toolbar
        audio={audio}
        onMapAudio={mapAudio}
        ctx={ctx}
        onSwitchView={switchView}
        look={look}
        session={session}
        onOpenFile={(d, name) => { setFile({ doc: d, name }); setNote(`Opened ${name}`); }}
        onNote={setNote}
        tab={tab}
        onTab={setTab}
        folded={folded}
        onFolded={setFolded}
        onFile={() => setFileOpen(true)}
      />

      {fileOpen && (
        <FileView
          doc={doc}
          session={session}
          slug={slug}
          recents={recents}
          account={account}
          onSlug={(next) => { setFile(null); setNote(null); setSlug(next); }}
          onOpened={(d, name) => { setFile({ doc: d, name }); setNote(`Opened ${name}`); }}
          onClose={() => setFileOpen(false)}
          onNote={setNote}
        />
      )}

      <div className={navShown ? 'work' : 'work is-alone'}>
      {navShown ? (
        <NavPanel
          doc={doc}
          scroller={scroller}
          onGo={goToBlock}
          onClose={() => setNavOpen(false)}
          open={navRows}
          onOpen={setNavRows}
        />
      ) : (
        <button
          type="button"
          className="work__reveal"
          onClick={() => setNavOpen(true)}
          aria-label="Show the navigation panel"
          title="Show the navigation panel"
        >
          <Icon name="panel-open" size="md" />
        </button>
      )}

      <div
        className={`canvas canvas--${state.view.kind}${session.editing ? ' is-editing' : ''}`}
        ref={scroller}
        /*
         * A PĀDA PLAYS WHEN YOU CLICK IT — in Read mode, where a click has
         * nothing else to do.
         *
         * This is how anyone actually uses a recording against a text: point
         * at the line you cannot get right and hear it. In Write mode the same
         * click places the caret, which must win — a text editor whose click
         * plays a sound instead of putting the caret where you pointed is
         * unusable, and that is the whole reason this is conditional.
         */
        onClick={session.editing ? undefined : (e) => {
          const pada = (e.target as HTMLElement).closest?.('.pada');
          const verse = pada?.closest?.('[data-verse]');
          const line = pada?.getAttribute('data-line');
          const verseId = verse?.getAttribute('data-verse');
          if (verseId == null || line == null) return;
          audio.playPada(verseId, Number(line));
        }}
        /*
         * The APPEARANCE the author chose, in every view. The web view used to
         * force the site's own theme, so switching to it repainted the page in
         * someone else's colours and threw away the choice; the site's look is
         * still one click away in Appearance -> Page (`Veda Union · web`).
         */
        data-doc={look.document}
      >
        {error !== null && <p className="canvas__msg">Could not open: {error}</p>}
        {error === null && doc === null && <p className="canvas__msg">Opening…</p>}
        {doc !== null && (state.view.paginated ? (
          <PagedView
            doc={doc}
            script={script}
            showMarks={showMarks}
            page={state.page}
            zoom={state.zoom}
            contentKey={contentKey}
            addressable={session.editing}
          />
        ) : (
          <FlowView
            doc={doc}
            script={script}
            showMarks={showMarks}
            page={state.page}
            zoom={state.zoom}
            addressable={session.editing}
            web={state.view.kind === 'web'}
          />
        ))}
        {doc !== null && <EditorSurface session={session} scroller={scroller} />}
      </div>
      </div>

      {/* The transport, only once there is something to transport. */}
      {audio.name !== null && <AudioBar audio={audio} />}

      <StatusBar doc={doc} state={state} script={script} session={session} note={note} />
    </div>
  );
}
