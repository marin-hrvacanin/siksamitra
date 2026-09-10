/**
 * THE SIDELOAD — what Word is actually told, and why each part of it matters.
 *
 * There is no installer for an Office add-in: Word looks in places, and a
 * value of the wrong TYPE in one of those places is not an error. It is a Word
 * whose "Shared Folder" list is empty, with nothing written anywhere to say
 * why. So the three registry values are asserted by shape, and the one that
 * costs the most — `Flags` as a string instead of a DWORD — is named.
 *
 * WHY THE CATALOG ID IS DERIVED FROM THE FOLDER. A fresh GUID per install
 * leaves the previous key behind and Word lists the same shared folder several
 * times over. Deriving it makes installing twice idempotent, which is what
 * `--host local` after `--host pages` has to be.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG_ROOT, catalogEntries, catalogFolder, catalogId } from '../word-catalog.mjs';

describe('where the manifest is copied to', () => {
  it('on Windows, under the machine-local application data', () => {
    /* NOT the repository. A trusted catalog aimed at a folder that has been
       moved or re-cloned is an add-in that vanishes from Word's menu. */
    const folder = catalogFolder({ LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local' }, 'win32');
    expect(folder).toBe('C:\\Users\\x\\AppData\\Local\\siksamitra\\word-catalog');
  });

  it('on macOS, in the folder Word itself reads with no registration at all', () => {
    /* Word for Mac has no catalog and no setting: a manifest in the container's
       `wef` folder IS the installation. Getting this path wrong is the whole
       difference between working and not, and it is not guessable. */
    expect(catalogFolder({ HOME: '/Users/x' }, 'darwin'))
      .toBe('/Users/x/Library/Containers/com.microsoft.Word/Data/Documents/wef');
  });

  it('and it never returns an empty path, whatever the environment says', () => {
    /* `rmSync(folder, { recursive: true })` runs against this on uninstall. */
    for (const platform of ['win32', 'darwin', 'linux']) {
      expect(catalogFolder({}, platform).length, platform).toBeGreaterThan(4);
    }
  });
});

describe('the catalog’s identity', () => {
  it('is the same for the same folder, every time', () => {
    const a = 'C:\\Users\\x\\AppData\\Local\\siksamitra\\word-catalog';
    expect(catalogId(a)).toBe(catalogId(a));
  });

  it('and does not depend on how the path is capitalised', () => {
    /* Windows paths are case-insensitive, so two spellings of one folder must
       not become two catalogs pointing at the same place. */
    expect(catalogId('C:\\Users\\X\\Local\\sm')).toBe(catalogId('c:\\users\\x\\local\\sm'));
  });

  it('but is different for a different folder', () => {
    expect(catalogId('C:\\a')).not.toBe(catalogId('C:\\b'));
  });

  it('and is shaped like the GUID Word’s own UI shows', () => {
    expect(catalogId('C:\\a')).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  });
});

describe('the registry entries', () => {
  const folder = 'C:\\Users\\x\\AppData\\Local\\siksamitra\\word-catalog';
  const entries = catalogEntries(folder, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  const by = (name) => entries.find((e) => e.name === name);

  it('are the three Word looks for, and nothing else', () => {
    expect(entries.map((e) => e.name).sort()).toEqual(['Flags', 'Id', 'Url']);
  });

  it('live under the key Word reads', () => {
    /* `16.0` is every Office since 2016, Microsoft 365 included — there is no
       17.0, and a key under a version number does not exist would be silence. */
    expect(CATALOG_ROOT).toBe('HKCU\\Software\\Microsoft\\Office\\16.0\\WEF\\TrustedCatalogs');
    for (const entry of entries) {
      expect(entry.key).toBe(`${CATALOG_ROOT}\\{aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee}`);
    }
  });

  it('and Flags is a DWORD, which is the one that fails silently', () => {
    /* A `REG_SZ` "1" here leaves the folder registered and invisible: Word
       reads the flag as a number, gets nothing, and shows no menu entry. */
    expect(by('Flags')).toEqual({
      key: entries[0].key, name: 'Flags', type: 'REG_DWORD', value: '1',
    });
  });

  it('the Url is the folder, with no trailing separator', () => {
    expect(by('Url').value).toBe(folder);
    expect(by('Url').value.endsWith('\\')).toBe(false);
    expect(by('Url').type).toBe('REG_SZ');
  });

  it('and the Id value repeats the key’s own GUID, without the braces', () => {
    expect(by('Id').value).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    expect(by('Id').key).toContain(`{${by('Id').value}}`);
  });

  it('and the GUID defaults to the folder’s own', () => {
    expect(catalogEntries(folder)[0].key).toContain(`{${catalogId(folder)}}`);
  });
});
