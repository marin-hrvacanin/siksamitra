/**
 * Word `.docx` — reading and writing the owner's own marked files.
 *
 * Pure TypeScript, so it runs in the browser and in Node alike: a `.docx` is a
 * zip of XML, and `fflate` plus a small reader is the whole dependency. No
 * Python, no native module, no service.
 *
 * RULE ZERO GOVERNS THE IMPORTER. Marks are TRANSCRIBED from the styles he
 * applied, never re-derived. His files contain hand-placed marks the algorithm
 * does not produce, and an importer that "fixed" one would be destroying a
 * decision. The engine may be run afterwards as a COMPARISON, and its
 * disagreements go in the report for a human to rule on.
 *
 * TWO TRAPS, both of which have cost a defect elsewhere and are closed here:
 *   - never sort runs by position. `pdf_import` sorts by x and turns `śuklā̍m`
 *     into `śuklām̍`; document order is correct.
 *   - fold `ꣳ`/`ँ` → `ṁ` at the boundary, or a pre-formed candrabindu slips
 *     past the gum rule and ships with no reading aid.
 *
 * See specs/chant-editor/03-INTEROP.md §2.
 */
import { unzipSync, strFromU8 } from 'fflate';
import type { ChantDoc, ChantItem, ChantSection, ChantVerse } from '@siksamitra/format';
import { normalize } from '@siksamitra/engine';
import { REFERENCE_COUNTS, paraRoleOf, type WordParaRole } from './word-styles.js';
import {
  columnEmuOf, figureFromDrawing, relationshipTargets, type DocxDrawing,
} from './docx-figures.js';
import { readParagraphs, type WordParagraph, type WordRun } from './docx-read.js';

/* The OOXML reader is `docx-read.ts`. Re-exported because it is part of this
   module's published surface — the add-in and two gates read paragraphs. */
export { mergeRuns, readParagraphs } from './docx-read.js';
/* The transcriber is `docx-runs.ts` and the report is `docx-report.ts`,
   split out when this file passed 700 lines. Re-exported because they are
   part of this module's published surface. */
export { tokensFromRuns } from './docx-runs.js';
export type { ImportReport } from './docx-report.js';
import { tokensFromRuns } from './docx-runs.js';
import type { ImportReport } from './docx-report.js';
export type { WordParagraph, WordRun } from './docx-read.js';

/* ==========================================================================
   Import
   ========================================================================== */


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
 * Build a verse's tokens from one `Translit` paragraph's runs.
 *
 * Letters come from the text; marks come from the STYLES. No rule is run.
 * Consecutive holding runs of the same style form one `hg` group, and a group
 * covering more than one letter is kept but reported: narrowing it needs the
 * same-point test (02A H26), and guessing a host is how boxes end up off by a
 * letter.
 */

export interface DocxImport {
  doc: ChantDoc;
  report: ImportReport;
  /** The raw paragraphs, so a caller can re-classify without re-unzipping. */
  paragraphs: WordParagraph[];
}

/** Read a `.docx` into a chant document plus a report of everything it did. */
export function importDocx(bytes: Uint8Array, title = 'Imported'): DocxImport {
  /*
   * THE PICTURES COME OUT OF THE ZIP TOO. A `.docx` keeps them in
   * `word/media/`, named from `word/_rels/document.xml.rels`, and reading only
   * `document.xml` is how every picture in an imported manual used to become
   * nothing at all — silently, because a `<w:drawing>` carries no text and a
   * paragraph with no text is a paragraph this reader skips.
   */
  const zip = unzipSync(bytes, {
    filter: (f) => f.name === 'word/document.xml'
      || f.name === 'word/_rels/document.xml.rels'
      || f.name.startsWith('word/media/'),
  });
  const xml = zip['word/document.xml'];
  if (xml === undefined) throw new Error('not a .docx — word/document.xml is missing');

  const documentText = strFromU8(xml);
  const paragraphs = readParagraphs(documentText);
  const rels = zip['word/_rels/document.xml.rels'] === undefined
    ? new Map<string, string>()
    : relationshipTargets(strFromU8(zip['word/_rels/document.xml.rels']));
  const columnEmu = columnEmuOf(documentText);
  let figureN = 0;

  const report: ImportReport = {
    source: { kind: 'docx', bytes: bytes.length },
    structure: {
      paragraphs: paragraphs.length,
      paragraphsWithBody: paragraphs.filter((p) => p.empty !== true).length,
      runs: 0, sections: 0, verses: 0, syllables: 0,
    },
    marks: {},
    byStyle: {},
    byPara: {},
    normalisations: [],
    unresolved: [],
  };

  for (const p of paragraphs) {
    if (p.empty === true) continue; // counted in `paragraphs`, not per style
    const key = p.pStyle ?? 'default';
    report.byPara[key] = (report.byPara[key] ?? 0) + 1;
    for (const r of p.runs) {
      report.structure.runs += 1;
      const sk = r.rStyle ?? 'none';
      report.byStyle[sk] = (report.byStyle[sk] ?? 0) + 1;
    }
  }

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

  /** One picture out of the zip, as an item of the step being read. */
  const addFigure = (drawing: DocxDrawing): void => {
    const sec = current() ?? newSection(title, 'section');
    const target = rels.get(drawing.relId);
    const part = target === undefined ? undefined : `word/${target.replace(/^\.?\//u, '')}`;
    const media = part === undefined ? undefined : zip[part];
    if (part === undefined || media === undefined) {
      report.unresolved.push({
        at: sec.id, what: 'a picture whose bytes are not in the file', raw: drawing.relId,
      });
      return;
    }
    figureN += 1;
    const figure = figureFromDrawing(drawing, part, media, `fig-${figureN}`, columnEmu);
    if (figure === null) {
      figureN -= 1;
      report.unresolved.push({
        at: sec.id,
        what: 'a picture in a format a document may not carry '
          + '(.emf and .wmf are the two Word writes)',
        raw: part,
      });
      return;
    }
    entries(sec).push({ item: { t: 'figure', figure } });
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
    const sec: ChantSection = current() ?? newSection(title, 'section');
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
      verseRuns.push(...p.runs, { text: '\n', rStyle: null, superscript: false });
      if (/[।॥]\s*\d*\s*[।॥]?\s*$/.test(text)) closeVerse();
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

  const doc: ChantDoc = {
    title,
    titleForms: { iast: title },
    sections: withItems.filter((s) => s.verses.length > 0 || (s.items?.length ?? 0) > 0),
    version: 3,
  };
  return { doc, report, paragraphs };
}

export { REFERENCE_COUNTS };
