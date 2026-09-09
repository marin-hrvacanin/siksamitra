import puppeteer from 'puppeteer-core';
import { browserPath } from './_browser.mjs';
import { APP_URL } from './_ui.mjs';
const b = await puppeteer.launch({ executablePath: browserPath(), headless: 'shell', args: ['--no-sandbox'], });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto(APP_URL, { waitUntil: 'networkidle0' });
await p.waitForSelector('.rbb');
console.log(await p.evaluate(() => {
  const out = {};
  const seg = document.querySelector('.seg');
  out.segWidth = Math.round(seg.getBoundingClientRect().width);
  out.buttons = [...document.querySelectorAll('.rbb')].map((b) => {
    const c = getComputedStyle(b);
    return { text: b.textContent, cls: b.className, w: Math.round(b.getBoundingClientRect().width), bg: c.backgroundColor, color: c.color };
  });
  const sel = document.querySelector('.tb__sel');
  out.select = { w: Math.round(sel.getBoundingClientRect().width), maxW: getComputedStyle(sel).maxWidth };
  const app = document.querySelector('.app');
  out.appThemeAttr = app.getAttribute('data-theme');
  out.violetOnRoot = getComputedStyle(document.documentElement).getPropertyValue('--color-violet').trim();
  out.violetOnApp = getComputedStyle(app).getPropertyValue('--color-violet').trim();
  out.inkSoftOnApp = getComputedStyle(app).getPropertyValue('--color-ink-soft').trim();
  out.prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
  out.space9 = getComputedStyle(document.documentElement).getPropertyValue('--space-9');
  out.toolbarChildren = [...document.querySelector('.rbn').children].map((c) => c.className || c.tagName);
  return out;
}));
await b.close();
