/**
 * A document as a FILE: the bytes it is written as, the bytes it is read from,
 * and what an empty one is.
 *
 * WHAT WAS MISSING. Every caller that had to turn a `.json` document into an
 * object wrote its own `normalizeChantDoc(JSON.parse(text))` — the CLI's
 * `readDoc`, the web app's fetch, the gates — and none of them checked
 * anything. A truncated file, a `.json` that is a package-lock, or a document
 * written by a newer build all came out the same way: a `TypeError` thrown
 * somewhere deep in a renderer, minutes later, naming a field nobody has heard
 * of. The window cannot show that to a person, so the check belongs here,
 * beside the format it is checking, and it returns a sentence rather than
 * throwing.
 *
 * WHAT IT CHECKS, and no more. Only the invariants a reader would crash on:
 * the top level is an object, the title is a string, `sections` is an array of
 * objects each with an id and a verse array. It is NOT `sm validate`, which
 * checks the marking (holds without hg, words[] alignment, missing
 * Devanāgarī); a document can be structurally sound and still fail that, and
 * refusing to OPEN such a document is the opposite of useful — it is the one
 * you most need to look at.
 */
import type { ChantDoc, ChantItem, ChantSection } from './chant-structure.js';
import type { ChantVerse } from './chant-verse.js';
import type { ChantToken } from './chant-tokens.js';
import { CHANT_FORMAT_VERSION, canonicalJson, normalizeChantDoc } from './chant-select.js';
import { encodeMarks } from './mark-codec.js';
import { toTextAndMarks } from './migrate.js';

/** What a chant document's `format` field says, when it carries one. */
export const CHANT_FILE_FORMAT = 'vedaunion.chant';

/**
 * The bytes a document is saved as.
 *
 * `canonicalJson`, not `JSON.stringify`: the interchange contract defines a
 * document's identity as its canonical bytes (docs/INTERCHANGE.md §9), and
 * `docHash`, the `.vuchant` manifest and the variant files' `baseHash` are all
 * taken over exactly these. Writing pretty-printed JSON here would give the
 * same document two byte sequences and make every one of those hashes depend
 * on which program last wrote the file.
 *
 * EVERY VERSE WAS WRITTEN TWICE. A composed section holds its verses in
 * `items`, interleaved with instructions and figures, and again in `verses`.
 * In memory that is deliberate and `normalizeChantDoc` keeps the two in step —
 * `items` is authoritative and `verses` is rebuilt from it on every load. On
 * disk it was pure duplication: Śrī Rudram is 1618.8 kB, of which `items` is
 * 798.9 kB and `verses` 794.1 kB, byte-identical. Half of every corpus file
 * was a copy of the other half.
 *
 * It went unseen because the one tool that asked where the bytes go,
 * `tools/size-study.mjs`, counts `s.items ?? s.verses` — one copy, never both.
 *
 * So the derived array is not written. Reading rebuilds it, which is the same
 * path a composed document has always taken.
 *
 * NEITHER ARE THE TOKENS, for the same reason and a larger saving. A verse is
 * one text and a list of markings; `tokens` is that expanded into a syllable
 * per akṣara with an object per letter, and it is 45% of what is left. It is
 * written as `text` + `marks` and rebuilt on open by `openChantDoc` in
 * `@siksamitra/edit` — there and not here because rebuilding needs the
 * engine's syllabification and this package has no dependencies. Going the
 * other way needs nothing, so the writer can do it.
 *
 * `tools/migrate-audit.mjs` is what makes that safe: it converts all 573
 * verses of the corpus both ways and compares byte for byte, and
 * `check:size`'s round trip does the same per file on the way in.
 *
 * The trailing newline is not part of the canonical bytes and is not written.
 */
export const writeChantFile = (doc: ChantDoc): string => canonicalJson(stored(doc));

/**
 * A section as it is stored: `verses` is absent when `items` carries them, and
 * a verse's `tokens` are absent when its text and markings can rebuild them.
 *
 * Separate types rather than casts, because the difference is real — this
 * shape is not one a consumer may read. Everything in the program reads an
 * OPENED document, where both are there.
 */
type StoredVerse = Omit<ChantVerse, 'tokens'> & { tokens?: ChantToken[] };
type StoredItem = ChantItem extends infer I
  ? I extends { t: 'verse' } ? ({ t: 'verse' } & StoredVerse) : I
  : never;
type StoredSection = Omit<ChantSection, 'verses' | 'items'> & {
  verses?: ChantVerse[];
  items?: StoredItem[];
};
type StoredDoc = Omit<ChantDoc, 'sections'> & { sections: StoredSection[] };

/**
 * A verse as it goes to disk.
 *
 * The text and the markings are taken from the TOKENS every time rather than
 * from whatever `text` the verse is carrying, so the two cannot drift: while
 * both shapes exist, the tokens are what the editor changes, and a stale
 * `text` written beside fresh tokens would be a document that says two things.
 * When the editor works on text and markings directly this inverts, and the
 * tokens stop existing (§10.1).
 */
function storedVerse(v: ChantVerse): StoredVerse {
  /*
   * A verse with no tokens has nothing to convert. A composed section — the
   * saṅkalpa — carries placeholder verses the reader fills in at render time,
   * and `toTextAndMarks` would try to walk an array that is not there.
   */
  if (v.tokens === undefined || v.tokens.length === 0) {
    const { tokens: _none, ...bare } = v;
    return bare;
  }
  const { tokens: _derived, text: _t, marks: _m, ...rest } = v;
  const { text, marks } = toTextAndMarks(v);
  return { ...rest, text, marks: encodeMarks(marks) };
}

/** The document as it goes to disk: nothing that opening it will rebuild. */
const stored = (doc: ChantDoc): StoredDoc => ({
  ...doc,
  sections: doc.sections.map((s): StoredSection => {
    /*
     * A section with no `items` keeps its `verses` — there they are the only
     * copy, and a v2 document must still be writable by a build that has not
     * migrated it. `normalizeChantDoc` gives every section `items`, so in
     * practice this is "write the ordered content once".
     */
    if (s.items === undefined) {
      return { ...s, verses: s.verses.map((v) => storedVerse(v) as ChantVerse) };
    }
    const { verses: _derived, ...rest } = s;
    return {
      ...rest,
      items: s.items.map((it) => (
        it.t === 'verse' ? { ...storedVerse(it), t: 'verse' as const } : it)) as StoredItem[],
    };
  }),
});

/** A document that opened, or the sentence to show instead. */
export type ChantFileRead =
  | { readonly ok: true; readonly doc: ChantDoc }
  | { readonly ok: false; readonly error: string };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The first structural problem, as a sentence, or `null`.
 *
 * The FIRST rather than all of them, deliberately. A file that fails this is
 * corrupt or is not a chant document at all, and a list of forty consequences
 * of one broken bracket tells a reader less than the first line does.
 */
function problemIn(value: unknown): string | null {
  if (!isObject(value)) return 'the file is not a chant document — its contents are not an object';

  const format = value['format'];
  if (format !== undefined && format !== CHANT_FILE_FORMAT) {
    return `the file says it is "${String(format)}", not a ${CHANT_FILE_FORMAT} document`;
  }

  const version = value['version'];
  if (typeof version === 'number' && version > CHANT_FORMAT_VERSION) {
    /* Named rather than swallowed: a v4 document opened by a v3 build would
       lose whatever v4 added the moment it was saved back. */
    return `the file is format version ${version}; this build reads up to `
      + `${CHANT_FORMAT_VERSION} — a newer śikṣāmitra wrote it`;
  }

  if (typeof value['title'] !== 'string') return 'the document has no title';

  const sections = value['sections'];
  if (!Array.isArray(sections)) return 'the document has no sections';

  for (const [i, section] of sections.entries()) {
    if (!isObject(section)) return `section ${i + 1} is not a section`;
    if (typeof section['id'] !== 'string' || section['id'] === '') {
      return `section ${i + 1} has no id`;
    }
    const verses = section['verses'];
    const items = section['items'];
    /* One or the other. `normalizeChantDoc` rebuilds `verses` from `items`
       when a section is composed, so a section carrying only `items` is
       valid — and rejecting it would refuse every v3 document. */
    if (!Array.isArray(verses) && !Array.isArray(items)) {
      return `section "${String(section['id'])}" has neither verses nor items`;
    }
    for (const [j, verse] of (Array.isArray(verses) ? verses : []).entries()) {
      if (!isObject(verse)) return `verse ${j + 1} of "${String(section['id'])}" is not a verse`;
      if (typeof verse['id'] !== 'string' || verse['id'] === '') {
        return `verse ${j + 1} of "${String(section['id'])}" has no id`;
      }
      if (!Array.isArray(verse['tokens'])) {
        return `verse "${String(verse['id'])}" has no tokens`;
      }
    }
  }
  return null;
}

/**
 * Read a document, or say why not.
 *
 * Normalising is part of reading, not a step a caller may forget: `items` is
 * authoritative when a section carries it, and a consumer that read the raw
 * `verses` of a composed section would silently show the wrong content.
 *
 * THE VERSES HAVE NO TOKENS YET. A stored verse is text and markings; the
 * syllables are rebuilt by `openChantDoc` in `@siksamitra/engine`, which this
 * package cannot call. `ChantVerse.tokens` is typed as present because a
 * hundred places read it and they must keep compiling, so the type is
 * OPTIMISTIC here and a caller that reads `verse.tokens` off the result of
 * this function gets `undefined` rather than a compile error.
 *
 * So: `openChantDoc(...)` is how a program opens a document. `readChantFile`
 * is for the half that only wants the structure and the sentence to show when
 * a file will not open. The distinction disappears with the tokens (§10.1).
 */
export function readChantFile(text: string): ChantFileRead {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    /* The parser's own message carries the line and column, which is the only
       useful thing anyone can say about a file that was cut off mid-write. */
    return { ok: false, error: `not JSON — ${e instanceof Error ? e.message : String(e)}` };
  }
  const problem = problemIn(parsed);
  if (problem !== null) return { ok: false, error: problem };
  return { ok: true, doc: normalizeChantDoc(parsed as ChantDoc) };
}

/**
 * What "New" opens: a title, one section, one verse, and nothing else.
 *
 * THE VERSE HAS A `src`, and that is the whole reason this function exists
 * rather than an object literal at the call site. A verse without `src` is
 * *transcribed* — hand-marked evidence the engine may not re-derive — and rule
 * zero refuses every edit that reaches one. A new document built without it
 * therefore opens as a document that cannot be typed into, which is not a
 * failure any error message would explain.
 *
 * `tokens` is empty because there is no text yet; the first keystroke derives
 * them from `src.lines`.
 */
export function blankChantDoc(title: string): ChantDoc {
  const verse: ChantVerse = { id: 'v-1', tokens: [], src: { lines: [''] } };
  const section: ChantSection = { id: 's-1', title: '', verses: [verse] };
  return normalizeChantDoc({
    title,
    titleForms: {},
    version: CHANT_FORMAT_VERSION,
    sections: [section],
  });
}
