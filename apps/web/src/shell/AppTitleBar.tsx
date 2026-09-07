/**
 * THE WINDOW'S OWN BAR, filled in for this program.
 *
 * `TitleBar` knows about platforms — where the caption buttons go on Windows,
 * on macOS, on Linux — and nothing about chants. This knows about chants and
 * nothing about platforms: the document's name goes in the middle, the mark
 * on the left, and undo and redo on the right where the window's own
 * furniture is.
 *
 * WHY UNDO AND REDO ARE UP THERE. They belong to the WINDOW, not to a tab: a
 * mistake is undone from wherever you are, and putting them on Home means
 * pressing a tab first to take back a keystroke. Word does the same thing for
 * the same reason, in its quick-access bar.
 */
import type { ReactNode } from 'react';
import type { ChantDoc } from '@siksamitra/format';
import { TitleBar } from './TitleBar.js';
import { Icon } from '../ui/Icon.js';
import type { Session } from '../editor/useSession.js';

export function AppTitleBar(
  { doc, file, session }: {
    doc: ChantDoc | null;
    /** A document opened from disk names its file; a library one names us. */
    file: { name: string } | null;
    session: Session;
  },
): ReactNode {
  return (
    <TitleBar
      title={doc === null ? 'śikṣāmitra' : doc.title}
      subtitle={file === null ? 'śikṣāmitra' : file.name}
      leading={<span className="tbar__mark" aria-hidden>śi</span>}
      trailing={(
        <>
          <button
            type="button"
            className="tbar__b"
            title="Undo (Ctrl+Z)"
            disabled={!session.canUndo}
            onClick={() => session.undoEdit()}
          >
            <Icon name="undo" size="md" />
          </button>
          <button
            type="button"
            className="tbar__b"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!session.canRedo}
            onClick={() => session.redoEdit()}
          >
            <Icon name="redo" size="md" />
          </button>
        </>
      )}
    />
  );
}
