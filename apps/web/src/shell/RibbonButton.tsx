/**
 * The ribbon's buttons — the two shapes Word has, and no third.
 *
 *   LARGE  a 20 px glyph over a one- or two-line label, in a column. For the
 *          few actions a group is actually about. Word calls this a "big
 *          button" and puts one or two per group; more than that and the eye
 *          has nothing to land on.
 *   SMALL  a 16 px glyph beside its label, in a row, stacked three to a
 *          column. For everything else in the group.
 *
 * WHY BOTH, rather than one uniform size: the difference IS the information.
 * A group of identical buttons makes the reader read every label; a group with
 * one large button and a stack of small ones says what the group is for before
 * anything is read. That is the whole reason Word's ribbon is faster than a
 * toolbar of equal icons, and it is worth copying exactly.
 *
 * `onMouseDown` refuses focus on purpose. A ribbon button that took the
 * keyboard left the editing surface drawing a blinking caret while typing went
 * nowhere, and made Space re-fire the last button instead of inserting a
 * space. The click still fires; only the focus change is refused.
 */
import type { ReactNode } from 'react';
import { Icon, type IconName } from '../ui/Icon.js';

export interface RibbonButtonProps {
  /**
   * The glyph — omitted for a button whose LABEL is the picture.
   *
   * The four script buttons are the case: `IAST`, `देव`, `తెలు`, `தமி` are
   * each their own script's own letters, and putting the same translate glyph
   * beside all four made them look like four copies of one control.
   */
  icon?: IconName;
  label: string;
  /** The tooltip. Say what it is FOR; the label already says what it is. */
  title?: string;
  /** Shown after the title in the tooltip, as Word shows it. */
  accel?: string;
  size?: 'lg' | 'sm';
  disabled?: boolean;
  /** A toggle's state. `undefined` for a plain action, so nothing is announced. */
  pressed?: boolean;
  onClick: () => void;
}

const keepFocus = (e: React.MouseEvent): void => e.preventDefault();

export function RibbonButton(
  { icon, label, title, accel, size = 'sm', disabled = false, pressed, onClick }: RibbonButtonProps,
): ReactNode {
  const tip = [title ?? label, accel === undefined ? '' : `(${accel})`]
    .filter((s) => s !== '').join(' ');
  return (
    <button
      type="button"
      className={`rbb rbb--${size}${pressed === true ? ' is-on' : ''}`}
      disabled={disabled}
      title={tip}
      aria-pressed={pressed}
      onMouseDown={keepFocus}
      onClick={onClick}
    >
      {icon !== undefined && <Icon name={icon} size={size === 'lg' ? 'lg' : 'md'} />}
      <span className="rbb__l">{label}</span>
    </button>
  );
}

/**
 * Small buttons in a column — Word's stack. Three fit; a fourth wraps.
 *
 * `columns={2}` for a group of four, which is what the scripts are: four in one
 * column would not fit the ribbon's height, and a fourth row silently clipped
 * is how a control disappears without anyone deciding to remove it.
 */
export function RibbonStack(
  { children, columns = 1 }: { children: ReactNode; columns?: 1 | 2 },
): ReactNode {
  return <div className={columns === 2 ? 'rbs rbs--2' : 'rbs'}>{children}</div>;
}
