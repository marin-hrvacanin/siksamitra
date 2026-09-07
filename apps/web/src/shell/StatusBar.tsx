/**
 * The status bar.
 *
 * What a person needs to know without asking: which document, how big, what
 * the view is doing. It is also where the honest caveats live — an unverified
 * script says so here rather than nowhere.
 */

import type { ReactNode } from 'react';
import type { ChantDoc, ChantScriptKey } from '@siksamitra/format';
import { syllableCount } from '@siksamitra/format';
import { zoomLabel } from '@siksamitra/layout';
import type { ViewState } from '../state/useViewState.js';
import type { Appearance } from '../state/useAppearance.js';
import { EditStatus } from '../editor/EditStatus.js';
import type { Session } from '../editor/useSession.js';

const UNVERIFIED: Partial<Record<ChantScriptKey, string>> = {
  tam: 'Tamil forms are unreviewed',
};

export function StatusBar(
  { doc, state, script, look, session }: {
    doc: ChantDoc | null;
    state: ViewState;
    script: ChantScriptKey;
    look: Appearance;
    session: Session;
  },
): ReactNode {
  const verses = doc?.sections.reduce((n, s) => n + s.verses.length, 0) ?? 0;
  const syllables = doc?.sections.reduce(
    (n, s) => n + s.verses.reduce((m, v) => m + syllableCount(v.tokens), 0), 0,
  ) ?? 0;
  const caveat = UNVERIFIED[script];

  return (
    <footer className="status">
      <span className="status__title">{doc?.title ?? '—'}</span>
      <span className="status__sep status__opt" aria-hidden>·</span>
      <span className="status__opt">{doc?.sections.length ?? 0} sections</span>
      <span className="status__sep status__opt2" aria-hidden>·</span>
      <span className="status__opt2">{verses} verses</span>
      <span className="status__sep status__opt" aria-hidden>·</span>
      <span className="status__opt">{syllables} syllables</span>
      <span className="status__gap" />
      <EditStatus session={session} />
      {caveat !== undefined && <span className="status__warn">{caveat}</span>}
      <span>{state.view.label}</span>
      <span className="status__sep" aria-hidden>·</span>
      {state.view.paginated && <><span>{state.page.label}</span><span className="status__sep" aria-hidden>·</span></>}
      <span>{zoomLabel(state.zoom)}</span>
      <span className="status__sep status__opt" aria-hidden>·</span>
      {/* Which appearance is in force, so a surprising look has an explanation. */}
      <span className="status__opt">
        {look.chromeChoices.find((c) => c.id === look.chrome)?.name ?? look.chrome}
        {' / '}
        {look.documentChoices.find((c) => c.id === look.document)?.name ?? look.document}
      </span>
    </footer>
  );
}
