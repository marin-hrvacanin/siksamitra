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
import { TitleBar } from './TitleBar.js';
import { Icon } from '../ui/Icon.js';
import { titleBarNames } from './title-names.js';
import type { DocFile } from './useDocFile.js';

export function AppTitleBar({ file }: { file: DocFile }): ReactNode {
  const { doc, session } = file;
  /*
   * THE FILE'S NAME ONLY WHEN IT SAYS SOMETHING THE TITLE DOES NOT — see
   * `title-names.ts`. A library document's file name IS its title, so the bar
   * read "durgā sūktam durgā sūktam".
   */
  const names = titleBarNames(
    doc === null ? null : { title: doc.title, name: file.name, kind: file.kind },
    file.dirty,
  );
  return (
    <TitleBar
      /*
       * THE MARK GOES BEFORE THE NAME. A bullet is what VS Code, Sublime and
       * TextMate all put there, and it is in front because the name is the
       * part that gets truncated: "durga-sukt…" with the mark at the end says
       * nothing at all. Nothing else in this bar changes while typing, so the
       * dot appearing is the whole signal.
       */
      title={names.title}
      subtitle={names.subtitle}
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
