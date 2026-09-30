/**
 * THE MARKING ACCELERATORS, ONCE — for the app's keymap and for Word's.
 *
 * The app binds Short, Long, Clear and Re-apply to keys in its own keymap
 * (`apps/web/src/editor/keymap.ts`), and the Word add-in declares the same
 * four to Word in a shortcuts file it generates. Two copies of "Short is
 * Ctrl+H" is two answers the first time one of them is changed, so the chord
 * is data here and both read it.
 *
 * `ctrl` is Ctrl on Windows and Linux and ⌘ on a Mac, in both programs: the
 * app reads it through `modifierOf`, and Word maps Ctrl to ⌘ itself.
 */
export interface Chord {
  /** `KeyboardEvent.key`, lower case. */
  readonly key: string;
  readonly ctrl?: true;
  readonly shift?: true;
  readonly alt?: true;
}

export const MARK_KEYS = {
  holdShort: { key: 'h', ctrl: true },
  holdLong: { key: 'h', ctrl: true, shift: true },
  clearHold: { key: 'k', ctrl: true },
  reapply: { key: 'r', ctrl: true, shift: true },
} as const satisfies Record<string, Chord>;

export type MarkKey = keyof typeof MARK_KEYS;

/** A chord the way Word's shortcuts file writes one: `Ctrl+Shift+H`. */
export function officeChord(c: Chord): string {
  return [c.ctrl === true ? 'Ctrl' : '', c.alt === true ? 'Alt' : '', c.shift === true ? 'Shift' : '',
    c.key.length === 1 ? c.key.toUpperCase() : c.key].filter((s) => s !== '').join('+');
}
