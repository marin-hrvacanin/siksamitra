/**
 * The top of the window, as a DECLARATION.
 *
 * It says what the tabs are, what groups are in them, and what is in each
 * group. It does not know how a group collapses, how the popover works, or how
 * wide anything is — that is `Ribbon` and `useOverflow`. Adding a group is one
 * entry in the array below and it inherits the responsive behaviour for free.
 *
 * WHY FOUR TABS, and these four. Word's tabs are kinds of work, not lists of
 * features, and the same test applies here: what is someone DOING?
 *
 *   Home     the work: which mode you are in, the holdings, undo, the file.
 *   Marking  the marking in full — holdings by hand, and the rules that place
 *            them automatically.
 *   View     looking: flow or pages or the site, which script, marks on or
 *            off, zoom, the page, the appearance.
 *
 * The Marking tab is the one that would not exist in Word, and it is the point
 * of the program — so it sits second, where the eye goes after Home. Its
 * holding buttons appear on Home as well, because that is the work and a tab
 * switch between every box is friction nobody should pay.
 */

import type { ReactNode } from 'react';
import type { ChantDoc } from '@siksamitra/format';
import { PAGE_SIZES, type ViewKind } from '@siksamitra/layout';
import { commandsIn, type CommandContext, type CommandGroup } from './commands.js';
import { Ribbon, type RibbonGroup, type RibbonTab } from './Ribbon.js';
import { RibbonButton, RibbonStack } from './RibbonButton.js';
import { FileGroup } from './FileGroup.js';
import { ScriptGroup } from './ScriptGroup.js';
import { RegisterGroup } from './RegisterGroup.js';
import { MappingGroup, SpeedGroup, TransportGroup } from './AudioGroup.js';
import type { Recording } from '../audio/useRecording.js';
import { ViewSwitcher } from './ViewSwitcher.js';
import { AppearanceMenu } from './AppearanceMenu.js';
import type { Appearance } from '../state/useAppearance.js';
import {
  AutoButtons, EditToggle, HistoryButtons, MarkButtons,
} from '../editor/EditGroup.js';
import type { Session } from '../editor/useSession.js';


/**
 * The commands of one group, as ribbon buttons.
 *
 * `large` names the ones that get the big face — the actions the group is
 * about. Everything else stacks. Naming them here rather than in the registry
 * keeps the registry about what a command IS, not how big it looks.
 */
function CommandButtons(
  { group, ctx, large = [] }: {
    group: CommandGroup;
    ctx: CommandContext;
    large?: readonly string[];
  },
): ReactNode {
  const all = commandsIn(group);
  const big = all.filter((c) => large.includes(c.id));
  const small = all.filter((c) => !large.includes(c.id));
  const button = (c: (typeof all)[number], size: 'lg' | 'sm'): ReactNode => (
    <RibbonButton
      key={c.id}
      icon={c.icon}
      label={c.label}
      size={size}
      {...(c.hint === undefined ? {} : { title: c.hint })}
      {...(c.key === undefined ? {} : { accel: c.key })}
      disabled={!(c.enabled?.(ctx) ?? true)}
      {...(c.active === undefined ? {} : { pressed: c.active(ctx) })}
      onClick={() => c.run(ctx)}
    />
  );
  return (
    <div className="rbg">
      {big.map((c) => button(c, 'lg'))}
      {small.length > 0 && <RibbonStack>{small.map((c) => button(c, 'sm'))}</RibbonStack>}
    </div>
  );
}

export function Toolbar(
  {
    ctx, onSwitchView, look, session,
    onOpenFile, onNote, tab, onTab, folded, onFolded, onFile, audio, onMapAudio,
  }: {
    ctx: CommandContext;
    onSwitchView: (k: ViewKind) => void;
    look: Appearance;
    session: Session;
    onOpenFile: (doc: ChantDoc, name: string) => void;
    onNote: (message: string) => void;
    tab: string;
    onTab: (id: string) => void;
    folded: boolean;
    onFolded: (folded: boolean) => void;
    /** Opens the backstage — see `Backstage.tsx`. */
    onFile: () => void;
    audio: Recording;
    onMapAudio: (file: File) => void;
  },
): ReactNode {
  /*
   * Priority decides what survives a narrow window: lower numbers collapse
   * last. Within a tab, the group the tab is FOR outranks its neighbours —
   * losing the holding buttons on the Marking tab would leave a tab about
   * nothing.
   */
  const home: RibbonGroup[] = [
    {
      id: 'mode', label: 'Mode', icon: 'mode-write', priority: 0,
      content: <EditToggle session={session} />,
    },
    /*
     * THE HOLDING BUTTONS ARE ON HOME TOO, and not only on Marking.
     *
     * Word's rule is that the most-used tools are on the first tab, and for
     * this program that is the marking: placing a holding is the work. A tab
     * switch between every box you draw is the kind of friction that makes
     * people stop using the ribbon and learn the shortcut — which is fine for
     * an expert and hopeless for anyone else. Marking keeps the fuller set.
     */
    {
      id: 'holdings-home', label: 'Holding', icon: 'hold-short', priority: 1,
      content: <MarkButtons session={session} />,
    },
    {
      id: 'history', label: 'History', icon: 'undo', priority: 2,
      content: <HistoryButtons session={session} />,
    },
    {
      id: 'file', label: 'File', icon: 'document', priority: 4,
      content: <FileGroup doc={session.doc} onOpen={onOpenFile} onNote={onNote} />,
    },
  ];

  const marking: RibbonGroup[] = [
    {
      id: 'holdings', label: 'Holding', icon: 'hold-short', priority: 0,
      content: <MarkButtons session={session} />,
    },
    /*
     * FIRST AFTER THE HOLDINGS, and never folded away before them.
     *
     * Every mark on the page came out of the register, so a tab about marking
     * that does not name it is a tab about marking with its subject missing —
     * which is exactly what "different rules depending on the source, I don't
     * see anywhere" was.
     */
    {
      id: 'register', label: 'Rules', icon: 'tree', priority: 1,
      content: <RegisterGroup session={session} onNote={onNote} />,
    },
    {
      id: 'auto', label: 'From the rules', icon: 'auto-keep', priority: 2,
      content: <AutoButtons session={session} />,
    },
    {
      id: 'mode-marking', label: 'Mode', icon: 'mode-write', priority: 3,
      content: <EditToggle session={session} />,
    },
  ];

  const view: RibbonGroup[] = [
    {
      id: 'view', label: 'Views', icon: 'view-pages', priority: 0,
      content: <ViewSwitcher value={ctx.view} onChange={onSwitchView} />,
    },
    {
      id: 'script', label: 'Script', icon: 'script', priority: 2,
      content: <ScriptGroup value={ctx.script} onChange={ctx.setScript} />,
    },
    {
      id: 'text', label: 'Marks', icon: 'marks', priority: 1,
      content: <CommandButtons group="text" ctx={ctx} large={['text.marks']} />,
    },
    {
      id: 'zoom', label: 'Zoom', icon: 'zoom-in', priority: 3,
      content: (
        <CommandButtons
          group="zoom"
          ctx={ctx}
          large={['zoom.in', 'zoom.out']}
        />
      ),
    },
    // The page-size control only means anything where there are pages.
    ...(ctx.paginated
      ? [{
        id: 'page', label: 'Page', icon: 'page-size' as const, priority: 4,
        content: (
          <div className="rbg">
            <label className="rbf">
              <span className="rbf__l">Size</span>
              <select
                className="tb__sel"
                value={ctx.pageSize}
                onChange={(e) => ctx.setPageSize(e.target.value)}
                aria-label="Page size"
              >
                {Object.values(PAGE_SIZES).map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </label>
          </div>
        ),
      }]
      : []),
    {
      id: 'appearance', label: 'Appearance', icon: 'appearance', priority: 5,
      content: <AppearanceMenu look={look} />,
    },
  ];

  /*
   * AUDIO IS ITS OWN TAB, not a group on View.
   *
   * Listening and marking are different sittings — one is done with the ears
   * and a loop, the other with the eyes and a selection — and a group that
   * only fits when the window is wide is a group most people never find.
   */
  const audioTab: RibbonGroup[] = [
    {
      id: 'transport', label: 'Play', icon: 'play', priority: 0,
      content: (
        <TransportGroup
          audio={audio}
          verseId={session.selection?.head.verseId ?? null}
        />
      ),
    },
    {
      id: 'speed', label: 'Speed', icon: 'loop', priority: 2,
      content: <SpeedGroup audio={audio} />,
    },
    {
      id: 'mapping', label: 'The recording', icon: 'waveform', priority: 1,
      content: (
        <MappingGroup doc={session.doc} audio={audio} onMap={onMapAudio} onNote={onNote} />
      ),
    },
  ];

  const tabs: readonly RibbonTab[] = [
    { id: 'home', label: 'Home', groups: home },
    { id: 'marking', label: 'Marking', groups: marking },
    { id: 'audio', label: 'Audio', groups: audioTab },
    { id: 'view', label: 'View', groups: view },
  ];

  return (
    <Ribbon
      tabs={tabs}
      active={tab}
      onActive={onTab}
      hidden={folded}
      onHidden={onFolded}
      onFile={onFile}
    />
  );
}
