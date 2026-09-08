#!/usr/bin/env node
/**
 * ONE COMMAND THAT STARTS THE PROGRAM, ON WHATEVER THIS MACHINE IS.
 *
 *   npm run run              start the newest build, building what is stale
 *   npm run run -- --build   rebuild the desktop app first, then start it
 *   npm run run -- --web     skip the desktop app; serve the bundle and open it
 *   npm run run -- --dev     the live dev server, with hot reload
 *
 * Why this exists: starting it took knowing which of five commands to use, in
 * which order, and that `copy:fonts` has to run before a desktop build or the
 * bundle ships without its fonts and the window opens on "asset not found:
 * index.html". That is knowledge that belongs in a script, not in a person.
 *
 * It is also the command the other machine will use. This repository is worked
 * on from Windows and from a Mac, and every path, binary name and bundle
 * layout below differs between them — which is exactly the sort of thing that
 * is discovered at the worst moment unless it is written down once.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceHash } from '../tools/build-stamp.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = new Set(process.argv.slice(2));
const say = (s) => console.log(`  ${s}`);

/** Run a command in the repository, inheriting the terminal. */
function run(command, commandArgs, { quiet = false } = {}) {
  const r = spawnSync(command, commandArgs, {
    cwd: ROOT,
    stdio: quiet ? 'pipe' : 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) {
    if (quiet && r.stderr) process.stderr.write(r.stderr);
    throw new Error(`${command} ${commandArgs.join(' ')} exited ${String(r.status)}`);
  }
  return r;
}

/** Is `apps/web/dist` built from the source that is on disk right now? */
async function webIsCurrent() {
  const stamp = join(ROOT, 'apps/web/dist/build-stamp.json');
  if (!existsSync(stamp)) return false;
  try {
    const { source } = JSON.parse(readFileSync(stamp, 'utf8'));
    return source === await sourceHash();
  } catch { return false; }
}

async function buildWeb() {
  /*
   * FONTS FIRST, ALWAYS. `apps/web/public/fonts` is not in the repository; it
   * is assembled by `copy:fonts`. A desktop build without it embeds a bundle
   * missing its fonts — 3.6 MB instead of 9.9 — and the window opens on
   * "asset not found: index.html", which says nothing about fonts at all.
   */
  say('fonts');
  run('npm', ['run', 'copy:fonts'], { quiet: true });
  say('building the web bundle');
  /* `build:web` writes the build stamp itself. */
  run('npm', ['run', 'build:web']);
}

/** Where a built desktop binary lives, per platform, newest first. */
async function desktopBinaries() {
  const targets = ['release', 'debug'].map((p) => join(ROOT, 'apps/desktop/src-tauri/target', p));
  const found = [];
  for (const dir of targets) {
    if (!existsSync(dir)) continue;
    if (process.platform === 'darwin') {
      /* macOS ships an .app; the executable is inside it. Prefer the bundle,
         because launching the inner binary directly gives a process with no
         dock entry and no menu bar. */
      const bundles = join(dir, 'bundle/macos');
      if (existsSync(bundles)) {
        for (const name of await readdir(bundles)) {
          if (name.endsWith('.app')) found.push(join(bundles, name));
        }
      }
    }
    for (const name of await readdir(dir).catch(() => [])) {
      const isExe = process.platform === 'win32'
        ? name.endsWith('.exe')
        : !name.includes('.');
      if (!isExe || !name.startsWith('siksamitra')) continue;
      const path = join(dir, name);
      if (statSync(path).isFile()) found.push(path);
    }
  }
  return found
    .map((path) => ({ path, at: statSync(path).mtimeMs }))
    .sort((a, b) => b.at - a.at);
}

if (args.has('--dev')) {
  say('the dev server, with hot reload — Ctrl+C to stop');
  run('npm', ['run', 'dev']);
  process.exit(0);
}

if (!await webIsCurrent()) await buildWeb();
else say('the web bundle is current');

if (args.has('--build')) {
  say('building the desktop app — this compiles Rust and takes a few minutes');
  run('npm', ['run', 'desktop:build']);
}

if (!args.has('--web')) {
  const [newest] = await desktopBinaries();
  if (newest !== undefined) {
    /*
     * A DESKTOP BINARY EMBEDS THE BUNDLE IT WAS BUILT WITH, so one older than
     * the bundle would open on the previous version of the program and look
     * like the change had not worked. Said plainly rather than rebuilt behind
     * the person's back: a Rust release build is minutes, and springing that
     * on someone who asked to run the program is worse than telling them.
     */
    const bundleAt = statSync(join(ROOT, 'apps/web/dist/build-stamp.json')).mtimeMs;
    if (newest.at < bundleAt) {
      say('NOTE: the desktop app is older than the web bundle it would show.');
      say('      run `npm run run -- --build` to rebuild it, or `-- --web` for the browser.');
    }
    say(`starting ${newest.path.replace(ROOT, '.')}`);
    const child = spawn(
      process.platform === 'darwin' && newest.path.endsWith('.app')
        ? 'open'
        : newest.path,
      process.platform === 'darwin' && newest.path.endsWith('.app') ? [newest.path] : [],
      { cwd: ROOT, detached: true, stdio: 'ignore' },
    );
    child.unref();
    process.exit(0);
  }
  say('no desktop build yet — serving the bundle in a browser instead.');
  say('run `npm run run -- --build` to build the desktop app.');
}

/*
 * The browser fallback, and what the gates point at. `serve` is already a
 * dependency of the checks, so this adds nothing to install.
 */
const PORT = process.env.PORT ?? '5293';
say(`serving apps/web/dist on http://localhost:${PORT}/ — Ctrl+C to stop`);
run('npx', ['--yes', 'serve', '-l', PORT, 'apps/web/dist']);
