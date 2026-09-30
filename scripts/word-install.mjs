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
 * only route that does not go through a marketplace. It does what the friends'
 * `install-windows.cmd` does, from the same constants (`word-catalog.mjs`, which
 * also says why a shared-folder catalog and not the developer key), with one
 * manifest per host in the one folder. See `docs/WORD-ADDIN.md` for the
 * marketplace route, which is a submission rather than a script.
 *
 * IT COPIES THE MANIFEST rather than pointing at the repository, because a
 * registration outlives a checkout.
 *
 * IT DOES NOT NEED THE ADD-IN TO BE BUILT unless the host is `local`: a
 * published manifest names URLs on somebody else's server, and Word fetches
 * them itself.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADDIN_HOSTS, manifestFaults, manifestFor, manifestVersion } from './word-addin.mjs';
import { CATALOG_ROOT, CATALOG_ID, DEVELOPER_KEY, catalogEntries, catalogFolder, manifestFile, shareOf } from './word-catalog.mjs';

const ADDIN = 'apps/word-addin';
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};

const folder = catalogFolder();
/* `reg` says "unable to find" on stderr for a value that is not there, which
   is the ordinary case in an uninstall; only its answer is wanted. */
const reg = (args) => execFileSync('reg', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const tryReg = (args) => { try { return reg(args); } catch { return null; } };

function list() {
  if (process.platform === 'darwin') {
    console.log(`\n  ${folder}\n`);
    return;
  }
  const catalog = tryReg(['query', `${CATALOG_ROOT}\\{${CATALOG_ID}}`]);
  const developer = tryReg(['query', DEVELOPER_KEY]);
  console.log(catalog ?? '\n  no shared-folder catalog\n');
  console.log(developer ?? '  nothing sideloaded as a developer add-in\n');
}

function uninstall() {
  rmSync(folder, { recursive: true, force: true });
  if (process.platform !== 'darwin') {
    tryReg(['delete', `${CATALOG_ROOT}\\{${CATALOG_ID}}`, '/f']);
    for (const h of Object.values(ADDIN_HOSTS)) tryReg(['delete', DEVELOPER_KEY, '/v', h.id, '/f']);
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
  const file = join(folder, manifestFile(key));
  writeFileSync(file, xml, 'utf8');

  if (process.platform === 'darwin') {
    console.log(`\n  ${host.name} -> ${file}`);
    console.log('\n  Restart Word, open a document, then Home -> Add-ins -> the add-in.');
    console.log('  Word forgets it when it quits (OfficeDev/office-js#6973): choose it again each time.\n');
    return;
  }

  const share = shareOf(folder);
  const shared = share !== null && existsSync(join(share, manifestFile(key)));
  if (shared) {
    tryReg(['delete', DEVELOPER_KEY, '/v', host.id, '/f']);
    for (const e of catalogEntries(share)) reg(['add', e.key, '/v', e.name, '/t', e.type, '/d', e.value, '/f']);
  } else {
    reg(['add', DEVELOPER_KEY, '/v', host.id, '/t', 'REG_SZ', '/d', file, '/f']);
  }
  console.log(`\n  ${host.name}  ->  ${file}`);
  console.log(shared ? `  catalog        ${share}` : `  sideloaded     ${DEVELOPER_KEY} ${host.id}  (the share could not be read)`);
  console.log(`  serving from   ${host.base}`);
  if (key === 'local') console.log('\n  It needs `npm run word-addin:serve` running.');
  console.log(shared
    ? `\n  Restart Word, then once: Home -> Add-ins -> More Add-ins -> SHARED FOLDER -> ${host.name} -> Add.\n  Word keeps it after that.\n`
    : `\n  Restart Word, then Home -> Add-ins -> More Add-ins -> MY ADD-INS -> Developer Add-ins -> ${host.name}.\n  Word forgets a developer add-in when it closes (OfficeDev/office-js#6973): add it again each time.\n`);
}

if (argv.includes('--list')) list();
else if (argv.includes('--uninstall')) uninstall();
else install(flag('host') ?? 'pages');
