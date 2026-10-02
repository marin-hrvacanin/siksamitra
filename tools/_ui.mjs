/**
 * THE UI CONTRACT, for the tools that drive the program.
 *
 * Six tools open the app in a browser and press things: the smoke checks, the
 * editing smoke, the walkthrough, the fidelity gate, the responsive check and
 * the theme matrix. Each one used to hold its own copy of "the view buttons
 * are `.seg__b`" and "the mode toggle says Read only" — so rebuilding the
 * toolbar broke all six at once, silently, in the way that matters most: a
 * `querySelector` that finds nothing does not throw, it returns `null`, and
 * `null?.click()` is a no-op that leaves the check passing against a page it
 * never touched.
 *
 * So the contract lives here, once. When the shell changes, this file changes
 * and the tools do not.
 */
import { assertFresh } from './build-stamp.mjs';

export { assertFresh };

/**
 * Where the app is, for every tool.
 *
 * It was written out in each of them, and they did not agree: the theme matrix
 * asked for 5273 while the app was being served on 5293, and passed only
 * because CI happened to use the port it had guessed.
 */
export const APP_URL = process.env.URL ?? 'http://localhost:5273/';

/**
 * WHAT WENT WRONG ON A PAGE, BY ITS ADDRESS — a gate's console and network
 * errors, gathered into `errors`. Chrome's console says only "Failed to load
 * resource: 404"; the failed request itself says which, so that is what is
 * kept. CI was red for days on that one line with nothing to go on.
 *
 * ONE failure is expected and is no fault: a recitation's clips are not in the
 * repository (`apps/web/src/shell/media.ts`), and the audio dock asks for the
 * first one to learn whether the recording is there (`useHeard`), so on a host
 * without them — CI, the desktop app — that request fails, by design. Every
 * other failure still fails the gate.
 */
export const RECITATION = /\/tests\/[^/]+\/audio\//;
export function watchErrors(page, errors) {
  const expected = (url) => RECITATION.test(new URL(url).pathname);
  page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400 && !expected(r.url())) errors.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => {
    const why = r.failure()?.errorText ?? '';
    if (why !== 'net::ERR_ABORTED' && !expected(r.url())) errors.push(`${why} ${r.url()}`);
  });
}

/**
 * Open the app, and refuse to drive a build that is not the source on disk.
 *
 * The freshness check belongs here rather than in each tool, because a check a
 * tool has to remember to make is a check that will be forgotten — and this
 * one was missing entirely while every browser gate reported green against a
 * bundle built hours earlier. See `build-stamp.mjs`.
 */
export async function openApp(page, url = APP_URL, { selector = '.rbn' } = {}) {
  await assertFresh(url);
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector(selector);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

/** The parts of the window, by selector. */
export const UI = {
  titleBar: '.tbar',
  ribbon: '.rbn',
  ribbonBody: '.rbn__body',
  tab: (id) => `#rbn-tab-${id}`,
  group: (id) => `[data-group="${id}"]`,
  nav: '.nav',
  navRow: '.nav__row',
  canvas: '.canvas',
  status: '.status',
  document: '.doc',
  /** A ribbon button, found by its visible label. */
  button: '.rbb',
};

/** Bring a ribbon tab to the front. Its groups only exist while it is. */
export async function openTab(page, id) {
  const clicked = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el === null) return false;
    el.click();
    return true;
  }, UI.tab(id));
  if (!clicked) throw new Error(`no ribbon tab "${id}" — the tabs have changed`);
  await new Promise((r) => setTimeout(r, 250));
}

/**
 * Press a ribbon button by its label, on whichever tab it lives on.
 *
 * THROWS if there is no such button, which is the whole point: a tool that
 * quietly did nothing reported success for a page it had not touched.
 */
export async function press(page, label, { tab } = {}) {
  if (tab !== undefined) await openTab(page, tab);
  const hit = await page.evaluate((args) => {
    const [sel, want] = args;
    const el = [...document.querySelectorAll(sel)]
      .find((b) => (b.textContent ?? '').trim() === want);
    if (el === undefined) return null;
    if (el.disabled) return 'disabled';
    el.click();
    return 'clicked';
  }, [UI.button, label]);
  if (hit === null) throw new Error(`no ribbon button labelled "${label}"`);
  if (hit === 'disabled') throw new Error(`the button "${label}" is disabled`);
  await new Promise((r) => setTimeout(r, 250));
}

/** Whether a ribbon button is currently pressed. */
export const isOn = (page, label) => page.evaluate((args) => {
  const [sel, want] = args;
  const el = [...document.querySelectorAll(sel)]
    .find((b) => (b.textContent ?? '').trim() === want);
  return el === undefined ? null : el.getAttribute('aria-pressed') === 'true';
}, [UI.button, label]);

/** Read or write mode. One name for it, wherever the button moves to. */
export const setMode = (page, mode) =>
  press(page, mode === 'write' ? 'Write' : 'Read', { tab: 'home' });

/** Flow, Pages or Web. */
export const setView = (page, label) => press(page, label, { tab: 'view' });

/** A holding, on the selection or the letter under the caret. */
export const mark = (page, which) => press(page, which, { tab: 'home' });

/** The status bar's text, whitespace collapsed. */
export const status = (page) => page.evaluate(
  (sel) => document.querySelector(sel)?.textContent?.replace(/\s+/g, ' ') ?? '',
  UI.status,
);
