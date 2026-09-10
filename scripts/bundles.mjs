/**
 * WHICH BUNDLE FORMATS A MACHINE CAN BUILD.
 *
 * Its own module so the one rule that broke every release build can be tested
 * without importing `package.mjs`, which starts a build the moment it loads.
 */
/**
 * WHAT EACH MACHINE CAN BUILD, and the two names per platform.
 *
 * `primary` is the one file a person should download; `bundles` is every
 * format this host can produce. `--all` means the SECOND of those, and the
 * usage note above has said so from the start — "every bundle format this
 * machine can produce".
 *
 * IT DID NOT DO THAT. `--all` took the union of every platform's list and
 * handed the lot to Tauri, which accepts only the names belonging to the host
 * it is running on — so the first release build ever attempted died on macOS
 * with `error: invalid value 'msi' for '--bundles' [possible values: ios, app,
 * dmg]`, and would have died on Linux over `nsis` and on Windows over `deb`.
 * `npm run package -- --all` could not succeed on any machine, and the release
 * workflow runs exactly that. See `bundlesFor`.
 *
 * NO MSI, and that is not an omission. The MSI target refuses a version whose
 * pre-release identifier is not numeric — `2.0.0-alpha.0` fails it with "must
 * be numeric-only and cannot be greater than 65535" — and it fails the whole
 * build AFTER the NSIS installer has already been produced. NSIS is Tauri's
 * own recommendation for Windows and is what the download page links.
 */
export const TARGETS = {
  win32: { name: 'Windows', primary: 'nsis', bundles: 'nsis', out: 'an .exe installer' },
  darwin: { name: 'macOS', primary: 'dmg', bundles: 'app,dmg', out: 'an .app bundle and a .dmg' },
  linux: { name: 'Linux', primary: 'appimage', bundles: 'deb,appimage', out: 'a .deb and an .AppImage' },
};

/**
 * The `--bundles` list for a host, which may never name another platform's.
 *
 * Exported so the one rule that broke every release build has a test:
 * `scripts/__tests__/package.test.js`.
 */
export function bundlesFor(host, all = false) {
  const target = TARGETS[host];
  if (target === undefined) return null;
  return all ? target.bundles : target.primary;
}

