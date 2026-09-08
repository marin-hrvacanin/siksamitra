#!/usr/bin/env node
/**
 * IS THE PAGE THE TOOLS ARE DRIVING BUILT FROM THE SOURCE ON DISK?
 *
 * Every browser gate in `tools/` points at a URL, and nothing about a URL says
 * what it was built from. That gap cost a full verification cycle: the gates
 * were aimed at `serve apps/web/dist`, a bundle built hours earlier, and they
 * went on passing while the source they were supposed to be checking had
 * changed underneath them. Worse than a red gate — a green one measuring a
 * program nobody is about to ship.
 *
 * So the build writes down what it was built from, and the gates check it.
 *
 *   node tools/build-stamp.mjs --write apps/web/dist   # after a build
 *   node tools/build-stamp.mjs                         # print the hash
 *
 * The hash is over file CONTENT, not timestamps, so it survives a fresh clone
 * on another machine and does not churn when a file is merely touched.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, relative, sep, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

/**
 * What the page is built out of.
 *
 * Deliberately a list and not "everything": the hash has to change when the
 * shipped bundle would change and stay put otherwise, or the gates cry stale
 * over a README.
 */
const INPUTS = [
  'apps/web/src',
  'apps/web/index.html',
  'apps/web/vite.config.ts',
  'packages/tokens/generated',
];
/** Package sources the web app bundles. */
const PACKAGES = [
  'format', 'engine', 'edit', 'layout', 'render', 'audio', 'account', 'storage',
];

const SKIP = new Set(['node_modules', 'dist', '.git', 'target', '__tests__']);

async function walk(path, out) {
  let s;
  try { s = await stat(path); } catch { return out; }
  if (s.isFile()) { out.push(path); return out; }
  if (!s.isDirectory()) return out;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    await walk(join(path, entry.name), out);
  }
  return out;
}

/** A hash of every source file the web bundle is made from. */
export async function sourceHash() {
  const roots = [
    ...INPUTS,
    ...PACKAGES.map((p) => `packages/${p}/src`),
  ].map((p) => join(ROOT, p));

  const files = [];
  for (const r of roots) await walk(r, files);
  /* Sorted, and on forward slashes, so Windows and macOS agree. */
  files.sort();

  const all = createHash('sha256');
  for (const f of files) {
    const rel = relative(ROOT, f).split(sep).join('/');
    all.update(rel);
    all.update(createHash('sha256').update(await readFile(f)).digest());
  }
  return all.digest('hex').slice(0, 16);
}

/** What a served build claims about itself, or null if it does not say. */
export async function stampAt(url) {
  const base = new URL(url);
  /* The gates open the app with a query — `?chrome=native` — and the stamp
     sits beside the page, not inside its arguments. */
  base.search = '';
  base.hash = '';
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  try {
    const res = await fetch(new URL('build-stamp.json', base));
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    /* A dev server and a 404 page both answer with HTML. Neither is a stamp. */
    if (!type.includes('json')) return null;
    return await res.json();
  } catch { return null; }
}

/**
 * Is this URL a Vite dev server?
 *
 * It serves its own client at a fixed path and a static build does not, which
 * is the only difference that can be asked for over HTTP without trusting the
 * port number.
 */
async function isDevServer(url) {
  const at = new URL(url);
  at.search = '';
  at.hash = '';
  at.pathname = '/@vite/client';
  try {
    const res = await fetch(at);
    if (!res.ok) return false;
    return (res.headers.get('content-type') ?? '').includes('javascript');
  } catch { return false; }
}

/**
 * Refuse to test a bundle that is not the source on disk.
 *
 * A dev server is live by construction and needs no check. Anything else must
 * SAY what it was built from — a missing stamp used to return "live" and skip
 * the check, and that is how this was found: `apps/web/dist` had no
 * `build-stamp.json` at all, because the desktop build ran the workspace build
 * directly and bypassed the stamp, so every browser gate ran with its
 * freshness check quietly disabled. That is the failure this module exists to
 * prevent, wearing the module's own clothes.
 *
 * It throws rather than warns: a warning in a wall of gate output is a warning
 * nobody reads.
 */
export async function assertFresh(url) {
  const stamp = await stampAt(url);
  if (stamp === null) {
    if (await isDevServer(url)) return 'live';
    throw new Error(
      `\n  NO BUILD STAMP at ${url}\n`
      + '    it is not a dev server, so it is a built bundle that cannot say\n'
      + '    what it was built from — and an unchecked bundle is how a gate\n'
      + '    comes to pass against a program nobody is about to ship.\n'
      + '    run: npm run build:web\n',
    );
  }
  const now = await sourceHash();
  if (stamp.source === now) return 'fresh';
  throw new Error(
    `\n  STALE BUILD at ${url}\n`
    + `    it was built from ${stamp.source}${stamp.when === undefined ? '' : ` (${stamp.when})`}\n`
    + `    the source on disk is ${now}\n`
    + '    run: npm run build:web\n',
  );
}

const args = process.argv.slice(2);
if (args[0] === '--write') {
  const dist = args[1] ?? 'apps/web/dist';
  const stamp = { source: await sourceHash(), when: new Date().toISOString() };
  await writeFile(join(ROOT, dist, 'build-stamp.json'), `${JSON.stringify(stamp, null, 2)}\n`);
  console.log(`  build stamp ${stamp.source} -> ${dist}/build-stamp.json`);
} else if (args.length === 0 && import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  console.log(await sourceHash());
}
