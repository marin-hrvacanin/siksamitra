/**
 * The editing surface — a caret over drawn text.
 *
 * NOTHING HERE IS CONTENTEDITABLE, and that is the design. v1 put a Quill
 * `contenteditable` around the marked text, which made the document *be* the
 * DOM: a holding was a `<span class="ql-hold-short">`, "is this mark right?"
 * was a question about an HTML blob, and the browser was free to rewrite the
 * text at any moment. Composing Devanāgarī inside such a tree meant fighting
 * the browser's own idea of what a character is.
 *
 * Instead, three separate things:
 *
 *   1. the text is DRAWN by the one renderer, read-only, every letter carrying
 *      `data-u`;
 *   2. the caret is a rectangle this component positions;
 *   3. keystrokes arrive through a hidden field, so dead keys, an on-screen
 *      keyboard, an IME and a paste all work without special handling — the
 *      browser composes the text, and we read what it composed.
 *
 * The cost is that the caret has to be positioned from measurements, which is
 * what `unit-map.ts` does. The benefit is that the document is data all the
 * way down, and every editing operation is testable without a browser.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { caretAt, offsetOf, selectionRange, addressAt } from '@siksamitra/edit';
import { handleEditKey } from './keymap.js';
import { caretBox, hitAt, offsetOfHit, paintSelection, unitOfAddress, type CaretBox } from './unit-map.js';
import type { Session } from './useSession.js';

export function EditorSurface(
  { session, scroller }: { session: Session; scroller: RefObject<HTMLElement | null> },
): ReactNode {
  const field = useRef<HTMLTextAreaElement>(null);
  const [box, setBox] = useState<CaretBox | null>(null);
  const composing = useRef(false);

  /* ── the caret's position, measured after every layout ─────────────────── */
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el === null || !session.editing || session.selection === null) {
      setBox(null);
      return;
    }
    const head = session.selection.head;
    const srcMap = session.srcMapOf(head.verseId);
    const place = srcMap === null ? null : unitOfAddress(srcMap, head);
    setBox(caretBox(el, head.verseId, place));
  }, [scroller, session.editing, session.selection, session.srcMapOf, session.doc]);

  /* ── the selection highlight, painted rather than re-rendered ──────────── */
  useEffect(() => {
    const el = scroller.current;
    if (el === null) return;
    paintSelection(el, session.editing ? session.selected : []);
  }, [scroller, session.selected, session.editing, session.doc]);

  /* ── clicking places the caret ─────────────────────────────────────────── */
  useEffect(() => {
    const el = scroller.current;
    if (el === null || !session.editing) return;

    let dragging = false;

    const place = (e: MouseEvent, extend: boolean): void => {
      const hit = hitAt(e.target, e.clientX);
      if (hit === null) return;
      const offset = offsetOfHit(session.flat, session.srcMapOf(hit.verseId), hit);
      if (offset === null) return;
      const at = addressAt(session.flat, offset);
      if (at === null) return;
      const anchor = extend && session.selection !== null ? session.selection.anchor : at;
      session.setSelection({ anchor, head: at }, hit.sectionId);
      field.current?.focus({ preventScroll: true });
    };

    const onDown = (e: MouseEvent): void => {
      if (e.button !== 0) return;
      /*
       * The default action of a mousedown moves focus — to the clicked element,
       * or to nothing if it is not focusable. Either way it takes focus AWAY
       * from the hidden field, and then nothing typed reaches the document:
       * measured, the caret moved correctly and every keystroke went nowhere.
       * Preventing it also stops the browser starting its own text selection
       * over text whose selection we draw ourselves.
       */
      e.preventDefault();
      dragging = true;
      place(e, e.shiftKey);
    };
    const onMove = (e: MouseEvent): void => { if (dragging) place(e, true); };
    const onUp = (): void => { dragging = false; };

    el.addEventListener('mousedown', onDown);
    el.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [scroller, session]);

  /* ── the keyboard ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!session.editing) return;
    const onKey = (e: KeyboardEvent): void => {
      // While an IME is composing, the keyboard belongs to the IME. Stealing
      // arrow keys mid-composition is how a candidate list becomes unusable.
      if (composing.current) return;
      if (handleEditKey(e, session) !== null) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session]);

  /* ── keep the caret on screen, without fighting the user's scrolling ───── */
  useEffect(() => {
    const el = scroller.current;
    if (el === null || box === null || !session.editing) return;
    const top = box.top - el.scrollTop;
    const bottom = top + box.height;
    if (top >= 0 && bottom <= el.clientHeight) return;
    el.scrollTop = box.top - el.clientHeight / 2;
  }, [scroller, box, session.editing]);

  const onInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    if (composing.current) return;
    const text = e.currentTarget.value;
    e.currentTarget.value = '';
    if (text !== '') session.insert(text);
  }, [session]);

  const onPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Taken directly rather than through the field, so a multi-line paste
    // arrives as the newlines the author copied — which is what distributes it
    // across verses.
    const text = e.clipboardData.getData('text/plain');
    if (text === '') return;
    e.preventDefault();
    session.insert(text);
  }, [session]);

  const onCopy = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (session.selection === null) return;
    const { from, to } = selectionRange(session.flat, session.selection);
    if (from === to) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', session.flat.text.slice(from, to));
  }, [session]);

  /* ── select-all is bounded by the section, on purpose ─────────────────── */
  useEffect(() => {
    if (!session.editing) return;
    const onSelectAll = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() !== 'a' || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const first = addressAt(session.flat, 0);
      const last = addressAt(session.flat, session.flat.text.length);
      if (first !== null && last !== null) {
        session.setSelection({ anchor: first, head: last });
      }
    };
    window.addEventListener('keydown', onSelectAll);
    return () => window.removeEventListener('keydown', onSelectAll);
  }, [session]);

  if (!session.editing) return null;

  return (
    <>
      {box !== null && (
        <div
          className="caret"
          style={{ left: `${box.left}px`, top: `${box.top}px`, height: `${box.height}px` }}
          aria-hidden
        />
      )}
      {/*
        * The field the browser types into. Positioned AT the caret, one pixel
        * wide and transparent — not `display: none`, because an IME's
        * candidate window appears where the field is, and a hidden field puts
        * it in the corner of the screen.
        */}
      <textarea
        ref={field}
        className="editor__field"
        style={box === null ? undefined : { left: `${box.left}px`, top: `${box.top}px` }}
        onInput={onInput}
        onPaste={onPaste}
        onCopy={onCopy}
        onCut={onCopy}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={(e) => {
          composing.current = false;
          const text = e.currentTarget.value;
          e.currentTarget.value = '';
          if (text !== '') session.insert(text);
        }}
        autoFocus
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        aria-label="chant text"
      />
    </>
  );
}

/**
 * Put the caret at the start of the first EDITABLE verse of the section.
 *
 * Not simply the first verse. A document may open on a transcribed one — four
 * of Durgā Sūktam's nine are — and a caret parked in a verse that refuses
 * every keystroke is an editor that appears broken. The refusal is right; it
 * just should not be the first thing that happens.
 */
export function startCaret(session: Session): void {
  if (session.selection !== null) return;
  const section = session.doc.sections.find((s) => s.id === session.sectionId);
  const editable = new Set(
    (section?.verses ?? []).filter((v) => v.src !== undefined).map((v) => v.id),
  );
  const first = session.flat.lineStarts.find((l) => editable.has(l.verseId))
    ?? session.flat.lineStarts[0];
  if (first === undefined) return;
  session.setSelection(caretAt({ verseId: first.verseId, line: first.line, column: 0 }));
}

/** Where the caret is, as a status-bar string. Reads the source, not the DOM. */
export function caretLabel(session: Session): string {
  if (session.selection === null) return 'no caret';
  const { from, to } = selectionRange(session.flat, session.selection);
  const head = session.selection.head;
  const place = `${head.verseId} · line ${head.line + 1} · col ${head.column + 1}`;
  if (from === to) return place;
  const letters = session.selected.reduce((n, r) => n + (r.to - r.from + 1), 0);
  return `${place} · ${to - from} chars, ${letters} letters selected`;
}

/** The offset the caret sits at. Exported for the tests, which assert on the
 *  source rather than on pixels — a caret test that reads a rectangle is
 *  testing the browser. */
export const caretOffset = (session: Session): number | null =>
  session.selection === null ? null : offsetOf(session.flat, session.selection.head);
