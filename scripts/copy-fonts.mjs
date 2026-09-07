#!/usr/bin/env node
/**
 * Copy the vendored fonts into the web app.
 *
 * `assets/fonts` is the one source of truth; `apps/web/public/fonts` is build
 * output and gitignored. Copied rather than symlinked, because a symlink does
 * not survive a zip, an installer, or Windows without a developer-mode flag.
 */
import { cpSync, mkdirSync, readdirSync } from 'node:fs';

const FROM = 'assets/fonts';
const TO = 'apps/web/public/fonts';

mkdirSync(TO, { recursive: true });
cpSync(FROM, TO, { recursive: true, filter: (src) => !src.endsWith('.html') });
console.log(`  ${readdirSync(TO).length} font files -> ${TO}`);
