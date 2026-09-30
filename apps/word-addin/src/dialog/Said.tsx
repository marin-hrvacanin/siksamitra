/**
 * WHAT A BUTTON HAS TO SAY — a refusal, a result, or a question — in a dialog.
 *
 * Its arguments are the page's query (`word/dialog.ts` writes them): `text`,
 * `kind` (`plain`, `warn` or `ask`), `lines` (JSON), and for a question the
 * label of the button that says yes. Enter is the default button, Escape
 * closes; nothing here is ever written with `innerHTML`.
 *
 * Word draws the window and its title bar — "śikṣāmitra – <the site>" — and
 * an add-in cannot change it; that is Word saying whose window this is. What
 * is ours is the inside: one icon, one sentence, the detail under it, and the
 * buttons where Word's own dialogs keep them.
 */
import { useEffect, type ReactNode } from 'react';
import { Icon } from '@siksamitra/ui';
import { useMode } from '../ui/useMode.js';
import type { Reply } from '../word/dialog.js';

const send = (r: Reply): void => { Office.context.ui.messageParent(JSON.stringify(r)); };

export interface SaidArgs {
  text: string;
  kind: 'plain' | 'warn' | 'ask';
  lines: string[];
  yes: string;
}

/** The query, read defensively: a damaged one is a plain, empty message. */
export function argsOf(search: string): SaidArgs {
  const q = new URLSearchParams(search);
  let lines: string[] = [];
  try {
    const v: unknown = JSON.parse(q.get('lines') ?? '[]');
    if (Array.isArray(v)) lines = v.map(String);
  } catch { /* none */ }
  const kind = q.get('kind');
  return {
    text: q.get('text') ?? '',
    kind: kind === 'warn' || kind === 'ask' ? kind : 'plain',
    lines,
    yes: q.get('yes') ?? 'Yes',
  };
}

export function Said({ args }: { args: SaidArgs }): ReactNode {
  const mode = useMode();
  const asking = args.kind === 'ask';
  const yes = (): void => send(asking ? { answer: 'yes' } : { close: true });
  const no = (): void => send(asking ? { answer: 'no' } : { close: true });
  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); no(); }
      if (e.key === 'Enter') { e.preventDefault(); yes(); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  });

  return (
    <div className="dlg" data-chrome="palladio" data-mode={mode} data-kind={args.kind}>
      <div className="dlg__body">
        <span className="dlg__icon" aria-hidden><Icon name={args.kind === 'warn' ? 'warning' : 'info'} /></span>
        <div className="dlg__words">
          <p className="dlg__text">{args.text}</p>
          {args.lines.map((l) => <p key={l} className="dlg__line">{l}</p>)}
        </div>
      </div>
      <div className="dlg__do">
        {asking && <button type="button" className="dlg__btn" onClick={no}>Cancel</button>}
        <button type="button" className="dlg__btn dlg__btn--main" autoFocus onClick={yes}>
          {asking ? args.yes : 'OK'}
        </button>
      </div>
    </div>
  );
}
