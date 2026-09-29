/**
 * WORD-STYLE PARAGRAPHS -> A CHANT DOCUMENT. The one builder.
 *
 * Every importer that reads a marked page ends here: `importDocx` with the
 * paragraphs of a `.docx`, and the PDF reader with the paragraphs it reads off
 * the page in the same shape. Out of `docx.ts` so that neither importer can
 * build a document its own way — the PDF path had its own syllabifier and token
 * builder, in Python, and put every hyphen on the wrong syllable.
 *
 * Marks are TRANSCRIBED from the styles, never re-derived (rule zero at the
 * import boundary): `tokensFromRuns` reads them.
 */
import type { ChantDoc, ChantFigure, ChantItem, ChantSection, ChantVerse } from '@siksamitra/format';
import { normalize } from '@siksamitra/engine';
import { paraRoleOf, type WordParaRole } from './word-styles.js';
import type { DocxDrawing } from './docx-figures.js';
import { wordRun, type WordParagraph, type WordRun } from './docx-read.js';
import { tokensFromRuns } from './docx-runs.js';
import type { ImportReport } from './docx-report.js';

/** A locus line — "taittirīya saṁhitā 1.5.3", "Ṛgveda 10.90", "TA 3.12". */
const RE_LOCUS = /^[\p{L}\s.'’-]+\s\d+(?:[.,]\d+)*\.?$/u;
/** Prose that tells you to do something. */
const RE_IMPERATIVE = /^(take|offer|ring|sip|place|touch|pour|show|wave|bow|sprinkle|light|put|say|recite|do|repeat|hold)\b/i;

function classifyProse(text: string): 'source' | 'option' | 'do' | 'note' {
  const t = text.trim();
  if (/^optional(ly)?$/i.test(t)) return 'option';
  if (RE_LOCUS.test(t) && t.length < 90) return 'source';
  if (RE_IMPERATIVE.test(t)) return 'do';
  return 'note';
}


/**
 * A line that ENDS a verse: a DOUBLE daṇḍa, numbered or not (`॥`, `॥ 1॥`), or
 * any daṇḍa with the verse's number after it — in the Devanāgarī daṇḍas a
 * PDF's text layer has or the ASCII bars his Word files type. A SINGLE daṇḍa
 * with no number is the half-verse: it used to close the verse there, so
 * kanakadhārā's 21 ślokas read as 41 and agnimīḻe's 9 as 19.
 */
const VERSE_END = /(?:॥|\|\|)\s*\d*\s*(?:॥|\|\|)?\s*$|(?:[।॥]|\|{1,2})\s*\d+\s*(?:[।॥]|\|{1,2})?\s*$/u;

export interface BuildOptions {
  /** A title the CALLER chose; it wins over the file's own. */
  title?: string;
  /** What to call a document that names itself nowhere — its file name. */
  fallbackTitle: string;
  report: ImportReport;
  /** A paragraph's picture, or null when it cannot be carried — the caller
   *  says why in the report. */
  figure?: (drawing: DocxDrawing, sectionId: string) => ChantFigure | null;
}

export function buildDocument(paragraphs: readonly WordParagraph[], opts: BuildOptions): ChantDoc {
  const { report } = opts;
  /** The file's own title, from a `Title` / `Heading1` paragraph. */
  let ownTitle: string | undefined;
  const titleNow = (): string => opts.title ?? ownTitle ?? opts.fallbackTitle;
  /** Prose before the first section: the document's own front matter. */
  const front: import('@siksamitra/format').ChantInstruction[] = [];
  const sections: ChantSection[] = [];
  let part: string | undefined;
  let sectionRef: ChantSection | null = null;
  /** Reading through a call defeats control-flow narrowing: TypeScript cannot
   *  see the closure's assignment and kept narrowing the variable to `null`,
   *  which made every later read `never`. */
  const current = (): ChantSection | null => sectionRef;
  let pendingSource: string | undefined;
  let verseRuns: WordRun[] = [];
  let verseN = 0;

  // Returns the section rather than only assigning it: TypeScript cannot see a
  // closure's assignment, so reads after `if (section === null) newSection()`
  // narrowed to `never`.
  const newSection = (titleText: string, role: WordParaRole): ChantSection => {
    const id = `s-${sections.length + 1}`;
    const made = {
      id,
      n: role === 'step' ? String(sections.length + 1) : undefined,
      title: titleText,
      ...(part !== undefined ? { part } : {}),
      verses: [],
    } as ChantSection;
    sections.push(made);
    sectionRef = made;
    report.structure.sections += 1;
    verseN = 0;
    return made;
  };

  /*
   * THE ORDER OF A SECTION'S CONTENTS, kept as it is read.
   *
   * `ChantSection` carries both `verses` and `items`, and `itemsOf` prefers
   * `items` whenever it is not empty — so a section that put ONE thing in
   * `items` and its verses in `verses` drew that one thing and nothing else.
   * That was already happening: a step beginning with a direction and then a
   * mantra came back as the direction alone. Recorded here by reference and
   * materialised at the end, so a verse that gains a translation or an
   * instruction after it was recorded still goes in carrying it.
   */
  type Entry = { verse: ChantVerse } | { item: ChantItem };
  const order = new Map<string, Entry[]>();
  const entries = (sec: ChantSection): Entry[] => {
    const found = order.get(sec.id);
    if (found !== undefined) return found;
    const made: Entry[] = [];
    order.set(sec.id, made);
    return made;
  };

  /** One picture, as an item of the step being read. Where its bytes come
      from is the caller's business — a zip for Word, nothing yet for a PDF. */
  const addFigure = (drawing: DocxDrawing): void => {
    const sec = current() ?? newSection(titleNow(), 'section');
    const figure = opts.figure?.(drawing, sec.id) ?? null;
    if (figure !== null) entries(sec).push({ item: { t: 'figure', figure } });
  };

  /**
   * A `Caption` paragraph belongs to the picture above it.
   *
   * Word's own style, which is what we write and what a person using Word gets
   * from Insert ▸ Caption. Without this the caption came back as a direction —
   * a step with one picture read as picture, note, picture, note — because a
   * caption is prose and `classifyProse` has no way to know better.
   */
  const addCaption = (text: string): void => {
    const list = order.get(current()?.id ?? '') ?? [];
    const last = list[list.length - 1];
    if (last === undefined || !('item' in last) || last.item.t !== 'figure') return;
    const figure = last.item.figure;
    if (figure === undefined || text === '') return;
    list[list.length - 1] = { item: { t: 'figure', figure: { ...figure, caption: { en: text } } } };
  };

  const closeVerse = (): void => {
    if (verseRuns.length === 0) return;
    const sec: ChantSection = current() ?? newSection(titleNow(), 'section');
    verseN += 1;
    const where = `${sec.id}/v-${verseN}`;
    const tokens = tokensFromRuns(verseRuns, report, where);
    verseRuns = [];
    if (tokens.length === 0) return;
    const verse: ChantVerse = {
      id: `${sec.id}-v${verseN}`,
      n: String(verseN),
      tokens,
      ...(pendingSource !== undefined ? { source: pendingSource } : {}),
    };
    pendingSource = undefined;
    sec.verses.push(verse);
    entries(sec).push({ verse });
    report.structure.verses += 1;
  };

  for (const p of paragraphs) {
    const role = paraRoleOf(p.pStyle);
    const text = p.runs.map((r) => r.text).join('').trim();

    /* A picture stands where its paragraph stands, so it is taken before the
       paragraph is classified — a `<w:drawing>` carries no text, and a
       paragraph with no text is one this reader would otherwise skip. */
    if (p.drawings !== undefined) {
      closeVerse();
      for (const d of p.drawings) addFigure(d);
    }

    if (role === 'drop') continue;
    /* ANYTHING that is not a line of the verse ends the verse — a translation
       above all, which belongs to the verse BEFORE it. It did not: a verse
       whose last line ended in a single daṇḍa ran on through its translation
       into the next verse, and the translation went to the verse before. */
    if (role !== 'verse-line') closeVerse();

    if (role === 'title') {
      closeVerse();
      if (ownTitle === undefined && text !== '') { ownTitle = text; continue; }
      part = text;
      sectionRef = null;
      continue;
    }
    if (role === 'part') {
      closeVerse();
      part = text;
      sectionRef = null;
      continue;
    }
    if (role === 'section' || role === 'step') {
      closeVerse();
      if (text !== '') newSection(text, role);
      continue;
    }
    if (role === 'verse-line') {
      // Consecutive Translit paragraphs are one verse until a daṇḍa + number
      // closes it — the same grouping the PDF path uses.
      verseRuns.push(...p.runs, wordRun('\n'));
      if (VERSE_END.test(text)) closeVerse();
      continue;
    }
    if (role === 'translation') {
      const sec = current();
      const last = sec === null ? undefined : sec.verses[sec.verses.length - 1];
      if (last !== undefined && text !== '') {
        last.translation = {
          en: last.translation?.en === undefined ? text : `${last.translation.en} ${text}`,
        };
      }
      continue;
    }
    if (role === 'caption') {
      addCaption(text);
      continue;
    }
    if (role === 'insert') {
      report.unresolved.push({
        at: current()?.id ?? 'doc',
        what: 'the "Insert" paragraph style has no home in the format yet (00 §5.1)',
        raw: text.slice(0, 120),
      });
      continue;
    }
    // Prose: a locus, an option, a direction, or a note.
    if (text === '') continue;
    const kind = classifyProse(text);
    const sec = current();
    if (kind === 'source') {
      if (sec !== null && sec.verses.length === 0) sec.source = text;
      else pendingSource = text;
    } else if (sec !== null) {
      const instr = {
        kind: kind === 'option' ? ('option' as const)
          : kind === 'do' ? ('do' as const) : ('note' as const),
        text: { en: text },
      };
      const last = sec.verses[sec.verses.length - 1];
      if (last !== undefined) last.instructions = [...(last.instructions ?? []), instr];
      else entries(sec).push({ item: { t: 'instruction', instruction: instr } });
    } else {
      /* Before any section: the document's own front matter — the title
         page's lines, the dedication, the instructions for the whole text.
         It used to be dropped, all 13 paragraphs of the sādhanā's. */
      front.push({ kind: kind === 'option' ? 'option' : kind === 'do' ? 'do' : 'note', text: { en: text } });
    }
  }
  closeVerse();

  const norm = normalize(paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n'));
  report.normalisations = norm.changes;

  /* Materialised last, so a verse goes in carrying whatever it gained after it
     was recorded. A section with nothing but verses is left with no `items` at
     all, which is the shape `itemsOf` reads as "the verses, in order". */
  const withItems = sections.map((s) => {
    const list = order.get(s.id) ?? [];
    if (!list.some((e) => 'item' in e)) return s;
    return {
      ...s,
      items: list.map((e) => ('item' in e ? e.item : { t: 'verse' as const, ...e.verse })),
    };
  });

  const title = titleNow();
  const doc: ChantDoc = {
    title,
    titleForms: { iast: title },
    ...(front.length === 0 ? {} : { instructions: front }),
    sections: withItems.filter((s) => s.verses.length > 0 || (s.items?.length ?? 0) > 0),
    version: 3,
  };
  return doc;
}
