/**
 * WHAT CAN BE PLAYED, AND IN WHAT ORDER.
 *
 * `clipsOf` exists because the editor's transport was built on `mappedIn`,
 * which returns pādas and only for verses carrying a `lines` array. One
 * document in the corpus has them, so for the document the app opens by
 * default the transport's list was empty, Play returned without doing
 * anything, and the dock never appeared.
 *
 * The fixtures here are the SHAPES THE CORPUS ACTUALLY HAS, written out by
 * hand — a string duration, a numeric one, a null one, and clip names in an
 * order that is not their alphabetical order. Each is a real document's real
 * data; `tests/integration/audio-corpus.test.ts` asserts the same properties
 * against the eleven files themselves, which is where the reading is checked
 * against something nobody typed here.
 *
 * The expected orders below are the order a person recites in. None of them is
 * read back out of the function.
 */
import { describe, expect, it } from 'vitest';
import type { ChantDoc } from '@siksamitra/format';
import { clipsOf } from '../document.js';
import { mappedIn } from '../seams.js';

/** A document of `n` verses in one section, with whatever recording is given. */
const doc = (
  ids: string[],
  byVerse: Record<string, unknown>,
  extra: Partial<ChantDoc> = {},
): ChantDoc => ({
  title: 'test',
  titleForms: {},
  sections: [{
    id: 's-1',
    verses: ids.map((id) => ({ id, tokens: [] })),
    items: ids.map((id) => ({ t: 'verse' as const, id, tokens: [] })),
  }],
  recording: { byVerse: byVerse as never },
  ...extra,
}) as ChantDoc;

describe('a clip per verse, with no mapping at all', () => {
  /* Durgā Sūktam: eight clips, not one `lines` array, `duration` a STRING.
     This is the document the app opens, and it played nothing. */
  const durga = () => doc(
    ['v-1', 'v-2', 'v-3'],
    {
      'v-1': { file: 'durga-1.mp3', duration: '15.90', label: '1' },
      'v-2': { file: 'durga-2.mp3', duration: '17.80', label: '2' },
      'v-3': { file: 'durga-3.mp3', duration: '19.10', label: '3' },
    },
    { audioBase: '/tests/durga-suktam/audio/' },
  );

  it('is playable, though nothing has been mapped to a pāda', () => {
    expect(clipsOf(durga()).map((c) => c.file))
      .toEqual(['durga-1.mp3', 'durga-2.mp3', 'durga-3.mp3']);
  });

  it('which is exactly what the pāda mapping could not tell you', () => {
    /* The control: the reading this replaces, on the same document. If
       `mappedIn` ever starts answering for an unmapped verse, the fault this
       function exists for is gone and this test should be revisited. */
    expect(mappedIn(durga())).toEqual([]);
  });

  it('reads a string duration as seconds', () => {
    expect(clipsOf(durga())[0]?.duration).toBe(15.9);
  });

  it('and has no pāda offsets to offer', () => {
    for (const clip of clipsOf(durga())) expect(clip.lines).toEqual([]);
  });
});

describe('the order is the document\'s, not the file name\'s', () => {
  /*
   * Śiva Saṅkalpa Sūktam's thirty-nine clips are `v-1.mp3` … `v-39.mp3`.
   * Sorted as text that is v-1, v-10, v-11, v-12 — and `byVerse` is a record
   * whose keys `canonicalJson` sorts, so insertion order is no help either.
   */
  const ids = ['v-1', 'v-2', 'v-9', 'v-10', 'v-11'];
  const scrambled: Record<string, unknown> = {};
  /* Written in the alphabetical order the file on disk really has them in. */
  for (const id of ['v-1', 'v-10', 'v-11', 'v-2', 'v-9']) {
    scrambled[id] = { file: `${id}.mp3`, duration: 17.38 };
  }

  it('plays them in the order they are recited', () => {
    expect(clipsOf(doc(ids, scrambled)).map((c) => c.verseId))
      .toEqual(['v-1', 'v-2', 'v-9', 'v-10', 'v-11']);
  });

  it('and that is NOT the order the file names sort in', () => {
    /* The control. If this ever fails, the fixture stopped exercising the bug
       and the test above proves nothing. */
    const alphabetical = [...ids].sort((a, b) => `${a}.mp3`.localeCompare(`${b}.mp3`));
    expect(alphabetical).not.toEqual(['v-1', 'v-2', 'v-9', 'v-10', 'v-11']);
  });

  it('across sections, section by section', () => {
    const two = {
      title: 'test',
      titleForms: {},
      sections: [
        { id: 's-1', verses: [{ id: 'v-2', tokens: [] }], items: [] },
        { id: 's-2', verses: [{ id: 'v-1', tokens: [] }], items: [] },
      ],
      recording: { byVerse: { 'v-1': { file: 'a.mp3' }, 'v-2': { file: 'b.mp3' } } },
    } as unknown as ChantDoc;
    /* `v-2` first because its SECTION is first — the record's keys and the
       file names both say otherwise. */
    expect(clipsOf(two).map((c) => c.verseId)).toEqual(['v-2', 'v-1']);
  });
});

describe('what the document does not say', () => {
  it('a null duration is null, not zero and not NaN', () => {
    /* Puruṣa Sūktam: all twenty-four rows. */
    const clips = clipsOf(doc(['v-1'], { 'v-1': { file: 'x.mp3', duration: null } }));
    expect(clips[0]?.duration).toBe(null);
  });

  it('an unparseable duration is null rather than NaN', () => {
    const clips = clipsOf(doc(['v-1'], { 'v-1': { file: 'x.mp3', duration: 'soon' } }));
    expect(clips[0]?.duration).toBe(null);
  });

  it('a zero or negative duration is no duration', () => {
    expect(clipsOf(doc(['v-1'], { 'v-1': { file: 'x.mp3', duration: 0 } }))[0]?.duration)
      .toBe(null);
    expect(clipsOf(doc(['v-1'], { 'v-1': { file: 'x.mp3', duration: -3 } }))[0]?.duration)
      .toBe(null);
  });

  it('a verse with no row is skipped, and does not shift the others', () => {
    const clips = clipsOf(doc(
      ['v-1', 'v-2', 'v-3'],
      { 'v-1': { file: 'a.mp3' }, 'v-3': { file: 'c.mp3' } },
    ));
    expect(clips.map((c) => c.verseId)).toEqual(['v-1', 'v-3']);
  });

  it('a row naming an empty file is not a clip', () => {
    expect(clipsOf(doc(['v-1'], { 'v-1': { file: '' } }))).toEqual([]);
  });

  it('a row for a verse the document does not have is ignored', () => {
    /* The opposite direction to the one above, and `checkMapping` reports it
       as a problem — but a transport must not try to play it. */
    const clips = clipsOf(doc(['v-1'], { 'v-1': { file: 'a.mp3' }, 'v-99': { file: 'z.mp3' } }));
    expect(clips.map((c) => c.verseId)).toEqual(['v-1']);
  });

  it('a document with no recording at all has nothing to play', () => {
    expect(clipsOf({ title: 't', titleForms: {}, sections: [] } as unknown as ChantDoc))
      .toEqual([]);
  });

  it('and neither does no document', () => {
    expect(clipsOf(null)).toEqual([]);
    expect(clipsOf(undefined)).toEqual([]);
  });
});

describe('a step that named one take before there were per-verse clips', () => {
  const withSection = {
    title: 'test',
    titleForms: {},
    sections: [{
      id: 's-1',
      audio: { file: 'whole-step.mp3', duration: '48.5', label: 'The step' },
      verses: [{ id: 'v-1', tokens: [] }, { id: 'v-2', tokens: [] }],
      items: [],
    }],
  } as unknown as ChantDoc;

  it('the take answers for the verse the step starts at', () => {
    const clips = clipsOf(withSection);
    expect(clips.map((c) => c.verseId)).toEqual(['v-1']);
    expect(clips[0]?.file).toBe('whole-step.mp3');
    expect(clips[0]?.duration).toBe(48.5);
    expect(clips[0]?.label).toBe('The step');
  });

  it('and a per-verse row beats it where both exist', () => {
    const both = {
      ...withSection,
      recording: { byVerse: { 'v-1': { file: 'v-1.mp3' }, 'v-2': { file: 'v-2.mp3' } } },
    } as unknown as ChantDoc;
    expect(clipsOf(both).map((c) => c.file)).toEqual(['v-1.mp3', 'v-2.mp3']);
  });
});

describe('a mapped document keeps its pāda offsets', () => {
  /* Bhāgya Sūktam: the one document that has them. */
  const mapped = () => doc(['v-1'], {
    'v-1': {
      file: 'bhagya-suktam-1.mp3',
      duration: 21.736,
      lines: [{ start: 0, end: 6.952 }, { start: 6.952, end: 13.08 }],
    },
  });

  it('carries them through, in order', () => {
    expect(clipsOf(mapped())[0]?.lines)
      .toEqual([{ start: 0, end: 6.952 }, { start: 6.952, end: 13.08 }]);
  });

  it('and a mapped verse is one clip, not one per pāda', () => {
    /* `mappedIn` returns two rows for this verse; a transport that ran on it
       would play the verse twice. */
    expect(mappedIn(mapped())).toHaveLength(2);
    expect(clipsOf(mapped())).toHaveLength(1);
  });
});
