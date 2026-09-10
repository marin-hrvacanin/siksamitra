/**
 * THE DOCUMENT'S LIFE, in one place: New, Open, Save, Save As, and the
 * question that has to be asked before any of them throws work away.
 *
 * WHAT WAS MISSING. There was no lifecycle at all. A document arrived one of
 * two ways — a slug fetched from the corpus, or a `.smdoc` dropped into an
 * importer — and left one way, as a download. Nothing knew where a document
 * had come from, so nothing could put it back; nothing knew whether it had
 * been changed, so closing the window lost the work without a word.
 *
 * WHY IT OWNS THE SESSION rather than sitting beside it. The document's
 * identity and its edit history are one fact: opening another document
 * discards the history, and a save is a POSITION in that history. Two hooks
 * would need each other's state to answer either question, and the version
 * where `App` held both and passed them back and forth is how the two came to
 * disagree about which document was open.
 *
 * Everything decidable without a disk is in `doc-file.ts`, and everything that
 * differs between the desktop and a browser is in `file-host.ts`. What is left
 * here is state and sequencing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChantDoc } from '@siksamitra/format';
import { blankChantDoc, readChantFile, writeChantFile } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import { emptyHistory } from '@siksamitra/edit';
import { useSession, type Session } from '../editor/useSession.js';
import { host, windowControls } from './host.js';
import { fileAccess } from './file-host.js';
import { START_DOC, libraryTitle, libraryUrl } from './library.js';
import {
  UNTITLED, baseNameOf, fileNameFor, isDirty, planFor, savePointOf, windowTitle,
  type GuardAnswer, type PendingAction, type SavePoint,
} from './doc-file.js';
import { useRecents, type RecentDoc, type RecentKind } from './useRecents.js';

/** A document-shaped nothing, so the session hook is never conditional. */
const EMPTY_DOC: ChantDoc = { title: '', titleForms: {}, sections: [] };

/** Where a fresh history stands. A save recorded here means "never saved". */
const START = savePointOf(emptyHistory());

/** What is open, and where it came from. */
interface Open {
  /**
   * The document AS LOADED — never the edited one.
   *
   * Its identity is what `useSession` watches to decide that a different
   * document has been opened, so replacing this object throws the undo history
   * away. Save As therefore keeps it and changes only the ref.
   */
  readonly doc: ChantDoc;
  /** A slug, a path, or `null` for a document that has never been written. */
  readonly ref: string | null;
  readonly kind: RecentKind | 'new';
  /** What to call it: the file's name, or the slug. */
  readonly name: string;
}

export interface DocFile {
  readonly session: Session;
  /** `null` only before the first document has loaded, or after a failed one. */
  readonly doc: ChantDoc | null;
  /** Why nothing is on screen. Shown on the canvas, not in the status bar. */
  readonly error: string | null;
  readonly ref: string | null;
  /** The name for the title bar — a file's own, or the document's title. */
  readonly name: string;
  /**
   * WHERE THE OPEN DOCUMENT CAME FROM.
   *
   * The title bar needs it: the second line is there to say which FILE you are
   * editing, and a library document's `name` is the slug it was fetched by, so
   * showing it read "durgā sūktam / durga-suktam" — one name twice. Comparing
   * the two strings instead would mean knowing that `purusha-suktam` is
   * `puruṣa sūktam`, which is a transliteration table nobody should invent.
   * See `title-names.ts`.
   */
  readonly kind: 'file' | 'library' | 'new';
  readonly dirty: boolean;
  readonly recents: readonly RecentDoc[];
  /** Whether a recents row can be opened again on this host. */
  readonly canReopen: (row: RecentDoc) => boolean;
  /** The action the guard is holding, or `null` when it is not asking. */
  readonly pending: PendingAction | null;
  readonly answer: (answer: GuardAnswer) => void;
  readonly newDoc: () => void;
  readonly openDoc: () => void;
  readonly switchTo: (ref: string, kind: RecentKind) => void;
  /** A document an importer produced, on screen and unsaved. */
  readonly adopt: (doc: ChantDoc, name: string) => void;
  readonly save: () => void;
  readonly saveAs: () => void;
}

export function useDocFile(onNote: (message: string) => void): DocFile {
  const files = fileAccess();
  const recents = useRecents();
  const [open, setOpen] = useState<Open | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavePoint>(START);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const session = useSession(open?.doc ?? EMPTY_DOC);
  const dirty = open !== null && isDirty(session.history, saved);

  /*
   * What is open, readable from inside a callback that was made before it
   * changed. A ref rather than the state itself because the async paths here
   * — a fetch, a file dialog, a write — all resume after several renders.
   */
  const live = useRef<Open | null>(open);
  live.current = open;

  /**
   * Say what went wrong, in the place that suits what is on screen.
   *
   * With a document open, a failed open is news and belongs in the status bar;
   * with nothing open, the same sentence is the only thing the window has to
   * show and belongs on the canvas. Reporting both ways left "Could not open"
   * across the middle of a document that had opened perfectly well.
   */
  const report = useCallback((message: string) => {
    if (live.current === null) setError(message); else onNote(message);
  }, [onNote]);

  /**
   * Take on a document — and OPEN it here, not at each of the four callers.
   *
   * A stored verse is text and markings; its syllables are rebuilt by
   * `openChantDoc`. `readChantFile` cannot do that (it is in `format`, which
   * has no engine), so a document that reached the window straight from the
   * reader had no tokens at all and every view drew nothing. Doing it at the
   * one place every route passes through is what stops the next route
   * forgetting.
   *
   * A blank document and one built in memory go through it too: opening an
   * already-open document is a no-op, so there is no branch to get wrong.
   */
  const install = useCallback((next: Open) => {
    setOpen({ ...next, doc: openChantDoc(next.doc) });
    setSaved(START);
    setError(null);
  }, []);

  /*
   * A load in flight must not overwrite a document opened since. A counter
   * rather than an `AbortController`: an aborted fetch rejects, which would
   * report a failure for a document nobody is waiting for any more.
   */
  const loads = useRef(0);

  const openLibrary = useCallback(async (slug: string): Promise<void> => {
    const token = loads.current + 1;
    loads.current = token;
    try {
      const response = await fetch(libraryUrl(slug));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const read = readChantFile(await response.text());
      if (loads.current !== token) return;
      if (!read.ok) { report(`${slug}: ${read.error}`); return; }
      install({ doc: read.doc, ref: slug, kind: 'library', name: slug });
      recents.remember({
        ref: slug, kind: 'library', name: slug, title: libraryTitle(slug),
      });
    } catch (e) {
      if (loads.current !== token) return;
      report(`${slug}: ${e instanceof Error ? e.message : 'could not be opened'}`);
    }
  }, [install, recents, report]);

  /** Take on a document whose bytes have been read, whatever read them. */
  const adoptText = useCallback((ref: string, name: string, text: string): boolean => {
    const read = readChantFile(text);
    if (!read.ok) { report(`${name}: ${read.error}`); return false; }
    install({ doc: read.doc, ref, kind: 'file', name });
    recents.remember({ ref, kind: 'file', name, title: read.doc.title });
    onNote(`Opened ${name}`);
    return true;
  }, [install, onNote, recents, report]);

  const openFile = useCallback(async (): Promise<void> => {
    try {
      const picked = await files.pickOpen();
      if (picked === null) return;
      adoptText(picked.ref, picked.name, picked.text);
    } catch (e) {
      report(`Could not open: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [adoptText, files, report]);

  const openAgain = useCallback(async (ref: string): Promise<void> => {
    try {
      const got = await files.read(ref);
      adoptText(got.ref, got.name, got.text);
    } catch (e) {
      /*
       * Moved, renamed or deleted since it was last opened. Nothing checks a
       * recents list in the background, so this is the first moment its
       * absence is actually known — drop the row rather than leaving a button
       * that will fail the same way tomorrow.
       */
      recents.forget(ref);
      report(`${baseNameOf(ref)}: ${e instanceof Error ? e.message : 'gone'}`
        + ' — removed from Recent');
    }
  }, [adoptText, files, recents, report]);

  /**
   * Write the document, either back where it came from or somewhere chosen.
   *
   * One function for Save and Save As, because Save with nowhere to write IS
   * Save As — a new document has no path, and a library document's path is an
   * HTTP URL into the corpus that nothing here may write to.
   *
   * Returns whether anything was written, and the caller needs the answer: a
   * Save As dismissed in the middle of "save then close" must cancel the
   * close as well.
   */
  const writeOut = useCallback(async (where: 'here' | 'ask'): Promise<boolean> => {
    const current = live.current;
    if (current === null) return false;
    /*
     * The bytes and the position are both taken BEFORE the first await. A
     * keystroke that lands while the disk is busy must not be counted as
     * written, or the document would be marked clean with an edit missing.
     */
    const text = writeChantFile(session.doc);
    const point = savePointOf(session.history);
    const inPlace = where === 'here'
      && current.kind === 'file'
      && current.ref !== null
      && files.writesInPlace(current.ref);
    try {
      if (inPlace && current.ref !== null) {
        await files.write(current.ref, text);
        setSaved(point);
        recents.remember({
          ref: current.ref, kind: 'file', name: current.name, title: session.doc.title,
        });
        onNote(`Saved ${current.name}`);
        return true;
      }
      const put = await files.pickSave(fileNameFor(session.doc.title, 'json'), text);
      if (put === null) return false;
      /* `doc` is carried across unchanged — see `Open.doc`. Replacing it here
         would reset the session and discard the undo history at the exact
         moment somebody committed to keeping the work. */
      setOpen({ doc: current.doc, ref: put.ref, kind: 'file', name: put.name });
      setSaved(point);
      recents.remember({
        ref: put.ref, kind: 'file', name: put.name, title: session.doc.title,
      });
      onNote(files.writesInPlace(put.ref) ? `Saved ${put.name}` : `Downloaded ${put.name}`);
      return true;
    } catch (e) {
      onNote(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }, [files, onNote, recents, session]);

  const closeWindow = useCallback(async (): Promise<void> => {
    const window_ = await windowControls();
    /* `destroy`, not `close`: `close` asks the window to close, which comes
       straight back to the guard this call is the answer to. */
    await window_?.destroy();
  }, []);

  const carryOut = useCallback(async (action: PendingAction): Promise<void> => {
    switch (action.k) {
      case 'new':
        install({ doc: blankChantDoc(UNTITLED), ref: null, kind: 'new', name: UNTITLED });
        return;
      case 'open':
        await openFile();
        return;
      case 'switch':
        await (action.kind === 'library' ? openLibrary(action.ref) : openAgain(action.ref));
        return;
      case 'import':
        /* No ref: a `.smdoc` or a `.docx` is not a place this program writes
           back to, so the imported document is unsaved from its first moment
           and Save takes it to a `.json` of its own. */
        install({ doc: action.doc, ref: null, kind: 'new', name: action.name });
        onNote(`Opened ${action.name}`);
        return;
      case 'close':
        await closeWindow();
    }
  }, [closeWindow, install, onNote, openAgain, openFile, openLibrary]);

  /** Anything that would throw the open document away goes through here. */
  const guarded = useCallback((action: PendingAction) => {
    if (dirty) { setPending(action); return; }
    void carryOut(action);
  }, [carryOut, dirty]);

  const answer = useCallback((given: GuardAnswer) => {
    const held = pending;
    setPending(null);
    if (held === null) return;
    const plan = planFor(given);
    if (!plan.proceed) return;
    void (async () => {
      /* A save that was itself dismissed cancels the whole thing. Proceeding
         after it would discard the document the person had just chosen to
         keep, which is the one outcome nobody asked for. */
      if (plan.save && !(await writeOut('here'))) return;
      await carryOut(held);
    })();
  }, [carryOut, pending, writeOut]);

  /* Whichever of the two a document has: a file's own name, or its title. */
  const name = open === null || open.kind === 'library'
    ? (session.doc.title.trim() === '' ? UNTITLED : session.doc.title)
    : open.name;

  /* One document, once, at startup — see `library.ts` for why a real one. */
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void openLibrary(START_DOC);
  }, [openLibrary]);

  /*
   * The name in the task bar and in the browser's tab, with the mark. Both,
   * because the desktop window's own title is what Alt+Tab and the task bar
   * read — our title bar is drawn inside the window and neither of them can
   * see it.
   */
  useEffect(() => {
    const shown = windowTitle(name, dirty);
    document.title = shown;
    if (host.kind === 'desktop') void windowControls().then((w) => w?.setTitle(shown));
  }, [dirty, name]);

  /*
   * THE BROWSER'S OWN GUARD, for the ways out that are not ours: the tab's
   * close button, a reload, the back gesture. It cannot offer Save / Discard /
   * Cancel — the browser writes that dialog and will not be told what to say —
   * so the choice is between its wording and losing the work in silence.
   * Registered on the desktop too, where it catches a WebView reload.
   */
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e: BeforeUnloadEvent): void => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /*
   * THE WINDOW'S CLOSE BUTTON, which is ours to answer properly. Registered
   * once and reading the latest handler through a ref: re-listening whenever
   * the document becomes dirty would leave a gap between the two listeners,
   * and a close in that gap goes through unguarded.
   */
  const onClose = useRef(guarded);
  onClose.current = guarded;
  useEffect(() => {
    if (host.kind !== 'desktop') return undefined;
    let alive = true;
    let stop: (() => void) | undefined;
    void (async () => {
      const window_ = await windowControls();
      if (window_ === null || !alive) return;
      stop = await window_.onCloseRequested(() => onClose.current({ k: 'close' }));
    })();
    return () => { alive = false; stop?.(); };
  }, []);

  return {
    session,
    doc: open === null ? null : session.doc,
    error,
    ref: open?.ref ?? null,
    name,
    kind: open?.kind ?? 'new',
    dirty,
    recents: recents.list,
    canReopen: (row) => (row.kind === 'library' ? true : files.reopenable(row.ref)),
    pending,
    answer,
    newDoc: () => guarded({ k: 'new' }),
    openDoc: () => guarded({ k: 'open' }),
    switchTo: (ref, kind) => guarded({ k: 'switch', ref, kind }),
    adopt: (imported, importedName) => guarded({ k: 'import', doc: imported, name: importedName }),
    save: () => { void writeOut('here'); },
    saveAs: () => { void writeOut('ask'); },
  };
}
