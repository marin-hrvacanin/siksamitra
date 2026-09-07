/**
 * The view switcher — the three modes, as three buttons.
 *
 * Not a dropdown and not a segmented strip of words: these are switched
 * between constantly, each has a picture that says what it is (a scroll, a
 * spread of pages, a globe), and the current one has to be readable without
 * opening anything. Word puts its view modes in exactly this shape, on the
 * View tab, for the same reasons.
 */

import type { ReactNode } from 'react';
import { VIEW_CYCLE, VIEW_MODES, type ViewKind } from '@siksamitra/layout';
import { RibbonButton } from './RibbonButton.js';
import type { IconName } from '../ui/Icon.js';

/** One icon per view. Here rather than in `layout`, which draws nothing. */
const ICON: Readonly<Record<ViewKind, IconName>> = {
  flow: 'view-flow',
  paged: 'view-pages',
  web: 'view-web',
};

export function ViewSwitcher(
  { value, onChange }: { value: ViewKind; onChange: (k: ViewKind) => void },
): ReactNode {
  return (
    <div className="rbg" role="group" aria-label="View">
      {VIEW_CYCLE.map((kind) => (
        <RibbonButton
          key={kind}
          icon={ICON[kind]}
          label={VIEW_MODES[kind].label}
          size="lg"
          title={VIEW_MODES[kind].purpose}
          pressed={kind === value}
          onClick={() => onChange(kind)}
        />
      ))}
    </div>
  );
}
