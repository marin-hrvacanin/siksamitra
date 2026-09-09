#!/usr/bin/env node
/**
 * DOES THE RECITATION PLAY? Measured in a real browser, against the clock.
 *
 * The owner's report: "audio should be fully functional, as it used to be on
 * vedaunion.org and the older siksamitra branch." It was not, and nothing said
 * so — every path in this failure is silent. `audioBase` gives
 * `/tests/durga-suktam/audio/durga-1.mp3`, this program serves a bundle and
 * not the platform, the fetch 404s, `<audio>` fires `error` where nobody is
 * listening, and Play looks like a button that does nothing.
 *
 * TWO DOCUMENTS, because the corpus has two SHAPES and only one of them was
 * ever exercised:
 *
 *   Durgā Sūktam    eight clips, NOT ONE pāda mapping. This is what the app
 *                   opens, and it is the shape almost the whole corpus is in
 *                   (80 of 82 clips). The transport used to be built on the
 *                   pāda mapping, so for this document its list was empty and
 *                   the dock never appeared at all.
 *   Bhāgya Sūktam   nine clips, all nine mapped down to the pāda. The only
 *                   document that can test a highlight, and the only one the
 *                   old reading could play.
 *
 * A gate that drove the mapped document alone would have passed throughout.
 *
 * WHAT IS ASSERTED, and in each case against something outside the program:
 *
 *   the file exists      a ranged GET from NODE — not from inside the page,
 *                        which CORS blocks, so the probe reported HTTP 0 for a
 *                        file that was there. `sourceFor` returning a
 *                        plausible string is not a recitation; a 200/206 and
 *                        `audio/mpeg` is.
 *   it is really playing `HTMLAudioElement.currentTime` MOVES, read off the
 *                        element itself, and `paused` is false. A `playing`
 *                        flag in the app is the app's own opinion.
 *   which clip           the element's `src`, by file name.
 *   the advance          the src CHANGES to the next verse's clip. "Still
 *                        playing" would pass on a clip that simply looped.
 *   the right line lights the class the app puts on ONE pāda, checked against
 *                        the verse whose clip is on air — every clip starts at
 *                        zero, so a bare time matches a pāda in most verses.
 *
 * THE MEDIA ORIGIN IS PASSED IN, so this gate says which server it measured.
 *   npm run dev
 *   node tools/interaction-audio.mjs
 *   MEDIA=http://localhost:5174 node tools/interaction-audio.mjs
 */
import puppeteer from 'puppeteer-core';
import { browserPath } from './_browser.mjs';
import { APP_URL } from './_ui.mjs';

const MEDIA = (process.env.MEDIA ?? APP_URL.replace(/\/$/, '')).replace(/\/$/, '');
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

let passed = 0;
const failures = [];
const check = (name, ok, detail = '') => {
  if (ok) { passed += 1; console.log(`  ok    ${name}${detail === '' ? '' : `  — ${detail}`}`); return; }
  failures.push(name);
  console.log(`  FAIL  ${name}  ${detail}`);
};

console.log('\n── the recitation, played and listened to\n');
console.log(`  media origin: ${MEDIA}\n`);

/*
 * THE FILE, from node, before a browser is opened.
 *
 * This used to run inside the page with `fetch`, which CORS refuses for a
 * cross-origin media host that sends no `Access-Control-Allow-Origin` — and a
 * refused fetch rejects, so the probe reported `HTTP 0` for a file that was
 * being served perfectly well. An `<audio>` element is not bound by that rule,
 * which is exactly why the app can play what the probe could not read.
 */
async function reachable(path) {
  try {
    const r = await fetch(`${MEDIA}${path}`, { headers: { Range: 'bytes=0-99' } });
    return { status: r.status, type: r.headers.get('content-type') ?? '' };
  } catch (e) {
    return { status: 0, type: String(e?.message ?? e) };
  }
}
const head = await reachable('/tests/durga-suktam/audio/durga-1.mp3');
check('the recitation is where the document says it is',
  head.status === 200 || head.status === 206, `HTTP ${head.status} ${head.type}`);

const browser = await puppeteer.launch({
  executablePath: browserPath(),
  headless: 'shell',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
/* Every request the page makes for a clip, so a 404 cannot pass unnoticed. */
const media = [];
page.on('response', (r) => {
  if (/\.mp3(\?|$)/i.test(r.url())) media.push({ url: r.url(), status: r.status() });
});

await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${APP_URL}?media=${encodeURIComponent(MEDIA)}`, { waitUntil: 'networkidle0' });
await page.waitForSelector('[data-block-id]');
await page.evaluate(() => document.fonts.ready);
await wait(600);

const pressTab = (label) => page.evaluate((want) => {
  [...document.querySelectorAll('.rbn__tab')].find((t) => t.textContent.trim() === want)?.click();
}, label);
const pressButton = (label) => page.evaluate((want) => {
  const b = [...document.querySelectorAll('.rbb')].find((x) => x.textContent.trim() === want);
  if (b === undefined) return 'missing';
  if (b.disabled) return 'disabled';
  b.click();
  return 'clicked';
}, label);
/** The element itself, not the app's opinion of it. */
const clock = () => page.evaluate(() => {
  const a = [...document.querySelectorAll('audio')].find((x) => x.src !== '');
  return a === undefined ? null : {
    clip: a.src.split('/').pop(),
    t: a.currentTime,
    paused: a.paused,
    duration: a.duration,
    error: a.error?.code ?? 0,
  };
});
/** Put the caret in a verse, so "This verse" has a subject. */
const caretIn = async (verseId) => {
  const spot = await page.evaluate((id) => {
    const u = document.querySelector(`[data-verse="${id}"] [data-u]`);
    if (u === null) return null;
    u.scrollIntoView({ block: 'center' });
    const r = u.getBoundingClientRect();
    return { x: r.left + 1, y: r.top + r.height / 2 };
  }, verseId);
  if (spot === null) throw new Error(`no verse ${verseId} on the page`);
  await page.mouse.click(spot.x, spot.y);
  await wait(300);
};
/** Which pādas are lit, as `verse/line`. */
const litPadas = () => page.$$eval('.is-sung', (els) => els.map((e) => {
  const verse = e.closest('[data-verse]')?.dataset.verse ?? '?';
  return `${verse}/${e.dataset.line ?? '?'}`;
}));
/** Open one of the documents that come with the program. */
const openLibraryDoc = async (title) => {
  /* The File tab is `.rbn__file`, not a `.rbn__tab` — it opens the backstage,
     which is a place rather than a set of controls. `pressTab('File')` found
     nothing and did nothing, in the silence a `querySelector` always keeps. */
  const opened = await page.evaluate(() => {
    const b = document.querySelector('.rbn__file');
    if (b === null) return false;
    b.click();
    return true;
  });
  if (!opened) throw new Error('no File tab in the ribbon');
  await page.waitForSelector('.bs__item', { timeout: 4000 });
  await wait(300);
  const hit = await page.evaluate((want) => {
    const b = [...document.querySelectorAll('.bs__item')]
      .find((x) => x.querySelector('.bs__item-name')?.textContent.trim() === want);
    if (b === undefined) return 'missing';
    b.click();
    return 'clicked';
  }, title);
  if (hit !== 'clicked') throw new Error(`no library document "${title}" in the File view`);
  await wait(1800);
  await page.evaluate(() => document.fonts.ready);
};

/* ══ DURGĀ SŪKTAM — clips, no mapping. The shape the corpus is mostly in. ══ */
console.log(`\n  ── ${await page.title()} — eight clips, no pāda mapping\n`);

const dock = await page.$$eval('.adock', (d) => d.length);
check('a document with a recitation shows its transport', dock > 0, `${dock} dock(s)`);

check('the recitation has an element in the page, not a detached one',
  (await page.$$eval('audio', (a) => a.length)) > 0,
  `${await page.$$eval('audio', (a) => a.length)} <audio>`);

await caretIn('v-2');
await pressTab('Audio');
await wait(250);
check('the Audio tab offers the verse under the caret',
  (await pressButton('This verse')) === 'clicked');

await wait(1700);
const first = await clock();
await wait(1500);
const later = await clock();

if (first === null || later === null) {
  check('the recitation is playing', false, 'no <audio> element has a source');
} else {
  check('the clip that loaded is the one for the verse under the caret',
    first.clip === 'durga-2.mp3', first.clip);
  check('the media element reports no error', first.error === 0, `code ${first.error}`);
  const secs = (n) => (Number.isFinite(n) ? n.toFixed(2) : String(n));
  check('and the clock is moving', later.t > first.t + 0.5 && !later.paused,
    `${secs(first.t)}s → ${secs(later.t)}s of ${secs(later.duration)}s`);
}

/*
 * A CLIP ENDING IS NOT THE CHANT ENDING. Rather than sit through eighteen
 * seconds, the element is seeked to just before the end and the run is watched
 * over the boundary. The SEEK is this gate's; the ADVANCE is the program's,
 * and it is read as the src CHANGING — "still playing" would pass on a loop.
 */
await page.evaluate(() => {
  const a = [...document.querySelectorAll('audio')].find((x) => x.src !== '');
  if (a !== undefined && Number.isFinite(a.duration)) a.currentTime = Math.max(0, a.duration - 0.5);
});
await wait(3000);
const crossed = await clock();
check('a clip ending moves on to the NEXT verse, not to silence',
  crossed !== null && !crossed.paused && crossed.clip === 'durga-3.mp3',
  crossed === null ? 'no element' : `${crossed.clip} at ${Number(crossed.t).toFixed(2)}s`);

check('and nothing is lit, because this document has no pāda mapping',
  (await litPadas()).length === 0, (await litPadas()).join(', '));

await pressButton('Stop');
await wait(300);

/* ══ BHĀGYA SŪKTAM — the one document mapped down to the pāda ═════════════ */
await openLibraryDoc('Bhāgya Sūktam');
console.log(`\n  ── ${await page.title()} — nine clips, all nine mapped\n`);

check('the mapped document also shows its transport',
  (await page.$$eval('.adock', (d) => d.length)) > 0);

await caretIn('v-2');
await pressTab('Audio');
await wait(250);
check('its verse plays too', (await pressButton('This verse')) === 'clicked');
await wait(2000);

const sung = await clock();
check('the mapped clip is playing',
  sung !== null && !sung.paused && sung.error === 0,
  sung === null ? 'no element' : `${sung.clip} at ${sung.t.toFixed(2)}s`);

const lit = await litPadas();
check('exactly one pāda is lit', lit.length === 1, lit.join(', ') || 'none');
check('and it is in the verse whose clip is playing',
  lit.length === 1 && lit[0].startsWith('v-2/'), lit.join(', ') || 'none');

await pressButton('Stop');
await wait(400);
check('and nothing is lit once it stops', (await litPadas()).length === 0,
  (await litPadas()).join(', '));

/* ── nothing was asked for and refused ───────────────────────────────────── */
const bad = media.filter((m) => m.status >= 400);
check('no clip was asked for and refused', bad.length === 0,
  bad.slice(0, 3).map((m) => `${m.status} ${m.url.split('/').pop()}`).join(', '));
check('and clips really were fetched — a silent gate proves nothing',
  media.length > 0, `${media.length} request(s)`);
console.log(`\n  clips requested: ${[...new Set(media.map((m) => m.url.split('/').pop()))].join(', ')}`);

console.log(`\n  ${passed} passed, ${failures.length} failed.`);
console.log(`  page errors: ${errors.length === 0 ? 'none' : errors.slice(0, 2).join(' | ')}`);
await browser.close();
if (failures.length > 0 || errors.length > 0) {
  console.log('\nAUDIO INTERACTION FAILED\n');
  process.exit(1);
}
console.log('\nAUDIO INTERACTION PASSES\n');
