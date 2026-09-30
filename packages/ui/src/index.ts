/**
 * The interface both programs are built from — the app and the Word add-in.
 *
 * One origin for every control a person touches, so the two cannot look like
 * two programs. The stylesheets are exported beside the components
 * (`@siksamitra/ui/ribbon.css`, …) and read only tokens.
 */
export { Icon } from './Icon.js';
export type { IconName } from './Icon.js';
export { ICONS, ICON_NAMES } from './icons.generated.js';
export { Popover } from './Popover.js';
export { RibbonButton, RibbonStack } from './RibbonButton.js';
export type { RibbonButtonProps } from './RibbonButton.js';
export { TooltipLayer, tipProps } from './Tooltip.js';
/* The IAST keyboard: the table, and the keys drawn from it. See `iast.ts`. */
export { IAST_LEADER, IAST_LEADER_KEY, IAST_PALETTE, leaderFor, leaderStep } from './iast.js';
export type { IastGroup, IastKey } from './iast.js';
export { IastKeys } from './IastKeys.js';
export { MARK_KEYS, officeChord } from './keys.js';
export type { Chord, MarkKey } from './keys.js';
