/**
 * A `.vuchant` is a zip, and a zip entry name is attacker-controlled text.
 *
 * Every archive here is built BY HAND with `fflate`, never with our own
 * `pack()`. A fixture produced by the writer under test is not an attack: it
 * can only contain what the writer is willing to emit, which is exactly the set
 * of inputs that were never the problem.
 *
 * The threat model is a package arriving from somewhere else — downloaded from
 * the platform, mailed between two reciters, or handed over by the operating
 * system when someone double-clicks it.
 */

import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { PackageError, unpack, readManifest } from '@siksamitra/interop';
import { LIMITS, entryNameProblem } from '@siksamitra/interop';

/** A minimally well-formed package, so each test changes one thing. */
function archive(entries: Record<string, Uint8Array | string>): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const [name, body] of Object.entries(entries)) {
    files[name] = typeof body === 'string' ? strToU8(body) : body;
  }
  return zipSync(files, { mtime: 315532800000 });
}

const MANIFEST = JSON.stringify({
  format: 'vedaunion.chant.package',
  version: 1,
  slug: 'x',
  title: 'x',
  engine: 'test',
  createdAt: '1980-01-01T00:00:00.000Z',
  docHash: 'deadbeef',
  contents: { documentBytes: 0, assets: 0, assetBytes: 0 },
});

describe('zip-slip: an entry that escapes its directory', () => {
  it.each([
    ['assets/../../../evil.mp3', 'a traversal through the asset prefix'],
    ['../evil.mp3', 'a traversal at the top level'],
    ['assets/../../etc/passwd', 'a deeper traversal'],
    ['/etc/passwd', 'a POSIX-absolute path'],
    ['C:/Windows/System32/evil.dll', 'a Windows-absolute path'],
    ['\\\\server\\share\\evil', 'a UNC path'],
    ['assets\\..\\..\\evil', 'a traversal using backslashes'],
  ])('refuses %s (%s)', (name) => {
    const bytes = archive({ 'manifest.json': MANIFEST, [name]: 'x' });
    // Refused, not sanitised: a rewritten hostile name produces a file the
    // author never asked for, under a name they cannot predict.
    return expect(unpack(bytes)).rejects.toThrow(PackageError);
  });

  it('names the offending entry in the error, so the file can be inspected', async () => {
    const bytes = archive({ 'manifest.json': MANIFEST, 'assets/../../evil': 'x' });
    await expect(unpack(bytes)).rejects.toThrow(/assets\/\.\.\/\.\.\/evil/);
  });

  it('still accepts the legitimate shapes', () => {
    for (const name of [
      'document.json', 'manifest.json',
      'assets/audio/verse-1.mp3', 'assets/figures/lamp.png',
      'source/chant.yaml', 'originals/sadhana.docx',
      'assets/a.b.c.mp3', 'assets/purusha-suktam_01.mp3',
    ]) {
      expect(entryNameProblem(name), name).toBeNull();
    }
  });
});

describe('names that collide or vanish on a real filesystem', () => {
  it('refuses a Windows reserved device name', () => {
    // `assets/CON` is not a file on Windows; writing it addresses the console.
    for (const n of ['assets/CON', 'assets/con.mp3', 'assets/PRN', 'assets/COM1.wav']) {
      expect(entryNameProblem(n), n).toMatch(/reserved device name/);
    }
  });

  it('refuses a trailing dot or space', () => {
    // Windows silently strips both, so `evil.mp3 ` and `evil.mp3` become one
    // file and the second write wins — a way to replace an entry that passed
    // inspection with one that did not.
    expect(entryNameProblem('assets/evil.mp3 ')).toMatch(/dot or space/);
    expect(entryNameProblem('assets/evil.')).toMatch(/dot or space/);
  });

  it('refuses control characters and empty segments', () => {
    expect(entryNameProblem('assets/a\u0000b')).toMatch(/control character/);
    expect(entryNameProblem('assets//b.mp3')).toMatch(/empty path segment/);
    expect(entryNameProblem('')).toMatch(/empty name/);
  });
});

describe('resource exhaustion', () => {
  it('refuses a declared entry larger than the limit before inflating it', async () => {
    // Highly compressible: a few KB on disk, far over the cap expanded. The
    // point is that the refusal happens from the HEADER, so the process never
    // allocates it.
    const huge = new Uint8Array(LIMITS.entryBytes + 1024);
    const bytes = archive({ 'manifest.json': MANIFEST, 'assets/bomb.bin': huge });
    await expect(unpack(bytes)).rejects.toThrow(PackageError);
  }, 60_000);

  it('refuses more entries than the limit', async () => {
    const files: Record<string, string> = { 'manifest.json': MANIFEST };
    for (let i = 0; i <= LIMITS.entryCount; i += 1) files[`assets/a${i}`] = 'x';
    await expect(unpack(archive(files))).rejects.toThrow(/entries/);
  }, 60_000);
});

describe('the manifest and the document must agree', () => {
  it('refuses an archive that is not a zip', async () => {
    await expect(unpack(strToU8('this is not a zip'))).rejects.toThrow(/not a zip/);
  });

  it('refuses a missing manifest', async () => {
    await expect(unpack(archive({ 'document.json': '{}' }))).rejects.toThrow(/manifest/);
  });

  it('refuses a manifest that is not a chant package', async () => {
    const bytes = archive({ 'manifest.json': JSON.stringify({ format: 'something.else' }) });
    await expect(unpack(bytes)).rejects.toThrow(/not a chant package/);
  });

  it('refuses a package version from the future rather than guessing', async () => {
    const bytes = archive({
      'manifest.json': JSON.stringify({ ...JSON.parse(MANIFEST), version: 99 }),
    });
    await expect(unpack(bytes)).rejects.toThrow(/version 99/);
  });

  it('REFUSES a document whose hash does not match, and does not repair it', async () => {
    // The rule the format turns on. A document that does not match its hash was
    // edited outside the tools, and accepting it would let a hand-patched file
    // circulate as though the engine had produced it.
    const bytes = archive({
      'manifest.json': MANIFEST,
      'document.json': JSON.stringify({ title: 'tampered', sections: [] }),
    });
    await expect(unpack(bytes)).rejects.toThrow(/does not match the manifest hash/);
  });

  it('refuses a manifest that is not JSON', async () => {
    await expect(unpack(archive({ 'manifest.json': '{ not json' })))
      .rejects.toThrow(/not JSON/);
  });

  it('reads a manifest without inflating the assets', async () => {
    // The reason `readManifest` exists: listing a 40 MB package must not cost
    // 40 MB. It must still refuse a hostile one.
    const bytes = archive({ 'manifest.json': MANIFEST, 'assets/big.mp3': 'x'.repeat(10_000) });
    const m = await readManifest(bytes);
    expect(m.slug).toBe('x');
  });
});
