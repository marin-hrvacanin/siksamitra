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
import { existsSync } from 'node:fs';
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

/** Launch one, with the flags every tool here wants. */
export const launch = (opts = {}) => puppeteer.launch({
  executablePath: browserPath(), headless: 'shell', args: ['--no-sandbox'], ...opts,
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
