/**
 * A RIBBON COMMAND, CALLED IN THE ADD-IN'S OWN RUNTIME — for `drive.ps1`.
 *
 *   node tools/word-ui/press.mjs fn <FunctionName>
 *   node tools/word-ui/press.mjs dialog <Button label>
 *   node tools/word-ui/press.mjs eval <base64 of async code>   (Office settings, as Settings sets them)
 *   node tools/word-ui/press.mjs said <words>   (the open message says them; then it is answered)
 *   node tools/word-ui/press.mjs upload <file>   (the pane's file picker, as choosing a file in it does)
 *
 * A ribbon button invoked through UI Automation does not always reach the
 * add-in — measured: the tab's buttons were pressed, nothing ran, and once the
 * keystrokes went into the document instead. What a press DOES is call the
 * command's function in the shared runtime (`ExecuteFunction` in the
 * manifest), so that is what this does, over the WebView2 debugging port
 * Word's add-in runtime opens when it is started with
 * `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9229`.
 *
 * The call is not awaited: a command that asks first holds its promise until
 * the dialog is answered, and the dialog is the next step's.
 */
import puppeteer from 'puppeteer-core';

const [what, arg] = process.argv.slice(2);

/*
 * THE RUNTIME OF THE TEST DOCUMENT, and no other. Every open document can have
 * the add-in's runtime of its own, and the first page found could be one of
 * the person's — Word reopens his documents by itself on a start. The
 * document a runtime serves is asked; only the one `WORD_UI_DOC` names is
 * used, and none is the error it should be.
 */
async function runtimeOf(pages) {
  const wanted = (process.env.WORD_UI_DOC ?? '').split(/[\\/]/).pop()?.toLowerCase() ?? '';
  const candidates = pages.filter((p) => p.url().includes('taskpane.html'));
  for (const page of candidates) {
    const url = await page.evaluate(() => Office.context.document.url ?? '').catch(() => '');
    const name = decodeURIComponent(String(url)).split(/[\\/]/).pop()?.toLowerCase() ?? '';
    if (wanted === '' ? candidates.length === 1 : name === wanted) return page;
  }
  throw new Error(`no add-in runtime for ${wanted || 'the one document'} — refusing to press anything in another document`);
}
const PORT = process.env.WORD_CDP_PORT ?? '9229';
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null });
let code = 0;
try {
  const pages = await browser.pages();
  if (what === 'fn') {
    /* A message still open is the previous step's, unanswered — and Word
       opens one dialog at a time, so this command's own would never appear.
       Said, and closed, so the steps after it are not all blamed for it. */
    const open = pages.find((p) => p.url().includes('said.html'));
    if (open !== undefined) {
      const q = new URL(open.url()).searchParams;
      const text = [q.get('text'), ...JSON.parse(q.get('lines') ?? '[]')].join(' — ');
      await open.evaluate(() => { [...document.querySelectorAll('button')].at(-1)?.click(); }).catch(() => {});
      throw new Error(`a message was left open before '${arg}': ${text}`);
    }
    const page = await runtimeOf(pages);
    const found = await page.evaluate((fn) => {
      const f = globalThis[fn];
      if (typeof f !== 'function') return false;
      void f({ completed() {}, source: { id: fn } });
      return true;
    }, arg);
    if (!found) throw new Error(`no command '${arg}' in the runtime`);
  } else if (what === 'eval') {
    const page = await runtimeOf(pages);
    const code = Buffer.from(arg, 'base64').toString('utf8');
    await page.evaluate(`(async () => { ${code} })()`);
  } else if (what === 'said') {
    const deadline = Date.now() + 15_000;
    let page;
    while (page === undefined && Date.now() < deadline) {
      page = (await browser.pages()).find((p) => p.url().includes('said.html'));
      if (page === undefined) await new Promise((r) => setTimeout(r, 400));
    }
    if (page === undefined) throw new Error(`no message said "${arg}"`);
    const q = new URL(page.url()).searchParams;
    const text = [q.get('text'), ...JSON.parse(q.get('lines') ?? '[]')].join(' — ');
    await page.evaluate(() => { [...document.querySelectorAll('button')].at(-1)?.click(); }).catch(() => {});
    if (!text.includes(arg)) throw new Error(`the message said "${text}", not "${arg}"`);
  } else if (what === 'upload') {
    const page = await runtimeOf(pages);
    const input = await page.$('input[type=file]');
    if (input === null) throw new Error('no file picker in the pane — is Settings showing?');
    await input.uploadFile(arg);
  } else if (what === 'dialog') {
    const deadline = Date.now() + 15_000;
    let hit = false;
    while (!hit && Date.now() < deadline) {
      for (const p of await browser.pages()) {
        if (!/said\.html|dialog/.test(p.url())) continue;
        hit = await p.evaluate((label) => {
          const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === label);
          b?.click();
          return b !== undefined;
        }, arg).catch(() => false);
        if (hit) break;
      }
      if (!hit) await new Promise((r) => setTimeout(r, 400));
    }
    if (!hit) throw new Error(`no '${arg}' button in any dialog`);
  } else {
    throw new Error(`press.mjs fn <name> | dialog <label>, not '${what}'`);
  }
} catch (e) {
  console.error(String(e instanceof Error ? e.message : e));
  code = 1;
}
await browser.disconnect();
process.exit(code);
