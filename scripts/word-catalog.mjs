/**
 * HOW WORD IS TOLD THE ADD-IN EXISTS — the sideload, as data.
 *
 * There is no installer for an Office add-in. Word looks in places, and
 * putting the manifest in one of those places IS the installation:
 *
 *   Windows   a folder registered as a trusted catalog, under
 *             `HKCU\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs`.
 *             The add-in then appears under Insert → My Add-ins → Shared
 *             Folder.
 *   macOS     the manifest dropped into
 *             `~/Library/Containers/com.microsoft.Word/Data/Documents/wef`.
 *             No registry, no catalog, no setting.
 *   Word on   uploaded per user or deployed by an administrator through the
 *   the web   Microsoft 365 admin centre. Not something a script can do.
 *
 * THE CATALOG FOLDER IS NOT IN THE REPOSITORY. It is under `%LOCALAPPDATA%`,
 * because a registration outlives the checkout: the repository gets moved,
 * renamed or re-cloned, and a catalog pointing at a folder that is gone is an
 * add-in that vanishes from the menu with no explanation. The manifest is
 * COPIED there.
 *
 * WHY THE KEY NAME IS A GUID AND SO IS THE `Id` VALUE. Microsoft's own
 * instructions: a subkey named with a fresh GUID, holding `Id` (the same
 * GUID), `Url` (the folder) and `Flags` (1 = show it in the menu). The GUID is
 * the CATALOG's, not the add-in's — one catalog folder can hold several
 * manifests — so it is derived from the folder rather than from the add-in, and
 * re-registering the same folder rewrites one key instead of adding a second.
 */
import { createHash } from 'node:crypto';

/** Where the manifests are copied to, per platform. */
export function catalogFolder(env = process.env, platform = process.platform) {
  if (platform === 'darwin') {
    const home = env.HOME ?? '';
    return `${home}/Library/Containers/com.microsoft.Word/Data/Documents/wef`;
  }
  const base = env.LOCALAPPDATA ?? env.APPDATA ?? env.HOME ?? '.';
  return `${base}\\siksamitra\\word-catalog`;
}

/**
 * A stable GUID for a folder path.
 *
 * Derived rather than random so that installing twice is idempotent: a random
 * GUID each time leaves the previous key behind, and Word then lists the same
 * shared folder several times over.
 *
 * The shape is a version-4-looking GUID because that is what Word's own
 * documentation shows and what its UI displays; nothing reads the version
 * nibble, and a hash is not a random number, so the bits are set to say so
 * rather than left to look like entropy they are not.
 */
export function catalogId(folder) {
  const hex = createHash('sha256').update(folder.toLowerCase()).digest('hex');
  const g = [hex.slice(0, 8), hex.slice(8, 12), `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`, hex.slice(20, 32)];
  return g.join('-');
}

/** Where Word looks. `16.0` is every Office since 2016, including Microsoft 365. */
export const CATALOG_ROOT = 'HKCU\\Software\\Microsoft\\Office\\16.0\\WEF\\TrustedCatalogs';

/**
 * The registry entries that register one folder, as `reg add` arguments.
 *
 * Returned as data so the shape can be tested without touching a registry —
 * and it is worth testing: `Flags` as a string instead of a DWORD, or a `Url`
 * with a trailing backslash, both produce a Word that lists no shared folder
 * and says nothing.
 */
export function catalogEntries(folder, id = catalogId(folder)) {
  const key = `${CATALOG_ROOT}\\{${id}}`;
  return [
    { key, name: 'Id', type: 'REG_SZ', value: id },
    { key, name: 'Url', type: 'REG_SZ', value: folder },
    { key, name: 'Flags', type: 'REG_DWORD', value: '1' },
  ];
}
