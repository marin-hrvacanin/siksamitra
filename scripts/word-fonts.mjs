/**
 * THE FONT HIS DOCUMENTS ARE SET IN THAT A MACHINE DOES NOT HAVE — and where
 * the installers get it.
 *
 * His `Svara` style is URW Palladio ITU, bold, and his candrabindu is that
 * font's own glyph (U+F141, private-use: nothing else draws it). Word ships
 * without it, so on a machine that has never had it every svara is drawn in a
 * fallback face, the wrong weight and at the wrong height — which is what the
 * owner saw on this laptop the day Word was installed on it.
 *
 * NOT VENDORED. URW++ gave URW Palladio to Ulrich Stiehl to extend with the
 * Indological diacritics and distribute free of charge to Indologists, and it
 * is published at his site. So the installer fetches it from there rather
 * than from us. His site serves it over plain HTTP, so the archive is checked
 * against the hash below before anything in it is installed: a different file
 * is refused, and the add-in still installs.
 *
 * Installed for the one person running the installer — `%LOCALAPPDATA%` and
 * `HKCU` on Windows, `~/Library/Fonts` on a Mac — so no administrator.
 */

export const PALLADIO = Object.freeze({
  family: 'URW Palladio ITU',
  url: 'http://www.sanskritweb.net/itrans/paitux.zip',
  /** SHA-256 of `paitux.zip` as published (the January 2007 revision). */
  sha256: 'b4cb4f8546ac8cad8bd412cbbe65f8f98254141bec3ad73bae3ab6b26659f54f',
  /** The four faces in the archive, and the name Windows registers each under. */
  faces: Object.freeze([
    { file: 'PAITUR.TTF', name: 'URW Palladio ITU (TrueType)' },
    { file: 'PAITUB.TTF', name: 'URW Palladio ITU Bold (TrueType)' },
    { file: 'PAITUI.TTF', name: 'URW Palladio ITU Italic (TrueType)' },
    { file: 'PAITUBI.TTF', name: 'URW Palladio ITU Bold Italic (TrueType)' },
  ]),
});

/** Where a per-user font is registered on Windows. */
export const USER_FONTS_KEY = 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts';
