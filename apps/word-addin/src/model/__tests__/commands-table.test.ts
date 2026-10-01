/**
 * THE TAB, THE RIGHT-CLICK MENU AND THE SHORTCUTS CANNOT DRIFT FROM THE TABLE.
 *
 * The manifest block and the shortcuts file are generated from
 * `commands-table.ts` (`npm run gen:word-commands`); these fail when the files
 * on disk are not what the table generates, and when anything Word would
 * silently refuse — an id too long, a string too long, an icon missing, a
 * shared runtime whose three `resid`s disagree — has crept in.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COMMANDS, ICONS_NEEDED, TAB, iconFile } from '../../commands-table.js';
import {
  ICON_SIZES, SHORTCUTS_FILE, iconPath, shortcuts, versionOverrides, withCommands,
} from '../../manifest-commands.js';
import { MARK_KEYS, officeChord } from '@siksamitra/ui';

const ADDIN = fileURLToPath(new URL('../../../', import.meta.url));
const manifest = readFileSync(`${ADDIN}manifest.xml`, 'utf8');

describe('the manifest on disk', () => {
  it('is what the table generates — run `npm run gen:word-commands` if not', () => {
    expect(withCommands(manifest)).toBe(manifest);
  });
  it('has its own tab and a right-click menu on selected text', () => {
    expect(manifest).toContain('<CustomTab id="sm.Tab">');
    expect(manifest).toContain('<OfficeMenu id="ContextMenuText">');
    expect(manifest).toContain('<FunctionFile resid="sm.Taskpane.Url"/>');
  });
  it('orders DesktopFormFactor as the schema does: GetStarted, FunctionFile, extension points', () => {
    const at = (s: string) => manifest.indexOf(s);
    expect(at('<GetStarted>')).toBeLessThan(at('<FunctionFile'));
    expect(at('<FunctionFile')).toBeLessThan(at('<ExtensionPoint'));
  });
  it('puts a CustomTab\'s Label after its groups', () => {
    const tab = manifest.slice(manifest.indexOf('<CustomTab'), manifest.indexOf('</CustomTab>'));
    expect(tab.lastIndexOf('<Group')).toBeLessThan(tab.indexOf('<Label resid="sm.Tab.Label"/>'));
  });
});

describe('what Word would refuse without saying', () => {
  const block = versionOverrides();
  it('every resource id is at most 32 characters', () => {
    for (const m of block.matchAll(/\b(?:resid|id)="([^"]+)"/g)) {
      if (m[0].startsWith('resid') || /^sm\./.test(m[1]!)) expect(m[1]!.length, m[1]).toBeLessThanOrEqual(32);
    }
  });
  it('every short string is at most 125 characters and every long one 250', () => {
    const short = block.slice(block.indexOf('<bt:ShortStrings>'), block.indexOf('</bt:ShortStrings>'));
    const long = block.slice(block.indexOf('<bt:LongStrings>'), block.indexOf('</bt:LongStrings>'));
    for (const m of short.matchAll(/DefaultValue="([^"]*)"/g)) expect(m[1]!.length, m[1]).toBeLessThanOrEqual(125);
    for (const m of long.matchAll(/DefaultValue="([^"]*)"/g)) expect(m[1]!.length, m[1]).toBeLessThanOrEqual(250);
  });
  it('every resid a control names is defined', () => {
    const defined = new Set([...block.matchAll(/<bt:\w+ id="([^"]+)"/g)].map((m) => m[1]));
    for (const m of block.matchAll(/resid="([^"]+)"/g)) expect(defined.has(m[1]), m[1]).toBe(true);
  });
  it('every picture exists at every size, and it is a PNG with something drawn in it', () => {
    for (const file of new Set(ICONS_NEEDED.map(iconFile))) {
      for (const n of ICON_SIZES) {
        const f = `${ADDIN}assets/${iconPath(file, n)}`;
        expect(existsSync(f), f).toBe(true);
        const png = readFileSync(f);
        expect([...png.subarray(1, 4)].map((c) => String.fromCharCode(c)).join('')).toBe('PNG');
        /* An empty 16 px transparent PNG is ~100 bytes; a drawn glyph is more. */
        expect(png.length, f).toBeGreaterThan(110);
      }
    }
  });
  it('the shortcuts file on disk is what the table generates', () => {
    expect(readFileSync(`${ADDIN}assets/${SHORTCUTS_FILE}`, 'utf8')).toBe(shortcuts());
    expect(manifest).toContain(`<ExtendedOverrides Url="https://localhost:3000/${SHORTCUTS_FILE}"/>`);
  });
});

describe('one runtime', () => {
  /* The shared runtime loads only when every reference to it is the same
     resid; a mismatch is a Word that runs the buttons and ignores the keys. */
  it('the runtime, the function file and Settings are the same page', () => {
    const block = versionOverrides();
    expect(block).toContain('<Runtime resid="sm.Taskpane.Url" lifetime="long"/>');
    expect(block).toContain('<FunctionFile resid="sm.Taskpane.Url"/>');
    const panes = [...block.matchAll(/<SourceLocation resid="([^"]+)"\/>/g)].map((m) => m[1]);
    expect(panes.length).toBeGreaterThan(0);
    expect(new Set(panes)).toEqual(new Set(['sm.Taskpane.Url']));
    expect(block).not.toContain('<TaskpaneId>');
  });
  it('Runtimes is the first thing in Host', () => {
    const block = versionOverrides();
    expect(block.indexOf('<Runtimes>')).toBeLessThan(block.indexOf('<DesktopFormFactor>'));
    expect(block.indexOf('<Host xsi:type="Document">')).toBeLessThan(block.indexOf('<Runtimes>'));
  });
});

describe('the table', () => {
  it('ids and function names are unique', () => {
    expect(new Set(COMMANDS.map((e) => e.id)).size).toBe(COMMANDS.length);
    expect(new Set(COMMANDS.map((e) => e.fn)).size).toBe(COMMANDS.length);
  });
  it('the right-click menu has the range markings and not the point ones', () => {
    const menu = COMMANDS.filter((e) => e.context === true).map((e) => e.id);
    expect(menu).toEqual(expect.arrayContaining(['hold-short', 'hold-long', 'change-anusvara', 'change-visarga']));
    expect(menu).not.toContain('pause-short');
    expect(menu).not.toContain('svarabhakti');
  });
  it('the holding group is the app’s: Short, Long, and a Clear that takes only the holding', () => {
    const holding = TAB.find((g) => g.id === 'holding')!;
    expect(holding.controls.map((c) => c.label)).toEqual(['Short', 'Long', 'Clear']);
    const clear = COMMANDS.find((c) => c.id === 'hold-clear')!;
    expect(clear.does).toEqual({ mark: { k: 'clear', only: ['hold'] } });
  });
  it('the app’s accelerators are Word’s, from the one table', () => {
    const keyOf = (id: string) => COMMANDS.find((c) => c.id === id)?.key;
    expect(keyOf('hold-short')).toEqual(MARK_KEYS.holdShort);
    expect(keyOf('hold-long')).toEqual(MARK_KEYS.holdLong);
    expect(keyOf('hold-clear')).toEqual(MARK_KEYS.clearHold);
    expect(keyOf('reapply')).toEqual(MARK_KEYS.reapply);
    expect(officeChord(MARK_KEYS.holdLong)).toBe('Ctrl+Shift+H');
    const chords = COMMANDS.flatMap((c) => (c.key === undefined ? [] : [officeChord(c.key)]));
    expect(new Set(chords).size).toBe(chords.length);
  });
  it('no two pauses are both called Pause', () => {
    expect(COMMANDS.map((c) => c.label)).toEqual(expect.arrayContaining(['Short pause', 'Long pause']));
    expect(COMMANDS.map((c) => c.label)).not.toContain('Pause');
  });
  it('every palette character is in an insert menu, once', () => {
    const inserted = COMMANDS.flatMap((c) => (typeof c.does === 'object' && 'insert' in c.does ? [c.does.insert] : []));
    expect(new Set(inserted).size).toBe(inserted.length);
    expect(inserted).toEqual(expect.arrayContaining(['ā', 'ṭh', 'ś', 'ṣ', '।', 'ꣳ']));
  });
  it('there is no pane button: Settings is the only thing that opens the side panel', () => {
    expect(COMMANDS.filter((c) => c.does === 'panel').map((c) => c.id)).toEqual(['panel']);
    expect(COMMANDS.map((c) => c.label)).not.toContain('Pane');
  });
});
