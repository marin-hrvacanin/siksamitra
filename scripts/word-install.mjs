#!/usr/bin/env node
/**
 * PUT THE ADD-IN IN THIS COPY OF WORD.
 *
 *   node scripts/word-install.mjs                  # the published add-in
 *   node scripts/word-install.mjs --host local     # the one served from here
 *   node scripts/word-install.mjs --list
 *   node scripts/word-install.mjs --uninstall
 *
 * This is the SIDELOAD — the developer's and the early user's route, and the
 * only route that does not go through a marketplace. See
 * `scripts/word-catalog.mjs` for what each platform actually looks at, and
 * `docs/WORD-ADDIN.md` for the marketplace route, which is a submission rather
 * than a script.
 *
 * IT COPIES THE MANIFEST rather than pointing at the repository, because a
 * registration outlives a checkout. A trusted catalog aimed at a folder that
 * has been moved or renamed is an add-in that disappears from Word's menu with
 * no explanation anywhere.
 *
 * IT DOES NOT NEED THE ADD-IN TO BE BUILT unless the host is `local`: a
 * published manifest names URLs on somebody else's server, and Word fetches
 * them itself.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADDIN_HOSTS, manifestFaults, manifestFor, manifestVersion } from './word-addin.mjs';
import { CATALOG_ROOT, catalogFolder, catalogId } from './word-catalog.mjs';
import { WINDOWS_KEY } from './word-friend-installers.mjs';

const ADDIN = 'apps/word-addin';
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};

const folder = catalogFolder();
const id = catalogId(folder);
const reg = (args) => execFileSync('reg', args, { encoding: 'utf8' });

function list() {
  if (process.platform === 'darwin') {
    console.log(`\n  ${folder}\n`);
    return;
  }
  try {
    console.log(reg(['query', WINDOWS_KEY]));
  } catch {
    console.log('\n  no add-in is sideloaded\n');
  }
}

function uninstall() {
  rmSync(folder, { recursive: true, force: true });
  if (process.platform !== 'darwin') {
    for (const h of Object.values(ADDIN_HOSTS)) {
      try { reg(['delete', WINDOWS_KEY, '/v', h.id, '/f']); } catch { /* not this one */ }
    }
    /* The shared-folder catalog an earlier version registered, if it is there. */
    try {
      reg(['delete', `${CATALOG_ROOT}\\{${id}}`, '/f']);
    } catch { /* it was not registered; the folder is gone either way */ }
  }
  console.log('\n  gone. Restart Word.\n');
}

function install(key) {
  const host = ADDIN_HOSTS[key];
  if (host === undefined) {
    throw new Error(`no such host: ${key}. One of ${Object.keys(ADDIN_HOSTS).join(', ')}.`);
  }
  const version = manifestVersion(
    JSON.parse(readFileSync(join(ADDIN, 'package.json'), 'utf8')).version,
  );
  const xml = manifestFor(readFileSync(join(ADDIN, 'manifest.xml'), 'utf8'), host, version);
  const faults = manifestFaults(xml, host);
  if (faults.length > 0) {
    throw new Error(`refusing to install a manifest that would not load:\n  - ${faults.join('\n  - ')}`);
  }

  mkdirSync(folder, { recursive: true });
  /* One file per host, so installing the local build does not overwrite the
     published one — the two have different `<Id>`s and Word can hold both. */
  const file = join(folder, `siksamitra-${key}.xml`);
  writeFileSync(file, xml, 'utf8');

  if (process.platform === 'darwin') {
    console.log(`\n  ${host.name} -> ${file}`);
    console.log('\n  Restart Word. It appears under Insert -> My Add-ins.\n');
    return;
  }

  /* WORD'S DOCUMENTED SIDELOAD: a value named with the add-in's id, holding
     the manifest's path. Word loads it at start, so the tab is simply there.
     The shared-folder catalog this used to register — a local folder — was
     accepted and never shown. The friends' installer
     (`word-friend-installers.mjs`) writes the same key. */
  reg(['add', WINDOWS_KEY, '/v', host.id, '/t', 'REG_SZ', '/d', file, '/f']);
  console.log(`\n  ${host.name}  ->  ${file}`);
  console.log(`  sideloaded     ${WINDOWS_KEY} ${host.id}`);
  console.log(`  serving from   ${host.base}`);
  if (key === 'local') {
    console.log('\n  It needs `npm run word-addin:serve` running.');
  }
  console.log('\n  Restart Word: the tab is on the ribbon.\n');
}

/* The macOS drop folder wants the manifest named for the add-in and nothing
   else; on Windows the folder is a catalog and holds as many as it likes. */
if (argv.includes('--list')) list();
else if (argv.includes('--uninstall')) uninstall();
else install(flag('host') ?? 'pages');

