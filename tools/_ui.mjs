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
