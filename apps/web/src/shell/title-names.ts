/**
 * WHAT THE TITLE BAR SAYS, as two strings.
 *
 * Its own module so the rule has a test: `AppTitleBar` is a component whose
 * only interesting decision is this one, and a component test would be three
 * mounts to check two strings.
 *
 * THE FAULT IT FIXES. The bar shows the document's title with the file's name
 * beneath it, which is what a document tool does — and for a LIBRARY document
 * the second line is the slug it was fetched by. `durgā sūktam` read
 * "durgā sūktam / durga-suktam", one name twice, and it stayed that way long
 * enough to be photographed for the landing page.
 *
 * WHY THE KIND AND NOT A COMPARISON OF THE TWO STRINGS. Comparing them means
 * knowing that `durga-suktam` is `durgā sūktam` and that `purusha-suktam` is
 * `puruṣa sūktam` — a transliteration table, invented here, that would be
 * wrong for the next document somebody adds. The document already says where
 * it came from, and the answer follows from that: the subtitle exists to tell
 * you WHICH FILE ON DISK you are editing, so it is shown for a file and for
 * nothing else. A library document has no file.
 */

/** What the bar shows where there is nothing else to say. */
const PROGRAM = 'śikṣāmitra';

/** Where the open document came from — `DocFile.kind`. */
export type DocOrigin = 'file' | 'library' | 'new';

export interface TitleBarNames {
  readonly title: string;
  readonly subtitle: string;
}

/**
 * The document's name, and the file's name when there is a file.
 *
 * `dirty` puts a bullet in FRONT of the title — what VS Code, Sublime and
 * TextMate all do — because the name is the part that gets truncated, and
 * "durga-sukt…" with the mark at the end says nothing at all.
 */
export function titleBarNames(
  open: { title: string; name: string; kind: DocOrigin } | null,
  dirty: boolean,
): TitleBarNames {
  if (open === null) return { title: PROGRAM, subtitle: PROGRAM };
  const title = `${dirty ? '• ' : ''}${open.title}`;
  /* A document that has never been written has no file name to show, and a
     library document's is a slug nobody typed. */
  if (open.kind !== 'file' || open.name.trim() === '') return { title, subtitle: PROGRAM };
  return { title, subtitle: open.name };
}
