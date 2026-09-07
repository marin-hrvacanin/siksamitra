import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: process.env.CHROME, headless: 'shell', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 2 });
await p.goto('file:///D:/Projects/siksamitra/design-preview.html', { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 900));
console.log(await p.evaluate(() => ({
  panels: document.querySelectorAll('.dp-panel').length,
  holds: document.querySelectorAll('.hold').length,
  svaras: document.querySelectorAll('[class*=svara]').length,
  aksaras: document.querySelectorAll('.syl').length,
})));
const ids = await p.evaluate(() => [...new Set([...document.querySelectorAll('.dp-panel')].map(x => x.dataset.option))]);
for (const id of ids) {
  await p.evaluate((i) => document.querySelector(`[data-filter="${i}"]`).click(), id);
  await new Promise(r => setTimeout(r, 400));
  await p.screenshot({ path: `${process.argv[2]}/opt-${id}.png`, fullPage: true });
}
console.log('shots:', ids.join(', '));
await b.close();
