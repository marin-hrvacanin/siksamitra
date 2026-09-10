#!/usr/bin/env node
/**
 * SERVE THE BUILT ADD-IN FROM THIS MACHINE, over HTTPS.
 *
 *   npm run word-addin:serve          # https://localhost:3000
 *
 * WHY THIS EXISTS BESIDE THE DEV SERVER. `npm run -w @siksamitra/word-addin
 * dev` is Vite: it serves the SOURCE, transforms on demand, and needs the
 * whole workspace on disk. This serves the BUILT folder — the same bytes that
 * get uploaded — which is what makes "it works locally" mean the same thing as
 * "it works published". It is also what a person who wants the add-in without
 * the internet runs, and Vite's dev server is not that.
 *
 * WHY HTTPS IS NOT OPTIONAL. Office refuses to load a task pane over http, in
 * development as much as in production, and reports the refusal as a blank
 * pane. The certificate is the one `office-addin-dev-certs install` writes, and
 * it EXPIRES — 30 days, short enough that a person will hit it — so the expiry
 * is checked and said out loud rather than discovered as Word failing to load
 * a page that worked yesterday.
 *
 * NO DEPENDENCY. A static file server is `node:https` plus a content-type
 * table; rule 16 is about not rewriting a MECHANISM somebody has perfected,
 * and this is not a mechanism — it is a `readFile` and a header. What it does
 * need is care about which file it will hand out, which is `fileFor` below.
 */
import { createServer } from 'node:https';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { homedir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADDIN_HOSTS } from './word-addin.mjs';

const CERTS = join(homedir(), '.office-addin-dev-certs');
export const KEY = join(CERTS, 'localhost.key');
export const CERT = join(CERTS, 'localhost.crt');

export const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'text/xml; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

/**
 * The file a request asks for, or `null`.
 *
 * THE ONE THING A STATIC SERVER MUST NOT GET WRONG. This runs on a developer's
 * machine with their whole disk beneath it, so `GET /../../../.ssh/id_rsa` has
 * to resolve to nothing. Four steps, and each is here for its own reason:
 *
 *   - `decodeURIComponent` THROWS on a malformed escape (`%zz`). Unhandled in
 *     a request handler, that is the server gone. A bad escape is a 404.
 *   - `normalize` on a path forced to start with `/` collapses `..` before
 *     anything is joined, so the traversal is gone rather than caught.
 *   - `startsWith(root)` alone is not enough even after that: `/srv/rootevil`
 *     starts with `/srv/root`. The separator is part of the test.
 *   - a NUL byte is refused outright. Node throws on one in a path anyway;
 *     refusing it here means it is refused on purpose.
 */
export function fileFor(root, url) {
  let asked;
  try {
    asked = decodeURIComponent((url ?? '/').split(/[?#]/)[0] ?? '/');
  } catch {
    return null;
  }
  if (asked.includes('\0')) return null;
  const path = resolve(root, `.${normalize(`/${asked}`)}`);
  if (path !== root && !path.startsWith(root + sep)) return null;
  if (!existsSync(path)) return null;
  if (!statSync(path).isDirectory()) return path;
  const index = join(path, 'index.html');
  return existsSync(index) ? index : null;
}

/** How long the developer certificate has left, in whole days. */
export function certDays(pem, now = Date.now()) {
  return Math.floor((Date.parse(new X509Certificate(pem).validTo) - now) / 86_400_000);
}

function main(folder) {
  if (!existsSync(KEY) || !existsSync(CERT)) {
    console.error('\n  No developer certificate. Run:\n\n'
      + '    npm run word-addin:certs\n\n'
      + '  It installs a local certificate authority — Windows asks you to '
      + 'confirm once.\n');
    process.exit(1);
  }
  /* SAY WHEN IT EXPIRES. A pane that loaded yesterday and is blank today, with
     no error anywhere, is this. */
  const days = certDays(readFileSync(CERT));
  if (days < 0) {
    console.error(`\n  The developer certificate expired ${-days} day(s) ago. `
      + 'Word will refuse the pane.\n  Run `npm run word-addin:certs` again.\n');
    process.exit(1);
  }
  if (!existsSync(join(folder, 'taskpane.html'))) {
    console.error(`\n  ${folder} has no taskpane.html.\n\n`
      + '    npm run check:word-addin\n'
      + '    node scripts/word-publish.mjs --host local --out out/word-extension-local\n');
    process.exit(1);
  }

  const root = resolve(folder);
  const { port } = new URL(ADDIN_HOSTS.local.base);

  createServer({ key: readFileSync(KEY), cert: readFileSync(CERT) }, (req, res) => {
    const file = fileFor(root, req.url);
    if (file === null) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not here\n');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      /* The pane is reloaded constantly while a person works, and nothing here
         is versioned by name except the bundle. */
      'cache-control': 'no-store',
      /* The add-in is framed BY WORD, which is the point, so framing cannot be
         forbidden — but sniffing a content type into something else can be. */
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    });
    res.end(readFileSync(file));
  /*
   * BOUND TO THE LOOPBACK INTERFACE, not to every interface. `listen(port)`
   * with no host serves the folder to the whole network the machine is on —
   * a laptop on a hotel or conference network included. The manifest says
   * `https://localhost:3000` and the certificate is valid for nothing else,
   * so nobody else has any business reaching it.
   */
  }).listen(Number(port), '127.0.0.1', () => {
    console.log(`\n  ${ADDIN_HOSTS.local.base}  <-  ${folder}`);
    console.log(`  loopback only; the certificate is good for ${days} more day(s)\n`);
    console.log('  Word: Insert -> My Add-ins -> Shared Folder -> śikṣāmitra (local)\n');
  });
}

/* Run only when this file IS the program. It exports `fileFor`, and a test
   that imports it must not start a server on port 3000. */
if (process.argv[1] !== undefined
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main(process.argv[2] ?? 'out/word-extension-local');
}
