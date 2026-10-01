/**
 * THE MANIFEST'S COMMANDS — the tab, the right-click menu and the keyboard
 * shortcuts, written out of `commands-table.ts`.
 *
 * Pure: it returns the `<VersionOverrides>` block (and the `<ExtendedOverrides>`
 * that names the shortcuts file) as a string, and `scripts/word-commands.ts`
 * puts it into `manifest.xml`. The test compares the file with this.
 *
 * ONE PAGE, ONE RUNTIME. `taskpane.html` is the runtime the ribbon's functions
 * run in, the page the keyboard shortcuts are associated in, and the Settings
 * panel — the same `resid` in `<Runtime>`, `<FunctionFile>` and the Settings
 * button's `ShowTaskpane`, which is what makes Word share it
 * (learn.microsoft.com/office/dev/add-ins/develop/configure-your-add-in-to-use-a-shared-runtime).
 * A Word without the shared runtime ignores `<Runtimes>` and still runs every
 * button; only the shortcuts need it.
 *
 * THE ORDER IS THE SCHEMA'S. `Host` takes `Runtimes` first; `DesktopFormFactor`
 * takes `GetStarted`, then `FunctionFile`, then the extension points; a
 * `CustomTab` takes its groups and then its `Label`; a resource id is at most
 * 32 characters. An element out of order is a sideload that fails without a
 * message (learn.microsoft.com/office/dev/add-ins/develop/manifest-element-ordering).
 */
import { officeChord } from '@siksamitra/ui';
import {
  ALL_COMMANDS, COMMANDS, ICONS_NEEDED, TAB, iconFile, type Command, type Control,
} from './commands-table.js';

/** Where the published files are; `manifestFor` replaces it per host. */
export const DEV_BASE = 'https://localhost:3000';
/** The sizes Word asks a command icon in. */
export const ICON_SIZES = [16, 32, 80] as const;
/** Where a picture is, relative to the site's root. */
export const iconPath = (file: string, size: number): string => `ribbon/${file}-${size}.png`;
/** The keyboard shortcuts, as Word reads them. */
export const SHORTCUTS_FILE = 'shortcuts.json';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const icon = (file: string, pad: string): string => [
  `${pad}<Icon>`,
  ...ICON_SIZES.map((n) => `${pad}  <bt:Image size="${n}" resid="sm.i.${file}.${n}"/>`),
  `${pad}</Icon>`,
].join('\n');

const action = (c: Command, pad: string): string => (c.does === 'panel'
  ? `${pad}<Action xsi:type="ShowTaskpane">\n${pad}  <SourceLocation resid="sm.Taskpane.Url"/>\n${pad}</Action>`
  : `${pad}<Action xsi:type="ExecuteFunction">\n${pad}  <FunctionName>${c.fn}</FunctionName>\n${pad}</Action>`);

const tip = (id: string, pad: string): string =>
  `${pad}<Supertip>\n${pad}  <Title resid="sm.${id}.L"/>\n${pad}  <Description resid="sm.${id}.T"/>\n${pad}</Supertip>`;

function item(c: Command, pad: string, prefix: string): string {
  return [
    `${pad}<Item id="${prefix}.${c.id}">`,
    `${pad}  <Label resid="sm.${c.id}.L"/>`,
    tip(c.id, `${pad}  `),
    icon(iconFile(c.icon), `${pad}  `),
    action(c, `${pad}  `),
    `${pad}</Item>`,
  ].join('\n');
}

function control(c: Control, pad: string): string {
  if (c.kind === 'menu') {
    return [
      `${pad}<Control xsi:type="Menu" id="sm.tab.${c.id}">`,
      `${pad}  <Label resid="sm.${c.id}.L"/>`,
      tip(c.id, `${pad}  `),
      icon(iconFile(c.icon), `${pad}  `),
      `${pad}  <Items>`,
      ...c.items.map((i) => item(i, `${pad}    `, 'sm.tab')),
      `${pad}  </Items>`,
      `${pad}</Control>`,
    ].join('\n');
  }
  return [
    `${pad}<Control xsi:type="Button" id="sm.tab.${c.id}">`,
    `${pad}  <Label resid="sm.${c.id}.L"/>`,
    tip(c.id, `${pad}  `),
    icon(iconFile(c.icon), `${pad}  `),
    action(c, `${pad}  `),
    `${pad}</Control>`,
  ].join('\n');
}

const MENU_ICON = 'marks';

/** The tip, with its shortcut said at the end — Word shows no accelerator. */
const tipOf = (c: Command): string => (c.key === undefined ? c.tip : `${c.tip} (${officeChord(c.key)})`);

export function versionOverrides(): string {
  const groups = TAB.map((g) => [
    `              <Group id="sm.grp.${g.id}">`,
    `                <Label resid="sm.grp.${g.id}"/>`,
    icon(iconFile(g.controls[0]!.icon), '                '),
    ...g.controls.map((c) => control(c, '                ')),
    '              </Group>',
  ].join('\n'));
  const menus = TAB.flatMap((g) => g.controls.filter((c): c is Extract<Control, { kind: 'menu' }> => c.kind === 'menu'));
  const context = COMMANDS.filter((c) => c.context === true);
  const files = [...new Set(ICONS_NEEDED.map(iconFile))];
  const images = files.flatMap((f) => ICON_SIZES.map((n) =>
    `        <bt:Image id="sm.i.${f}.${n}" DefaultValue="${DEV_BASE}/${iconPath(f, n)}"/>`));
  const short = [
    ['sm.Tab.Label', 'śikṣāmitra'],
    ['sm.Ctx.Label', 'śikṣāmitra'],
    ['sm.GetStarted.Title', 'śikṣāmitra is ready'],
    ...TAB.map((g) => [`sm.grp.${g.id}`, g.label]),
    ...menus.map((m) => [`sm.${m.id}.L`, m.label]),
    ...COMMANDS.map((c) => [`sm.${c.id}.L`, c.label]),
  ];
  const long = [
    ['sm.Ctx.Tip', 'Mark the selected letters, or the letter before the caret.'],
    ['sm.GetStarted.Description', 'Everything is on the śikṣāmitra tab. Type a letter and press Short or Long, '
      + 'or a svara — or right-click a selection.'],
    ...menus.map((m) => [`sm.${m.id}.T`, m.tip]),
    ...COMMANDS.map((c) => [`sm.${c.id}.T`, tipOf(c)]),
  ];
  const strings = (rows: string[][], pad: string): string =>
    rows.map(([id, v]) => `${pad}<bt:String id="${id}" DefaultValue="${esc(v!)}"/>`).join('\n');

  return `<VersionOverrides
    xmlns="http://schemas.microsoft.com/office/taskpaneappversionoverrides"
    xsi:type="VersionOverridesV1_0">
    <Hosts>
      <Host xsi:type="Document">
        <Runtimes>
          <Runtime resid="sm.Taskpane.Url" lifetime="long"/>
        </Runtimes>
        <DesktopFormFactor>
          <GetStarted>
            <Title resid="sm.GetStarted.Title"/>
            <Description resid="sm.GetStarted.Description"/>
            <LearnMoreUrl resid="sm.Support.Url"/>
          </GetStarted>
          <FunctionFile resid="sm.Taskpane.Url"/>
          <ExtensionPoint xsi:type="PrimaryCommandSurface">
            <CustomTab id="sm.Tab">
${groups.join('\n')}
              <Label resid="sm.Tab.Label"/>
            </CustomTab>
          </ExtensionPoint>
          <ExtensionPoint xsi:type="ContextMenu">
            <OfficeMenu id="ContextMenuText">
              <Control xsi:type="Menu" id="sm.ctx">
                <Label resid="sm.Ctx.Label"/>
                <Supertip>
                  <Title resid="sm.Ctx.Label"/>
                  <Description resid="sm.Ctx.Tip"/>
                </Supertip>
${icon(MENU_ICON, '                ')}
                <Items>
${context.map((c) => item(c, '                  ', 'sm.ctx')).join('\n')}
                </Items>
              </Control>
            </OfficeMenu>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>
    </Hosts>
    <Resources>
      <bt:Images>
${images.join('\n')}
      </bt:Images>
      <bt:Urls>
        <bt:Url id="sm.Taskpane.Url" DefaultValue="${DEV_BASE}/taskpane.html"/>
        <bt:Url id="sm.Support.Url" DefaultValue="https://marin-hrvacanin.github.io/siksamitra/#word"/>
      </bt:Urls>
      <bt:ShortStrings>
${strings(short, '        ')}
      </bt:ShortStrings>
      <bt:LongStrings>
${strings(long, '        ')}
      </bt:LongStrings>
    </Resources>
  </VersionOverrides>
  <ExtendedOverrides Url="${DEV_BASE}/${SHORTCUTS_FILE}"/>`;
}

/**
 * The keyboard shortcuts file `<ExtendedOverrides>` names — every command with
 * a `key`, under its function's name, which is also the id `runtime.ts`
 * associates (learn.microsoft.com/office/dev/add-ins/design/keyboard-shortcuts).
 */
export function shortcuts(): string {
  const keyed = ALL_COMMANDS.filter((c) => c.key !== undefined);
  return `${JSON.stringify({
    actions: keyed.map((c) => ({ id: c.fn, type: 'ExecuteFunction', name: c.label })),
    shortcuts: keyed.map((c) => ({ action: c.fn, key: { default: officeChord(c.key!) } })),
  }, null, 2)}\n`;
}

/** The manifest with its `<VersionOverrides>` (and `<ExtendedOverrides>`) replaced. */
export function withCommands(manifest: string): string {
  const start = manifest.indexOf('<VersionOverrides');
  const close = manifest.indexOf('</VersionOverrides>');
  if (start < 0 || close < 0) throw new Error('the manifest has no <VersionOverrides> block');
  let end = close + '</VersionOverrides>'.length;
  const ext = /^\s*<ExtendedOverrides[^>]*\/>/.exec(manifest.slice(end));
  if (ext !== null) end += ext[0].length;
  return manifest.slice(0, start) + versionOverrides() + manifest.slice(end);
}
