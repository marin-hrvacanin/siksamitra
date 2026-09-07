import puppeteer from 'puppeteer-core';
const exe = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await puppeteer.launch({ executablePath: exe, headless: 'shell', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(String(e)));
await p.setViewport({ width: 1400, height: 900 });
await p.goto('http://localhost:5273/', { waitUntil: 'networkidle0' });
await p.waitForSelector('[data-block-id]', { timeout: 15000 });

const flow = await p.evaluate(() => ({
  blocks: document.querySelectorAll('[data-block-id]').length,
  syllables: document.querySelectorAll('.syl').length,
  holds: document.querySelectorAll('.hold').length,
  title: document.querySelector('.status')?.textContent?.slice(0, 40),
  view: document.querySelector('.seg__b.is-on')?.textContent,
}));
console.log('FLOW  ', JSON.stringify(flow));

// Switch to Pages and wait for the page map to materialise.
await p.evaluate(() => [...document.querySelectorAll('.seg__b')].find((b) => b.textContent === 'Pages')?.click());
await p.waitForSelector('.page', { timeout: 20000 });
await new Promise((r) => setTimeout(r, 600));
const paged = await p.evaluate(() => {
  const pages = [...document.querySelectorAll('.page')];
  return {
    pages: pages.length,
    firstPageBlocks: pages[0]?.querySelectorAll('[data-block-id]').length,
    pageW: Math.round(pages[0]?.getBoundingClientRect().width ?? 0),
    pageH: Math.round(pages[0]?.getBoundingClientRect().height ?? 0),
    folio: pages[0]?.querySelector('.page__folio')?.textContent?.trim(),
  };
});
console.log('PAGED ', JSON.stringify(paged));

await p.evaluate(() => [...document.querySelectorAll('.seg__b')].find((b) => b.textContent === 'Web')?.click());
await new Promise((r) => setTimeout(r, 400));
const web = await p.evaluate(() => ({
  theme: document.querySelector('.app')?.getAttribute('data-theme'),
  blocks: document.querySelectorAll('[data-block-id]').length,
}));
console.log('WEB   ', JSON.stringify(web));
console.log('ERRORS', errs.length ? errs.slice(0, 5) : 'none');
await b.close();
