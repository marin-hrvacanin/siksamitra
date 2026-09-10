/**
 * THE NAME IN THE TITLE BAR, AND THE ONE UNDER IT.
 *
 * The bar shows the document's title with the file's name beneath it, which is
 * what a document tool does — and for a LIBRARY document the second line is
 * the slug it was fetched by. `durgā sūktam` read "durgā sūktam /
 * durga-suktam", one name twice, and it stayed that way long enough to be
 * photographed for the landing page.
 *
 * WHY THE ORIGIN AND NOT A COMPARISON. Comparing the two strings means knowing
 * that `durga-suktam` is `durgā sūktam` and that `purusha-suktam` is `puruṣa
 * sūktam` — a transliteration table, invented for the purpose, that would be
 * wrong for the next document somebody adds. The first version of this did
 * exactly that and failed on `ṣ` becoming `sh`. The document says where it
 * came from; the subtitle is there to say which FILE you are editing.
 */
import { describe, expect, it } from 'vitest';
import { titleBarNames } from '../title-names.js';

describe('a document from the library', () => {
  /* Its `name` is the slug `useDocFile` fetched it by — see `install`. */
  const cases: readonly [string, string][] = [
    ['durgā sūktam', 'durga-suktam'],
    ['bhāgya sūktam', 'bhagya-suktam'],
    ['puruṣa sūktam', 'purusha-suktam'],
    ['śrī rudram', 'sri-rudram'],
  ];

  for (const [title, slug] of cases) {
    it(`"${title}" does not also show "${slug}"`, () => {
      const names = titleBarNames({ title, name: slug, kind: 'library' }, false);
      expect(names.title).toBe(title);
      expect(names.subtitle).toBe('śikṣāmitra');
    });
  }
});

describe('a document from a file', () => {
  it('shows the file, because that is what the subtitle is for', () => {
    /* THE CONTROL. Without it, hiding the subtitle always would satisfy every
       case above and lose the one piece of information it carries: which file
       on disk you are editing. */
    expect(titleBarNames(
      { title: 'durgā sūktam', name: 'working-copy-3.json', kind: 'file' }, false,
    ).subtitle).toBe('working-copy-3.json');
  });

  it('and shows it even when it is the title with an extension', () => {
    /* `fileNameFor` keeps the diacritics and the spaces, so a saved document's
       file is its own title plus `.smdoc`. That is not a duplicate: the
       extension is which format it is in, which the title cannot say. */
    expect(titleBarNames(
      { title: 'durgā sūktam', name: 'durgā sūktam.smdoc', kind: 'file' }, false,
    ).subtitle).toBe('durgā sūktam.smdoc');
  });

  it('but not an empty one', () => {
    expect(titleBarNames({ title: 'x', name: '   ', kind: 'file' }, false).subtitle)
      .toBe('śikṣāmitra');
  });
});

describe('a document that has never been written', () => {
  it('has no file to name', () => {
    expect(titleBarNames({ title: 'Untitled', name: '', kind: 'new' }, false).subtitle)
      .toBe('śikṣāmitra');
  });
});

describe('with nothing open at all', () => {
  it('the bar is the program’s own name', () => {
    expect(titleBarNames(null, false)).toEqual({
      title: 'śikṣāmitra', subtitle: 'śikṣāmitra',
    });
  });
});

describe('unsaved changes', () => {
  it('are a bullet BEFORE the name, where an editor puts it', () => {
    /*
     * In front, because the name is the part that gets truncated:
     * "durga-sukt…" with the mark at the end says nothing at all.
     */
    expect(titleBarNames({ title: 'durgā sūktam', name: 'd.json', kind: 'file' }, true).title)
      .toBe('• durgā sūktam');
  });

  it('and nothing marks a document that matches what is on disk', () => {
    expect(titleBarNames({ title: 'durgā sūktam', name: 'd.json', kind: 'file' }, false).title)
      .toBe('durgā sūktam');
  });
});
