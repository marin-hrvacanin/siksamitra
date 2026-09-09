/**
 * The editing surface — the browser's caret, our document.
 *
 * WHAT THIS REPLACED, AND WHY.
 *
 * The first version drew everything itself: a caret rectangle it measured and
 * blinked, a selection it painted class by class onto each letter, drag
 * handling on mousemove, and a hidden `<textarea>` to catch keystrokes. It was
 * built that way to keep the document out of the DOM, which was right — but
 * the DOCUMENT being ours does not mean the INTERACTION has to be, and that
 * second step did not follow.
 *
 * It went as such things go. Selection had to be reimplemented, then drag, then
 * word motion, then a fallback for keystrokes that arrived while a menu had
 * taken the focus — each fix correct, the pile of them wrong. What the browser
 * gives away for nothing, and what was being rebuilt here: the I-beam pointer,
 * drag-select, double-click for a word, triple-click for a line, shift-click to
 * extend, arrows that know where a line wrapped, word motion that knows the
 * font, Home and End, an accessible cursor, and an IME.
 *
 * The measurement, and why it is not the reason, is written down once in
 * `dom-selection.ts` rather than twice here with two different numbers.
 *
 * SO: THE BROWSER SELECTS AND WE EDIT.
 *
 *   THE PAGE IS `contenteditable`, which is where all of the above comes from.
 *
 *   NOTHING IS EVER TYPED INTO IT. Every `beforeinput` is refused and turned
 *   into a command against the model, which re-derives and re-renders. The DOM
 *   is a projection at all times; the browser may select in it and may not
 *   change it. That is the invariant this whole file exists to hold, and it is
 *   what keeps "is this holding correct?" a question about data rather than a
 *   question about an HTML blob.
 *
 *   THE SELECTION IS READ, NOT DRAWN. `selectionchange` maps the browser's
 *   position through the letter map into an address in the source.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { selectionRange } from '@siksamitra/edit';
import { handleEditKey } from './keymap.js';
import { useDomCaret } from './useDomCaret.js';
import { applyInput } from './apply-input.js';
import { focusDocument } from './focus.js';
import type { Session } from './useSession.js';

export function EditorSurface(
  { session, scroller }: { session: Session; scroller: RefObject<HTMLElement | null> },
): ReactNode {
  /** The live session, for listeners that are registered once. */
  const live = useRef(session);
  live.current = session;

  /*
   * TRUE WHILE WE ARE MOVING THE BROWSER'S CARET OURSELVES.
   *
   * It is a cheap guard against reading our own write straight back, and it is
   * NOT what prevents a loop — a claim this comment used to make and which is
   * false. `selectionchange` is dispatched from a queued task, so it fires
   * long after the `finally` below has cleared the flag; by the time it
   * matters, it is already false.
   *
   * What actually prevents the loop: `setSelection` does not bump `revision`,
   * and the effect that puts the caret back keys on `revision` alone. Reading
   * a selection can therefore never cause one to be written. The flag stays
   * because it saves a wasted round trip when the timing does line up, but
   * nothing depends on it.
   */
  const placing = useRef(false);

  /*
   * THE PAGE IS MADE EDITABLE BY THE VIEWS, not from here.
   *
   * This used to walk the scroller and set `contenteditable` on every `.doc`
   * it found. It could only run when one of its dependencies changed, and
   * switching from the flowing column to Pages changes neither the document
   * nor the mode — so the new page elements never got the attribute and the
   * paged view was silently uneditable: the caret moved, and nothing typed
   * into it arrived.
   *
   * React renders those elements and React is the only thing that knows when
   * it has replaced them, so the attribute belongs in the same place as the
   * class name. It also keeps it off the measuring probe by construction,
   * which the imperative version had to remember to do.
   */

  /* ── the keyboard has to be somewhere, and it has to be here ───────────── */
  /*
   * THREE WAYS TYPING DIED SILENTLY, all of them the same omission.
   *
   * A `contenteditable` only receives keys while it holds the focus, and
   * nothing was giving it any. So: the program opened with the page editable
   * and nothing focused, and the first keystroke went nowhere. Pressing a
   * ribbon button moved the focus to that button and the next keystroke went
   * nowhere. Finishing an IME composition rebuilt the page — deliberately, to
   * discard what the browser had written — and destroyed the very node the
   * focus was in.
   *
   * The old surface had all three covered, around a hidden field, and the
   * rewrite dropped every one. `focusDocument` puts it back, and the effect
   * below re-asserts it whenever the page is rebuilt.
   *
   * `preventScroll`, because focusing an element the browser thinks is
   * off-screen otherwise jumps the page to the top of the document.
   */

  /*
   * On entering the writing mode, and after every rebuild — but NOT before
   * there is a caret to focus onto.
   *
   * Focusing an editable that holds no selection makes the browser invent one
   * at the very top of the document, and the next `selectionchange` reads that
   * back into the model. The program opened with its caret in the first verse
   * whichever verse that was — in Durgā Sūktam a transcribed one, which
   * refuses every keystroke. Waiting for the caret means focus lands on a
   * selection that is already in the right place.
   */
  const hasCaret = session.selection !== null;
  useEffect(() => {
    if (!session.editing || !hasCaret) return;
    focusDocument();
  }, [session.editing, session.remount, hasCaret]);

  /*
   * AND A CARET IN A VERSE THAT CAN ACTUALLY TAKE ONE.
   *
   * Not simply the first verse: five of Durgā Sūktam's nine are transcribed,
   * and a caret parked in one refuses every keystroke. The refusal is right;
   * it should not be the first thing that happens.
   */
  useEffect(() => {
    if (!session.editing || session.selection !== null) return;
    const section = session.doc.sections.find((sec) => sec.id === session.sectionId);
    const editable = new Set(
      (section?.verses ?? []).filter((v) => v.src !== undefined).map((v) => v.id),
    );
    const first = session.flat.lineStarts.find((l) => editable.has(l.verseId))
      ?? session.flat.lineStarts[0];
    if (first === undefined) return;
    const at = { verseId: first.verseId, line: first.line, column: 0 };
    session.setSelection({ anchor: at, head: at });
  }, [session.editing, session.selection, session.doc, session.sectionId, session.flat, session]);

  /* Keeping the browser's selection and the model in step, both ways — see
     `useDomCaret`. It is the seam of the whole design, so it is its own file. */
  useDomCaret(session, scroller, placing);

  /* ── every change is refused, and applied to the document instead ──────── */
  useEffect(() => {
    const el = scroller.current;
    if (el === null) return;

    const onBeforeInput = (e: InputEvent): void => {
      const now = live.current;
      if (!now.editing) return;
      /*
       * WHILE AN IME IS COMPOSING, EVERY INPUT IS THE IME's.
       *
       * A composing IME needs the text it is working on to be in the document
       * while its candidate window is open, so those events are let through
       * and the DOM runs briefly ahead of the model. `compositionend` then
       * reconciles, and the re-render replaces whatever the browser wrote.
       *
       * IT IS THE WHOLE COMPOSITION THAT IS LET THROUGH, not just the events
       * whose `inputType` says `insertCompositionText`. Committing a
       * composition can arrive as a plain `insertText` — measured: composing
       * "na" and committing it put "nana" in the document, because the commit
       * was applied here AND again at `compositionend`. Ignoring everything
       * until the composition is over leaves exactly one path in.
       */
      if (now.composing() || e.inputType.startsWith('insertCompositionText')) return;
      e.preventDefault();
      applyInput(e, now);
    };

    /*
     * WHERE THE COMPOSITION STARTED, remembered at the start.
     *
     * By the time it ends, the browser has written its own text into the DOM
     * and the model's caret still points at where it began. The composed text
     * therefore REPLACES that range rather than being inserted at wherever the
     * caret has apparently drifted to — which is what makes the result the
     * same whether the IME committed one character or replaced five.
     */
    /*
     * `null` UNTIL A COMPOSITION ACTUALLY STARTS, never `{0, 0}`.
     *
     * Zero is a real offset — the very start of the section — so a default of
     * `{0, 0}` is not "unknown", it is "insert at the top of the document".
     * A `compositionend` without a matching start (some Android keyboards, and
     * anything that ends a composition the page never saw begin) would have
     * dropped the composed text there, several screens from the caret.
     */
    let began: { from: number; to: number } | null = null;
    /*
     * A COMPOSITION THAT NEVER ENDS WOULD WEDGE THE EDITOR SHUT.
     *
     * While `composing` is true every input is let through untouched and every
     * binding is ignored — which is right while an IME is working and a
     * disaster if it is stuck. `compositionend` may never arrive if the node
     * being composed into is torn down first, which `rebuild()` does on
     * purpose and re-pagination does by accident. So the latch is also
     * released when the page loses the keyboard, which is the one thing that
     * is certainly true once a composition is over.
     */
    const onBlur = (): void => live.current.setComposing(false);

    const onCompositionStart = (): void => {
      const now = live.current;
      now.setComposing(true);
      const at = now.selection === null ? null : selectionRange(now.flat, now.selection);
      began = at === null ? null : { from: at.from, to: at.to };
    };
    const onCompositionEnd = (e: CompositionEvent): void => {
      const now = live.current;
      now.setComposing(false);
      if (!now.editing) return;
      /* An empty composition is one the person abandoned — the DOM is back to
         where it started, and so is the model. Nothing to do. */
      if (e.data === '') return;
      /* No recorded start: fall back to an ordinary insert at the caret, which
         is where the person is looking. */
      if (began === null) now.insert(e.data);
      else now.replaceRange(began.from, began.to, e.data, 'type');
      began = null;
      /* And throw away what the browser wrote while it was composing — see
         `Session.rebuild`. */
      now.rebuild();
    };

    /* Cut and copy read from the MODEL, not from the DOM: the DOM holds the
       projection, and copying `gṁ` out of a document whose source says `ṁ`
       would paste something the author never wrote. */
    /*
     * WHAT LEAVES THIS PROGRAM IS THE SOURCE, NOT THE PROJECTION.
     *
     * The page shows `gṁ` where the document says `ṁ`, and boxes where the
     * document says a holding. Letting the browser copy its own DOM would put
     * a spelling the author never wrote onto the clipboard, so the text comes
     * out of the model.
     *
     * `preventDefault` IS UNCONDITIONAL, and that matters more than it looks.
     * Returning early on an unmapped selection — one spanning two sections,
     * say — let the browser fall back to copying the DOM, which is the exact
     * leak this handler exists to stop. With nothing to copy, nothing is
     * copied.
     */
    const copyFromModel = (e: ClipboardEvent): string | null => {
      const now = live.current;
      /*
       * NOT GATED ON THE WRITING MODE. Read is the PROOFING mode — the one
       * text is most often copied out of — and leaving it to the browser
       * there put `gṁ`, the verse numbers and the boxes on the clipboard,
       * which is the whole leak this exists to stop.
       */
      e.preventDefault();
      if (now.selection === null) return null;
      const at = selectionRange(now.flat, now.selection);
      if (at === null || at.from === at.to) {
        /*
         * The model has no range but the eye sees one — a selection inside a
         * verse copied from a marked source, whose position is only known to
         * the line. Its tokens ARE its record, so the drawn text is the best
         * answer there is, and silence would be the worst.
         */
        const shown = document.getSelection()?.toString() ?? '';
        if (shown === '') return null;
        e.clipboardData?.setData('text/plain', shown);
        return null;
      }
      const text = now.flat.text.slice(at.from, at.to);
      /*
       * WRITTEN AND CHECKED, because `onCut` deletes on the strength of it.
       * `clipboardData` is null in some contexts and the write can be refused;
       * returning the text anyway meant a cut that destroyed the text and put
       * nothing on the clipboard.
       */
      const board = e.clipboardData;
      if (board === null) return null;
      board.setData('text/plain', text);
      return board.getData('text/plain') === text ? text : null;
    };

    const onCopy = (e: ClipboardEvent): void => { copyFromModel(e); };

    /*
     * CUT IS COPY AND DELETE.
     *
     * It was bound straight to the copy handler, which calls
     * `preventDefault()` — so the browser cancelled the cut and never sent the
     * `deleteByCut` that would have removed anything. Ctrl+X was a copy, and
     * the `deleteByCut` branch in `apply-input.ts` was unreachable code that
     * made the file look as though it worked.
     *
     * This is the second time that bug has been fixed here; the first fix's
     * own comment said "Cut is copy AND delete. It used to be copy alone."
     */
    const onCut = (e: ClipboardEvent): void => {
      const now = live.current;
      /* Only if the text is verifiably ON the clipboard, and only in the
         writing mode: a cut in Read mode is a copy. */
      if (!now.editing || copyFromModel(e) === null || now.selection === null) return;
      const at = selectionRange(now.flat, now.selection);
      if (at === null || at.from === at.to) return;
      now.replaceRange(at.from, at.to, '');
    };

    /*
     * POINTING AT THE TEXT DESELECTS WHATEVER OBJECT WAS SELECTED.
     *
     * On the way DOWN and outside a figure: a mousedown inside one is the
     * figure taking the selection for itself (`figure.tsx` handles it and
     * prevents the default), and clearing here would undo that in the same
     * gesture.
     */
    const onPointerDown = (e: Event): void => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.fig') !== null && target?.closest('.fig') !== undefined) return;
      live.current.clearObjects();
    };
    el.addEventListener('mousedown', onPointerDown);
    el.addEventListener('beforeinput', onBeforeInput as EventListener);
    el.addEventListener('compositionstart', onCompositionStart);
    el.addEventListener('focusout', onBlur);
    el.addEventListener('compositionend', onCompositionEnd as EventListener);
    el.addEventListener('copy', onCopy as EventListener);
    el.addEventListener('cut', onCut as EventListener);
    return () => {
      el.removeEventListener('mousedown', onPointerDown);
      el.removeEventListener('beforeinput', onBeforeInput as EventListener);
      el.removeEventListener('compositionstart', onCompositionStart);
      el.removeEventListener('focusout', onBlur);
      el.removeEventListener('compositionend', onCompositionEnd as EventListener);
      el.removeEventListener('copy', onCopy as EventListener);
      el.removeEventListener('cut', onCut as EventListener);
    };
  }, [scroller]);

  /* ── our own keys, and only ours ───────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const now = live.current;
      if (!now.editing || now.composing()) return;
      /*
       * MOTION AND DELETION ARE NOT HERE ANY MORE.
       *
       * Arrows, Home, End, word motion, Backspace and Delete are the
       * browser's: it knows where the lines wrapped and what a word is in this
       * font, and it arrives as `beforeinput` with the exact range. What is
       * left is what the browser has no idea about — the marks, and an undo
       * that must not be the browser's own.
       */
      if (handleEditKey(e, now) !== null) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /**
   * Whether the caret sits in a verse that cannot be edited.
   *
   * From the DOCUMENT, not from the DOM: a verse with no `src` layer carries
   * marks read off a hand-marked source that exist nowhere else, and that fact
   * belongs to the data.
   */
  const frozen = useMemo(() => {
    const head = session.selection?.head;
    if (head === undefined) return false;
    const section = session.doc.sections.find((s) => s.id === session.sectionId);
    const verse = section?.verses.find((v) => v.id === head.verseId);
    return verse !== undefined && verse.src === undefined;
  }, [session.doc, session.sectionId, session.selection]);

  /*
   * A CARET IN A VERSE THAT WILL NOT TAKE ONE, said out loud.
   *
   * The old surface drew a grey, non-blinking caret there — "present, and
   * visibly not an insertion point". A native caret cannot be restyled per
   * position, so the fact is stated instead: the class dims the caret through
   * `caret-color` (see `editor.css`), and the status bar carries the words.
   *
   * This was briefly a class that no stylesheet defined, set by an effect
   * whose comment said it was "announced rather than drawn" while it was in
   * fact neither.
   */
  useEffect(() => {
    const el = scroller.current;
    if (el === null) return;
    el.classList.toggle('is-frozen', frozen && session.editing);
  }, [scroller, frozen, session.editing]);

  return null;
}

