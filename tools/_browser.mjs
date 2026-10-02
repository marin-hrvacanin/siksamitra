/**
 * WHERE THE BROWSER IS. One answer, for every tool that opens one.
 *
 * Twelve tools in here drive a real browser, and each one used to find it by
 * itself. Six carried `process.env.CHROME ?? 'C:/Program Files/Google/Chrome/
 * Application/chrome.exe'`, five read the variable bare, and one — the export
 * gate — actually searched the machine. So on a machine with Edge and no
 * Chrome, which is the machine this was written on, eleven gates died inside
 * puppeteer with
 *
 *     Error: An `executablePath` or `channel` must be specified
 *
 * naming neither the variable to set nor the fact that a browser was wanted,
 * while the twelfth passed. A gate that cannot be run is a gate that is not
 * run, and four of them had quietly become unrunnable.
 *
 * The fallback list is not a convenience. Without it the only way to run a
 * browser gate is to already know the variable's name, which is exactly the
 * knowledge a new machine — or a new person — does not have.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

/** Where a browser usually is, in the order worth looking. */
const CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];

/**
 * The browser to drive.
 *
 * `CHROME` wins when it is set, and a `CHROME` pointing at nothing is an error
 * rather than a silent fall through to some other browser: someone who set it
 * meant that binary, and quietly using a different one would make a gate
 * report on a browser nobody chose.
 */
export function browserPath() {
  const named = process.env.CHROME;
  if (named !== undefined && named !== '') {
    if (!existsSync(named)) throw new Error(`CHROME is set to "${named}", which is not there`);
    return named;
  }
  const found = CANDIDATES.find((p) => existsSync(p));
  if (found === undefined) {
    throw new Error(
      'no browser found. This needs one — set CHROME to a Chrome or Edge '
      + `binary. Looked in:\n  ${CANDIDATES.join('\n  ')}`,
    );
  }
  return found;
}

/**
 * HIS OWN FONTS — `fonts/` at the repository's root: Arial, Times New Roman,
 * Calibri and Calibri Light, Mangal, URW Palladio ITU, licensed by him and
 * never committed, because the repository is public. Where the folder is —
 * his machine; the bot's server, mounted read-only — the browser that prints
 * the PDFs is pointed at it, so a page is set in his faces, which the stacks
 * name first; where it is not, the faces named after them stand in, with the
 * same widths. Windows has them already and does not read fontconfig.
 */
const FONTS = fileURLToPath(new URL('../fonts/', import.meta.url));
function fontEnv() {
  if (!existsSync(FONTS)) return {};
  const conf = join(tmpdir(), 'siksamitra-fonts.conf');
  writeFileSync(conf, '<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n'
    + '  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>\n'
    + `  <dir>${FONTS}</dir>\n  <cachedir>${join(tmpdir(), 'siksamitra-fontconfig')}</cachedir>\n</fontconfig>\n`);
  return { FONTCONFIG_FILE: conf };
}

/** Launch one, with the flags every tool here wants — and his fonts, where they are. */
export const launch = (opts = {}) => puppeteer.launch({
  executablePath: browserPath(), headless: 'shell', args: ['--no-sandbox'],
  env: { ...process.env, ...fontEnv() }, ...opts,
});

/** Open a browser once and hand it to `fn`, closing it whatever happens. */
export async function withBrowser(fn, opts = {}) {
  const browser = await launch(opts);
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}
