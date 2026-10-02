/**
 * ASK — Śrutidhara beside the document, in the app.
 *
 * The same panel as the Word add-in's Ask tab (`AgentPanel` in
 * `@siksamitra/ui`); what is the app's is the host:
 *
 *   library   the verified documents the app already serves (`/chants/`,
 *             with the index the corpus plugin makes from them);
 *   place     a finished text OPENS in the app — through the same path an
 *             import takes, so unsaved work is asked about first;
 *   no web    the app's pages may not read other sites; a person pastes a
 *             text instead, and it is built from as it is.
 *
 * Each person's own key, kept on this computer (`localSettings`).
 */
import { useMemo, type ReactNode } from 'react';
import type { ChantDoc } from '@siksamitra/format';
import { publishedLibrary, type Host } from '@siksamitra/agent';
import { AgentPanel, Icon, localSettings } from '@siksamitra/ui';

export const ASK_INTRO = 'Namaste! Ask me for a sūkta, a stotra or a śloka — I find it in the library, mark it by the '
  + 'śikṣā rules, check it, and open it here. Or paste a text, and I mark it.';

export function AskPane({ adopt, onClose }: {
  adopt: (doc: ChantDoc, name: string) => void;
  onClose: () => void;
}): ReactNode {
  const host = useMemo<Host>(() => ({
    where: 'the śikṣāmitra app, beside the document the person has open',
    library: publishedLibrary(new URL('/', globalThis.location?.href ?? 'http://localhost/').toString()),
    async place(doc) {
      adopt(doc, `${doc.title}.smdoc`);
      return `opened in the app: "${doc.title}"`;
    },
  }), [adopt]);
  const store = useMemo(() => localSettings('siksamitra.agent'), []);
  return (
    <aside className="ask" aria-label="Ask">
      <div className="ask__head">
        <span className="ask__title">Ask</span>
        <button type="button" className="ask__close" onClick={onClose} aria-label="Close Ask" title="Close Ask">
          <Icon name="panel-close" size="md" />
        </button>
      </div>
      <div className="ask__body">
        <AgentPanel host={host} mode="deliver" store={store} intro={ASK_INTRO} />
      </div>
    </aside>
  );
}
