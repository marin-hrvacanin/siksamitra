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

const UNVERIFIED: Partial<Record<ChantScriptKey, string>> = {
  tam: 'Tamil forms are unreviewed',
};

export function StatusBar(
  { doc, state, script }: { doc: ChantDoc | null; state: ViewState; script: ChantScriptKey },
): ReactNode {
  const verses = doc?.sections.reduce((n, s) => n + s.verses.length, 0) ?? 0;
  const syllables = doc?.sections.reduce(
    (n, s) => n + s.verses.reduce((m, v) => m + syllableCount(v.tokens), 0), 0,
  ) ?? 0;
  const caveat = UNVERIFIED[script];

  return (
    <footer className="status">
      <span>{doc?.title ?? '—'}</span>
      <span className="status__sep" aria-hidden>·</span>
      <span>{doc?.sections.length ?? 0} sections</span>
      <span className="status__sep" aria-hidden>·</span>
      <span>{verses} verses</span>
      <span className="status__sep" aria-hidden>·</span>
      <span>{syllables} syllables</span>
      <span className="status__gap" />
      {caveat !== undefined && <span className="status__warn">{caveat}</span>}
      <span>{state.view.label}</span>
      <span className="status__sep" aria-hidden>·</span>
      {state.view.paginated && <><span>{state.page.label}</span><span className="status__sep" aria-hidden>·</span></>}
      <span>{zoomLabel(state.zoom)}</span>
    </footer>
  );
}
