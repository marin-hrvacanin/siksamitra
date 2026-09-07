/**
 * The ribbon — tabs over grouped controls, the way Word does it.
 *
 * WHY WORD'S MODEL, PRECISELY. This program's readers come to it from Word:
 * that is where their documents are, and a ribbon they already know how to
 * read is worth more than any arrangement we might prefer. So the parts are
 * the parts Word has, and they mean what they mean there:
 *
 *   a TAB STRIP    the kinds of work: writing, marking, looking, the file.
 *                  The active tab is joined to the body below it, so the body
 *                  reads as that tab's contents rather than as a second bar.
 *   a BODY         one row of GROUPS, each a small cluster of controls with a
 *                  quiet label under it and a hairline between it and the next.
 *                  The label is what makes a ribbon scannable: you find
 *                  "Holding" and then look inside it, instead of reading
 *                  fourteen words in a line.
 *   COLLAPSING     a group that no longer fits becomes ONE button carrying the
 *                  group's icon and label, which opens the same controls in a
 *                  popover. Nothing becomes unreachable, and the ribbon never
 *                  wraps or scrolls sideways.
 *   HIDING         the whole body folds away (Ctrl+F1), leaving the tabs. On a
 *                  small screen that is 88px of document back.
 *
 * WHAT THIS COMPONENT DOES NOT KNOW: what any control does. A tab declares
 * itself — id, label, groups — and a group declares itself — id, label, icon,
 * priority, contents. Adding either is one entry in `Toolbar.tsx`, and the
 * responsive behaviour, the popover and the keyboard come free. That is the
 * same discipline as the command registry, for the same reason: in v1 the
 * ribbon, the dialogs and the key handler were three copies of the same
 * actions and they drifted.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '../ui/Icon.js';
import { Popover } from '../ui/Popover.js';
import { useOverflow, type OverflowGroup } from './useOverflow.js';

export interface RibbonGroup extends OverflowGroup {
  readonly label: string;
  /** Shown when the group collapses to a single button. */
  readonly icon: IconName;
  readonly content: ReactNode;
}

export interface RibbonTab {
  readonly id: string;
  readonly label: string;
  readonly groups: readonly RibbonGroup[];
}

/**
 * A group that did not fit, as one labelled button and a popover.
 *
 * The popover is PORTALLED (see `ui/Popover.tsx`): the ribbon body clips its
 * children so a group cannot spill across the row, and that clip cut every
 * menu off at the ribbon's edge.
 */
function FoldedGroup(
  { group, open, onToggle }: { group: RibbonGroup; open: boolean; onToggle: () => void },
): ReactNode {
  const anchor = useRef<HTMLDivElement>(null);
  return (
    <section className="grp grp--folded">
      <div className="grp__body" ref={anchor}>
        <button
          type="button"
          className={open ? 'rbb rbb--lg is-on' : 'rbb rbb--lg'}
          aria-expanded={open}
          aria-haspopup="dialog"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToggle}
        >
          <Icon name={group.icon} size="lg" />
          <span className="rbb__l">
            {group.label}
            <Icon name="chevron" size="sm" className="rbb__caret" />
          </span>
        </button>
        <Popover anchor={anchor} open={open} onClose={onToggle} label={group.label}>
          <div className="pop__row">{group.content}</div>
        </Popover>
      </div>
      <div className="grp__label">{group.label}</div>
    </section>
  );
}

/** Everything that did not fit even as a folded button, behind one chevron. */
function MoreGroups(
  { groups, open, onToggle }: {
    groups: readonly RibbonGroup[]; open: boolean; onToggle: () => void;
  },
): ReactNode {
  const anchor = useRef<HTMLDivElement>(null);
  return (
    <section className="grp grp--more">
      <div className="grp__body" ref={anchor}>
        <button
          type="button"
          className={open ? 'rbb rbb--lg is-on' : 'rbb rbb--lg'}
          aria-expanded={open}
          aria-haspopup="dialog"
          title={`More: ${groups.map((g) => g.label).join(', ')}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToggle}
        >
          <Icon name="more" size="lg" />
          <span className="rbb__l">More</span>
        </button>
        <Popover
          anchor={anchor}
          open={open}
          onClose={onToggle}
          label="More controls"
          align="end"
        >
          <div className="pop__row">
            {groups.map((g) => (
              <section className="grp" key={`more-${g.id}`}>
                <div className="grp__body">{g.content}</div>
                <div className="grp__label">{g.label}</div>
              </section>
            ))}
          </div>
        </Popover>
      </div>
      <div className="grp__label">{groups.length} more</div>
    </section>
  );
}

export function Ribbon(
  { tabs, active, onActive, hidden, onHidden, onFile }: {
    tabs: readonly RibbonTab[];
    active: string;
    onActive: (id: string) => void;
    hidden: boolean;
    onHidden: (hidden: boolean) => void;
    /** The File tab opens the backstage — a place, not a set of controls. */
    onFile: () => void;
  },
): ReactNode {
  const tab = tabs.find((t) => t.id === active) ?? tabs[0]!;
  /* The fold and the shared overflow button pay for their own width — see
     `useOverflow`, which is where that arithmetic belongs. */
  const { ref, visible, collapsed, overflow, remeasure } = useOverflow(tab.groups, 0);
  const [open, setOpen] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  /* The set of groups changes with the tab and with the editing mode, and the
     natural widths change with it. Measured after that, not before. */
  useEffect(() => { remeasure(); }, [tab.id, tab.groups.length, remeasure]);

  useEffect(() => {
    if (open === null) return;
    const away = (e: MouseEvent): void => {
      if (box.current !== null && !box.current.contains(e.target as Node)) setOpen(null);
    };
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  /* Ctrl+F1 — Word's own shortcut for folding the ribbon away. */
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'F1' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onHidden(!hidden);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [hidden, onHidden]);

  return (
    <div className={hidden ? 'rbn is-folded' : 'rbn'} ref={box}>
      <div className="rbn__tabs" role="tablist" aria-label="Ribbon">
        {/*
          FILE IS NOT A TAB, and it is deliberately the first thing in the
          strip. It does not switch what the ribbon shows — it opens the
          backstage over the whole window. Word makes the same distinction and
          marks it the same way: its own colour, at the start, apart.
        */}
        <button
          type="button"
          className="rbn__file"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onFile}
        >
          File
        </button>
        {tabs.map((t) => (
          <button
            type="button"
            key={t.id}
            role="tab"
            id={`rbn-tab-${t.id}`}
            aria-selected={t.id === tab.id}
            aria-controls="rbn-body"
            className={t.id === tab.id ? 'rbn__tab is-on' : 'rbn__tab'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onActive(t.id); if (hidden) onHidden(false); }}
          >
            {t.label}
          </button>
        ))}
        <div className="rbn__tabs-fill" />
        <button
          type="button"
          className="rbn__fold"
          aria-expanded={!hidden}
          title={hidden ? 'Show the ribbon (Ctrl+F1)' : 'Hide the ribbon (Ctrl+F1)'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onHidden(!hidden)}
        >
          <Icon name="chevron" size="sm" className={hidden ? 'rbn__caret' : 'rbn__caret is-up'} />
        </button>
      </div>

      <div
        className="rbn__body"
        id="rbn-body"
        role="tabpanel"
        aria-labelledby={`rbn-tab-${tab.id}`}
        ref={ref}
      >
        {tab.groups.map((g) => {
          const shown = visible.has(g.id);
          return (
            <section
              className={shown ? 'grp' : 'grp is-collapsed'}
              data-group={g.id}
              key={g.id}
              /*
               * A collapsed group stays in the DOM, out of flow, so its natural
               * width is still measurable. Removing it would leave the ribbon
               * unable to discover that it fits again when the window grows —
               * a one-way collapse that never comes back.
               */
              aria-hidden={!shown}
            >
              <div className="grp__body">{g.content}</div>
              <div className="grp__label">{g.label}</div>
            </section>
          );
        })}

        {[...collapsed].map((id) => {
          const g = tab.groups.find((x) => x.id === id)!;
          return (
            <FoldedGroup
              key={`folded-${id}`}
              group={g}
              open={open === id}
              onToggle={() => setOpen((o) => (o === id ? null : id))}
            />
          );
        })}
        {overflow.length > 0 && (
          <MoreGroups
            groups={overflow.map((id) => tab.groups.find((g) => g.id === id)!)}
            open={open === '__more'}
            onToggle={() => setOpen((o) => (o === '__more' ? null : '__more'))}
          />
        )}
      </div>
    </div>
  );
}
