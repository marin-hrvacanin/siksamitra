#!/usr/bin/env node
/**
 * MICROSOFT'S OWN VALIDATOR, over every manifest we publish.
 *
 *   npm run word-addin:validate
 *
 * `office-addin-manifest validate` does two things: it checks the manifest
 * against the current XSD, and it submits it to Microsoft's acceptance-test
 * service — the same service that runs when an add-in is submitted to
 * AppSource. So this is not our opinion of the manifest; it is the store's.
 *
 * IT IS NOT IN `npm run check`, and for the same reason the browser gates are
 * not: it needs the network, and a check that fails when a train goes into a
 * tunnel is a check people learn to ignore. Run it before publishing, and
 * before submitting.
 *
 * WHAT IT TELLS US THAT NOTHING ELSE CAN: which platforms the requirement sets
 * in the manifest actually reach. That list is printed, because it is the
 * answer to "will this work in Word on the web" and it is not a thing to guess
 * about — a requirement set raised by one minor version silently drops
 * perpetual Office, and the only symptom is an add-in that will not install
 * for the people who have it.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ADDIN_HOSTS, manifestFor, manifestVersion } from './word-addin.mjs';

const ADDIN = 'apps/word-addin';
/** The validator's own CLI, resolved rather than found on a PATH. */
const VALIDATOR = 'node_modules/office-addin-manifest/cli.js';
const template = readFileSync(join(ADDIN, 'manifest.xml'), 'utf8');
const version = manifestVersion(
  JSON.parse(readFileSync(join(ADDIN, 'package.json'), 'utf8')).version,
);

const dir = mkdtempSync(join(tmpdir(), 'sm-manifests-'));
let bad = 0;

for (const [key, host] of Object.entries(ADDIN_HOSTS)) {
  const file = join(dir, `manifest.${key}.xml`);
  writeFileSync(file, manifestFor(template, host, version), 'utf8');
  process.stdout.write(`\n  ── ${key} ${'─'.repeat(Math.max(0, 60 - key.length))}\n`);
  let out = '';
  try {
    /*
     * THE CLI'S OWN ENTRY POINT, run by this node — not `npx` through a shell.
     * `execFileSync('npx', […], { shell: true })` concatenates the arguments
     * into a command line without escaping them, which Node itself now warns
     * is a security hazard (DEP0190); the file name here comes from `mkdtemp`
     * and is harmless, but a habit that is only safe because of where today's
     * input comes from is not a safe habit.
     */
    out = execFileSync(process.execPath, [VALIDATOR, 'validate', file], { encoding: 'utf8' });
  } catch (e) {
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    bad += 1;
  }
  /* The service returns sixty lines of things that are right. What is worth
     reading is what is wrong, plus the platform list — which is the one piece
     of information a person cannot work out from the file. */
  const lines = out.split('\n');
  const trouble = lines.filter((l) => /error|invalid|fail|warn|missing/i.test(l)
    && !/is found to be valid|does adhere|has finished/i.test(l));
  for (const line of trouble) console.log(`  ! ${line.trim()}`);
  const from = lines.findIndex((l) => l.includes('can run on the following platforms'));
  if (from !== -1) {
    for (const line of lines.slice(from + 1)) {
      if (!line.trim().startsWith('-')) break;
      console.log(`   ${line.trim()}`);
    }
  }
  console.log(`  ${/The manifest is valid/.test(out) ? 'valid' : 'NOT VALID'} — ${host.base}`);
  if (!/The manifest is valid/.test(out)) bad += 1;
}

rmSync(dir, { recursive: true, force: true });
console.log('');
if (bad > 0) {
  console.error(`  ${bad} manifest(s) the store would reject\n`);
  process.exit(1);
}
