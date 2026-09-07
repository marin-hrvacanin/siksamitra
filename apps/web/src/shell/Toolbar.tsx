/**
 * The toolbar.
 *
 * It renders the command registry — it does not know what any command does. So
 * adding an action never touches this file, and a button can never disagree
 * with its own keyboard shortcut because both read one entry.
 */

import type { ReactNode } from 'react';
import type { ChantScriptKey } from '@siksamitra/format';
import { PAGE_SIZES, type ViewKind } from '@siksamitra/layout';
import { commandsIn, type CommandContext } from './commands.js';
import { ViewSwitcher } from './ViewSwitcher.js';

const SCRIPTS: readonly { k: ChantScriptKey; label: string }[] = [
  { k: 'iast', label: 'IAST' },
  { k: 'deva', label: 'देव' },
  { k: 'tel', label: 'తెలు' },
  { k: 'tam', label: 'தமி' },
];

function CommandButtons({ group, ctx }: { group: Parameters<typeof commandsIn>[0]; ctx: CommandContext }): ReactNode {
  return (
    <>
      {commandsIn(group).map((c) => {
        const enabled = c.enabled?.(ctx) ?? true;
        const on = c.active?.(ctx) ?? false;
        return (
          <button
            type="button"
            key={c.id}
            className={on ? 'tb__b is-on' : 'tb__b'}
            disabled={!enabled}
            aria-pressed={c.active === undefined ? undefined : on}
            title={c.key === undefined ? c.hint : `${c.hint ?? c.label} (${c.key})`}
            onClick={() => c.run(ctx)}
          >
            {c.label}
          </button>
        );
      })}
    </>
  );
}

export function Toolbar(
  { ctx, documents, slug, onSlug, onSwitchView }: {
    ctx: CommandContext;
    documents: readonly { slug: string; title: string }[];
    slug: string;
    onSlug: (s: string) => void;
    onSwitchView: (k: ViewKind) => void;
  },
): ReactNode {
  return (
    <header className="tb">
      <span className="tb__brand">śikṣāmitra</span>

      <select className="tb__sel" value={slug} onChange={(e) => onSlug(e.target.value)} aria-label="Document">
        {documents.map((d) => <option key={d.slug} value={d.slug}>{d.title}</option>)}
      </select>

      <span className="tb__gap" />

      <ViewSwitcher value={ctx.view} onChange={onSwitchView} />

      {ctx.paginated && (
        <select
          className="tb__sel"
          value={Object.keys(PAGE_SIZES).find((id) => PAGE_SIZES[id]!.label !== undefined && id === 'a4') ?? 'a4'}
          onChange={() => undefined}
          aria-label="Page size"
        >
          {Object.values(PAGE_SIZES).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      )}

      <div className="tb__grp"><CommandButtons group="zoom" ctx={ctx} /></div>

      <div className="tb__grp" role="group" aria-label="Script">
        {SCRIPTS.map((s) => (
          <button
            type="button"
            key={s.k}
            className={ctx.script === s.k ? 'tb__b is-on' : 'tb__b'}
            aria-pressed={ctx.script === s.k}
            onClick={() => ctx.setScript(s.k)}
            title={s.k === 'tam' ? 'Tamil — forms unreviewed' : undefined}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="tb__grp"><CommandButtons group="text" ctx={ctx} /></div>
      <div className="tb__grp"><CommandButtons group="appearance" ctx={ctx} /></div>
    </header>
  );
}
