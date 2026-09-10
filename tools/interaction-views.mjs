#!/usr/bin/env node
/**
 * WHERE THE EDITOR IS DRAWN TWICE, AND THE RULE IT MUST NOT BREAK.
 *
 * A separate script from `interaction.mjs`, and separate on purpose: these
 * change which view is drawing the document, and a long sequence of gestures
 * sharing one mutating document is how a check starts depending on the order
 * of the ones before it. A fresh browser, one subject.
 *
 *   rule zero  a verse copied from a marked source refuses an edit — and the
 *              caret must be in THAT verse. It used to clamp into the previous
 *              one, which is editable, so the edit was allowed and landed in
 *              the wrong verse with no warning at all.
 *   the pages  the paged view renders the document a second time, and a third
 *              off-screen to measure heights. Every page must be editable and
 *              the measuring copy must not be.
 *
 *   npm run dev            # or serve a built bundle
 *   node tools/interaction-views.mjs
 */
import {
  URL,
  browser, page, errors, wait, column, check, clickLetter,
  verseText, caret, warning, thickBoxes, passed, failures,
} from './_editor-probe.mjs';

console.log('\n── the editor, driven like a person drives it\n');

/* ── rule zero, in the verse that was actually clicked ──────────────────── */
/*
 * THE BUG THIS EXISTS FOR was silent data loss, and the old shape of this
 * check walked straight past it.
 *
 * A transcribed verse has no source map, and an earlier version concluded it
 * had no place in the source either and clamped the caret to the END OF THE
 * PREVIOUS VERSE. Clicking Durgā Sūktam's third verse put the caret in the
 * second; the status bar named the second; rule zero saw an edit inside an
 * editable verse and allowed it; and the letter landed several lines from the
 * click. No refusal, no warning, wrong verse.
 *
 * It hid because the obvious test clicks the FIRST transcribed verse, which
 * has nothing before it to be clamped into. So this deliberately picks a
 * verse with no source layer that HAS one before it.
 *
 * WHAT IT ASSERTS HAS CHANGED, and the bug it was written for has not. There
 * is no refusal any more — a verse holds its own text and its own markings,
 * and every verse takes an edit. What still has to be true, and is the whole
 * point, is that the letter lands WHERE IT WAS TYPED: in the verse clicked,
 * not several lines away in the one before it.
 */
const shape = await page.evaluate(() => [...document.querySelectorAll('[data-verse]')]
  .map((v) => ({ id: v.dataset['verse'], attested: v.dataset['attested'] === '1' })));
const trap = shape.find((v, i) => v.attested && shape.slice(0, i).some((x) => !x.attested));
if (trap === undefined) {
  check('a transcribed verse after an editable one refuses, by name', false,
    'this document has no transcribed verse preceded by an editable one');
} else {
  const spot = await page.evaluate((id) => {
    const verse = document.querySelector(`[data-verse="${id}"]`);
    const letters = [...verse.querySelectorAll('[data-u]')];
    const el = letters[Math.min(20, letters.length - 1)];
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + 1, y: r.top + r.height / 2 };
  }, trap.id);
  await page.mouse.click(spot.x, spot.y);
  await wait(250);
  const landed = await caret();
  const wholeBefore = await page.evaluate(() => document.querySelector('.doc')?.textContent ?? '');
  await page.keyboard.type('X');
  await wait(500);
  const said = await warning();
  const wholeAfter = await page.evaluate(() => document.querySelector('.doc')?.textContent ?? '');
  const number = Number(/-(\d+)$/.exec(trap.id ?? '')?.[1] ?? -1);

  check(`a click in ${trap.id} puts the caret in ${trap.id}, not in the verse before it`,
    landed.startsWith(`${trap.id} ·`), landed);
  check('and typing there is accepted, not refused',
    !/copied from a marked source/.test(said), said.slice(0, 58));
  /* The letter is IN THE VERSE THAT WAS CLICKED. Reading the verse's own text
     rather than the page's, so a change anywhere else cannot satisfy it. */
  const inVerse = await page.evaluate(
    (id) => document.querySelector(`[data-verse="${id}"]`)?.textContent ?? '',
    trap.id,
  );
  /* Lower case: `normLoose` folds what is typed, which for IAST is right. */
  check(`and the letter landed in ${trap.id}`,
    inVerse.toLowerCase().includes('x'), inVerse.slice(0, 40));
  check('and the document did change', wholeAfter !== wholeBefore);
}

/* ── a selection that runs out of its section ───────────────────────────── */
/*
 * Ctrl+A is the ordinary way to reach this, and it used to be a lying
 * highlight: the browser anchors the selection in a section HEADING and ends
 * it in a source line — both outside any verse — so nothing mapped, the model
 * kept a stale caret from before, and the page showed the whole document
 * selected while a command would have touched one letter of it.
 *
 * A caret is bound to one section, so the selection is clamped to one and the
 * status bar says how much. What the status bar names is then exactly what a
 * command touches, which is the only arrangement where what somebody sees
 * predicts what will happen.
 */
await page.evaluate(() => {
  const first = document.querySelector('[data-verse]:not([data-attested]) [data-u]');
  first?.scrollIntoView({ block: 'center' });
});
const aimAt = await page.evaluate(() => {
  const el = document.querySelector('[data-verse]:not([data-attested]) [data-u]');
  const r = el.getBoundingClientRect();
  return { x: r.left + 1, y: r.top + r.height / 2 };
});
await page.mouse.click(aimAt.x, aimAt.y);
await wait(200);
await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
await wait(500);
const all = await page.evaluate(() => ({
  native: document.getSelection().toString().length,
  status: document.querySelector('.status__caret')?.textContent ?? '',
  chars: document.querySelector('.doc')?.textContent?.length ?? 0,
}));
check('Ctrl+A leaves the model a real range, not a stale caret',
  /letters selected/.test(all.status) && all.native > 0, all.status);

await page.keyboard.press('Backspace');
await wait(600);
const shrunk = await page.evaluate(() => document.querySelector('.doc')?.textContent?.length ?? 0);
const promised = Number(/(\d+) chars/.exec(all.status)?.[1] ?? -1);
check('and a delete removes what the status bar promised, not one letter of it',
  shrunk < all.chars && Math.abs((all.chars - shrunk) - promised) <= 2,
  `status said ${promised} chars, ${all.chars - shrunk} left the page`);
await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
await wait(500);

/* ── copying out of a verse that cannot be edited ───────────────────────── */
/*
 * A copied verse is read-only and is still the thing most worth copying. Its
 * position is known only to the line — it has no source map — and an earlier
 * fix snapped both ends of a selection to that line's start, so Ctrl+C inside
 * one produced an empty range AND prevented the browser copying either.
 */
await page.browserContext().overridePermissions(new global.URL(URL).origin,
  ['clipboard-read', 'clipboard-write']);
await page.evaluate(() => {
  const verse = document.querySelector('[data-verse][data-attested]');
  const letters = [...verse.querySelectorAll('[data-u]')];
  letters[0].scrollIntoView({ block: 'center' });
  const range = document.createRange();
  range.setStart(letters[2].firstChild ?? letters[2], 0);
  const last = letters[7];
  range.setEnd(last.firstChild ?? last, (last.firstChild?.textContent ?? '').length);
  const sel = document.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
});
await wait(250);
const shown = await page.evaluate(() => document.getSelection().toString());
await page.keyboard.down('Control'); await page.keyboard.press('KeyC'); await page.keyboard.up('Control');
await wait(400);
const onBoard = await page.evaluate(async () => {
  try { return await navigator.clipboard.readText(); } catch { return ''; }
});
check('copying out of a copied verse puts what is highlighted on the clipboard',
  onBoard !== '' && onBoard === shown, JSON.stringify(onBoard.slice(0, 16)));

/* ── the paged view, which renders the document twice ───────────────────── */
/*
 * Pages are a SECOND rendering of the same document, and there is a third,
 * hidden off-screen, that exists to measure block heights. All three are
 * `.doc`. This checks that the real pages are editable, that the measuring
 * copy is not — a caret in it would be at x = −99985 — and that typing into a
 * page actually reaches the document.
 */
await page.evaluate(() => [...document.querySelectorAll('.rbn__tab')]
  .find((t) => t.textContent?.trim() === 'View')?.click());
await wait(300);
await page.evaluate(() => [...document.querySelectorAll('.rbb')]
  .find((x) => x.textContent?.trim() === 'Pages')?.click());
await page.waitForSelector('.page');
await wait(1600);

const paged = await page.evaluate(() => ({
  editable: document.querySelectorAll('.page .doc[contenteditable="true"], .doc.page__content[contenteditable="true"]').length,
  probe: document.querySelector('.paged__probe')?.getAttribute('contenteditable'),
  pages: document.querySelectorAll('.page').length,
}));
check(
  'every page is editable and the measuring copy is not',
  paged.editable === paged.pages && paged.pages > 0 && paged.probe === null,
  `${paged.editable} of ${paged.pages} pages, probe=${String(paged.probe)}`,
);

const pagedText = () => page.evaluate(
  () => document.querySelector('.page [data-verse="v-2"] .pada')?.textContent ?? '',
);
const pagedBefore = await pagedText();
const aimed = await page.evaluate(() => {
  const letters = [...document.querySelectorAll('.page [data-verse="v-2"] [data-u]')];
  if (letters.length === 0) return null;
  letters[0].scrollIntoView({ block: 'center' });
  const r = letters[0].getBoundingClientRect();
  return { x: r.left + 1, y: r.top + r.height / 2 };
});
if (aimed !== null) {
  await page.mouse.click(aimed.x, aimed.y);
  await wait(250);
  await page.keyboard.type('oṁ ');
  await wait(600);
  check('typing on a page reaches the document', (await pagedText()) !== pagedBefore,
    (await pagedText()).slice(0, 26));
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
  await wait(450);
} else {
  check('typing on a page reaches the document', false, 'no addressable letter on a page');
}

/* Back to the flowing column, so the last check sees one host. */
await page.evaluate(() => [...document.querySelectorAll('.rbb')]
  .find((x) => x.textContent?.trim() === 'Flow')?.click());
await wait(600);

/* ── the choices a person made, after the program is closed and opened ──── */
/*
 * WHICH VIEW, WHAT PAPER, WHAT ZOOM — all three were React state and nothing
 * else, so all three reset on every start: an author working in Pages on A5 at
 * 90 % was put back in Flow on A4 at 100 % each time the program opened.
 * `useAppearance` had already written down why that is not acceptable.
 *
 * A RELOAD IS THE TEST, because it is the only thing in a browser that is the
 * same event as closing and reopening the program: the React tree is gone and
 * whatever comes back came from storage.
 */
const viewShape = () => page.evaluate(() => {
  const d = [...document.querySelectorAll('.doc')].find((e) => e.closest('.paged__probe') === null);
  return {
    pages: document.querySelectorAll('.page').length,
    pageW: Math.round(document.querySelector('.page')?.getBoundingClientRect().width ?? -1),
    zoom: d === undefined ? -1 : Number(getComputedStyle(d).getPropertyValue('--doc-zoom')) || -1,
  };
});
const pickSize = (id) => page.evaluate((want) => {
  const el = document.querySelector('[aria-label="Page size"]');
  if (el === null) throw new Error('no page-size control');
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  set.call(el, want);
  el.dispatchEvent(new Event('change', { bubbles: true }));
}, id);
const ribbon = (label, tab) => page.evaluate((args) => {
  const [want, t] = args;
  if (t !== null) document.querySelector(`#rbn-tab-${t}`)?.click();
  const el = [...document.querySelectorAll('.rbb')].find((b) => (b.textContent ?? '').trim() === want);
  if (el === undefined) throw new Error(`no ribbon button "${want}"`);
  el.click();
}, [label, tab ?? null]);

await ribbon('Pages', 'view');
await wait(1400);
await pickSize('a5');
await wait(1200);
await ribbon('Zoom out', 'view');
await wait(1000);
const chose = await viewShape();
check('a view, a paper size and a zoom were chosen', chose.pages > 0 && chose.zoom > 0,
  `${chose.pages} A5 pages, ${chose.pageW} px wide, zoom ${chose.zoom}`);

/* The document has been typed into by now, so the unload guard fires; accept
   it, because throwing the edit away is the point of the restart. And
   `domcontentloaded` rather than `networkidle0`: the dev server's own hot-reload
   socket never lets a reload reach zero connections. */
page.on('dialog', (d) => { void d.accept(); });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-block-id]');
await wait(2200);
const back = await viewShape();
check('THE VIEW, THE PAPER AND THE ZOOM COME BACK after a restart',
  back.pages > 0 && back.pageW === chose.pageW && Math.abs(back.zoom - chose.zoom) < 0.001,
  `${back.pages} pages, ${back.pageW} px wide (was ${chose.pageW}), zoom ${back.zoom}`);

/*
 * THE CONTROL. Without it, a build that simply always opened in Pages on A5
 * would pass — so the storage is cleared and the same reload must give the
 * defaults back: Flow, which draws no pages at all.
 */
await page.evaluate(() => { localStorage.removeItem('siksamitra.view'); });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-block-id]');
await wait(2000);
const fresh = await viewShape();
check('and with nothing stored it opens in Flow at actual size — the defaults',
  fresh.pages === 0 && Math.abs(fresh.zoom - 1) < 0.001,
  `${fresh.pages} pages, zoom ${fresh.zoom}`);

/* ── the invariant the whole design rests on ────────────────────────────── */
const drift = await page.evaluate(() => {
  /* Every letter the browser can see must still be one the renderer drew.
     A stray text node directly under the editable host is the DOM having
     been typed into behind the model's back. */
  const host = document.querySelector('.doc[contenteditable="true"]');
  if (host === null) return 'no editable host';
  const loose = [...host.childNodes].filter(
    (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
  );
  return loose.length;
});
check('the DOM was never edited behind the model', drift === 0, String(drift));

console.log(`\n  ${passed} passed, ${failures.length} failed.`);
console.log(`  console errors: ${errors.length === 0 ? 'none' : errors.slice(0, 3).join(' | ')}`);
await browser.close();
if (failures.length > 0 || errors.length > 0) {
  console.log('\nVIEWS FAILED\n');
  process.exit(1);
}
console.log('\nVIEWS PASSES\n');
