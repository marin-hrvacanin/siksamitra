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
import type { ChantScriptKey } from '@siksamitra/format';
import { anchorAt, scrollTopFor, type BlockOffset, type ViewKind } from '@siksamitra/layout';
import { FlowView } from './views/FlowView.js';
import { PagedView } from './views/PagedView.js';
import { StatusBar } from './shell/StatusBar.js';
import { Toolbar } from './shell/Toolbar.js';
import { handleKey, type CommandContext } from './shell/commands.js';
import { EditorSurface, startCaret } from './editor/EditorSurface.js';
import { useSession } from './editor/useSession.js';
import { useViewState } from './state/useViewState.js';
import { useViewport } from './state/useViewport.js';
import { useDocument } from './state/useDocument.js';
import { useAppearance } from './state/useAppearance.js';

/** A document-shaped nothing, so the session hook is never conditional. */
const EMPTY_DOC = { title: '', titleForms: {}, sections: [] };

const DOCUMENTS = [
  { slug: 'durga-suktam', title: 'Durgā Sūktam' },
  { slug: 'bhagya-suktam', title: 'Bhāgya Sūktam' },
  { slug: 'purusha-suktam', title: 'Puruṣa Sūktam' },
  { slug: 'sri-rudram', title: 'Śrī Rudram' },
];

export function App() {
  const viewport = useViewport();
  const look = useAppearance();
  const state = useViewState(viewport, look.mode);
  const [slug, setSlug] = useState(DOCUMENTS[0]!.slug);
  const { doc: opened, error } = useDocument(slug);
  /*
   * The session owns the document from here on: what is on screen is the
   * EDITED document, not the one that was fetched. One source of truth, so a
   * view cannot show text the editor does not have.
   */
  const session = useSession(opened ?? EMPTY_DOC);
  const doc = opened === null ? null : session.doc;
  const [script, setScript] = useState<ChantScriptKey>('iast');
  const [showMarks, setShowMarks] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);

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
  }), [state, switchView, script, showMarks, look]);

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
   * Entering edit mode puts the caret somewhere; Escape leaves. A mode with no
   * way out is a trap, and a mode you enter with no caret does nothing when
   * you type — both were on the list of what made the platform's editor feel
   * like a form.
   */
  useEffect(() => {
    if (session.editing) startCaret(session);
  }, [session]);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && session.editing) session.setEditing(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [session]);

  const contentKey = useMemo(
    () => `${slug}|${script}|${showMarks}|${session.editing}`,
    [slug, script, showMarks, session.editing],
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
      <Toolbar
        ctx={ctx}
        documents={DOCUMENTS}
        slug={slug}
        onSlug={setSlug}
        onSwitchView={switchView}
        look={look}
        session={session}
      />

      <div
        className={`canvas canvas--${state.view.kind}${session.editing ? ' is-editing' : ''}`}
        ref={scroller}
        data-doc={state.view.kind === 'web' ? 'warm' : look.document}
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
          />
        ))}
        {doc !== null && <EditorSurface session={session} scroller={scroller} />}
      </div>

      <StatusBar doc={doc} state={state} script={script} look={look} session={session} />
    </div>
  );
}
