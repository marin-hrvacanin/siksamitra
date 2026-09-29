/**
 * WRITE THE ADD-IN'S RIBBON TAB AND RIGHT-CLICK MENU — the manifest block and
 * the icons — out of the pane's own controls.
 *
 *   npm run gen:word-commands
 *
 * The manifest's `<VersionOverrides>` comes from `manifest-commands.ts`; each
 * command's icon is the app's own glyph (`packages/ui`'s icon table, the one
 * the ribbon and the pane draw), rasterised at the three sizes Word asks for.
 * `commands-table.test.ts` fails when either is stale, so the tab cannot drift
 * from the pane.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ICONS, type IconName } from '../packages/ui/src/icons.generated.js';
import { ENTRIES } from '../apps/word-addin/src/commands-table.js';
import { ICON_SIZES, iconPath, withCommands } from '../apps/word-addin/src/manifest-commands.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ADDIN = join(ROOT, 'apps', 'word-addin');

/**
 * The ink of a command icon. ONE colour, because a PNG cannot follow Word's
 * theme, so it has to hold on the light ribbon and the dark one: 3.8:1 against
 * white and 3.8:1 against #292929 (WCAG relative luminance 0.227), above the
 * 3:1 a UI glyph needs. The app's own mark colours do not all hold on the
 * dark ribbon: the svara red is 1.96:1 there, the change blue 2.83:1.
 */
const INK = '#3A86D4';

const manifestPath = join(ADDIN, 'manifest.xml');
writeFileSync(manifestPath, withCommands(readFileSync(manifestPath, 'utf8')));

const ids = new Set<IconName>([...ENTRIES.map((e) => e.id), 'marks']);
for (const id of ids) {
  const glyph = ICONS[id];
  for (const size of ICON_SIZES) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${glyph.viewBox}" width="${size}" `
      + `height="${size}" color="${INK}" fill="${INK}">${glyph.body}</svg>`;
    const out = join(ADDIN, 'assets', iconPath(id, size));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, await sharp(Buffer.from(svg)).png().toBuffer());
  }
}
console.log(`manifest: ${ENTRIES.length} commands; icons: ${ids.size} × ${ICON_SIZES.length} sizes`);
