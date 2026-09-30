/**
 * THE SIDELOAD — what Word is actually told, and why each part of it matters.
 *
 * There is no installer for an Office add-in: Word looks in places, and a
 * value of the wrong TYPE in one of those places is not an error. It is a Word
 * whose "Shared Folder" list is empty, with nothing written anywhere to say
 * why. So the three registry values are asserted by shape, and the one that
 * costs the most — `Flags` as a string instead of a DWORD — is named.
 *
 * WHY A NETWORK PATH. Word accepted a catalog at `C:\...` and never listed it;
 * the same folder as `\\localhost\C$\...` it lists, and an add-in added from
 * it is still on the ribbon after Word restarts — measured on Word
 * 16.0.20326, where the developer key's add-in was gone on the next start.
 */
import { describe, expect, it } from 'vitest';
import {
  CATALOG_ID, CATALOG_ROOT, DEVELOPER_KEY, catalogEntries, catalogFolder, manifestFile, shareOf,
} from '../word-catalog.mjs';

describe('where the manifest is copied to', () => {
  it('on Windows, under the machine-local application data', () => {
    /* NOT the repository. A trusted catalog aimed at a folder that has been
       moved or re-cloned is an add-in that vanishes from Word's menu. */
    const folder = catalogFolder({ LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local' }, 'win32');
    expect(folder).toBe('C:\\Users\\x\\AppData\\Local\\siksamitra\\word');
  });

  it('on macOS, in the folder Word itself reads with no registration at all', () => {
    /* Getting this path wrong is the whole difference between working and
       not, and it is not guessable. */
    expect(catalogFolder({ HOME: '/Users/x' }, 'darwin'))
      .toBe('/Users/x/Library/Containers/com.microsoft.Word/Data/Documents/wef');
  });

  it('and it never returns an empty path, whatever the environment says', () => {
    /* `rmSync(folder, { recursive: true })` runs against this on uninstall. */
    for (const platform of ['win32', 'darwin', 'linux']) {
      expect(catalogFolder({}, platform).length, platform).toBeGreaterThan(4);
    }
  });

  it('the published manifest is the one the friends\u2019 installer downloads; others sit beside it', () => {
    expect(manifestFile('pages')).toBe('manifest.xml');
    expect(manifestFile('local')).toBe('siksamitra-local.xml');
    expect(manifestFile('vedaunion')).toBe('siksamitra-vedaunion.xml');
  });
});

describe('the folder as a network path', () => {
  it('is the drive\u2019s administrative share on this machine', () => {
    expect(shareOf('C:\\Users\\x\\AppData\\Local\\siksamitra\\word'))
      .toBe('\\\\localhost\\C$\\Users\\x\\AppData\\Local\\siksamitra\\word');
  });

  it('whatever the drive, and however its letter is written', () => {
    expect(shareOf('d:\\Data\\sm')).toBe('\\\\localhost\\D$\\Data\\sm');
  });

  it('leaves a path that is already a network one alone', () => {
    expect(shareOf('\\\\server\\share\\sm')).toBe('\\\\server\\share\\sm');
  });

  it('and has none for a path that is not on a drive', () => {
    expect(shareOf('relative\\sm')).toBeNull();
    expect(shareOf('/Users/x/wef')).toBeNull();
  });
});

describe('the registry entries', () => {
  const url = '\\\\localhost\\C$\\Users\\x\\AppData\\Local\\siksamitra\\word';
  const entries = catalogEntries(url, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
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

  it('the Url is the network path, with no trailing separator', () => {
    expect(by('Url').value).toBe(url);
    expect(by('Url').value.endsWith('\\')).toBe(false);
    expect(by('Url').type).toBe('REG_SZ');
  });

  it('and the Id value repeats the key\u2019s own GUID, braces and all, as Microsoft\u2019s .reg does', () => {
    expect(by('Id').value).toBe('{aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee}');
    expect(by('Id').key.endsWith(`\\${by('Id').value}`)).toBe(true);
  });

  it('the catalog is ONE, the same on every machine, so installing twice rewrites it', () => {
    expect(CATALOG_ID).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
    expect(catalogEntries(url)[0].key).toBe(`${CATALOG_ROOT}\\{${CATALOG_ID}}`);
    expect(catalogEntries('elsewhere')[0].key).toBe(catalogEntries(url)[0].key);
  });

  it('and the developer key is the fallback, under the same Office', () => {
    expect(DEVELOPER_KEY).toBe('HKCU\\Software\\Microsoft\\Office\\16.0\\WEF\\Developer');
  });
});
