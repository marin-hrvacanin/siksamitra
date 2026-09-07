/**
 * THE FILE VIEW, wired up.
 *
 * `Backstage` draws the place; this decides what is in it. The split is the
 * usual one — the component knows nothing about which documents exist, where a
 * file comes from or what an account is, so it can be rendered in a test with
 * three fake rows and no session at all.
 *
 * The list of documents that ship with the program lives here rather than in
 * `App` because this is the only view that shows it.
 */
import type { ReactNode } from 'react';
import type { ChantDoc } from '@siksamitra/format';
import { Backstage } from './Backstage.js';
import { FileGroup } from './FileGroup.js';
import type { RecentDocument } from './useRecents.js';
import type { AccountApi } from '../account/useAccount.js';
import type { Session } from '../editor/useSession.js';

/** What comes with the program. Named here, and nowhere else. */
export const DOCUMENTS: readonly { slug: string; title: string }[] = [
  { slug: 'durga-suktam', title: 'Durgā Sūktam' },
  { slug: 'bhagya-suktam', title: 'Bhāgya Sūktam' },
  { slug: 'purusha-suktam', title: 'Puruṣa Sūktam' },
  { slug: 'sri-rudram', title: 'Śrī Rudram' },
];

export function FileView(
  { doc, session, slug, recents, account, onSlug, onOpened, onClose, onNote }: {
    doc: ChantDoc | null;
    session: Session;
    slug: string;
    recents: readonly RecentDocument[];
    account: AccountApi;
    onSlug: (slug: string) => void;
    onOpened: (doc: ChantDoc, name: string) => void;
    onClose: () => void;
    onNote: (note: string) => void;
  },
): ReactNode {
  return (
    <Backstage
      doc={doc}
      documents={DOCUMENTS}
      slug={slug}
      recents={recents}
      account={account}
      onSlug={onSlug}
      onClose={onClose}
      onAbout={() => onNote(
        'śikṣāmitra 2.0.0-alpha — a workbench for marked Sanskrit recitation text. '
        + 'Fonts under the SIL OFL; icons from Material Symbols, Apache-2.0.',
      )}
      actions={(
        <FileGroup
          doc={session.doc}
          onOpen={(opened, name) => {
            onOpened(opened, name);
            /* Opening something is one of the three ways out of this view —
               staying here after a document changed underneath would leave
               the reader looking at the wrong file's facts. */
            onClose();
          }}
          onNote={onNote}
        />
      )}
    />
  );
}
