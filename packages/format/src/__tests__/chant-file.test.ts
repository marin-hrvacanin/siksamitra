/**
 * READING AND WRITING A DOCUMENT AS A FILE — the refusals and the empty one.
 *
 * `readChantFile` is what stands between the window and a file somebody
 * chose. Before it, every caller wrote its own `JSON.parse` and checked
 * nothing, so a truncated file, a `.json` that was a package-lock, or a
 * document written by a newer build all failed the same way: a `TypeError`
 * deep in a renderer, minutes later, naming a field nobody has heard of. A
 * window cannot show that to a person.
 *
 * The corpus is NOT read here — the unit tier may not — so the eleven real
 * documents and the round trip over them are in
 * `tests/integration/chant-file.test.ts`. What is left is every way a file can
 * be wrong, which needs no corpus at all.
 */
import { describe, expect, it } from 'vitest';
import {
  CHANT_FORMAT_VERSION, blankChantDoc, isAttested, readChantFile, writeChantFile,
} from '../index.js';

describe('the bytes are canonical', () => {
  it('sorts keys, whatever order they arrived in', () => {
    const scrambled = '{"sections":[],"titleForms":{},"title":"x","version":2}';
    const read = readChantFile(scrambled);
    if (!read.ok) throw new Error(read.error);
    const written = writeChantFile(read.doc);
    /* Independent of the writer: the keys in the output, in the order they
       appear, must be sorted — that is what makes `docHash` reproducible. */
    const keys = [...written.matchAll(/"([a-zA-Z]+)":/g)].map((m) => m[1]);
    expect(keys).toEqual([...keys].sort());
    expect(written).not.toContain(' ');
  });
});

describe('a bad file is reported, never thrown', () => {
  const cases: [string, string, RegExp][] = [
    ['truncated', '{"title":"x","sections":[', /not JSON/],
    ['an array', '[1,2,3]', /not a chant document/],
    ['a number', '42', /not a chant document/],
    ['someone else’s format', '{"format":"vedaunion.variant","title":"x","sections":[]}',
      /not a vedaunion\.chant document/],
    ['from a newer build', `{"title":"x","sections":[],"version":${CHANT_FORMAT_VERSION + 1}}`,
      /newer śikṣāmitra/],
    ['no title', '{"sections":[]}', /no title/],
    ['no sections', '{"title":"x"}', /no sections/],
    ['a section with no id', '{"title":"x","sections":[{"verses":[]}]}', /section 1 has no id/],
    ['a section with no content', '{"title":"x","sections":[{"id":"s-1"}]}',
      /neither verses nor items/],
    ['a verse with no tokens', '{"title":"x","sections":[{"id":"s-1","verses":[{"id":"v-1"}]}]}',
      /no tokens/],
  ];
  for (const [what, text, says] of cases) {
    it(`refuses ${what}`, () => {
      const read = readChantFile(text);
      expect(read.ok).toBe(false);
      expect(read.ok ? '' : read.error).toMatch(says);
    });
  }

  it('says which section, not merely that one is wrong', () => {
    const read = readChantFile(
      '{"title":"x","sections":[{"id":"good","verses":[]},{"id":"bad"}]}',
    );
    expect(read.ok ? '' : read.error).toContain('bad');
  });
});

describe('a new document', () => {
  const blank = blankChantDoc('Untitled');

  it('is one section and one verse', () => {
    expect(blank.sections).toHaveLength(1);
    expect(blank.sections[0]?.verses).toHaveLength(1);
  });

  it('is derivable, so it can be typed into', () => {
    /*
     * `isAttested` is the format's own reading of rule zero: a verse with no
     * `src` is transcribed evidence and every edit that reaches one is
     * REFUSED. A blank document whose verse were attested would open as a
     * document that cannot be written in, which no error message explains.
     */
    const verse = blank.sections[0]?.verses[0];
    expect(verse).toBeDefined();
    expect(isAttested(verse!)).toBe(false);
  });

  it('is a document this program can open', () => {
    expect(readChantFile(writeChantFile(blank)).ok).toBe(true);
  });

  it('keeps `items` in step, as a normalised document must', () => {
    expect(blank.sections[0]?.items).toHaveLength(1);
  });
});
