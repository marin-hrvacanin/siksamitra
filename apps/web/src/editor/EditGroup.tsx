/**
 * The editing buttons, rendered FROM the keyboard table.
 *
 * Not a parallel list. Every button here is a row in `EDIT_KEYS`, so a button
 * and its shortcut cannot drift apart, cannot disagree about whether the action
 * is available, and cannot be added in one place and forgotten in the other —
 * the failure v1 had three times over. The icon comes from the same row, so a
 * button cannot be shown with another action's picture either.
 *
 * WHICH BUTTON IS LARGE is in the table, not in this file. "The first one" was
 * the rule once, and it drew Undo large with its label underneath and Redo
 * small with its label beside it — a pair of opposites that did not look like
 * a pair. Two actions that answer each other are the same size; the rest stack.
 */
import type { ReactNode } from 'react';
import { RibbonButton, RibbonStack } from '../shell/RibbonButton.js';
import { accelOf, ribbonActions, type Binding } from './keymap.js';
import { focusDocument } from './focus.js';
import type { Session } from './useSession.js';

/** Named for a screen reader: a bare `role="group"` announces nothing. */
const GROUP_LABELS: Record<NonNullable<Binding['ribbon']>, string> = {
  marks: 'Holdings',
  history: 'History',
  auto: 'Automatic marking',
};

function Buttons(
  { group, session }: { group: NonNullable<Binding['ribbon']>; session: Session },
): ReactNode {
  const actions = ribbonActions(group);
  const large = actions.filter((b) => b.size === 'lg');
  const small = actions.filter((b) => b.size !== 'lg');
  const button = (b: Binding, size: 'lg' | 'sm'): ReactNode => (
    <RibbonButton
      key={`${b.label}-${size}`}
      icon={b.icon ?? 'marks'}
      label={b.label}
      size={size}
      {...(b.hint === undefined ? {} : { title: b.hint })}
      {...(accelOf(b) === undefined ? {} : { accel: accelOf(b)! })}
      /*
       * Enabled while there is a document, whatever the mode. A marking button
       * that is grey until you find the mode switch teaches nothing — pressing
       * it now ENTERS the writing mode and applies, which is what a ribbon
       * does everywhere else.
       */
      disabled={!(b.enabled?.(session) ?? true)}
      {...(b.pressed === undefined ? {} : { pressed: b.pressed(session) })}
      onClick={() => {
        if (!session.editing) session.setEditing(true);
        /* Only a binding with something to run gets a button; the ribbon shows
           none of the browser's own keys, and never did. */
        b.run?.(session, false);
        /*
         * AND THE KEYBOARD GOES BACK TO THE DOCUMENT.
         *
         * Clicking this button moved the focus onto it, and a
         * `contenteditable` that does not hold the focus receives nothing —
         * so without this, applying a mark from the ribbon left the page
         * looking editable and taking no keys at all. That is the exact
         * report the previous surface's focus helper existed for, and it was
         * lost in the rewrite.
         */
        focusDocument();
      }}
    />
  );

  return (
    <div className="rbg" role="group" aria-label={GROUP_LABELS[group]}>
      {large.map((b) => button(b, 'lg'))}
      {small.length > 0 && <RibbonStack>{small.map((b) => button(b, 'sm'))}</RibbonStack>}
    </div>
  );
}

export const MarkButtons = ({ session }: { session: Session }): ReactNode =>
  <Buttons group="marks" session={session} />;

export const HistoryButtons = ({ session }: { session: Session }): ReactNode =>
  <Buttons group="history" session={session} />;

export const AutoButtons = ({ session }: { session: Session }): ReactNode =>
  <Buttons group="auto" session={session} />;

/**
 * The edit toggle.
 *
 * A mode, and shown as one. An editor that is always editable is right for a
 * word processor and wrong here: most of the time this program is used to
 * PROOF a text against a printed source, and a stray keystroke into an
 * attested verse is exactly the accident rule zero exists to prevent.
 *
 * Two buttons rather than one that changes its label, because a toggle whose
 * caption is its NEXT state is the oldest ambiguity in interface design — does
 * "Editing" mean it is, or that it will be? Two faces, one pressed.
 */
export function EditToggle({ session }: { session: Session }): ReactNode {
  return (
    <div className="rbg" role="group" aria-label="Mode">
      <RibbonButton
        icon="mode-read"
        label="Read"
        size="lg"
        title="Look, and never type — the safe mode for proofing"
        pressed={!session.editing}
        onClick={() => session.setEditing(false)}
      />
      <RibbonButton
        icon="mode-write"
        label="Write"
        size="lg"
        title="Type into the text (Esc leaves)"
        accel="Esc"
        pressed={session.editing}
        onClick={() => session.setEditing(true)}
      />
    </div>
  );
}
