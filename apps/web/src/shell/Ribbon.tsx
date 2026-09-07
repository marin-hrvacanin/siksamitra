/**
 * The ribbon: named groups in one row, collapsing when they do not fit.
 *
 * Word's model, because it is the right one for a tool with more controls than
 * a narrow window can hold: a group that stops fitting becomes one labelled
 * button that opens the same controls in a popover. One row at every size, and
 * nothing ever becomes unreachable.
 *
 * A group DECLARES itself — id, label, priority, contents — and this component
 * knows nothing about what any of them do. Adding a group is one entry in the
 * caller's array; the overflow behaviour, the popover and the keyboard all come
 * free. That is the same discipline as the command registry, for the same
 * reason: in v1 the ribbon, the dialogs and the key handler were three copies
 * of the same actions and they drifted.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useOverflow, type OverflowGroup } from './useOverflow.js';

export interface RibbonGroup extends OverflowGroup {
  readonly label: string;
  /** Shown when collapsed, if there is room for neither label nor icon. */
  readonly short?: string;
  readonly content: ReactNode;
}

export function Ribbon(
  { groups, leading, reserve }: {
    groups: readonly RibbonGroup[];
    /** The fixed part: brand, document picker. Never collapses. */
    leading?: ReactNode;
    reserve?: number;
  },
): ReactNode {
  const { ref, visible, collapsed, remeasure } = useOverflow(groups, reserve);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Re-measure when the set of groups changes — a group appearing (Pages adds
  // the page-size control) changes the natural widths.
  useEffect(() => { remeasure(); }, [groups.length, remeasure]);

  useEffect(() => {
    if (openGroup === null && !overflowOpen) return;
    const onDown = (e: MouseEvent): void => {
      if (box.current !== null && !box.current.contains(e.target as Node)) {
        setOpenGroup(null);
        setOverflowOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      setOpenGroup(null);
      setOverflowOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openGroup, overflowOpen]);

  const hidden = groups.filter((g) => collapsed.includes(g.id));

  return (
    <div className="rb" ref={box}>
      {leading !== undefined && <div className="rb__lead">{leading}</div>}

      <div className="rb__row" ref={ref}>
        {groups.map((g) => {
          const isVisible = visible.has(g.id);
          return (
            <div
              className={isVisible ? 'rb__grp' : 'rb__grp is-collapsed'}
              data-group={g.id}
              key={g.id}
              /*
               * A collapsed group is kept in the DOM but taken out of flow, so
               * its natural width stays measurable. Removing it would make the
               * ribbon unable to discover that it fits again once the window
               * grows — a one-way collapse that never comes back.
               */
              aria-hidden={!isVisible}
            >
              <span className="rb__label">{g.label}</span>
              <div className="rb__content">{g.content}</div>
            </div>
          );
        })}
      </div>

      {hidden.length > 0 && (
        <div className="rb__more">
          <button
            type="button"
            className={overflowOpen ? 'tb__b is-on' : 'tb__b'}
            aria-expanded={overflowOpen}
            aria-haspopup="dialog"
            onClick={() => { setOverflowOpen((o) => !o); setOpenGroup(null); }}
            title={`More: ${hidden.map((g) => g.label).join(', ')}`}
          >
            {/* A chevron, not an emoji. Emoji as iconography is a tell. */}
            <span aria-hidden>»</span>
            <span className="rb__more-n">{hidden.length}</span>
          </button>

          {overflowOpen && (
            <div className="rb__pop" role="dialog" aria-label="More controls">
              {hidden.map((g) => (
                <div className="rb__pop-grp" key={g.id}>
                  <p className="rb__pop-lbl">{g.label}</p>
                  <div className="rb__pop-content">{g.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
