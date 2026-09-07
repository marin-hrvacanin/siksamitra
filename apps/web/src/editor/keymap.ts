/**
 * The editing keyboard — a table, not a switch.
 *
 * Same reason as `shell/commands.ts`: a shortcut that lives inside a `switch`
 * in a component cannot be listed, cannot be shown in a menu, and cannot be
 * checked for a clash. Here, every binding is a row, and the row is the only
 * place it exists.
 *
 * WHAT IS NOT HERE: typing. A printable character does not come through
 * `keydown` at all — it arrives as an `input` event on the hidden field, which
 * is what makes dead keys, an on-screen keyboard, an IME and a paste all work
 * without one line of special handling each. Trying to reconstruct text from
 * key codes is how an editor ends up unable to type `ā`.
 */
import type { Session } from './useSession.js';
import type { IconName } from '../ui/Icon.js';

export interface Binding {
  /** `KeyboardEvent.key`, matched case-insensitively for letters. Empty for an
   *  action that has a button but no accelerator. */
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  /**
   * Alt. NEVER set, and matched anyway — see `handleEditKey`.
   *
   * On Windows AltGr *is* Ctrl+Alt, so a table that ignored `altKey` swallowed
   * every AltGr chord: on a Croatian, German or Polish layout the character it
   * produces was eaten and an edit command ran instead. Alt+Left, the
   * browser's Back, went the same way.
   */
  alt?: boolean;
  /**
   * THE BROWSER DOES THIS ONE, and we must not.
   *
   * The page is `contenteditable`, so the caret, the selection and every
   * motion key belong to the browser: it knows where a line wrapped and what a
   * word is in this font, and `selectionchange` brings the result back into
   * the model. Handling them here as well meant `preventDefault` stopped the
   * browser moving its caret while our model moved anyway — measured, four
   * presses of ArrowRight advanced the model by four columns and left the
   * visible caret exactly where it was, so the next letter typed appeared
   * somewhere the caret had never been.
   *
   * They stay in this table because it is also what the keyboard help reads
   * from, and "the arrow keys move the caret" is still true and still worth
   * saying. `handleEditKey` skips them.
   */
  native?: boolean;
  /** Shown in a menu or a tooltip. */
  label: string;
  /** Which ribbon group shows this as a button. Absent ⇒ keyboard only, which
   *  is right for the caret keys: nobody wants an "arrow left" button. */
  ribbon?: 'history' | 'marks' | 'auto';
  /**
   * The glyph on that button. Required in practice for a ribbon action: a
   * ribbon of words is a menu, and this one has to be usable at a glance by
   * someone coming from Word. The holding icons are our own notation — the box
   * in its two stroke weights — for the reason given in the icon manifest.
   */
  icon?: IconName;
  /**
   * How big its button is — and the reason this is DATA rather than "the first
   * one is large".
   *
   * That rule made Undo a large button with its label underneath and Redo a
   * small one with its label beside it: a pair of opposites that did not look
   * like a pair. Two things that answer each other — the two holding weights,
   * undo and redo — have to be the same size, and only the table knows which
   * those are.
   */
  size?: 'lg' | 'sm';
  /** One line, for the tooltip. Says what it is FOR. */
  hint?: string;
  enabled?: (session: Session) => boolean;
  /**
   * What it does — absent for a `native` key, which this program does not do.
   *
   * Optional rather than a no-op function: a `run` that exists and is never
   * called is the shape of code that gets called again by accident, and this
   * whole entry exists precisely so that nobody calls it.
   */
  run?: (session: Session, shift: boolean) => void;
}

/** Ctrl on Windows and Linux, ⌘ on a Mac. Read once, not per keystroke. */
const APPLE = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform);
export const modifierOf = (e: KeyboardEvent | { ctrlKey: boolean; metaKey: boolean }): boolean =>
  (APPLE ? e.metaKey : e.ctrlKey);

export const EDIT_KEYS: readonly Binding[] = [
  // ── moving ────────────────────────────────────────────────────────────────
  { key: 'ArrowLeft', native: true, label: 'left' },
  { key: 'ArrowRight', native: true, label: 'right' },
  { key: 'ArrowUp', native: true, label: 'up a line' },
  { key: 'ArrowDown', native: true, label: 'down a line' },
  { key: 'ArrowLeft', ctrl: true, native: true, label: 'back a pada' },
  { key: 'ArrowRight', ctrl: true, native: true, label: 'on a pada' },
  { key: 'Home', native: true, label: 'start of line' },
  { key: 'End', native: true, label: 'end of line' },

  // ── changing ──────────────────────────────────────────────────────────────
  { key: 'Backspace', native: true, label: 'delete back' },
  { key: 'Delete', native: true, label: 'delete forward' },
  /* The browser sends `insertParagraph`, which `apply-input.ts` turns into a
     new line inside the verse. Ctrl+Enter is ours: a verse boundary is a
     decision no browser knows how to make. */
  { key: 'Enter', native: true, label: 'a new line' },
  { key: 'Enter', ctrl: true, label: 'new verse', run: (s) => s.newLine(true) },

  // ── marking ───────────────────────────────────────────────────────────────
  {
    key: 'h',
    ctrl: true,
    label: 'Short',
    ribbon: 'marks',
    icon: 'hold-short',
    size: 'lg',
    hint: 'A thin box — a short vowel before',
    run: (s) => s.mark({ hold: 'short' }),
  },
  {
    key: 'h',
    ctrl: true,
    shift: true,
    label: 'Long',
    ribbon: 'marks',
    icon: 'hold-long',
    size: 'lg',
    hint: 'A thick box — a long vowel before',
    run: (s) => s.mark({ hold: 'long' }),
  },
  {
    key: 'j',
    ctrl: true,
    label: 'None',
    ribbon: 'marks',
    icon: 'hold-none',
    hint: 'There is NO holding here — overrules the rules',
    run: (s) => s.mark({ hold: null }),
  },
  {
    key: 'k',
    ctrl: true,
    label: 'Clear',
    ribbon: 'marks',
    icon: 'marks-clear',
    hint: 'Withdraw your decision and let the rules decide again',
    run: (s) => s.unmark(['hold', 'hg']),
  },

  // ── history ───────────────────────────────────────────────────────────────
  {
    key: 'z',
    ctrl: true,
    label: 'Undo',
    ribbon: 'history',
    icon: 'undo',
    size: 'lg',
    enabled: (s) => s.canUndo,
    run: (s) => s.undoEdit(),
  },
  {
    key: 'z',
    ctrl: true,
    shift: true,
    label: 'Redo',
    ribbon: 'history',
    icon: 'redo',
    size: 'lg',
    enabled: (s) => s.canRedo,
    run: (s) => s.redoEdit(),
  },
  // The other redo. Two accelerators, ONE action — which is the whole reason
  // the bindings are a table: in v1 the second one called a different
  // function, and they drifted.
  { key: 'y', ctrl: true, label: 'Redo', run: (s) => s.redoEdit() },

  // ── the holdings, back to the rules ───────────────────────────────────────
  {
    key: '',
    label: 'Auto holdings',
    ribbon: 'auto',
    icon: 'auto-keep',
    hint: 'Re-run the holding rules, keeping the boxes you placed by hand',
    run: (s) => s.autoHoldings('keep'),
  },
  {
    key: '',
    label: 'Auto, mine out',
    ribbon: 'auto',
    icon: 'auto-replace',
    hint: 'Re-run the holding rules and DROP the boxes you placed by hand',
    run: (s) => s.autoHoldings('replace'),
  },
];

/** The accelerator, written the way the rest of the UI writes them. */
export function accelOf(b: Binding): string | undefined {
  if (b.key === '') return undefined;
  const parts: string[] = [];
  if (b.ctrl === true) parts.push(APPLE ? '⌘' : 'Ctrl');
  if (b.shift === true) parts.push('Shift');
  parts.push(b.key.length === 1 ? b.key.toUpperCase() : b.key);
  return parts.join('+');
}

/** The bindings that appear as buttons, in one ribbon group. */
export const ribbonActions = (group: NonNullable<Binding['ribbon']>): readonly Binding[] =>
  EDIT_KEYS.filter((b) => b.ribbon === group);

/**
 * Run the binding for this event, if there is one.
 *
 * Longest match wins: a binding that names `shift` beats one that does not, so
 * Ctrl+Shift+Z is redo rather than undo-with-a-shift-held. Without that rule
 * the table's ORDER would decide, which is the kind of dependency nobody
 * remembers when adding a row.
 */
export function handleEditKey(
  e: KeyboardEvent,
  session: Session,
): Binding | null {
  const ctrl = modifierOf(e);
  const candidates = EDIT_KEYS.filter((b) => (
    b.key !== ''
    /* The browser's, not ours — see `Binding.native`. */
    && b.native !== true
    && b.key.toLowerCase() === e.key.toLowerCase()
    && (b.ctrl ?? false) === ctrl
    // Alt is matched, not ignored: no binding declares it, so any chord
    // holding it belongs to the keyboard layout rather than to this table.
    && (b.alt ?? false) === e.altKey
    && (b.shift === undefined || b.shift === e.shiftKey)
  ));
  if (candidates.length === 0) return null;

  const chosen = candidates.reduce((best, b) => (
    (b.shift === undefined ? 0 : 1) > (best.shift === undefined ? 0 : 1) ? b : best
  ));
  if (chosen.enabled?.(session) === false) return null;
  /* A binding with no `run` is one the browser performs — filtered out above,
     so this cannot happen; typed rather than asserted because a future entry
     could reintroduce it. */
  if (chosen.run === undefined) return null;
  chosen.run(session, e.shiftKey);
  return chosen;
}
