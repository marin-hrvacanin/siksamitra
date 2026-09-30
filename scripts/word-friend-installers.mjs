/**
 * INSTALLING THE ADD-IN FOR SOMEBODY WHO IS NOT A DEVELOPER — one file to
 * double-click, published beside the add-in (`word-publish.mjs`).
 *
 * WHAT IT DOES ON WINDOWS, for the person running it alone — no administrator:
 *
 *   1. downloads the manifest from the published folder into
 *      `%LOCALAPPDATA%\siksamitra\word\manifest.xml`;
 *   2. tells Word about it the way Microsoft documents sideloading on
 *      Windows: a string value under `HKCU\Software\Microsoft\Office\16.0\WEF\Developer`,
 *      named with the add-in's id, holding the manifest's path. Word loads it
 *      at start, and the śikṣāmitra tab is on the ribbon — nothing to find in
 *      a menu;
 *   3. schedules a daily task, for that person, that downloads the manifest
 *      again — so new buttons arrive by themselves. The add-in's code needs
 *      nothing: Word loads it from the published folder every time it starts.
 *
 * `conhost.exe --headless` runs the daily download with no window.
 *
 * ON A MAC Word reads manifests from one folder, so the script is a download
 * into it. `install-mac.command` opens in Terminal when double-clicked.
 *
 * Every line is ASCII: a batch file is read in the console's code page, and a
 * name with a diacritic in it is a garbled line on some machines.
 */

/** The value name, the key and the paths the Windows files share. */
export const WINDOWS_KEY = 'HKCU\\Software\\Microsoft\\Office\\16.0\\WEF\\Developer';
const FOLDER = '%LOCALAPPDATA%\\siksamitra\\word';
const TASK = 'siksamitra Word add-in update';

const crlf = (lines) => `${lines.join('\r\n')}\r\n`;

/** `install-windows.cmd` for one published host. */
export function windowsInstaller(host) {
  const url = `${host.base}/manifest.xml`;
  return crlf([
    '@echo off',
    'setlocal',
    `rem  Installs ${ascii(host.name)} for Microsoft Word, for you alone. No administrator is needed.`,
    `set "HERE=${FOLDER}"`,
    'set "MANIFEST=%HERE%\\manifest.xml"',
    `set "URL=${url}"`,
    'echo.',
    `echo   Installing ${ascii(host.name)} for Microsoft Word...`,
    'if not exist "%HERE%" mkdir "%HERE%"',
    'curl.exe -fsSL "%URL%" -o "%MANIFEST%"',
    'if errorlevel 1 (',
    '  echo   Could not download it. Check the internet connection, then run this again.',
    '  pause',
    '  exit /b 1',
    ')',
    `reg add "${WINDOWS_KEY}" /v "${host.id}" /t REG_SZ /d "%MANIFEST%" /f >nul`,
    `schtasks /create /tn "${TASK}" /sc daily /st 12:00 /f /tr "conhost.exe --headless curl.exe -fsSL -o \\"%MANIFEST%\\" %URL%" >nul 2>nul`,
    'echo.',
    'echo   Done. Close Word if it is open, and start it again:',
    `echo   the ${ascii(host.name)} tab is on the ribbon. It keeps itself up to date.`,
    'echo.',
    'pause',
  ]);
}

/** `uninstall-windows.cmd`: the three things the installer did, undone. */
export function windowsUninstaller(host) {
  return crlf([
    '@echo off',
    `rem  Removes ${ascii(host.name)} from Microsoft Word.`,
    `reg delete "${WINDOWS_KEY}" /v "${host.id}" /f >nul 2>nul`,
    `schtasks /delete /tn "${TASK}" /f >nul 2>nul`,
    `rmdir /s /q "${FOLDER}" >nul 2>nul`,
    'echo.',
    `echo   ${ascii(host.name)} is removed. Start Word again and its tab is gone.`,
    'echo.',
    'pause',
  ]);
}

/** `install-mac.command`: the manifest, into the one folder Word on a Mac reads. */
export function macInstaller(host) {
  const dir = '$HOME/Library/Containers/com.microsoft.Word/Data/Documents/wef';
  return [
    '#!/bin/sh',
    `# Installs ${ascii(host.name)} for Microsoft Word on a Mac. Run it again to update the buttons.`,
    `mkdir -p "${dir}"`,
    `curl -fsSL "${host.base}/manifest.xml" -o "${dir}/siksamitra.xml" || { echo "Could not download it. Check the internet connection."; exit 1; }`,
    `echo "Done. Quit Word and open it again: the ${ascii(host.name)} tab is on the ribbon."`,
    '',
  ].join('\n');
}

/** A name as a batch file can print it. */
function ascii(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '');
}
