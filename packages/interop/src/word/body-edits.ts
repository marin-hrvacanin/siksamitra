/**
 * WHAT WAS DONE IN WORD, taken back into the document inside the file.
 *
 * A `.docx` this program writes carries the document itself (`import.ts`), and
 * reading that back is exact — but it is exact about the document as it was
 * WRITTEN. A person who then marks a line with the add-in, types a verse, or
 * deletes one has changed the page and not the document inside it, and
 * reading only the inside threw their work away without a word.
 *
 * So the page is read too, and compared — not with the document, which Word
 * cannot state every detail of (`carry.ts` in the add-in), but with what the
 * page WOULD read as had nobody touched it: each verse written again and read
 * by the same reader. A verse that reads the same is untouched and keeps
 * everything the file carried; one that reads differently was edited, and its
 * text, marks and translation are the page's. Verses added or removed in Word
 * are found by aligning the two readings — the longest common run of verses —
 * so one inserted verse does not make every verse after it "edited".
 *
 * LINE BY LINE, as the writer writes: one mantra paragraph per verse, its
 * translation in the paragraphs after it. Not through `buildDocument`, whose
 * grouping of lines into verses is for his hand-made files, one pāda each.
 */
import type { ChantDoc, ChantSection, ChantToken, ChantVerse } from '@siksamitra/format';
import { toTextAndMarks, withVerses } from '@siksamitra/format';
import type { ScriptKey } from '@siksamitra/engine';
import { paraRoleOf } from '../word-styles.js';
import { mergeRuns, readParagraphs, type WordParagraph } from '../docx-read.js';
import { reportFor } from '../docx-report.js';
import { tokensFromRuns } from '../docx-runs.js';
import { documentXml } from './body.js';
import { scriptOfLine } from './script-reader.js';

interface PageVerse {
  tokens: ChantToken[];
  translation?: string;
  /** How it reads: text, marks (who placed them aside), translation. */
  key: string;
}

/** The mantra lines of a page, each with the translation written after it. */
function pageVerses(paragraphs: readonly WordParagraph[]): PageVerse[] {
  const report = reportFor('docx', 0, [...paragraphs]);
  const out: Omit<PageVerse, 'key'>[] = [];
  for (const p of paragraphs) {
    const role = paraRoleOf(p.pStyle);
    const text = p.runs.map((r) => r.text).join('');
    if (role === 'verse-line') {
      out.push({ tokens: tokensFromRuns(mergeRuns(p.runs), report, `p-${out.length}`, scriptOfLine(text)) });
    } else if (role === 'translation' && out.length > 0 && text.trim() !== '') {
      const last = out[out.length - 1]!;
      last.translation = last.translation === undefined ? text.trim() : `${last.translation}\n${text.trim()}`;
    }
  }
  return out.map((v) => {
    const tm = toTextAndMarks({ id: 'v', tokens: v.tokens } as ChantVerse);
    const marks = tm.marks.map(({ by: _by, ...m }) => JSON.stringify(m)).sort();
    return { ...v, key: JSON.stringify([tm.text, marks, v.translation ?? null]) };
  });
}

/** One verse as its own page: what it reads as, or `null` when it writes no line. */
function asWritten(v: ChantVerse, script: ScriptKey): string | null {
  const alone = { title: '', titleForms: {}, sections: [{ id: 's', verses: [v] }] } as ChantDoc;
  const read = pageVerses(readParagraphs(documentXml(alone, '', undefined, script)));
  return read.length === 1 ? read[0]!.key : null;
}

/** Pairs `[i, j]` of a longest common subsequence of `a` and `b`. */
function common(a: readonly string[], b: readonly string[]): [number, number][] {
  const len: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      len[i]![j] = a[i] === b[j] ? len[i + 1]![j + 1]! + 1 : Math.max(len[i + 1]![j]!, len[i]![j + 1]!);
    }
  }
  const out: [number, number][] = [];
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] === b[j]) { out.push([i, j]); i += 1; j += 1; } else if (len[i + 1]![j]! >= len[i]![j + 1]!) i += 1; else j += 1;
  }
  return out;
}

export interface BodyEdits {
  doc: ChantDoc;
  /** Verses whose text, marks or translation were changed in Word. */
  edited: number;
  added: number;
  removed: number;
}

/** A verse with the page's letters: what the letters were derived from is gone with them. */
function edited(v: ChantVerse, w: PageVerse): ChantVerse {
  const { text: _t, marks: _m, src: _s, ...rest } = v;
  return {
    ...rest, tokens: w.tokens,
    ...(w.translation === undefined ? {} : { translation: { ...v.translation, en: w.translation } }),
  };
}

/**
 * The document inside the file, with what was done to the page in Word.
 * `documentBody` is the file's `word/document.xml`, `script` the one the
 * document was written in (the manifest's).
 */
export function withBodyEdits(
  doc: ChantDoc, documentBody: string, stylesXml: string | undefined, script: ScriptKey,
): BodyEdits {
  const page = pageVerses(readParagraphs(documentBody, stylesXml));
  const keyOf = new Map<ChantVerse, string | null>();
  for (const s of doc.sections) for (const v of s.verses) keyOf.set(v, asWritten(v, script));
  /* Only a verse that writes a line can have been edited on the page. */
  const visible = [...keyOf.entries()].filter(([, k]) => k !== null).map(([v, k]) => ({ v, key: k! }));
  const pairs = common(visible.map((x) => x.key), page.map((x) => x.key));
  if (pairs.length === visible.length && page.length === visible.length) return { doc, edited: 0, added: 0, removed: 0 };

  /* What became of each verse, and what the page added after which. Between
     two anchors the document's verses are paired with the page's in order:
     the first of them are EDITED — the same verse with new letters — and what
     is left over on either side was added or removed. */
  type Fate = { kind: 'kept' } | { kind: 'edited'; w: PageVerse } | { kind: 'removed' };
  const fate = new Map<number, Fate>();
  const addAfter = new Map<number, PageVerse[]>();
  let pa = -1;
  let pb = -1;
  for (const [a, b] of [...pairs, [visible.length, page.length] as [number, number]]) {
    const gone = Array.from({ length: a - pa - 1 }, (_x, k) => pa + 1 + k);
    const come = page.slice(pb + 1, b);
    gone.forEach((gi, k) => fate.set(gi, k < come.length ? { kind: 'edited', w: come[k]! } : { kind: 'removed' }));
    const extra = come.slice(gone.length);
    if (extra.length > 0) addAfter.set(gone.length > 0 ? gone[gone.length - 1]! : pa, extra);
    if (a < visible.length) fate.set(a, { kind: 'kept' });
    pa = a;
    pb = b;
  }

  const count = { edited: 0, added: 0, removed: 0 };
  const ids = new Set([...keyOf.keys()].map((v) => v.id));
  const lists = new Map<ChantSection, ChantVerse[]>(doc.sections.map((s) => [s, []]));
  let into = doc.sections[0];
  const add = (after: number): void => {
    for (const w of addAfter.get(after) ?? []) {
      if (into === undefined) return;
      let id = `${into.id}-w${count.added + 1}`;
      while (ids.has(id)) id += "'";
      ids.add(id);
      count.added += 1;
      lists.get(into)!.push({ id, tokens: w.tokens, ...(w.translation === undefined ? {} : { translation: { en: w.translation } }) });
    }
  };
  add(-1);
  let vi = 0;
  for (const s of doc.sections) {
    for (const v of s.verses) {
      if (keyOf.get(v) === null) { lists.get(s)!.push(v); continue; }
      const f = fate.get(vi) ?? { kind: 'kept' };
      if (f.kind === 'kept') lists.get(s)!.push(v);
      else if (f.kind === 'edited') { lists.get(s)!.push(edited(v, f.w)); count.edited += 1; } else count.removed += 1;
      into = s;
      add(vi);
      vi += 1;
    }
  }
  const sections = doc.sections.map((s) => withVerses(s, lists.get(s)!));
  return { doc: { ...doc, sections }, ...count };
}
