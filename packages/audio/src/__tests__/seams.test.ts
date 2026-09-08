/**
 * Moving a boundary by hand.
 *
 * The property that matters is the one `checkMapping` polices: a mapping that
 * has been dragged about must still be a mapping — no pāda running backwards,
 * no pāda starting before its neighbour has finished, and no verse touched
 * that the drag was not about. So the assertions here are mostly `checkMapping`
 * on the result and the untouched rows compared field by field, which is
 * something `moveSeam` does not compute and cannot fake.
 *
 * The expected seconds are worked out by hand from the fixture below rather
 * than read back out of the function.
 */
import { describe, expect, it } from 'vitest';
import type { ChantDoc } from '@siksamitra/format';
import { checkMapping } from '../document.js';
import {
  limitsOf, mainFile, mappedIn, MIN_PADA, moveSeam, nearestSeam, seamKinds, seamsOf,
} from '../seams.js';

/**
 * Two verses, two pādas each, over one take: 0–4, 4–9, 9–13, 13–20.
 *
 * `v-2` is written into the record BEFORE `v-1` on purpose. `byVerse` is a
 * record and a hand-patched document really does come back in that order, so a
 * reader that trusted insertion order would put the second verse first.
 */
const doc = (): ChantDoc => ({
  title: 'test',
  titleForms: {},
  /* The verses have to exist: `checkMapping` reports a mapping row that names
     a verse the document does not have, and an empty section list would make
     every assertion below fail for that reason instead of the one it is about. */
  sections: [{
    id: 's-1',
    title: 'one',
    verses: [{ id: 'v-1', tokens: [] }, { id: 'v-2', tokens: [] }],
  }],
  recording: {
    byVerse: {
      'v-2': {
        file: 'take.wav',
        label: 'second',
        lines: [{ start: 9, end: 13 }, { start: 13, end: 20 }],
      },
      'v-1': {
        file: 'take.wav',
        duration: 20,
        lines: [{ start: 0, end: 4 }, { start: 4, end: 9 }],
      },
    },
  },
});

const spansOf = (d: ChantDoc, verseId: string): unknown =>
  d.recording?.byVerse?.[verseId]?.lines;

describe('reading the seams out of a document', () => {
  it('puts the pādas in the order they are sung, not the order they are stored', () => {
    expect(mappedIn(doc()).map((p) => `${p.verseId}.${p.line}`))
      .toEqual(['v-1.0', 'v-1.1', 'v-2.0', 'v-2.1']);
  });

  it('has one more seam than it has pādas', () => {
    const padas = mappedIn(doc());
    expect(seamsOf(padas)).toEqual([0, 4, 9, 13, 20]);
    expect(seamsOf(padas)).toHaveLength(padas.length + 1);
  });

  it('has nothing to say about a document with no recording', () => {
    const bare: ChantDoc = { title: 't', titleForms: {}, sections: [] };
    expect(mappedIn(bare)).toEqual([]);
    expect(seamsOf([])).toEqual([]);
    expect(mainFile(bare)).toBeNull();
  });

  it('names the take most of the mapping is in', () => {
    expect(mainFile(doc())).toBe('take.wav');
  });

  it('keeps one take apart from another', () => {
    const d = doc();
    (d.recording as { byVerse: Record<string, { file: string }> }).byVerse['v-2']!.file = 'other.wav';
    expect(mappedIn(d, 'take.wav').map((p) => p.verseId)).toEqual(['v-1', 'v-1']);
  });
});

describe('moving a seam', () => {
  it('writes BOTH sides of the boundary, so nothing overlaps and nothing is lost', () => {
    const next = moveSeam(doc(), mappedIn(doc()), 2, 10.5);
    expect(spansOf(next, 'v-1')).toEqual([{ start: 0, end: 4 }, { start: 4, end: 10.5 }]);
    expect(spansOf(next, 'v-2')).toEqual([{ start: 10.5, end: 13 }, { start: 13, end: 20 }]);
    expect(checkMapping(next)).toEqual([]);
  });

  it('leaves every other field of the rows it touches exactly as it found them', () => {
    const next = moveSeam(doc(), mappedIn(doc()), 1, 5);
    expect(next.recording?.byVerse?.['v-1']?.duration).toBe(20);
    expect(next.recording?.byVerse?.['v-2']?.label).toBe('second');
    expect(next.title).toBe('test');
  });

  it('does not touch a verse the boundary is not between', () => {
    const before = doc();
    const next = moveSeam(before, mappedIn(before), 1, 5);
    expect(spansOf(next, 'v-2')).toEqual(spansOf(before, 'v-2'));
  });

  it('stops against the neighbour rather than collapsing a pāda', () => {
    /* Seam 2 sits at 9 between pādas 4–9 and 9–13. Dragged to 40 it can only
       reach 13 − MIN_PADA; dragged to −5 it can only reach 4 + MIN_PADA. */
    const padas = mappedIn(doc());
    expect(limitsOf(padas, 2)).toEqual({ low: 4 + MIN_PADA, high: 13 - MIN_PADA });
    const far = moveSeam(doc(), padas, 2, 40);
    expect(mappedIn(far)[2]?.start).toBe(12.95);
    const back = moveSeam(doc(), padas, 2, -5);
    expect(mappedIn(back)[1]?.end).toBe(4.05);
    expect(checkMapping(far)).toEqual([]);
    expect(checkMapping(back)).toEqual([]);
  });

  it('moves the first and last seams, which have only one side', () => {
    const padas = mappedIn(doc());
    const head = moveSeam(doc(), padas, 0, 1.5);
    expect(mappedIn(head)[0]).toMatchObject({ start: 1.5, end: 4 });
    const tail = moveSeam(doc(), padas, 4, 22, 25);
    expect(mappedIn(tail)[3]).toMatchObject({ start: 13, end: 22 });
    expect(checkMapping(head)).toEqual([]);
    expect(checkMapping(tail)).toEqual([]);
  });

  it('will not push the last seam past the length of the recording', () => {
    const padas = mappedIn(doc());
    expect(mappedIn(moveSeam(doc(), padas, 4, 999, 20))[3]?.end).toBe(20);
  });

  it('lands on the same hundredth-of-a-second grid the mapper writes on', () => {
    const next = moveSeam(doc(), mappedIn(doc()), 2, 10.123456);
    expect(mappedIn(next)[2]?.start).toBe(10.12);
  });

  it('changes nothing when asked for a seam that does not exist', () => {
    const before = doc();
    expect(moveSeam(before, mappedIn(before), 9, 3)).toBe(before);
    expect(moveSeam(before, mappedIn(before), -1, 3)).toBe(before);
  });
});

describe('which boundaries were heard and which were guessed', () => {
  /*
   * The recording breathed at 4.1 and 12.8 and nowhere else. Seams 1 and 3 are
   * within the 1.2 s the mapper is allowed to move a boundary; seam 2, at 9,
   * is 4.9 s from the nearer of them and is therefore arithmetic.
   */
  const gaps = [{ start: 3.9, end: 4.3 }, { start: 12.6, end: 13.0 }];

  it('calls a boundary heard only when a breath is close enough to be the same event', () => {
    /* 0 and 20 are the ends of the take and there is no breath within 1.2 s of
       either, so they are arithmetic too — which is right: nobody breathed
       there, the recitation simply started and stopped. */
    expect(seamKinds([0, 4, 9, 13, 20], gaps))
      .toEqual(['even', 'breath', 'even', 'breath', 'even']);
  });

  it('calls everything a guess when the recording never stops', () => {
    expect(seamKinds([0, 4, 9], [])).toEqual(['even', 'even', 'even']);
  });

  it('takes the threshold from the caller, so a tighter rule marks more guesses', () => {
    expect(seamKinds([4], gaps, 0.05)).toEqual(['even']);
    expect(seamKinds([4], gaps, 0.2)).toEqual(['breath']);
  });
});

describe('finding the seam under a pointer', () => {
  const seams = [0, 4, 9, 13, 20];

  it('takes the nearest within reach and nothing outside it', () => {
    expect(nearestSeam(seams, 8.6, 0.5)).toBe(2);
    expect(nearestSeam(seams, 6.5, 0.5)).toBeNull();
  });

  it('breaks a tie towards the earlier seam, so a drag is repeatable', () => {
    expect(nearestSeam([10, 12], 11, 2)).toBe(0);
  });
});
