/**
 * Commands — a registry, so the toolbar, the keyboard and any future menu or
 * palette all read one list.
 *
 * WHY THIS EXISTS RATHER THAN BUTTONS WITH `onClick`. In v1 the same action
 * lived in the ribbon, in a dialog and in a key handler, three times over, and
 * they drifted: one of them checked a precondition the others did not. Every
 * way of invoking an action has to reach the same code, or "it works from the
 * menu but not the shortcut" becomes a permanent class of bug.
 *
 * So a command is DATA: an id, a label, where it appears, when it is available,
 * and what it does. Adding one is one entry. Adding a command palette later is
 * a component that renders this list — no change to any command.
 */

import type { ChantScriptKey } from '@siksamitra/format';
import type { ViewKind, ZoomMode } from '@siksamitra/layout';
import type { IconName } from '../ui/Icon.js';

/** Everything a command may act on. Explicit, so a command cannot reach past it. */
export interface CommandContext {
  readonly view: ViewKind;
  readonly setView: (k: ViewKind) => void;
  readonly cycleView: () => void;
  readonly zoom: number;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly resetZoom: () => void;
  readonly setZoomMode: (m: ZoomMode) => void;
  readonly paginated: boolean;
  readonly pageSize: string;
  readonly setPageSize: (id: string) => void;
  readonly script: ChantScriptKey;
  readonly setScript: (s: ChantScriptKey) => void;
  readonly showMarks: boolean;
  readonly setShowMarks: (on: boolean) => void;
  readonly theme: string;
  readonly setTheme: (t: string) => void;
  /** The editor has the keyboard: a colliding accelerator stands down. */
  readonly editing: boolean;
}

export type CommandGroup = 'view' | 'zoom' | 'text' | 'appearance';

export interface Command {
  readonly id: string;
  readonly label: string;
  /** The glyph on its button. One table for the label and the icon, so a
   *  command cannot be shown with another command's picture. */
  readonly icon: IconName;
  /** One line, for a tooltip. Says what it is FOR, not what it does. */
  readonly hint?: string;
  readonly group: CommandGroup;
  /**
   * Accelerator, in the conventional notation. Registered from here, so a
   * shortcut cannot exist without a command or disagree with its button.
   */
  readonly key?: string;
  /** Available in this context? A command that cannot run is shown disabled. */
  readonly enabled?: (c: CommandContext) => boolean;
  /**
   * The accelerator collides with a text-editing gesture, so it is not fired
   * while the editor has the keyboard. The BUTTON still works.
   *
   * One row today: Ctrl+Shift+V is paste-as-plain-text everywhere, and here it
   * was cycling the view instead — in the middle of typing.
   */
  readonly textConflict?: boolean;
  /** For a toggle: is it currently on? */
  readonly active?: (c: CommandContext) => boolean;
  readonly run: (c: CommandContext) => void;
}

export const COMMANDS: readonly Command[] = [
  {
    id: 'view.cycle',
    icon: 'view-pages',
    label: 'Next view',
    hint: 'Flow → Pages → Web',
    group: 'view',
    key: 'Ctrl+Shift+V',
    textConflict: true,
    run: (c) => c.cycleView(),
  },
  {
    id: 'zoom.in',
    icon: 'zoom-in',
    label: 'Zoom in',
    group: 'zoom',
    key: 'Ctrl+=',
    enabled: (c) => c.zoom < 4,
    run: (c) => c.zoomIn(),
  },
  {
    id: 'zoom.out',
    icon: 'zoom-out',
    label: 'Zoom out',
    group: 'zoom',
    key: 'Ctrl+-',
    enabled: (c) => c.zoom > 0.25,
    run: (c) => c.zoomOut(),
  },
  {
    id: 'zoom.reset',
    icon: 'zoom-actual',
    label: 'Actual size',
    group: 'zoom',
    key: 'Ctrl+0',
    run: (c) => c.resetZoom(),
  },
  {
    id: 'zoom.fitWidth',
    icon: 'zoom-fit-width',
    label: 'Fit width',
    group: 'zoom',
    run: (c) => c.setZoomMode({ kind: 'fit-width' }),
  },
  {
    id: 'zoom.fitPage',
    icon: 'zoom-fit-page',
    label: 'Fit page',
    group: 'zoom',
    // Fitting a whole page is meaningless where there is no page.
    enabled: (c) => c.paginated,
    run: (c) => c.setZoomMode({ kind: 'fit-page' }),
  },
  {
    id: 'text.marks',
    icon: 'marks',
    label: 'Marks',
    hint: 'Show the recitation marks',
    group: 'text',
    key: 'Ctrl+M',
    active: (c) => c.showMarks,
    run: (c) => c.setShowMarks(!c.showMarks),
  },
  {
    id: 'appearance.theme',
    icon: 'dark',
    label: 'Dark',
    hint: 'Switch the theme',
    group: 'appearance',
    // Pinned by the web view, which previews someone else's appearance.
    enabled: (c) => c.view !== 'web',
    active: (c) => c.theme === 'dark',
    run: (c) => c.setTheme(c.theme === 'dark' ? 'light' : 'dark'),
  },
];

export const commandsIn = (group: CommandGroup): readonly Command[] =>
  COMMANDS.filter((c) => c.group === group);

/**
 * Does this keyboard event match an accelerator?
 *
 * Deliberately small and literal. A general parser would be more impressive
 * and would need its own tests to earn the trust this does not require.
 */
export function matches(key: string, e: KeyboardEvent): boolean {
  const parts = key.split('+');
  const main = parts[parts.length - 1]!.toLowerCase();
  const needCtrl = parts.includes('Ctrl');
  const needShift = parts.includes('Shift');
  const needAlt = parts.includes('Alt');
  if (needCtrl !== (e.ctrlKey || e.metaKey)) return false;
  if (needShift !== e.shiftKey) return false;
  if (needAlt !== e.altKey) return false;
  const pressed = e.key.toLowerCase();
  // `Ctrl+=` and `Ctrl++` are the same gesture on most layouts.
  if (main === '=' && (pressed === '=' || pressed === '+')) return true;
  return pressed === main;
}

/** Run whichever command owns this key, if any. */
export function handleKey(e: KeyboardEvent, ctx: CommandContext): boolean {
  for (const command of COMMANDS) {
    if (command.key === undefined || !matches(command.key, e)) continue;
    if (ctx.editing && command.textConflict === true) return false;
    if (command.enabled?.(ctx) === false) return false;
    command.run(ctx);
    return true;
  }
  return false;
}
