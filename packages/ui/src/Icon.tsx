/**
 * One icon, one way.
 *
 * Every glyph in the program comes through here, from one generated table — so
 * there is no second place an icon can be drawn, no inline `<svg>` in a
 * component, and no size chosen per button. That was the rule the shell broke
 * first in v1: fourteen hand-written SVGs at nine sizes, three of them subtly
 * different versions of the same idea.
 *
 * SIZE IS A ROLE, not a number. `sm` is a dense control, `md` a ribbon button's
 * small row, `lg` a ribbon button's large face — the three sizes the chrome
 * actually has. All are in `em` of the chrome text, so an icon tracks the
 * interface size rather than fighting it.
 *
 * The glyphs are FILLED outlines (Material Symbols) and OUR STROKED marks in
 * the same table. Both take `currentColor`, so a button's own colour — hover,
 * pressed, disabled, accent — carries the icon with it and no icon states its
 * own colour anywhere.
 */
import type { ReactNode } from 'react';
import { ICONS, type IconName } from './icons.generated.js';

export type { IconName };

export function Icon(
  { name, size = 'md', className }: {
    name: IconName;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
  },
): ReactNode {
  const glyph = ICONS[name];
  return (
    <svg
      className={className === undefined ? `ic ic--${size}` : `ic ic--${size} ${className}`}
      viewBox={glyph.viewBox}
      /* Decoration: the button's own label or `aria-label` is what a screen
         reader reads. An icon that announced itself would say everything
         twice. */
      aria-hidden
      focusable="false"
      /* `dangerouslySetInnerHTML` for one generated string of path data, from a
         table this repository generates and a gate checks — not from a
         document, a file or a network. The alternative is parsing SVG into
         React elements at runtime for no gain. */
      dangerouslySetInnerHTML={{ __html: glyph.body }}
    />
  );
}
