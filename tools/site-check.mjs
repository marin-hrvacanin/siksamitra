#!/usr/bin/env node
/**
 * THE LANDING PAGE, LOOKED AT — at a phone width, a tablet width and a desk.
 *
 *   CHROME=<path> npm run check:site
 *
 * The site had no check of any kind, and it has cost twice already.
 *
 *   THE PICTURES WERE NOT THERE. `shots/` in `.gitignore` had no leading
 *   slash, so it matched `site/shots/` too: the three screenshots the download
 *   page showed had never been committed, every one of them answered 404 on
 *   the live site, and the owner's report was "images are not visible on the
 *   site". Nothing could have told us — the page looked fine locally, where
 *   the files exist.
 *
 *   AND THE INSTALL STEPS RAN OFF THE SCREEN. At 390 px the numbered steps of
 *   the Word section were CLIPPED — "Put it i", "Shared Folder → śikṣ" —
 *   because a flex child will not shrink below its content unless it is told
 *   it may. That is the block somebody follows three instructions from, and a
 *   clipped instruction is a wrong one.
 *
 * So: every image loads and has real pixels in it, every internal link points
 * at a file that exists, nothing is wider than the screen, and no anchor the
 * page links to is missing. Measured with a browser rather than by reading the
 * HTML, because both faults above were invisible in the source.
 *
 * IT READS THE FILES, not the deployed site, so it fails BEFORE a push rather
 * than after one. `word-extension/` is the exception: the Pages workflow
 * builds it into the artifact and it is not in the repository, so it is
 * checked only when it happens to be there.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { browserPath } from './_browser.mjs';

const SITE = 'site';
const PAGES = ['index.html', 'privacy.html', 'terms.html'];
/** Written by `.github/workflows/pages.yml` at deploy time; absent here. */
const GENERATED = ['word-extension/'];

const WIDTHS = [390, 768, 1280];

const results = [];
const check = (what, got, want) => {
  results.push({ ok: JSON.stringify(got) === JSON.stringify(want), what, got, want });
};

const browser = await puppeteer.launch({
  executablePath: browserPath(), headless: 'shell', args: ['--no-sandbox', '--allow-file-access-from-files'],
});

console.log('\n── the landing page, from the files\n');

for (const file of PAGES) {
  const url = pathToFileURL(resolve(join(SITE, file))).href;
  const page = await browser.newPage();
  const missing = [];
  page.on('requestfailed', (r) => missing.push(r.url()));
  page.on('response', (r) => { if (r.status() >= 400) missing.push(r.url()); });

  for (const width of WIDTHS) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);

    const seen = await page.evaluate(() => {
      /*
       * WHAT STICKS OUT, and WHAT IS CLIPPED — two different faults.
       *
       * A page can have no horizontal scrollbar and still be clipping its
       * content, because an overflowing child of a fixed-width parent is cut
       * rather than pushing the page wider. Both are looked for.
       */
      const over = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        /* A deliberate scroller may be wider than the screen INSIDE itself. */
        const scroller = el.closest('pre, [style*="overflow"], .scroll');
        if (scroller !== null && scroller !== el) continue;
        if (Math.ceil(r.right) > window.innerWidth + 1
          || Math.floor(r.left) < -1) {
          over.push(`${el.tagName.toLowerCase()}${el.className === '' ? '' : `.${String(el.className).split(' ')[0]}`}`
            + ` ${Math.round(r.left)}..${Math.round(r.right)}`);
        }
      }
      /* And text that its own box is cutting off. */
      const clipped = [];
      for (const el of document.querySelectorAll('p, li, h1, h2, h3, div, span, code')) {
        if (el.children.length > 0) continue;
        if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'auto') {
          clipped.push(`${el.tagName.toLowerCase()}: ${(el.textContent ?? '').trim().slice(0, 40)}`);
        }
      }
      return {
        over: [...new Set(over)].slice(0, 8),
        clipped: [...new Set(clipped)].slice(0, 8),
        scrollWidth: document.documentElement.scrollWidth,
        images: [...document.images].map((i) => ({
          src: i.getAttribute('src') ?? '',
          w: i.naturalWidth,
          h: i.naturalHeight,
        })),
        links: [...document.querySelectorAll('a[href]')]
          .map((a) => a.getAttribute('href') ?? '')
          .filter((h) => !h.startsWith('http') && !h.startsWith('mailto:')),
        anchors: [...document.querySelectorAll('[id]')].map((e) => e.id),
      };
    });

    check(`${file} at ${width}: nothing sticks out`, seen.over, []);
    check(`${file} at ${width}: nothing is clipped`, seen.clipped, []);
    check(`${file} at ${width}: no sideways scroll`, seen.scrollWidth <= width + 1, true);

    if (width === WIDTHS[0]) {
      /*
       * EVERY PICTURE HAS PIXELS IN IT. `naturalWidth` is 0 for an image the
       * browser could not load — which is exactly what the whole site did
       * after `.gitignore` ate `site/shots/`, and the HTML looked perfect.
       */
      check(`${file}: every image loaded`,
        seen.images.filter((i) => i.w === 0 || i.h === 0).map((i) => i.src), []);
      check(`${file}: there are images to check — the control`,
        file === 'index.html' ? seen.images.length > 3 : true, true);

      /* Every internal link goes somewhere: a file, or an anchor on this page. */
      const broken = [];
      for (const href of seen.links) {
        if (href.startsWith('#')) {
          if (!seen.anchors.includes(href.slice(1))) broken.push(href);
          continue;
        }
        const [path] = href.split('#');
        if (path === undefined || path === '' || path === './') continue;
        if (GENERATED.some((g) => path.startsWith(g))) continue;
        if (!existsSync(join(SITE, path))) broken.push(href);
      }
      check(`${file}: every link goes somewhere`, broken, []);
    }
  }
  await page.close();
  const real = [...new Set(missing)].filter((u) => !u.endsWith('/favicon.ico'));
  check(`${file}: nothing 404ed`, real, []);
}

await browser.close();

for (const r of results) {
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.what.padEnd(46)} ${
    r.ok ? '' : JSON.stringify(r.got)}`);
}
const bad = results.filter((r) => !r.ok);
console.log('');
if (bad.length > 0) {
  console.error(`SITE GATE FAILS — ${bad.length} of ${results.length}\n`);
  process.exit(1);
}
console.log(`SITE GATE PASSES — ${results.length} checks over `
  + `${PAGES.length} pages at ${WIDTHS.join(', ')} px\n`);
