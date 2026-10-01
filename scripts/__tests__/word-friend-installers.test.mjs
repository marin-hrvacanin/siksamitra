/**
 * The files a person double-clicks to install the add-in. Nothing here runs
 * them — a registry write is not a unit test; they were run against a real
 * Word 16.0.20326, catalog and fallback both — so what is checked is what they
 * would do: the right id, the right address, the network path Word accepts, the
 * one step the person takes in Word, no administrator, and nothing a console
 * could garble.
 */
import { describe, expect, it } from 'vitest';
import { ADDIN_HOSTS } from '../word-addin.mjs';
import { CATALOG_ID, CATALOG_ROOT, DEVELOPER_KEY, catalogFolder, shareOf } from '../word-catalog.mjs';
import { ADD_ONCE, macInstaller, windowsInstaller, windowsUninstaller } from '../word-friend-installers.mjs';
import { PALLADIO, USER_FONTS_KEY } from '../word-fonts.mjs';

const host = ADDIN_HOSTS.pages;
const ascii = (s) => [...s].every((c) => c === '\r' || c === '\n' || (c >= ' ' && c <= '~'));
const lines = (cmd) => cmd.split('\r\n');
const catalogKey = `${CATALOG_ROOT}\\{${CATALOG_ID}}`;

/* What cmd.exe makes of `%NAME%`, `%NAME:~a%` and `%NAME:~a,n%` — enough of it
   to read a `set` line back. */
function expand(text, env) {
  return text.replace(/%(\w+)(?::~(\d+)(?:,(\d+))?)?%/g, (all, name, from, count) => {
    const v = env[name];
    if (v === undefined) return all;
    if (from === undefined) return v;
    return count === undefined ? v.slice(Number(from)) : v.slice(Number(from), Number(from) + Number(count));
  });
}
const setOf = (cmd, name) => lines(cmd).find((l) => l.startsWith(`set "${name}=`)).slice(`set "${name}=`.length, -1);

describe('the Windows installer', () => {
  const cmd = windowsInstaller(host);

  it('downloads the published manifest into the one folder', () => {
    expect(cmd).toContain(`set "URL=${host.base}/manifest.xml"`);
    expect(cmd).toContain('curl.exe -fsSL "%URL%" -o "%MANIFEST%"');
    const env = { LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local' };
    expect(expand(setOf(cmd, 'HERE'), env)).toBe(catalogFolder(env, 'win32'));
  });

  it('names that folder by the same network path as word-catalog.mjs does', () => {
    /* The batch file cannot call shareOf, so it spells the path itself; this
       is the test that the two spellings are one path. */
    for (const local of ['C:\\Users\\x\\AppData\\Local', 'D:\\Profiles\\y\\AppData\\Local']) {
      const env = { LOCALAPPDATA: local };
      expect(expand(setOf(cmd, 'SHARE'), env)).toBe(shareOf(catalogFolder(env, 'win32')));
    }
  });

  it('trusts it as Word\u2019s shared-folder catalog: the three values, Flags a DWORD', () => {
    expect(cmd).toContain(`reg add "${catalogKey}" /v Id /t REG_SZ /d "{${CATALOG_ID}}" /f`);
    expect(cmd).toContain(`reg add "${catalogKey}" /v Url /t REG_SZ /d "%SHARE%" /f`);
    expect(cmd).toContain(`reg add "${catalogKey}" /v Flags /t REG_DWORD /d "1" /f`);
  });

  it('and takes away a developer registration an earlier installer made', () => {
    /* Two routes for one add-in list it twice, and the developer one is the
       one Word forgets. */
    const catalogAt = lines(cmd).findIndex((l) => l.includes(`/v Url`));
    const removeAt = lines(cmd).findIndex((l) => l === `reg delete "${DEVELOPER_KEY}" /v "${host.id}" /f >nul 2>nul`);
    expect(removeAt).toBeGreaterThan(-1);
    expect(removeAt).toBeLessThan(catalogAt);
  });

  it('falls back to the developer key only where the share cannot be read', () => {
    const l = lines(cmd);
    const test = l.indexOf('if not exist "%SHARE%\\manifest.xml" goto developer');
    const label = l.indexOf(':developer');
    const fallback = l.findIndex((x) => x.startsWith(`reg add "${DEVELOPER_KEY}" /v "${host.id}"`));
    expect(test).toBeGreaterThan(-1);
    expect(label).toBeGreaterThan(test);
    expect(fallback).toBeGreaterThan(label);
    /* and the catalog branch ends before the label, rather than falling into it */
    expect(l.slice(test, label)).toContain('exit /b 0');
  });

  it('tells the person the one thing to do in Word, in Word\u2019s own words', () => {
    expect(cmd).toContain('Home ^> Add-ins ^> More Add-ins ^> SHARED FOLDER');
    expect(cmd).toMatch(/Choose siksamitra, then Add/);
  });

  it('never redirects a line it meant to print', () => {
    /* `echo a > b` writes "a " into a file called b and prints nothing. */
    for (const line of lines(cmd).filter((x) => /^\s*echo\b/.test(x))) {
      expect(line.replace(/\^>/g, ''), line).not.toContain('>');
    }
  });

  it('keeps the manifest up to date by itself, with no window', () => {
    expect(cmd).toMatch(/schtasks \/create .*\/sc daily .*conhost\.exe --headless curl\.exe/);
  });

  it('needs no administrator: everything it writes is the user\u2019s own', () => {
    expect(cmd).not.toMatch(/HKLM|runas|\/ru SYSTEM|net share/i);
    expect(cmd).toContain('%LOCALAPPDATA%');
  });

  it('stops and says so when it cannot download', () => {
    expect(cmd).toMatch(/if errorlevel 1 \(\r\n.*Could not download/);
  });

  it('is ASCII with Windows line ends, as a batch file must be', () => {
    expect(ascii(cmd)).toBe(true);
    expect(lines(cmd).length).toBeGreaterThan(10);
    expect(cmd.replace(/\r\n/g, '')).not.toContain('\n');
  });
});

describe('the Windows uninstaller', () => {
  const cmd = windowsUninstaller(host);

  it('undoes all of it: the catalog, the developer key, the task, the folder', () => {
    expect(cmd).toContain(`reg delete "${catalogKey}" /f`);
    expect(cmd).toContain(`reg delete "${DEVELOPER_KEY}" /v "${host.id}" /f`);
    expect(cmd).toContain('schtasks /delete');
    expect(cmd).toContain('rmdir /s /q "%LOCALAPPDATA%\\siksamitra\\word"');
  });

  it('and is a batch file a console reads right', () => {
    expect(ascii(cmd)).toBe(true);
    for (const line of lines(cmd).filter((x) => /^\s*echo\b/.test(x))) {
      expect(line.replace(/\^>/g, ''), line).not.toContain('>');
    }
  });
});

describe('the Mac installer', () => {
  const sh = macInstaller(host);

  it('puts the manifest in the one folder Word on a Mac reads', () => {
    expect(sh.startsWith('#!/bin/sh\n')).toBe(true);
    expect(sh).toContain('Library/Containers/com.microsoft.Word/Data/Documents/wef');
    expect(sh).toContain(`${host.base}/manifest.xml`);
    expect(ascii(sh)).toBe(true);
  });

  it('and says where in Word to find it, and that Word forgets it for now', () => {
    expect(sh).toContain('Home > Add-ins > siksamitra');
    expect(sh).toMatch(/forgets it when it quits/);
  });
});

/* ── the face the svaras are set in ─────────────────────────────────────── */

describe('URW Palladio ITU, installed with the add-in', () => {
  const win = windowsInstaller(ADDIN_HOSTS.pages);
  const mac = macInstaller(ADDIN_HOSTS.pages);
  it('is fetched from where it is published, and checked against its hash before anything is installed', () => {
    expect(win).toContain(PALLADIO.url);
    const check = lines(win).findIndex((l) => l.includes(PALLADIO.sha256));
    const firstCopy = lines(win).findIndex((l) => l.includes('copy /y'));
    expect(check).toBeGreaterThan(0);
    expect(firstCopy).toBeGreaterThan(check);
  });
  it('every face goes to the person\'s own font folder and is registered for them — no administrator', () => {
    for (const f of PALLADIO.faces) {
      expect(win).toContain(`"%FONTS%\\${f.file}"`);
      expect(win).toContain(`reg add "${USER_FONTS_KEY}" /v "${f.name}" /t REG_SZ /d "%FONTS%\\${f.file}" /f >nul`);
    }
    expect(win).toContain('set "FONTS=%LOCALAPPDATA%\\Microsoft\\Windows\\Fonts"');
    expect(win).not.toMatch(/HKLM|%WINDIR%\\Fonts|%SystemRoot%\\Fonts/i);
  });
  it('unpacks with Windows\' own tar, which reads a zip', () => {
    expect(win).toContain('"%SystemRoot%\\System32\\tar.exe" -xf "%ZIP%"');
  });
  it('a failed download or a wrong file is said, and the add-in is installed all the same', () => {
    const sub = lines(win).slice(lines(win).indexOf(':fonts'));
    expect(sub.filter((l) => l.trim() === 'exit /b 0').length).toBeGreaterThanOrEqual(3);
    expect(sub.join('\n')).toMatch(/Could not download/);
    expect(sub.join('\n')).toMatch(/was not the published file/);
    expect(sub.join('\n')).not.toMatch(/exit \/b 1/);
  });
  it('the subroutine is called, and sits after every exit so nothing falls into it', () => {
    const l = lines(win);
    expect(l).toContain('call :fonts');
    const label = l.indexOf(':fonts');
    const developer = l.indexOf(':developer');
    expect(label).toBeGreaterThan(developer);
    expect(l.slice(developer, label)).toContain('exit /b 0');
  });
  it('an existing face is not copied over — one in use cannot be', () => {
    for (const f of PALLADIO.faces) expect(win).toContain(`if not exist "%FONTS%\\${f.file}" copy /y`);
  });
  it('every line is still ASCII, for the console\'s code page', () => {
    expect(win).toMatch(/^[\x00-\x7f]*$/);
  });
  it('on a Mac: the same file, the same hash, into ~/Library/Fonts', () => {
    expect(mac).toContain(PALLADIO.url);
    expect(mac).toContain(`shasum -a 256 "$ZIP" | cut -d' ' -f1)" = "${PALLADIO.sha256}"`);
    expect(mac).toContain('-d "$HOME/Library/Fonts"');
    for (const f of PALLADIO.faces) expect(mac).toContain(f.file);
  });
});

describe('the one step left is shown, not only printed', () => {
  const win = windowsInstaller(ADDIN_HOSTS.pages);
  const mac = macInstaller(ADDIN_HOSTS.pages);
  it('the page with the step opens in the browser, on Windows and on a Mac', () => {
    expect(ADD_ONCE).toMatch(/#add-once$/);
    expect(win).toContain(`start "" "${ADD_ONCE}"`);
    expect(mac).toContain(`open "${ADD_ONCE}"`);
  });
  it('Word is started when it is not running — and a Word that is open is never closed', () => {
    expect(win).toContain('find /I "WINWORD.EXE" >nul || start "" winword');
    expect(win).not.toMatch(/taskkill|stop-process|\/im winword/i);
  });
  it('and the page has that step, under that name', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('site/index.html', 'utf8')).toMatch(/id="add-once"/);
  });
});
