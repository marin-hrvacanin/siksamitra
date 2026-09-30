/**
 * The files a person double-clicks to install the add-in. Nothing here runs
 * them — a registry write is not a unit test — so what is checked is what
 * they would do: the right id, the right address, the documented key, no
 * administrator, and nothing a console could garble.
 */
import { describe, expect, it } from 'vitest';
import { ADDIN_HOSTS } from '../word-addin.mjs';
import { WINDOWS_KEY, macInstaller, windowsInstaller, windowsUninstaller } from '../word-friend-installers.mjs';

const host = ADDIN_HOSTS.pages;
const ascii = (s) => [...s].every((c) => c === '\r' || c === '\n' || (c >= ' ' && c <= '~'));

describe('the Windows installer', () => {
  const cmd = windowsInstaller(host);

  it('downloads the published manifest and registers it where Word sideloads from', () => {
    expect(cmd).toContain(`set "URL=${host.base}/manifest.xml"`);
    expect(cmd).toContain(`reg add "${WINDOWS_KEY}" /v "${host.id}" /t REG_SZ /d "%MANIFEST%" /f`);
    expect(WINDOWS_KEY).toBe('HKCU\\Software\\Microsoft\\Office\\16.0\\WEF\\Developer');
  });

  it('keeps the buttons up to date by itself, with no window', () => {
    expect(cmd).toMatch(/schtasks \/create .*\/sc daily .*conhost\.exe --headless curl\.exe/);
  });

  it('needs no administrator: everything it writes is the user’s own', () => {
    expect(cmd).not.toMatch(/HKLM|runas|\/ru SYSTEM/i);
    expect(cmd).toContain('%LOCALAPPDATA%');
  });

  it('stops and says so when it cannot download', () => {
    expect(cmd).toMatch(/if errorlevel 1 \(\r\n.*Could not download/);
  });

  it('is ASCII with Windows line ends, as a batch file must be', () => {
    expect(ascii(cmd)).toBe(true);
    expect(cmd.split('\r\n').length).toBeGreaterThan(10);
    expect(cmd.replace(/\r\n/g, '')).not.toContain('\n');
  });
});

describe('the Windows uninstaller', () => {
  it('undoes all three: the key, the task, the folder', () => {
    const cmd = windowsUninstaller(host);
    expect(cmd).toContain(`reg delete "${WINDOWS_KEY}" /v "${host.id}" /f`);
    expect(cmd).toContain('schtasks /delete');
    expect(cmd).toContain('rmdir /s /q "%LOCALAPPDATA%\\siksamitra\\word"');
    expect(ascii(cmd)).toBe(true);
  });
});

describe('the Mac installer', () => {
  it('puts the manifest in the one folder Word on a Mac reads', () => {
    const sh = macInstaller(host);
    expect(sh.startsWith('#!/bin/sh\n')).toBe(true);
    expect(sh).toContain('Library/Containers/com.microsoft.Word/Data/Documents/wef');
    expect(sh).toContain(`${host.base}/manifest.xml`);
    expect(ascii(sh)).toBe(true);
  });
});
