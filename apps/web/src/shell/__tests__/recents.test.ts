/**
 * THE RECENTS LIST.
 *
 * Two rules, and both used to live inside an effect where the only way to
 * check either was to open documents in a browser and look: a document opened
 * again MOVES to the front rather than appearing twice, and the list is
 * capped. The third thing tested here is the one that bites on an upgrade —
 * the list on disk was written by the previous version of this program, and
 * throwing it away to add a field is the sort of loss nobody reports and
 * everybody notices.
 */
import { describe, expect, it } from 'vitest';
import {
  RECENTS_KEEP, parseRecents, withRecent, withoutRecent, type RecentDoc,
} from '../recents.js';

const row = (ref: string, title = ref): RecentDoc => ({
  ref, kind: 'file', name: `${ref}.json`, title, at: '2026-09-08T00:00:00.000Z',
});

describe('adding', () => {
  it('puts the newest first', () => {
    const list = withRecent(withRecent([], row('a')), row('b'));
    expect(list.map((r) => r.ref)).toEqual(['b', 'a']);
  });

  it('never lists a document twice', () => {
    let list: readonly RecentDoc[] = [];
    for (const ref of ['a', 'b', 'a', 'c', 'b', 'a']) list = withRecent(list, row(ref));
    /* The property, not the expected array: whatever the order, a ref may
       appear once. A list that showed `a` three times would still be "most
       recent first". */
    expect(new Set(list.map((r) => r.ref)).size).toBe(list.length);
    expect(list.map((r) => r.ref)).toEqual(['a', 'b', 'c']);
  });

  it('carries the newer title, not the one it was first opened under', () => {
    const list = withRecent(withRecent([], row('a', 'old name')), row('a', 'new name'));
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe('new name');
  });

  it('never grows past the cap, however many are opened', () => {
    let list: readonly RecentDoc[] = [];
    for (let i = 0; i < RECENTS_KEEP * 3; i += 1) list = withRecent(list, row(`d-${i}`));
    expect(list).toHaveLength(RECENTS_KEEP);
    /* The ones kept are the last ones opened. */
    expect(list[0]?.ref).toBe(`d-${RECENTS_KEEP * 3 - 1}`);
  });
});

describe('forgetting', () => {
  it('drops exactly one row', () => {
    const list = withoutRecent([row('a'), row('b'), row('c')], 'b');
    expect(list.map((r) => r.ref)).toEqual(['a', 'c']);
  });

  it('is quiet about a ref that is not there', () => {
    expect(withoutRecent([row('a')], 'nope')).toHaveLength(1);
  });
});

describe('reading what is stored', () => {
  it('reads back what it wrote', () => {
    const list = withRecent(withRecent([], row('a')), row('b'));
    expect(parseRecents(JSON.stringify(list))).toEqual(list);
  });

  it('reads the shape the previous version wrote', () => {
    /*
     * v1 stored `{ slug, title, at }` and knew about library documents only.
     * Those rows are still somebody's list.
     */
    const old = '[{"slug":"durga-suktam","title":"Durgā Sūktam","at":"2026-09-01T10:00:00Z"}]';
    const list = parseRecents(old);
    expect(list).toHaveLength(1);
    expect(list[0]?.ref).toBe('durga-suktam');
    expect(list[0]?.kind).toBe('library');
    expect(list[0]?.title).toBe('Durgā Sūktam');
  });

  it('survives anything at all under the key', () => {
    for (const raw of [null, '', 'not json', '{}', '[1,2,3]', '["a"]', '[null]']) {
      expect(parseRecents(raw)).toEqual([]);
    }
  });

  it('keeps the rows that are rows and drops the ones that are not', () => {
    const mixed = JSON.stringify([
      { ref: 'a', kind: 'file', name: 'a.json', title: 'A', at: 'now' },
      { ref: 'b' },
      42,
      { title: 'no ref', at: 'now' },
      { ref: 'c', title: 'C', at: 'now' },
    ]);
    expect(parseRecents(mixed).map((r) => r.ref)).toEqual(['a', 'c']);
  });

  it('does not hand back more than the cap, whatever was stored', () => {
    const huge = JSON.stringify(
      Array.from({ length: 200 }, (_, i) => row(`d-${i}`)),
    );
    expect(parseRecents(huge)).toHaveLength(RECENTS_KEEP);
  });
});
