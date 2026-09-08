#!/usr/bin/env node
/**
 * Build an installer.
 *
 * ONE COMMAND, and what comes out is something a non-technical person can
 * double-click: no Node, no Python, no font installation, no "run this first".
 * Everything the program needs is inside it — eleven vendored font families,
 * the icons, the corpus.
 *
 *   npm run package            # for this machine
 *   npm run package -- --all   # every bundle format this machine can produce
 *   npm run package -- --skip-checks   # only when iterating on the shell
 *
 * CROSS-COMPILATION IS NOT ATTEMPTED, and the reason is worth stating rather
 * than discovering: a macOS bundle must be built on macOS — and signed with an
 * Apple Developer ID, or Gatekeeper REFUSES it outright rather than warning —
 * and a Linux AppImage wants the libraries it links against. Pretending
 * otherwise produces an artefact that fails on the one machine that matters.
 * So this builds what the host can build and says plainly what it did not.
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { platform } from 'node:os';

const all = process.argv.includes('--all');
const skipChecks = process.argv.includes('--skip-checks');
const host = platform();

const TARGETS = {
  win32: { name: 'Windows', bundles: 'nsis,msi', out: 'an .exe installer and an .msi' },
  darwin: { name: 'macOS', bundles: 'app,dmg', out: 'an .app bundle and a .dmg' },
  linux: { name: 'Linux', bundles: 'deb,appimage', out: 'a .deb and an .AppImage' },
};

function run(cmd) {
  console.log(`\n  $ ${cmd}\n`);
  execSync(cmd, { stdio: 'inherit' });
}

console.log('\n── śikṣāmitra: building an installer\n');

const target = TARGETS[host];
if (target === undefined) {
  console.error(`  unsupported host platform "${host}"\n`);
  process.exit(1);
}

/*
 * 1. The fonts, first.
 *
 * A missing face does not fail a build — it fails silently at run time, on
 * someone else's machine, as text in the wrong typeface that they have no way
 * to diagnose. So this is checked before anything is assembled.
 */
if (!existsSync('assets/fonts/fonts.css')) {
  console.log('  fonts are not vendored yet — fetching them');
  run('npm run fonts');
}

/*
 * 2. Every gate.
 *
 * An installer is the one artefact that reaches people who cannot read a stack
 * trace, so it is the last place to skip a check.
 */
if (skipChecks) {
  console.log('  SKIPPING CHECKS — this build is for iterating, not for release\n');
} else {
  run('npm run check');
}

// 3. The fonts into the app, then the web bundle the shell wraps.
run('node scripts/copy-fonts.mjs');
run('npm run build:web');

// 4. The shell.
const bundles = all
  ? [...new Set(Object.values(TARGETS).flatMap((t) => t.bundles.split(',')))].join(',')
  : target.bundles;
run(`npx --workspace @siksamitra/desktop tauri build --bundles ${bundles}`);

/*
 * 5. Say what came out, with sizes.
 *
 * The size is the number that decides whether someone on a slow connection
 * actually downloads it, so it is reported rather than left to be discovered.
 */
const bundleDir = 'apps/desktop/src-tauri/target/release/bundle';
console.log('\n── produced\n');
let found = 0;
if (existsSync(bundleDir)) {
  for (const kind of readdirSync(bundleDir)) {
    const dir = join(bundleDir, kind);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir)) {
      const path = join(dir, file);
      if (statSync(path).isDirectory()) continue;
      console.log(`  ${(statSync(path).size / 1024 / 1024).toFixed(1).padStart(6)} MB  ${path}`);
      found += 1;
    }
  }
}
if (found === 0) console.log('  nothing — the shell build did not produce a bundle');

console.log(`\n  host: ${target.name} — ${target.out}`);
if (!all) {
  const others = Object.entries(TARGETS)
    .filter(([k]) => k !== host)
    .map(([, t]) => t.name);
  console.log(`  not buildable here: ${others.join(', ')}. See docs/PACKAGING.md.`);
}
console.log('');
