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
