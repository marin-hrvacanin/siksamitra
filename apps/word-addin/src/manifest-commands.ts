/**
 * THE MANIFEST'S COMMANDS — the ribbon tab and the right-click menu, written
 * out of `commands-table.ts`.
 *
 * Pure: it returns the `<VersionOverrides>` block as a string, and
 * `scripts/word-commands.ts` puts it into `manifest.xml`. The test compares the
 * file with this, so a control added to the pane that is not on the tab fails
 * the build instead of going missing in Word.
 *
 * THE ORDER IS THE SCHEMA'S. `DesktopFormFactor` takes `GetStarted`, then
 * `FunctionFile`, then the extension points; a `CustomTab` takes its groups
 * and then its `Label`; a resource id is at most 32 characters. An element out
 * of order is a sideload that fails without a message
 * (learn.microsoft.com/office/dev/add-ins/develop/manifest-element-ordering).
 */
import { TAB, type Entry } from './commands-table.js';

/** Where the published files are; `manifestFor` replaces it per host. */
export const DEV_BASE = 'https://localhost:3000';
/** The sizes Word asks a command icon in. */
export const ICON_SIZES = [16, 32, 80] as const;
/** Where a command's icon is, relative to the site's root. */
export const iconPath = (id: string, size: number): string => `ribbon/${id}-${size}.png`;

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const icon = (id: string, pad: string): string => [
  `${pad}<Icon>`,
  ...ICON_SIZES.map((n) => `${pad}  <bt:Image size="${n}" resid="sm.${id}.${n}"/>`),
  `${pad}</Icon>`,
].join('\n');

const action = (e: Entry, pad: string): string => (e.does === 'open'
  ? `${pad}<Action xsi:type="ShowTaskpane">\n${pad}  <TaskpaneId>sm.Taskpane</TaskpaneId>\n`
    + `${pad}  <SourceLocation resid="sm.Taskpane.Url"/>\n${pad}</Action>`
  : `${pad}<Action xsi:type="ExecuteFunction">\n${pad}  <FunctionName>${e.fn}</FunctionName>\n${pad}</Action>`);

const tip = (e: Entry, pad: string): string =>
  `${pad}<Supertip>\n${pad}  <Title resid="sm.${e.id}.L"/>\n${pad}  <Description resid="sm.${e.id}.T"/>\n${pad}</Supertip>`;

function button(e: Entry, pad: string): string {
  return [
    `${pad}<Control xsi:type="Button" id="sm.tab.${e.id}">`,
    `${pad}  <Label resid="sm.${e.id}.L"/>`,
    tip(e, `${pad}  `),
    icon(e.id, `${pad}  `),
    action(e, `${pad}  `),
    `${pad}</Control>`,
  ].join('\n');
}

function menuItem(e: Entry, pad: string): string {
  return [
    `${pad}<Item id="sm.ctx.${e.id}">`,
    `${pad}  <Label resid="sm.${e.id}.L"/>`,
    tip(e, `${pad}  `),
    icon(e.id, `${pad}  `),
    action(e, `${pad}  `),
    `${pad}</Item>`,
  ].join('\n');
}

const MENU_ICON = 'marks';

export function versionOverrides(): string {
  const entries = TAB.flatMap((g) => g.entries);
  const groups = TAB.map((g) => [
    `              <Group id="sm.grp.${g.id}">`,
    `                <Label resid="sm.grp.${g.id}"/>`,
    icon(g.entries[0]!.id, '                '),
    ...g.entries.map((e) => button(e, '                ')),
    '              </Group>',
  ].join('\n'));
  const menu = entries.filter((e) => e.menu);
  const images = [...new Set([...entries.map((e) => e.id), MENU_ICON])]
    .flatMap((id) => ICON_SIZES.map((n) =>
      `        <bt:Image id="sm.${id}.${n}" DefaultValue="${DEV_BASE}/${iconPath(id, n)}"/>`));
  const short = [
    ['sm.Tab.Label', 'śikṣāmitra'],
    ['sm.Ctx.Label', 'śikṣāmitra'],
    ['sm.GetStarted.Title', 'śikṣāmitra is ready'],
    ...TAB.map((g) => [`sm.grp.${g.id}`, g.label]),
    ...entries.map((e) => [`sm.${e.id}.L`, e.label]),
  ];
  const long = [
    ['sm.Ctx.Tip', 'Mark the selected letters: a holding, a svara, an anusvāra or visarga change.'],
    ['sm.GetStarted.Description', 'Open the śikṣāmitra tab, select letters in a line and press Short or Long '
      + 'to mark a holding — or right-click a selection.'],
    ...entries.map((e) => [`sm.${e.id}.T`, e.tip]),
  ];
  const strings = (rows: string[][], pad: string): string =>
    rows.map(([id, v]) => `${pad}<bt:String id="${id}" DefaultValue="${esc(v!)}"/>`).join('\n');

  return `<VersionOverrides
    xmlns="http://schemas.microsoft.com/office/taskpaneappversionoverrides"
    xsi:type="VersionOverridesV1_0">
    <Hosts>
      <Host xsi:type="Document">
        <DesktopFormFactor>
          <GetStarted>
            <Title resid="sm.GetStarted.Title"/>
            <Description resid="sm.GetStarted.Description"/>
            <LearnMoreUrl resid="sm.Support.Url"/>
          </GetStarted>
          <FunctionFile resid="sm.Commands.Url"/>
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
${menu.map((e) => menuItem(e, '                  ')).join('\n')}
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
        <bt:Url id="sm.Commands.Url" DefaultValue="${DEV_BASE}/commands.html"/>
        <bt:Url id="sm.Support.Url" DefaultValue="https://marin-hrvacanin.github.io/siksamitra/#word"/>
      </bt:Urls>
      <bt:ShortStrings>
${strings(short, '        ')}
      </bt:ShortStrings>
      <bt:LongStrings>
${strings(long, '        ')}
      </bt:LongStrings>
    </Resources>
  </VersionOverrides>`;
}

/** The manifest with its `<VersionOverrides>` block replaced. */
export function withCommands(manifest: string): string {
  const start = manifest.indexOf('<VersionOverrides');
  const end = manifest.indexOf('</VersionOverrides>');
  if (start < 0 || end < 0) throw new Error('the manifest has no <VersionOverrides> block');
  return manifest.slice(0, start) + versionOverrides() + manifest.slice(end + '</VersionOverrides>'.length);
}
