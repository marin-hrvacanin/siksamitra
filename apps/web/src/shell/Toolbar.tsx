/**
 * The toolbar, as a DECLARATION of ribbon groups.
 *
 * It says what the groups are and what is in them. It does not know how they
 * collapse, how the overflow popover works, or how wide anything is — that is
 * `Ribbon` and `useOverflow`. Adding a group is one entry in the array below,
 * and it inherits the responsive behaviour for free.
 *
 * Same discipline as the command registry, for the same reason: in v1 the
 * ribbon, the dialogs and the key handler were three copies of the same
 * actions, and they drifted.
 */

import type { ReactNode } from 'react';
import type { ChantScriptKey } from '@siksamitra/format';
import { PAGE_SIZES, type ViewKind } from '@siksamitra/layout';
import { commandsIn, type CommandContext, type CommandGroup } from './commands.js';
import { Ribbon, type RibbonGroup } from './Ribbon.js';
import { ViewSwitcher } from './ViewSwitcher.js';
import { AppearanceMenu } from './AppearanceMenu.js';
import type { Appearance } from '../state/useAppearance.js';
import {
  AutoButtons, EditToggle, HistoryButtons, MarkButtons,
} from '../editor/EditGroup.js';
import type { Session } from '../editor/useSession.js';

const SCRIPTS: readonly { k: ChantScriptKey; label: string; title?: string }[] = [
  { k: 'iast', label: 'IAST' },
  { k: 'deva', label: 'देव' },
  { k: 'tel', label: 'తెలు' },
  { k: 'tam', label: 'தமி', title: 'Tamil — these forms are unreviewed' },
];

function CommandButtons(
  { group, ctx }: { group: CommandGroup; ctx: CommandContext },
): ReactNode {
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
  { ctx, documents, slug, onSlug, onSwitchView, look, session }: {
    ctx: CommandContext;
    documents: readonly { slug: string; title: string }[];
    slug: string;
    onSlug: (s: string) => void;
    onSwitchView: (k: ViewKind) => void;
    look: Appearance;
    session: Session;
  },
): ReactNode {
  /*
   * Priority decides what survives a narrow window: lower numbers go first and
   * collapse last. View leads because losing sight of the page you are proofing
   * is worse than losing the zoom buttons, which have keyboard equivalents.
   */
  const groups: RibbonGroup[] = [
    /*
     * Editing leads. Whether a keystroke will change the document is the most
     * consequential thing on this bar, so it is the last thing to collapse —
     * and the marking buttons sit beside it, because that is the work.
     */
    {
      id: 'mode',
      label: 'Mode',
      priority: 0,
      content: <EditToggle session={session} />,
    },
    ...(session.editing
      ? [
        {
          id: 'holdings',
          label: 'Holding',
          priority: 1,
          content: <MarkButtons session={session} />,
        },
        {
          id: 'auto',
          label: 'Rules',
          priority: 3,
          content: <AutoButtons session={session} />,
        },
        {
          id: 'history',
          label: 'History',
          priority: 2,
          content: <HistoryButtons session={session} />,
        },
      ]
      : []),
    {
      id: 'view',
      label: 'View',
      priority: 1,
      content: <ViewSwitcher value={ctx.view} onChange={onSwitchView} />,
    },
    {
      id: 'script',
      label: 'Script',
      priority: 2,
      content: (
        <div className="tb__row" role="group" aria-label="Script">
          {SCRIPTS.map((s) => (
            <button
              type="button"
              key={s.k}
              className={ctx.script === s.k ? 'tb__b is-on' : 'tb__b'}
              aria-pressed={ctx.script === s.k}
              onClick={() => ctx.setScript(s.k)}
              {...(s.title === undefined ? {} : { title: s.title })}
            >
              {s.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: 'text',
      label: 'Text',
      priority: 3,
      content: <div className="tb__row"><CommandButtons group="text" ctx={ctx} /></div>,
    },
    {
      id: 'zoom',
      label: 'Zoom',
      priority: 4,
      content: <div className="tb__row"><CommandButtons group="zoom" ctx={ctx} /></div>,
    },
    // The page-size control only means anything where there are pages.
    ...(ctx.paginated
      ? [{
        id: 'page',
        label: 'Page',
        priority: 5,
        content: (
          <select
            className="tb__sel"
            value={ctx.pageSize}
            onChange={(e) => ctx.setPageSize(e.target.value)}
            aria-label="Page size"
          >
            {Object.values(PAGE_SIZES).map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        ),
      }]
      : []),
    {
      id: 'appearance',
      label: 'Appearance',
      priority: 6,
      content: <AppearanceMenu look={look} />,
    },
  ];

  return (
    <Ribbon
      groups={groups}
      leading={(
        <>
          <span className="tb__brand">śikṣāmitra</span>
          <select
            className="tb__sel"
            value={slug}
            onChange={(e) => onSlug(e.target.value)}
            aria-label="Document"
          >
            {documents.map((d) => (
              <option key={d.slug} value={d.slug}>{d.title}</option>
            ))}
          </select>
        </>
      )}
    />
  );
}
