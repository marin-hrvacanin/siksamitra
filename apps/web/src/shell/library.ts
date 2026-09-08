/**
 * The documents that come with the program.
 *
 * Named here rather than inside the File view because two things need the
 * list and they are not the same thing: the backstage draws it, and the
 * lifecycle has to know that a `ref` like `durga-suktam` is fetched from
 * `/chants/` rather than read off the disk. With the list inside the view, the
 * hook that opens documents would have had to import a React component.
 *
 * These are served straight out of `corpus/chants/` by the Vite plugin — there
 * is no second copy — so a document re-derived by the CLI is the one the
 * window opens.
 */

export interface LibraryDoc {
  readonly slug: string;
  readonly title: string;
}

export const DOCUMENTS: readonly LibraryDoc[] = [
  { slug: 'durga-suktam', title: 'Durgā Sūktam' },
  { slug: 'bhagya-suktam', title: 'Bhāgya Sūktam' },
  { slug: 'purusha-suktam', title: 'Puruṣa Sūktam' },
  { slug: 'sri-rudram', title: 'Śrī Rudram' },
];

/**
 * What the window opens with.
 *
 * A real document rather than a blank one, and the reason is the work: this is
 * a tool for marking texts that already exist, and every one of the screenshot
 * and interaction probes drives it against a document with verses in it. New
 * is one keystroke away for the other case.
 */
export const START_DOC = DOCUMENTS[0]!.slug;

/** Where a library document is served from. */
export const libraryUrl = (slug: string): string =>
  `/chants/${encodeURIComponent(slug)}.json`;

/** Its title, for a recents row written before the document has been read. */
export const libraryTitle = (slug: string): string =>
  DOCUMENTS.find((d) => d.slug === slug)?.title ?? slug;
