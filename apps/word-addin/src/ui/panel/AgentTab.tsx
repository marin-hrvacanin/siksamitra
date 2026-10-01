/**
 * ASK — Śrutidhara in the panel: a text found, marked, checked and put into
 * the document at the caret. The panel is the shared one (`AgentPanel` in
 * `@siksamitra/ui`), the same as the app's; what is Word's is the host.
 */
import { useMemo, type ReactNode } from 'react';
import type { Model } from '@siksamitra/agent';
import { AgentPanel, localSettings } from '@siksamitra/ui';
import { wordHost } from '../../agent/word-host.js';

export const ASK_INTRO = 'Namaste! Ask me for a sūkta, a stotra or a śloka — I find it in the library, mark it by the '
  + 'śikṣā rules, check it, and put it into your document at the caret. Or paste a text, and I mark it.';

export function AgentTab({ model }: { model?: Model }): ReactNode {
  const host = useMemo(() => wordHost(), []);
  const store = useMemo(() => localSettings('siksamitra.agent'), []);
  return <AgentPanel host={host} mode="deliver" store={store} intro={ASK_INTRO} {...(model === undefined ? {} : { model })} />;
}
