/**
 * THE FILE VIEW, wired up.
 *
 * `Backstage` draws the place; this decides what is in it. The split is the
 * usual one — the component knows nothing about which documents exist, where a
 * file comes from or what an account is, so it can be rendered in a test with
 * three fake rows and no session at all.
 *
 * Everything about the document's life — which one is open, whether it has
 * been changed, what happens when another is chosen — arrives as one `DocFile`
 * rather than as six props. That is not tidiness: with six, the ribbon and
 * this view each held their own idea of which document was open, and the two
 * drifted the first time a Save As renamed one.
 */
import type { ReactNode } from 'react';
import { Backstage } from './Backstage.js';
import { FileGroup } from './FileGroup.js';
import { DOCUMENTS } from './library.js';
import type { CommandContext } from './commands.js';
import type { DocFile } from './useDocFile.js';
import type { AccountApi } from '../account/useAccount.js';

export function FileView(
  { file, ctx, account, onClose, onNote }: {
    file: DocFile;
    ctx: CommandContext;
    account: AccountApi;
    onClose: () => void;
    onNote: (note: string) => void;
  },
): ReactNode {
  return (
    <Backstage
      doc={file.doc}
      documents={DOCUMENTS}
      openRef={file.ref}
      dirty={file.dirty}
      recents={file.recents}
      canReopen={file.canReopen}
      account={account}
      onOpen={(ref, kind) => file.switchTo(ref, kind)}
      onClose={onClose}
      onAbout={() => onNote(
        'śikṣāmitra 2.0.0-alpha — a workbench for marked Sanskrit recitation text. '
        + 'Fonts under the SIL OFL; icons from Material Symbols, Apache-2.0.',
      )}
      actions={(
        <FileGroup
          ctx={ctx}
          doc={file.doc}
          onImport={(imported, name) => {
            file.adopt(imported, name);
            /* Importing something is one of the ways out of this view —
               staying here after the document changed underneath would leave
               the reader looking at the wrong file's facts. */
            onClose();
          }}
          onNote={onNote}
        />
      )}
    />
  );
}
