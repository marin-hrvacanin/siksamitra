/**
 * THE RIBBON TAB AND THE RIGHT-CLICK MENU CANNOT DRIFT FROM THE PANE.
 *
 * The manifest block is generated from the pane's own controls
 * (`npm run gen:word-commands`); these fail when the file on disk is not what
 * the table generates, and when anything Word would silently refuse — an id
 * too long, a string too long, an icon missing — has crept in.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ENTRIES, TAB } from '../../commands-table.js';
import { ICON_SIZES, iconPath, versionOverrides, withCommands } from '../../manifest-commands.js';
import { GROUPS } from '../../ui/controls.js';

const ADDIN = fileURLToPath(new URL('../../../', import.meta.url));
const manifest = readFileSync(`${ADDIN}manifest.xml`, 'utf8');

describe('the manifest on disk', () => {
  it('is what the table generates — run `npm run gen:word-commands` if not', () => {
    expect(withCommands(manifest)).toBe(manifest);
  });
  it('has its own tab and a right-click menu on selected text', () => {
    expect(manifest).toContain('<CustomTab id="sm.Tab">');
    expect(manifest).toContain('<OfficeMenu id="ContextMenuText">');
    expect(manifest).toContain('<FunctionFile resid="sm.Commands.Url"/>');
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
  it('every command has its icon at every size, and it is a PNG', () => {
    for (const id of new Set([...ENTRIES.map((e) => e.id), 'marks'])) {
      for (const n of ICON_SIZES) {
        const f = `${ADDIN}assets/${iconPath(id, n)}`;
        expect(existsSync(f), f).toBe(true);
        expect([...readFileSync(f).subarray(1, 4)].map((c) => String.fromCharCode(c)).join('')).toBe('PNG');
      }
    }
  });
});

describe('the table is the pane', () => {
  it('every pane control is on the tab, with the pane\'s own label and command', () => {
    for (const c of GROUPS.flatMap((g) => g.controls)) {
      const e = ENTRIES.find((x) => x.id === c.icon);
      expect(e?.label, c.label).toBe(c.label);
      expect(e?.does).toEqual({ mark: c.command });
    }
  });
  it('ids and function names are unique', () => {
    expect(new Set(ENTRIES.map((e) => e.id)).size).toBe(ENTRIES.length);
    expect(new Set(ENTRIES.map((e) => e.fn)).size).toBe(ENTRIES.length);
  });
  it('the right-click menu has the range markings and not the point ones', () => {
    const menu = ENTRIES.filter((e) => e.menu).map((e) => e.id);
    expect(menu).toEqual(expect.arrayContaining(['hold-short', 'hold-long', 'change-anusvara', 'change-visarga']));
    expect(menu).not.toContain('bar-short');
  });
  it('the tab groups are the pane\'s, and then the rules', () => {
    expect(TAB.map((g) => g.label)).toEqual([...GROUPS.map((g) => g.title), 'Rules']);
  });
});
