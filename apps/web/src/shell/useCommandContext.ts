/**
 * EVERYTHING A COMMAND MAY ACT ON — built once, from the window's state.
 *
 * Out of `App.tsx` so that file stays the shape of the window and under its
 * 400 lines; the context is the same object it always was (`CommandContext`
 * in `commands.ts`), with the Ask pane's open state beside the rest.
 */
import { useMemo } from 'react';
import type { ChantDoc, ChantScriptKey } from '@siksamitra/format';
import type { ViewKind, ZoomMode } from '@siksamitra/layout';
import type { CommandContext } from './commands.js';

export interface CommandSources {
  readonly state: {
    readonly view: { readonly kind: ViewKind; readonly paginated: boolean };
    readonly zoom: number;
    readonly page: { readonly id: string };
    readonly zoomIn: () => void;
    readonly zoomOut: () => void;
    readonly resetZoom: () => void;
    readonly setZoom: (m: ZoomMode) => void;
    readonly setPageSize: (id: string) => void;
  };
  readonly switchView: (k: ViewKind) => void;
  readonly withAnchor: (f: () => void) => void;
  readonly script: ChantScriptKey;
  readonly setScript: (s: ChantScriptKey) => void;
  readonly showMarks: boolean;
  readonly setShowMarks: (on: boolean) => void;
  readonly look: { readonly mode: string; readonly setMode: (m: 'dark' | 'light') => void };
  readonly editing: boolean;
  readonly doc: ChantDoc | null;
  readonly file: {
    readonly dirty: boolean;
    readonly newDoc: () => void;
    readonly openDoc: () => void;
    readonly save: () => void;
    readonly saveAs: () => void;
  };
  readonly askOpen: boolean;
  readonly setAskOpen: (open: boolean) => void;
}

export function useCommandContext(s: CommandSources): CommandContext {
  const { state, switchView, withAnchor, script, setScript, showMarks, setShowMarks, look, editing, doc, file, askOpen, setAskOpen } = s;
  return useMemo(() => ({
    view: state.view.kind,
    setView: switchView,
    cycleView: () => switchView(
      state.view.kind === 'flow' ? 'paged' : state.view.kind === 'paged' ? 'web' : 'flow',
    ),
    zoom: state.zoom,
    /*
     * EVERY GEOMETRY CHANGE KEEPS THE READER'S PLACE, not just a change of
     * view. Zoom scales every length and re-wraps the column, so the words
     * under the eye move while `scrollTop` does not — measured on Śrī Rudram
     * as eleven blocks of drift from one press of Zoom in. A page size
     * re-paginates outright. `withAnchor` is what `switchView` already was.
     */
    zoomIn: () => withAnchor(state.zoomIn),
    zoomOut: () => withAnchor(state.zoomOut),
    resetZoom: () => withAnchor(state.resetZoom),
    setZoomMode: (m: ZoomMode) => withAnchor(() => state.setZoom(m)),
    paginated: state.view.paginated,
    pageSize: state.page.id,
    setPageSize: (id: string) => withAnchor(() => state.setPageSize(id)),
    script,
    setScript,
    showMarks,
    setShowMarks,
    theme: look.mode,
    setTheme: (m: string) => look.setMode(m === 'dark' ? 'dark' : 'light'),
    editing,
    hasDoc: doc !== null,
    dirty: file.dirty,
    newDoc: file.newDoc,
    openDoc: file.openDoc,
    save: file.save,
    saveAs: file.saveAs,
    askOpen,
    setAskOpen,
  }), [state, switchView, withAnchor, script, setScript, showMarks, setShowMarks, look, editing, doc, file, askOpen, setAskOpen]);
}
