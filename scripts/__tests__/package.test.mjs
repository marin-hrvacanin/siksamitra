/**
 * WHICH BUNDLES TAURI IS ASKED FOR.
 *
 * THE FAULT, and it is the reason there had never been a v2 installer to
 * download. `npm run package -- --all` took the union of every platform's
 * bundle list and handed the lot to Tauri, which accepts only the names
 * belonging to the host it is running on. The first release build ever
 * attempted died on macOS with
 *
 *     error: invalid value 'msi' for '--bundles [<BUNDLES>...]'
 *       [possible values: ios, app, dmg]
 *
 * and would have died on Linux over `nsis` and on Windows over `deb`. So the
 * command in the release workflow could not succeed on ANY machine — and the
 * script's own usage note had said the right thing all along: `--all` is
 * "every bundle format this machine can produce".
 *
 * The lists here are Tauri's, per platform, and they are the point of the
 * file: a name that belongs to another platform fails the whole build after
 * the useful artefact has already been produced.
 */
import { describe, expect, it } from 'vitest';
import { TARGETS, bundlesFor } from '../bundles.mjs';

/** What `tauri build --bundles` accepts, by platform. Tauri's own lists. */
const ACCEPTS = {
  win32: ['nsis', 'msi'],
  darwin: ['ios', 'app', 'dmg'],
  linux: ['deb', 'rpm', 'appimage'],
};

describe('a host is never asked for another platform’s bundle', () => {
  for (const host of Object.keys(ACCEPTS)) {
    it(`${host} asks only for names ${host} accepts`, () => {
      for (const all of [false, true]) {
        const names = bundlesFor(host, all).split(',');
        for (const name of names) {
          expect(ACCEPTS[host], `${host} --all=${all}: ${name}`).toContain(name);
        }
      }
    });
  }

  it('and the union of all three is NOT what any of them is asked for', () => {
    /*
     * THE BUG, stated. The union contains every platform's names, so handing
     * it to any host names at least one it refuses.
     */
    const union = [...new Set(
      Object.values(TARGETS).flatMap((t) => t.bundles.split(',')),
    )];
    for (const host of Object.keys(ACCEPTS)) {
      const refused = union.filter((n) => !ACCEPTS[host].includes(n));
      expect(refused.length, `${host} would refuse ${refused.join(',')}`).toBeGreaterThan(0);
      expect(bundlesFor(host, true).split(','), host).not.toEqual(union);
    }
  });
});

describe('what each machine produces', () => {
  it('every platform names a primary, and it is in its own list', () => {
    /* The primary is the one file a person downloads; a primary outside the
       host's own list is a build that produces nothing to publish. */
    for (const [host, target] of Object.entries(TARGETS)) {
      expect(target.bundles.split(','), host).toContain(target.primary);
    }
  });

  it('Windows is NSIS and not MSI', () => {
    /*
     * The MSI target refuses a version whose pre-release identifier is not
     * numeric — `2.0.0-alpha.0` fails with "must be numeric-only and cannot be
     * greater than 65535" — and it fails the whole build AFTER the NSIS
     * installer has already been produced.
     */
    expect(bundlesFor('win32', true)).toBe('nsis');
  });

  it('macOS produces the .dmg the download page links', () => {
    expect(bundlesFor('darwin', true).split(',')).toContain('dmg');
  });

  it('Linux produces both the .deb and the .AppImage it links', () => {
    const names = bundlesFor('linux', true).split(',');
    expect(names).toContain('deb');
    expect(names).toContain('appimage');
  });

  it('and an unknown host is refused rather than guessed at', () => {
    expect(bundlesFor('sunos', true)).toBeNull();
    expect(bundlesFor('sunos')).toBeNull();
  });
});
