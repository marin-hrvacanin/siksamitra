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
 * TWO THINGS THAT LOOK LIKE DETAIL AND ARE NOT:
 *
 * THE LISTENERS ARE REGISTERED ONCE. `session` is a new object on every
 * render, so effects keyed on it re-subscribed four times per keystroke — and
 * a `let` inside such an effect is reset each time, which is why drag-select
 * never worked: mousedown set `dragging = true`, the re-render replaced the
 * closure, and every mousemove after it was a no-op. The session is read
 * through a ref and the effects do not depend on it.
 *
 * FOCUS IS THE CARET'S TRUTH. A ribbon button takes focus when clicked, and
 * this used to keep drawing a blinking caret while typing went nowhere — with
 * Backspace still working, because that path is a window listener. The caret
 * is drawn only while the field has focus, and focus is returned after every
 * command.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { addressAt, caretAt, offsetOf, selectionRange } from '@siksamitra/edit';
import { handleEditKey } from './keymap.js';
import {
  caretBox, hitAt, offsetOfHit, paintSelection, unitOfAddress, type CaretBox,
} from './unit-map.js';
import type { Session } from './useSession.js';

export function EditorSurface(
  { session, scroller }: { session: Session; scroller: RefObject<HTMLElement | null> },
): ReactNode {
  const field = useRef<HTMLTextAreaElement>(null);
  const [box, setBox] = useState<CaretBox | null>(null);
  const [focused, setFocused] = useState(false);

  /** The live session, for listeners that are registered once. */
  const live = useRef(session);
  live.current = session;

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
    const next = caretBox(el, session.sectionId, head.verseId, place);
    // Compared before it is set: a fresh object here caused a SECOND render
    // for every caret move, on top of the one that moved it.
    setBox((was) => (
      was?.left === next?.left && was?.top === next?.top && was?.height === next?.height
        ? was
        : next
    ));
  }, [
    scroller, session.editing, session.selection, session.sectionId,
    session.srcMapOf, session.revision,
  ]);

  /**
   * Whether the caret sits in a verse that cannot be edited.
   *
   * From the DOCUMENT, not from the DOM: a verse with no `src` layer carries
   * marks that were read off a hand-marked source and exist nowhere else, and
   * that fact belongs to the data. Written out rather than as `?.src ===
   * undefined`, which would also be true for a verse that is not there.
   */
  const frozen = useMemo(() => {
    const head = session.selection?.head;
    if (head === undefined) return false;
    const section = session.doc.sections.find((s) => s.id === session.sectionId);
    const verse = section?.verses.find((v) => v.id === head.verseId);
    return verse !== undefined && verse.src === undefined;
  }, [session.doc, session.sectionId, session.selection]);

  /* ── the selection highlight, painted rather than re-rendered ──────────── */
  useEffect(() => {
    const el = scroller.current;
    if (el === null) return;
    paintSelection(el, session.sectionId, session.editing ? session.selected : []);
  }, [scroller, session.sectionId, session.selected, session.editing, session.revision]);

  /** Put the keyboard back where it belongs. Called after every command. */
  const focus = useCallback(() => {
    field.current?.focus({ preventScroll: true });
  }, []);

  /* ── clicking places the caret, in ANY section ─────────────────────────── */
  useEffect(() => {
    const el = scroller.current;
    if (el === null) return;

    let dragging = false;

    const place = (e: MouseEvent, extend: boolean): void => {
      const now = live.current;
      if (!now.editing) return;
      const hit = hitAt(e.target, e.clientX);
      if (hit === null) return;

      /*
       * The clicked SECTION's own flat source and source map. Using the
       * current section's was what trapped the caret in the first one: the
       * lookup missed, this function returned early, and the section switch it
       * was about to make never happened.
       */
      const flat = now.flatFor(hit.sectionId);
      const map = now.srcMapIn(hit.sectionId, hit.verseId);
      const offset = offsetOfHit(flat, map, hit);
      if (offset === null) return;
      const at = addressAt(flat, offset);
      if (at === null) return;

      const sameSection = hit.sectionId === now.sectionId;
      const anchor = extend && sameSection && now.selection !== null
        ? now.selection.anchor
        : at;
      now.setSelection({ anchor, head: at }, hit.sectionId);
      focus();
    };

    const onDown = (e: MouseEvent): void => {
      if (e.button !== 0 || !live.current.editing) return;
      /*
       * The default action of a mousedown moves focus — to the clicked
       * element, or to nothing if it is not focusable. Either way it takes
       * focus AWAY from the hidden field, and then nothing typed reaches the
       * document: measured, the caret moved correctly and every keystroke went
       * nowhere. Preventing it also stops the browser starting its own text
       * selection over text whose selection we draw ourselves.
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
  }, [scroller, focus]);

  /* ── the keyboard ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const now = live.current;
      if (!now.editing) return;
      // While an IME is composing, the keyboard belongs to the IME. Stealing
      // arrow keys mid-composition is how a candidate list becomes unusable.
      if (now.composing()) return;

      // Select-all, bounded by the section on purpose.
      if (e.key.toLowerCase() === 'a' && (e.ctrlKey || e.metaKey) && !e.altKey) {
        e.preventDefault();
        const first = addressAt(now.flat, 0);
        const last = addressAt(now.flat, now.flat.text.length);
        if (first !== null && last !== null) now.setSelection({ anchor: first, head: last });
        return;
      }
      if (handleEditKey(e, now) !== null) {
        e.preventDefault();
        focus();
        return;
      }

      /*
       * A PRINTABLE KEY WHEN THE FIELD IS NOT LISTENING.
       *
       * Text normally arrives through the hidden field, which only works while
       * that field has focus — and anything that takes focus loses it: a menu,
       * a select, Escape closing a popover. From then on the page still looked
       * editable and every keystroke went nowhere. Menus now hand focus back
       * (see `ui/Popover.tsx`), and this is the second line of defence: a
       * single character with no Ctrl/Alt, typed while nothing else is
       * listening, is inserted here and the field is taken back.
       *
       * The guards matter. A key aimed at a real control — a text box, a
       * button being activated with Space — must reach it, so anything inside
       * a form control is left alone, and so is our own field, which has its
       * own path and must not receive the character twice.
       */
      const target = e.target as HTMLElement | null;
      const insideControl = target?.closest?.(
        'input, textarea, select, [contenteditable=""], [contenteditable="true"]',
      ) != null;
      const printable = [...e.key].length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (printable && !insideControl && now.selection !== null) {
        e.preventDefault();
        now.insert(e.key);
        focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus]);

  /* ── keep the caret on screen, without fighting the user's scrolling ───── */
  useEffect(() => {
    const el = scroller.current;
    if (el === null || box === null || !session.editing) return;
    const top = box.top - el.scrollTop;
    const bottom = top + box.height;
    if (top >= 0 && bottom <= el.clientHeight) return;
    el.scrollTop = box.top - el.clientHeight / 2;
  }, [scroller, box, session.editing]);

  /* ── entering the mode puts the caret somewhere and takes the keyboard ── */
  useEffect(() => {
    if (!session.editing) return;
    startCaret(live.current);
    focus();
  }, [session.editing, focus]);

  const onInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const now = live.current;
    if (now.composing()) return;
    const text = e.currentTarget.value;
    e.currentTarget.value = '';
    if (text !== '') now.insert(text);
  }, []);

  const onPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Taken directly rather than through the field, so a multi-line paste
    // arrives as the newlines the author copied — which is what distributes it
    // across verses.
    const text = e.clipboardData.getData('text/plain');
    if (text === '') return;
    e.preventDefault();
    live.current.insert(text);
  }, []);

  const copySelection = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>): boolean => {
      const now = live.current;
      if (now.selection === null) return false;
      const range = selectionRange(now.flat, now.selection);
      if (range === null || range.from === range.to) return false;
      e.preventDefault();
      e.clipboardData.setData('text/plain', now.flat.text.slice(range.from, range.to));
      return true;
    },
    [],
  );

  const onCopy = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    copySelection(e);
  }, [copySelection]);

  /** Cut is copy AND delete. It used to be copy alone. */
  const onCut = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (copySelection(e)) live.current.insert('');
  }, [copySelection]);

  if (!session.editing) return null;

  return (
    <>
      {box !== null && focused && (
        <div
          /*
           * A caret in a transcribed verse is drawn, and drawn DIFFERENTLY.
           * Hiding it would lose the one thing it is for — where the click
           * landed, and where a selection anchors — but blinking it invites
           * typing that the session is going to refuse. So it is grey and
           * still: present, and visibly not an insertion point.
           */
          className={frozen ? 'caret caret--frozen' : 'caret'}
          style={{ left: `${box.left}px`, top: `${box.top}px`, height: `${box.height}px` }}
          aria-hidden
        />
      )}
      {/*
        * The field the browser types into. Positioned AT the caret, tiny and
        * transparent — not `display: none`, because an IME's candidate window
        * appears where the field is, and a hidden field puts it in the corner
        * of the screen.
        *
        * It is also the surface's ACCESSIBLE handle: a screen reader has no
        * model of our caret, so the field points at the status line, which is
        * a live region carrying the caret's position and the last refusal.
        */}
      <textarea
        ref={field}
        className="editor__field"
        style={box === null ? undefined : { left: `${box.left}px`, top: `${box.top}px` }}
        onInput={onInput}
        onPaste={onPaste}
        onCopy={onCopy}
        onCut={onCut}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onCompositionStart={() => live.current.setComposing(true)}
        onCompositionEnd={(e) => {
          const now = live.current;
          now.setComposing(false);
          const text = e.currentTarget.value;
          e.currentTarget.value = '';
          if (text !== '') now.insert(text);
        }}
        autoFocus
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        aria-label="Chant text"
        aria-describedby="editor-status"
      />
    </>
  );
}

/**
 * Put the caret at the start of the first EDITABLE verse of the section.
 *
 * Not simply the first verse. A document may open on a transcribed one — five
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
  const range = selectionRange(session.flat, session.selection);
  const head = session.selection.head;
  const place = `${head.verseId} · line ${head.line + 1} · col ${head.column + 1}`;
  if (range === null || range.from === range.to) return place;
  const letters = session.selected.reduce((n, r) => n + (r.to - r.from + 1), 0);
  return `${place} · ${range.to - range.from} chars, ${letters} letters selected`;
}

/** The offset the caret sits at. Exported for the tests, which assert on the
 *  source rather than on pixels — a caret test that reads a rectangle is
 *  testing the browser. */
export const caretOffset = (session: Session): number | null =>
  session.selection === null ? null : offsetOf(session.flat, session.selection.head);
