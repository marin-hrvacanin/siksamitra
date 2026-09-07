/**
 * The view switcher.
 *
 * A segmented control rather than a dropdown: three options that are switched
 * between constantly should cost one click, and the current one should be
 * readable without opening anything.
 */

import type { ReactNode } from 'react';
import { VIEW_CYCLE, VIEW_MODES, type ViewKind } from '@siksamitra/layout';

export function ViewSwitcher(
  { value, onChange }: { value: ViewKind; onChange: (k: ViewKind) => void },
): ReactNode {
  return (
    <div className="seg" role="group" aria-label="View">
      {VIEW_CYCLE.map((kind) => {
        const mode = VIEW_MODES[kind];
        return (
          <button
            type="button"
            key={kind}
            className={kind === value ? 'seg__b is-on' : 'seg__b'}
            aria-pressed={kind === value}
            title={mode.purpose}
            onClick={() => onChange(kind)}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
