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
import type { CommandContext } from './commands.js';
import { CommandButtons } from './CommandButtons.js';
import { Ribbon, type RibbonGroup, type RibbonTab } from './Ribbon.js';
import { FileGroup } from './FileGroup.js';
import { ScriptGroup } from './ScriptGroup.js';
import { RegisterGroup } from './RegisterGroup.js';
import { BoundaryGroup, MappingGroup, SpeedGroup, TransportGroup } from './AudioGroup.js';
import type { Recording } from '../audio/useRecording.js';
import type { Mapping } from '../audio/useMapping.js';
import { ViewSwitcher } from './ViewSwitcher.js';
import { AppearanceMenu } from './AppearanceMenu.js';
import type { Appearance } from '../state/useAppearance.js';
import {
  AutoButtons, EditToggle, HistoryButtons, MarkButtons,
} from '../editor/EditGroup.js';
import type { Session } from '../editor/useSession.js';


export function Toolbar(
  {
    ctx, onSwitchView, look, session,
    onImport, onNote, tab, onTab, folded, onFolded, onFile, audio, mapping,
  }: {
    ctx: CommandContext;
    onSwitchView: (k: ViewKind) => void;
    look: Appearance;
    session: Session;
    onImport: (doc: ChantDoc, name: string) => void;
    onNote: (message: string) => void;
    tab: string;
    onTab: (id: string) => void;
    folded: boolean;
    onFolded: (folded: boolean) => void;
    /** Opens the backstage — see `Backstage.tsx`. */
    onFile: () => void;
    audio: Recording;
    /** The take, the boundaries and the selection — see `useMapping`. */
    mapping: Mapping;
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
      content: (
        <FileGroup ctx={ctx} doc={ctx.hasDoc ? session.doc : null} onImport={onImport} onNote={onNote} />
      ),
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
  const head = session.selection?.head ?? null;
  const audioTab: RibbonGroup[] = [
    {
      id: 'transport', label: 'Play', icon: 'play', priority: 0,
      content: (
        <TransportGroup
          audio={audio}
          at={head === null ? null : { verseId: head.verseId, line: head.line }}
        />
      ),
    },
    {
      id: 'mapping', label: 'The recording', icon: 'waveform', priority: 1,
      content: <MappingGroup doc={session.doc} audio={audio} mapping={mapping} />,
    },
    /*
     * BEFORE Speed, and never folded away first. Fixing the two boundaries the
     * mapper guessed is the work the Audio tab exists for; the speed is a
     * comfort, and a comfort should collapse before a tool.
     */
    {
      id: 'boundary', label: 'Boundary', icon: 'marks', priority: 2,
      content: <BoundaryGroup audio={audio} mapping={mapping} />,
    },
    {
      id: 'speed', label: 'Speed', icon: 'loop', priority: 3,
      content: <SpeedGroup audio={audio} />,
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
