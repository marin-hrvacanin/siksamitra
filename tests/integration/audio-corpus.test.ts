/**
 * THE RECITATIONS THE CORPUS ACTUALLY CARRIES.
 *
 * `clipsOf` was written because the editor's transport ran on `mappedIn`,
 * which answers only for verses that carry a `lines` array — and almost none
 * of the corpus does. The unit tests state that with fixtures. This states it
 * against the eleven real documents, which is the only place the claim can be
 * wrong in a way nobody typed.
 *
 * THE CONTROL. Every expected order here is computed by reading the file's
 * bytes with `JSON.parse` and walking `items` — the raw document, by a second
 * path, without `openChantDoc`, `normalizeChantDoc` or anything in
 * `@siksamitra/audio`. `items` and not `verses` on purpose: `verses` is the
 * DERIVED array a load rebuilds, and reading it is how a source layer attached
 * to all 573 verses was once silently discarded.
 *
 * The counts are written out as constants below. They were measured once, from
 * the files, and a document gaining or losing a recitation must change them
 * deliberately — that is the ratchet, and it is why they are not computed.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ChantDoc } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import { clipsOf, mappedIn } from '@siksamitra/audio';

const DIR = fileURLToPath(new URL('../../corpus/chants/', import.meta.url));
const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();

/**
 * What each document holds, measured from the files and then written down.
 *
 * `clips` is verses with a recitation; `mapped` is how many of those have pāda
 * offsets. The gap between the two columns IS the fault: every document but
 * one has clips that nothing could play.
 */
const EXPECTED: Record<string, { clips: number; mapped: number }> = {
  'bhagya-suktam.json': { clips: 9, mapped: 9 },
  'durga-suktam.json': { clips: 8, mapped: 0 },
  'ganapati-atharvashirsham.json': { clips: 0, mapped: 0 },
  'ganesha-ashtottara.json': { clips: 0, mapped: 0 },
  'lakshmi-ashtottara.json': { clips: 0, mapped: 0 },
  'mantra-pushpam.json': { clips: 0, mapped: 0 },
  'puja-vidhi.json': { clips: 0, mapped: 0 },
  /* 24 rows in `byVerse`, plus TWO sections that name a step-level take
     (`section.audio`) for a first verse with no row of its own — both the
     `introductory_stanza`. Counting `byVerse` alone says 24 and misses two
     verses a person can play. */
  'purusha-suktam.json': { clips: 26, mapped: 0 },
  'shiva-sankalpa-suktam.json': { clips: 39, mapped: 0 },
  'sri-rudram.json': { clips: 0, mapped: 0 },
  'vishnu-suktam.json': { clips: 0, mapped: 0 },
};

/** Opened the one legal way — `check:open` refuses any other. */
const open = (file: string): ChantDoc =>
  openChantDoc(JSON.parse(readFileSync(DIR + file, 'utf8')));

/**
 * The verse ids of a document that have a recitation, in the document's own
 * order — read off the RAW BYTES, by hand, as the control.
 */
function versesWithAudioByHand(file: string): string[] {
  const raw = JSON.parse(readFileSync(DIR + file, 'utf8')) as {
    recording?: { byVerse?: Record<string, { file?: string }> };
    sections?: { audio?: { file?: string }; items?: unknown[]; verses?: unknown[] }[];
  };
  const byVerse = raw.recording?.byVerse ?? {};
  const out: string[] = [];
  for (const section of raw.sections ?? []) {
    /* `items` is the canonical content; `verses` is derived from it on load. */
    const content = (section.items ?? section.verses ?? []) as { t?: string; id?: string }[];
    const verseIds = content
      .filter((it) => it.t === undefined || it.t === 'verse')
      .map((it) => it.id)
      .filter((id): id is string => typeof id === 'string');
    for (const [i, id] of verseIds.entries()) {
      const named = byVerse[id]?.file;
      const stepTake = i === 0 ? section.audio?.file : undefined;
      if ((named !== undefined && named !== '') || (stepTake !== undefined && stepTake !== '')) {
        out.push(id);
      }
    }
  }
  return out;
}

describe('every document in the corpus', () => {
  it('there are eleven of them, and each is in the table', () => {
    expect(files).toHaveLength(11);
    expect(files).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const file of files) {
    describe(file, () => {
      const want = EXPECTED[file]!;

      it(`has ${want.clips} verse(s) with a recitation`, () => {
        expect(clipsOf(open(file))).toHaveLength(want.clips);
      });

      it(`of which ${want.mapped} carry pāda offsets`, () => {
        const withLines = clipsOf(open(file)).filter((c) => c.lines.length > 0);
        expect(withLines).toHaveLength(want.mapped);
      });

      it('is playable in the order a person recites it', () => {
        expect(clipsOf(open(file)).map((c) => c.verseId))
          .toEqual(versesWithAudioByHand(file));
      });

      it('names a real file for every clip, and a real verse', () => {
        const doc = open(file);
        const ids = new Set(doc.sections.flatMap((s) => s.verses.map((v) => v.id)));
        for (const clip of clipsOf(doc)) {
          expect(clip.file, `${file} / ${clip.verseId}`).not.toBe('');
          expect(clip.file, `${file} / ${clip.verseId}`).toMatch(/\.(mp3|wav|m4a|ogg|opus)$/i);
          expect(ids.has(clip.verseId), `${clip.verseId} is not a verse of ${file}`).toBe(true);
        }
      });

      it('states a duration as a number of seconds, or not at all', () => {
        for (const clip of clipsOf(open(file))) {
          if (clip.duration === null) continue;
          expect(typeof clip.duration, `${file} / ${clip.verseId}`).toBe('number');
          expect(Number.isFinite(clip.duration)).toBe(true);
          expect(clip.duration).toBeGreaterThan(0);
          /* A verse is seconds long, not hours. A string read as a number the
             wrong way — `"15.90"` concatenated rather than parsed — lands far
             outside this. */
          expect(clip.duration).toBeLessThan(60 * 30);
        }
      });
    });
  }
});

describe('the fault this was written for', () => {
  it('the document the app opens has clips that the pāda mapping cannot see', () => {
    /*
     * THE WHOLE BUG, in one assertion, on the real file. Durgā Sūktam: eight
     * clips, and `mappedIn` — what the transport used to be built on — returns
     * nothing at all. So Play found no verse, returned, and the dock never
     * appeared. If this ever stops holding, the corpus has been re-mapped and
     * the transport's fallback is no longer under test by this document.
     */
    const doc = open('durga-suktam.json');
    expect(clipsOf(doc)).toHaveLength(8);
    expect(mappedIn(doc)).toEqual([]);
  });

  it('and across the corpus, far more is playable than is mapped', () => {
    let clips = 0;
    let mapped = 0;
    for (const file of files) {
      const doc = open(file);
      clips += clipsOf(doc).length;
      mapped += clipsOf(doc).filter((c) => c.lines.length > 0).length;
    }
    /* 82 clips, 9 of them mapped: 73 verses of recitation that the old reading
       could not play. The numbers are the ratchet. */
    expect(clips).toBe(82);
    expect(mapped).toBe(9);
  });

  it('a clip order taken from the file names would be wrong for the corpus', () => {
    /*
     * The second, undocumented half of the fault. `mappedIn` sorts by
     * `file.localeCompare`, so `v-1.mp3 … v-39.mp3` come back v-1, v-10, v-11.
     * This asserts that the corpus really does contain a document where the
     * two orders differ — without it, "the order is the document's" would be
     * a claim no document tests.
     */
    const doc = open('shiva-sankalpa-suktam.json');
    const recited = clipsOf(doc).map((c) => c.file);
    const alphabetical = [...recited].sort((a, b) => a.localeCompare(b));
    expect(recited).not.toEqual(alphabetical);
    expect(recited.slice(0, 3)).toEqual(['v-1.mp3', 'v-2.mp3', 'v-3.mp3']);
    expect(alphabetical.slice(0, 3)).toEqual(['v-1.mp3', 'v-10.mp3', 'v-11.mp3']);
  });
});
