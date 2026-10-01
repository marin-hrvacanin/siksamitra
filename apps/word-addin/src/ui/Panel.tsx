/**
 * THE ŚIKṢĀMITRA PANEL — the add-in's home, beside the document.
 *
 * The ribbon of a web add-in can hold buttons and menus and nothing else: no
 * pressed state, no picture of what a mark looks like, nowhere to say why a
 * press was refused (learn.microsoft.com/office/dev/add-ins/design/
 * add-in-commands). The panel can hold anything, and Word lets a person dock
 * it, float it and size it (the arrow on its title bar → Move). So this is
 * where the work is done — the line under the caret drawn with its marks,
 * every mark at a press, the rules, the scripts, the keyboard, the document —
 * and the ribbon keeps the buttons a person reaches for without looking.
 *
 * WHAT IT SAYS IT SAYS HERE: a refusal, a question, a note about what a
 * command did, under the tabs (`notices.ts`), never in a window of its own.
 *
 * Vertical and narrow, because that is the shape Word gives it: one column,
 * tabs across the top, nothing wider than the panel.
 */
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { Icon, type IconName } from '@siksamitra/ui';
import { attachPanel, currentNotices, dismiss, subscribe, type Notice } from './notices.js';
import { TABS, openTab, useTab } from './panel/nav.js';
import { useHere } from './panel/useHere.js';
import { MarkTab, usePress } from './panel/MarkTab.js';
import { RulesTab, sourcesName } from './panel/RulesTab.js';
import { ScriptTab } from './panel/ScriptTab.js';
import { TypeTab } from './panel/TypeTab.js';
import { DocumentTab } from './panel/DocumentTab.js';
import { useMode } from './useMode.js';

/** How long a plain note stays before it goes by itself. A warning and a question stay. */
const NOTE_MS = 8000;

function NoticeCard({ n }: { n: Notice }): ReactNode {
  useEffect(() => {
    if (n.kind !== 'plain') return undefined;
    const t = window.setTimeout(() => dismiss(n.id), NOTE_MS);
    return () => window.clearTimeout(t);
  }, [n]);
  return (
    <div className="pnl-note" data-kind={n.kind} role={n.kind === 'plain' ? 'status' : 'alert'}>
      <p className="pnl-note__text">{n.text}</p>
      {n.lines.map((l, i) => <p className="pnl-note__line" key={i}>{l}</p>)}
      {n.kind === 'ask' ? (
        <div className="pnl-row">
          <button type="button" className="pnl-btn pnl-btn--main" onClick={() => dismiss(n.id, true)}>{n.yes ?? 'Yes'}</button>
          <button type="button" className="pnl-btn" onClick={() => dismiss(n.id, false)}>Cancel</button>
        </div>
      ) : (
        <button type="button" className="pnl-note__close" aria-label="Dismiss" onClick={() => dismiss(n.id)}>×</button>
      )}
    </div>
  );
}

export function Panel(): ReactNode {
  const mode = useMode();
  const tab = useTab();
  const here = useHere();
  const { busy, press } = usePress(here);
  const notices = useSyncExternalStore(subscribe, currentNotices);
  useEffect(() => attachPanel(), []);
  const several = here.sources.length > 1;

  return (
    <div className="pnl" data-chrome="palladio" data-mode={mode} data-density="compact">
      <header className="pnl-top">
        <span className="pnl-brand">śikṣāmitra</span>
        <span className="pnl-chip pnl-chip--accent" title={several ? 'The sources of the selected lines' : 'The source of the line at the caret: whose rules mark it'}>
          {sourcesName(here.sources)}
        </span>
      </header>
      <nav className="pnl-tabs" role="tablist" aria-label="śikṣāmitra">
        {TABS.map((t) => (
          <button type="button" role="tab" key={t.id} aria-selected={tab === t.id} className="pnl-tab" onClick={() => openTab(t.id)}>
            <Icon name={t.icon as IconName} size="md" />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      {notices.length > 0 && (
        <div className="pnl-notes" aria-live="polite">
          {notices.map((n) => <NoticeCard n={n} key={n.id} />)}
        </div>
      )}
      <main className="pnl-body" role="tabpanel">
        {tab === 'mark' && <MarkTab here={here} busy={busy} press={press} />}
        {tab === 'rules' && <RulesTab here={here} busy={busy} press={press} />}
        {tab === 'script' && <ScriptTab here={here} busy={busy} press={press} />}
        {tab === 'type' && <TypeTab here={here} />}
        {tab === 'document' && <DocumentTab busy={busy} press={press} />}
      </main>
    </div>
  );
}
