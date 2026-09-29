/**
 * THE RIBBON TAB AND THE RIGHT-CLICK MENU, AS DATA.
 *
 * Every entry is a pane control from `ui/controls.ts` — the same label, the
 * same tip, the same command — plus the two that only make sense off the pane:
 * running the rules over the selection, and opening the pane. Three things read
 * this one list, so none of them can be out of step with the pane:
 *
 *   `commands.ts`                  registers a function per entry;
 *   `scripts/word-commands.ts`     writes the manifest's tab and menu, and
 *                                  rasterises each entry's icon;
 *   `commands-table.test.ts`       fails if the manifest on disk is not what
 *                                  this list generates.
 */
import type { IconName } from '@siksamitra/ui';
import type { MarkCommand } from '@siksamitra/edit';
import { GROUPS } from './ui/controls.js';

export interface Entry {
  /** Unique, ASCII: the manifest's control id and the icon file's name. */
  id: IconName;
  /** The global function the manifest's `ExecuteFunction` names. */
  fn: string;
  label: string;
  tip: string;
  /** What it does. `open` is the one entry that shows the pane instead. */
  does: { mark: MarkCommand } | 'run-selection' | 'open';
  /** Also in the right-click menu — the markings a person reaches for with
   *  text selected. The pauses and aids are placed at a caret, not a range. */
  menu: boolean;
}

export interface TabGroup {
  id: string;
  label: string;
  entries: Entry[];
}

/** `hold-short` → `smHoldShort`: a name `ExecuteFunction` can call. */
const fnOf = (id: string): string =>
  `sm${id.split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join('')}`;

const MENU: ReadonlySet<string> = new Set([
  'hold-short', 'hold-long', 'svara-anudatta', 'svara-svarita', 'svara-dirgha',
  'change-anusvara', 'change-visarga', 'marks-clear',
]);

export const TAB: readonly TabGroup[] = [
  ...GROUPS.map((g) => ({
    id: g.title.toLowerCase(),
    label: g.title,
    entries: g.controls.map((c): Entry => ({
      id: c.icon, fn: fnOf(c.icon), label: c.label, tip: c.tip.replace(/`/g, ''),
      does: { mark: c.command }, menu: MENU.has(c.icon),
    })),
  })),
  {
    id: 'rules',
    label: 'Rules',
    entries: [
      {
        id: 'auto-keep', fn: fnOf('auto-keep'), label: 'Re-mark',
        tip: 'Run the śikṣā rules over the selection, in the register this document is marked in. Hand markings are kept.',
        does: 'run-selection', menu: true,
      },
      {
        id: 'panel-open', fn: 'smOpenPane', label: 'Pane',
        tip: 'Open the śikṣāmitra pane: the register, the stages, the whole-document run and the styles.',
        does: 'open', menu: false,
      },
    ],
  },
];

export const ENTRIES: readonly Entry[] = TAB.flatMap((g) => g.entries);

/** Where a ribbon or menu command leaves what it has to say, for the pane. */
export const SAID_KEY = 'siksamitra.said';
