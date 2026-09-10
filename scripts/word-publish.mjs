#!/usr/bin/env node
/**
 * ASSEMBLE THE FOLDER THAT IS THE PUBLISHED WORD ADD-IN.
 *
 * An Office add-in has no server. It is a static folder plus a manifest, and
 * publishing it is copying that folder somewhere with a certificate. So this
 * writes the folder, once per host, and everything about which host is data —
 * see `scripts/word-addin.mjs`.
 *
 *   node scripts/word-publish.mjs                       # out/word-extension, GitHub Pages
 *   node scripts/word-publish.mjs --host vedaunion      # for vedaunion.org
 *   node scripts/word-publish.mjs --host pages --out site/word-extension
 *   node scripts/word-publish.mjs --all                 # one folder per host
 *
 * THE FOLDER IS SELF-CONTAINED, which is why the install instructions are a
 * redirect rather than a page of their own: the landing page already has the
 * design, the fonts and the words, and a second copy of them inside the
 * uploaded folder is a second copy to keep in step. Somebody who opens the
 * folder's URL gets taken to the instructions; nothing else needs to be there.
 *
 * IT REFUSES A STALE BUILD, the way the browser gates do. The manifest names
 * `taskpane.html` and the icons by URL, and a folder assembled out of a `dist`
 * from before the last source change is a published add-in that does not match
 * the repository it came from — with no symptom at all until somebody presses
 * a button that is not there.
 */
import {
  cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  ADDIN_HOSTS, INSTALL_URL, manifestFaults, manifestFor, manifestVersion,
} from './word-addin.mjs';

const ADDIN = 'apps/word-addin';
const DIST = join(ADDIN, 'dist');
const TEMPLATE = join(ADDIN, 'manifest.xml');

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};

/** The newest mtime under a directory — how staleness is measured. */
function newest(dir, skip = new Set(['node_modules', 'dist', '.git'])) {
  let latest = 0;
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const path = join(at, entry.name);
      if (entry.isDirectory()) { walk(path); continue; }
      latest = Math.max(latest, statSync(path).mtimeMs);
    }
  };
  walk(dir);
  return latest;
}

function requireFreshBuild() {
  if (!existsSync(join(DIST, 'taskpane.html'))) {
    throw new Error(`${DIST} has no taskpane.html. Run \`npm run check:word-addin\` first.`);
  }
  const built = statSync(join(DIST, 'taskpane.html')).mtimeMs;
  const source = Math.max(newest(join(ADDIN, 'src')), statSync(TEMPLATE).mtimeMs);
  if (source > built) {
    throw new Error('the built add-in is older than its source. '
      + 'Run `npm run check:word-addin` and publish again.');
  }
}

/**
 * The page somebody reaches by opening the folder's URL.
 *
 * A redirect AND a link, because a `<meta refresh>` alone leaves a person on a
 * blank page when the target is unreachable, and this is the URL that ends up
 * pasted into a chat message.
 */
const landingPage = (host) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>śikṣāmitra for Microsoft Word</title>
<meta http-equiv="refresh" content="0; url=${INSTALL_URL}">
<link rel="canonical" href="${INSTALL_URL}">
</head>
<body style="font:16px/1.6 system-ui,sans-serif;max-width:34rem;margin:4rem auto;padding:0 1.5rem">
<h1 style="font-weight:400">śikṣāmitra for Microsoft Word</h1>
<p>This folder is the add-in itself — the task pane Word loads, served from
${host.label}. There is nothing here to read.</p>
<p><a href="${INSTALL_URL}">How to install it</a> &middot;
<a href="manifest.xml">manifest.xml</a></p>
</body>
</html>
`;

/** One host's folder, written whole. */
function publish(key, out) {
  const host = ADDIN_HOSTS[key];
  if (host === undefined) {
    throw new Error(`no such host: ${key}. One of ${Object.keys(ADDIN_HOSTS).join(', ')}.`);
  }
  const version = manifestVersion(
    JSON.parse(readFileSync(join(ADDIN, 'package.json'), 'utf8')).version,
  );
  const xml = manifestFor(readFileSync(TEMPLATE, 'utf8'), host, version);
  const faults = manifestFaults(xml, host);
  if (faults.length > 0) {
    throw new Error(`the manifest for ${key} would not load:\n  - ${faults.join('\n  - ')}`);
  }

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(DIST, out, { recursive: true });
  writeFileSync(join(out, 'manifest.xml'), xml, 'utf8');
  writeFileSync(join(out, 'index.html'), landingPage(host), 'utf8');

  /* Every URL the manifest names has to be a file in the folder. This is the
     check that would have caught the icons: they were published at the root
     and the manifest asked for them under `/assets/`, which is a ribbon button
     with no icon and no error. */
  const escaped = host.base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const missing = [...xml.matchAll(new RegExp(`${escaped}/([^"'<>\\s]+)`, 'g'))]
    .map((m) => m[1])
    .filter((path, i, all) => all.indexOf(path) === i)
    .filter((path) => !existsSync(join(out, path)));
  if (missing.length > 0) {
    throw new Error(`the manifest names files the folder has not got: ${missing.join(', ')}`);
  }

  /*
   * AND THE PAGE'S OWN REFERENCES MUST BE RELATIVE. Two of the three hosts
   * serve the add-in from a FOLDER, not from a domain root, so a bundle built
   * with Vite's default `base` asks for `/assets/taskpane-<hash>.js` — which
   * resolves to the server's root, 404s, and shows a person a blank white task
   * pane with no message in it. Measured off the built HTML rather than
   * asserted about the config, because the config is not what Word loads.
   */
  const html = readFileSync(join(out, 'taskpane.html'), 'utf8');
  const absolute = [...html.matchAll(/(?:src|href)="(\/[^/][^"]*)"/g)].map((m) => m[1]);
  if (absolute.length > 0) {
    throw new Error('taskpane.html asks for root-relative files, which a folder-hosted '
      + `add-in cannot have: ${absolute.join(', ')}`);
  }

  /*
   * AND WHAT THE PUBLISHED PAGE PROMISES ABOUT ITSELF.
   *
   * Two things that are true of the source and have to stay true of the
   * BUILD, because the build is what people load: no inline script (the pane
   * is a module and a bundler that inlined one would be a new execution
   * surface), and the content security policy still in the head. A bundler
   * option or a plugin can quietly remove either.
   */
  if (!html.includes("object-src 'none'")) {
    throw new Error('taskpane.html has lost its Content-Security-Policy');
  }
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .filter((m) => (m[1] ?? '').trim() !== '');
  if (inline.length > 0) {
    throw new Error(`taskpane.html carries ${inline.length} inline script(s)`);
  }

  const files = [];
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else files.push(path);
    }
  };
  walk(out);
  const bytes = files.reduce((n, f) => n + statSync(f).size, 0);
  console.log(`  ${key.padEnd(10)} ${host.base}`);
  console.log(`  ${''.padEnd(10)} ${relative(process.cwd(), out)} — `
    + `${files.length} files, ${(bytes / 1024).toFixed(1)} kB`);
  return out;
}

requireFreshBuild();
console.log('\n  the Word add-in, as a folder to upload:\n');
if (argv.includes('--all')) {
  for (const key of Object.keys(ADDIN_HOSTS)) publish(key, `out/word-extension-${key}`);
} else {
  const key = flag('host') ?? 'pages';
  publish(key, flag('out') ?? 'out/word-extension');
}
console.log('');
