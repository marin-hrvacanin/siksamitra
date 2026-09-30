/**
 * HOW WORD IS TOLD THE ADD-IN EXISTS — the sideload, as data. The friends'
 * installers (`word-friend-installers.mjs`) and the developer's
 * (`word-install.mjs`) are both written from what is here.
 *
 * There is no installer for an Office add-in. Word looks in places, and
 * putting the manifest in one of those places IS the installation:
 *
 *   Windows   a TRUSTED CATALOG: a folder of manifests registered under
 *             `HKCU\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs`. It
 *             must be a NETWORK path — Word accepted a local one, `C:\...`,
 *             and never listed it — and a folder of one's own is one through
 *             the drive's administrative share, `\\localhost\C$\...`, which
 *             needs nothing created and no administrator to read. The person
 *             adds the add-in from Home → Add-ins → More Add-ins → SHARED
 *             FOLDER once, and Word keeps it.
 *
 *             The `...\WEF\Developer` key — a value named with the add-in's
 *             id, holding the manifest's path — is Microsoft's developer
 *             sideload, and was this program's route until Office's update of
 *             24–25 September 2026: since then Word forgets an add-in
 *             registered there when it closes (OfficeDev/office-js#6973,
 *             measured here on Word 16.0.20326 — the tab gone on the next
 *             start, and back only by adding it again). It is kept as the
 *             fallback for a machine where the share cannot be read.
 *   macOS     the manifest dropped into
 *             `~/Library/Containers/com.microsoft.Word/Data/Documents/wef`,
 *             then Home → Add-ins → the add-in. The same regression makes Word
 *             forget it there too, and a Mac has no catalog to fall back on.
 *   Word on   uploaded per user or deployed by an administrator through the
 *   the web   Microsoft 365 admin centre. Not something a script can do.
 *
 * THE FOLDER IS NOT IN THE REPOSITORY. It is under `%LOCALAPPDATA%`, because a
 * registration outlives the checkout: a catalog pointing at a folder that has
 * been moved or re-cloned is an add-in that vanishes with no explanation.
 */

/** Where Word looks for catalogs. `16.0` is every Office since 2016, Microsoft 365 included. */
export const CATALOG_ROOT = 'HKCU\\Software\\Microsoft\\Office\\16.0\\WEF\\TrustedCatalogs';

/** Microsoft's developer sideload: a value named with the add-in's id. The fallback. */
export const DEVELOPER_KEY = 'HKCU\\Software\\Microsoft\\Office\\16.0\\WEF\\Developer';

/**
 * THE CATALOG'S OWN GUID — one, fixed. It names the folder, not an add-in (a
 * catalog can hold several manifests), and it is the same on every machine and
 * every run, so installing twice rewrites one key rather than adding a second:
 * Word lists a folder once per key. Fixed rather than derived from the path
 * because the batch file must know it, and a batch file cannot hash.
 */
export const CATALOG_ID = '6f2a9c41-8e3b-4d07-b5a2-3c9e1f7d0b58';

/** The folder the manifests live in, relative to `%LOCALAPPDATA%` on Windows. */
export const WINDOWS_FOLDER = 'siksamitra\\word';

/** Where the manifests are copied to, per platform. */
export function catalogFolder(env = process.env, platform = process.platform) {
  if (platform === 'darwin') {
    const home = env.HOME ?? '';
    return `${home}/Library/Containers/com.microsoft.Word/Data/Documents/wef`;
  }
  const base = env.LOCALAPPDATA ?? env.APPDATA ?? env.HOME ?? '.';
  return `${base}\\${WINDOWS_FOLDER}`;
}

/**
 * The published add-in's manifest is `manifest.xml`, the name the friends'
 * installer downloads and its daily task refreshes; any other host's is named
 * for the host, so the local build sits beside it rather than replacing it.
 */
export function manifestFile(hostKey) {
  return hostKey === 'pages' ? 'manifest.xml' : `siksamitra-${hostKey}.xml`;
}

/**
 * A local folder as the network path Word will accept as a catalog: the
 * drive's administrative share on this machine. `C:\Users\x\...` becomes
 * `\\localhost\C$\Users\x\...`; a path that is already a network one is left
 * alone, and anything else has no such path.
 */
export function shareOf(folder) {
  if (folder.startsWith('\\\\')) return folder;
  const m = /^([A-Za-z]):\\(.*)$/.exec(folder);
  return m === null ? null : `\\\\localhost\\${m[1].toUpperCase()}$\\${m[2]}`;
}

/**
 * The registry entries that register one catalog, as `reg add` arguments.
 *
 * Returned as data so the shape can be tested without touching a registry —
 * and it is worth testing: `Flags` as a string instead of a DWORD, or a `Url`
 * with a trailing backslash, both produce a Word that lists no shared folder
 * and says nothing. The key and `Id` both carry the braces, as Microsoft's
 * own `.reg` example writes them.
 */
export function catalogEntries(url, id = CATALOG_ID) {
  const key = `${CATALOG_ROOT}\\{${id}}`;
  return [
    { key, name: 'Id', type: 'REG_SZ', value: `{${id}}` },
    { key, name: 'Url', type: 'REG_SZ', value: url },
    { key, name: 'Flags', type: 'REG_DWORD', value: '1' },
  ];
}
