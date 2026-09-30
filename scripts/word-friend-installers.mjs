/**
 * INSTALLING THE ADD-IN FOR SOMEBODY WHO IS NOT A DEVELOPER — one file to
 * double-click, published beside the add-in (`word-publish.mjs`). What Word is
 * told, and why that and not something else, is `word-catalog.mjs`.
 *
 * WHAT IT DOES ON WINDOWS, for the person running it alone — no administrator:
 *
 *   1. downloads the manifest from the published folder into
 *      `%LOCALAPPDATA%\siksamitra\word\manifest.xml`;
 *   2. trusts that folder as Word's shared-folder catalog, through the drive's
 *      own share (`\\localhost\C$\...`) — the one sideload Word still keeps
 *      after it closes. The person then adds it ONCE, from Home → Add-ins →
 *      More Add-ins → SHARED FOLDER, and the tab is there every time after.
 *      Where that share cannot be read, it registers the developer sideload
 *      instead and says what that costs;
 *   3. schedules a daily task, for that person, that downloads the manifest
 *      again. The add-in's code needs nothing: Word loads it from the
 *      published folder every time it starts.
 *
 * `conhost.exe --headless` runs the daily download with no window.
 *
 * ON A MAC Word reads manifests from one folder, so the script is a download
 * into it. `install-mac.command` opens in Terminal when double-clicked.
 *
 * Every line is ASCII: a batch file is read in the console's code page, and a
 * name with a diacritic in it is a garbled line on some machines. A `>` in an
 * `echo` is written `^>`, or the batch file redirects the line into a file.
 */
import { DEVELOPER_KEY, WINDOWS_FOLDER, catalogEntries } from './word-catalog.mjs';

const FOLDER = `%LOCALAPPDATA%\\${WINDOWS_FOLDER}`;
/* The same folder as a network path: `%LOCALAPPDATA:~0,1%` is its drive letter
   and `%LOCALAPPDATA:~2%` the rest — `\\localhost\C$\Users\...`. */
const SHARE = `\\\\localhost\\%LOCALAPPDATA:~0,1%$%LOCALAPPDATA:~2%\\${WINDOWS_FOLDER}`;
const TASK = 'siksamitra Word add-in update';
/* Word's own labels, in the order a person meets them. */
const ONCE = 'Home ^> Add-ins ^> More Add-ins ^> SHARED FOLDER';

const crlf = (lines) => `${lines.join('\r\n')}\r\n`;
const regAdd = (e, value = e.value) => `reg add "${e.key}" /v ${e.name} /t ${e.type} /d "${value}" /f >nul`;

/** `install-windows.cmd` for one published host. */
export function windowsInstaller(host) {
  const name = ascii(host.name);
  const url = `${host.base}/manifest.xml`;
  const catalog = catalogEntries('%SHARE%');
  return crlf([
    '@echo off',
    'setlocal',
    `rem  Installs ${name} for Microsoft Word, for you alone. No administrator is needed.`,
    `set "HERE=${FOLDER}"`,
    'set "MANIFEST=%HERE%\\manifest.xml"',
    `set "SHARE=${SHARE}"`,
    `set "URL=${url}"`,
    'echo.',
    `echo   Installing ${name} for Microsoft Word...`,
    'if not exist "%HERE%" mkdir "%HERE%"',
    'curl.exe -fsSL "%URL%" -o "%MANIFEST%"',
    'if errorlevel 1 (',
    '  echo   Could not download it. Check the internet connection, then run this again.',
    '  pause',
    '  exit /b 1',
    ')',
    `schtasks /create /tn "${TASK}" /sc daily /st 12:00 /f /tr "conhost.exe --headless curl.exe -fsSL -o \\"%MANIFEST%\\" %URL%" >nul 2>nul`,
    'if not exist "%SHARE%\\manifest.xml" goto developer',
    `reg delete "${DEVELOPER_KEY}" /v "${host.id}" /f >nul 2>nul`,
    ...catalog.map((e) => regAdd(e)),
    'echo.',
    'echo   Done. Now, once, in Word:',
    'echo     1. Close Word if it is open, and start it again.',
    `echo     2. ${ONCE}.`,
    `echo     3. Choose ${name}, then Add.`,
    `echo   From then on the ${name} tab is on the ribbon, and it keeps itself up to date.`,
    'echo.',
    'pause',
    'exit /b 0',
    ':developer',
    `reg add "${DEVELOPER_KEY}" /v "${host.id}" /t REG_SZ /d "%MANIFEST%" /f >nul`,
    'echo.',
    'echo   Done. In Word: Home ^> Add-ins ^> More Add-ins ^> MY ADD-INS, and under',
    `echo   Developer Add-ins choose ${name}, then Add. Word forgets it when it closes`,
    'echo   (a fault in Word since September 2026), so do this each time you start',
    'echo   Word until Microsoft fixes it.',
    'echo.',
    'pause',
  ]);
}

/** `uninstall-windows.cmd`: everything the installer did, undone. */
export function windowsUninstaller(host) {
  const name = ascii(host.name);
  return crlf([
    '@echo off',
    `rem  Removes ${name} from Microsoft Word.`,
    `reg delete "${catalogEntries('')[0].key}" /f >nul 2>nul`,
    `reg delete "${DEVELOPER_KEY}" /v "${host.id}" /f >nul 2>nul`,
    `schtasks /delete /tn "${TASK}" /f >nul 2>nul`,
    `rmdir /s /q "${FOLDER}" >nul 2>nul`,
    'echo.',
    `echo   ${name} is removed. Close Word if it is open: when it starts again, the`,
    `echo   ${name} tab is gone.`,
    'echo.',
    'pause',
  ]);
}

/** `install-mac.command`: the manifest, into the one folder Word on a Mac reads. */
export function macInstaller(host) {
  const name = ascii(host.name);
  const dir = '$HOME/Library/Containers/com.microsoft.Word/Data/Documents/wef';
  return [
    '#!/bin/sh',
    `# Installs ${name} for Microsoft Word on a Mac. Run it again to update the buttons.`,
    `mkdir -p "${dir}"`,
    `curl -fsSL "${host.base}/manifest.xml" -o "${dir}/siksamitra.xml" || { echo "Could not download it. Check the internet connection."; exit 1; }`,
    `echo "Done. Quit Word and open it again, open a document, then Home > Add-ins > ${name}."`,
    'echo "Word forgets it when it quits (a fault in Word since September 2026), so choose it there"',
    'echo "each time you start Word until Microsoft fixes it."',
    '',
  ].join('\n');
}

/** A name as a batch file can print it. */
function ascii(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '');
}
