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
 *
 * NOTHING OF HIS PAGE IS LEFT ON THE FLOOR. Measured on his sādhanā against the
 * PDF Word printed from it (`tools/fidelity/compare_pdf.py`), this reader lost
 * 571 of its 2,277 lines: every note written on a mantra line, every empty line
 * he spaces his blocks with, every page break, the title page and the contents.
 * Each is kept now, in the place he put it — see `openspec/changes/his-page`.
 */
import type {
  ChantDoc, ChantFigure, ChantInstruction, ChantItem, ChantProfileKey, ChantSection, ChantVerse,
} from '@siksamitra/format';
import { normalize } from '@siksamitra/engine';
import { paraRoleOf, roleOf, type WordParaRole } from './word-styles.js';
import type { DocxDrawing } from './docx-figures.js';
import { wordRun, type WordParagraph, type WordRun } from './docx-read.js';
import { tokensFromRuns } from './docx-runs.js';
import type { ImportReport } from './docx-report.js';
import { scriptOfLine } from './word/script-reader.js';
import { partOf } from './word/rule-parts.js';
import { registersOf } from './build-registers.js';
import { VERSE_END, classifyProse, linesIn, mantraOf, materialise, writeTranslations, type Entry } from './build-lines.js';

export interface BuildOptions {
  /** A title the CALLER chose; it wins over the file's own. */
  title?: string;
  /** What to call a document that names itself nowhere — its file name. */
  fallbackTitle: string;
  report: ImportReport;
  /** The register the lines outside every part are marked in, when the file
   *  records one (the add-in's settings — `recordedRegisterIn`). */
  register?: ChantProfileKey;
  /** A paragraph's picture, or null when it cannot be carried — the caller
   *  says why in the report. */
  figure?: (drawing: DocxDrawing, sectionId: string) => ChantFigure | null;
}

export function buildDocument(paragraphs: readonly WordParagraph[], opts: BuildOptions): ChantDoc {
  const { report } = opts;
  /** The file's own title, from a `Title` / `Heading1` paragraph. */
  let ownTitle: string | undefined;
  /** Prose before the first section: the document's own front matter. */
  const front: ChantInstruction[] = [];
  /** A book's title page, line by line, and its contents heading. */
  const cover: string[] = [];
  let contentsTitle: string | undefined;
  /** Still before the first heading of the body — where a title page is. */
  let inFront = true;
  const sections: ChantSection[] = [];
  let part: string | undefined;
  let sectionRef: ChantSection | null = null;
  /** Read through a call: TypeScript cannot see a closure's assignment. */
  const current = (): ChantSection | null => sectionRef;
  /** Sections whose source was our `Source`: comment lines after it head the verse. */
  const sealed = new Set<ChantSection>();
  /** Comment lines read on mantra lines, waiting for the verse they head. */
  let pendingSource: string | undefined;
  let verseRuns: WordRun[] = [];
  /** How many of the verse's lines each of its paragraphs holds. */
  let verseParas: number[] = [];
  /** The part the verse being read is in: its first line's content control. */
  let verseTag: string | undefined;
  /** Which register marks each verse — a Word part's, or none. */
  const registers = new Map<ChantVerse, ChantProfileKey | null>();
  /** Each verse's translation as it is read: its lines, and how many of them
   *  each of his paragraphs holds. Written onto the verse at the end. */
  const translations = new Map<ChantVerse, { lines: string[]; paras: number[] }>();
  const translationOf = (v: ChantVerse): { lines: string[]; paras: number[] } =>
    translations.get(v) ?? translations.set(v, { lines: [], paras: [] }).get(v)!;
  let verseN = 0;

  /*
   * THE SHAPE OF THE FILE says what its headings are. A single document — his
   * Śivopāsana, and every file `exportWord` writes — names itself once, in
   * Heading 2, and gives its chants Heading 3 and their steps Heading 4: the
   * three levels the app draws (`ROLE_OF_ELEMENT` in the tokens). A BOOK — his
   * sādhanā — has many Heading 2 parts, one level more than a document has,
   * and there Heading 2 is the part, Heading 3 the chant and Heading 4 a step
   * inside it (`ChantSection.sub`).
   */
  const roles = paragraphs.map((p) => paraRoleOf(p.pStyle));
  let verseOurs = false; // the verse being read began with our tag
  const single = !roles.includes('title') && roles.filter((r) => r === 'part').length === 1;

  /*
   * THE ORDER OF A SECTION'S CONTENTS, kept as it is read.
   *
   * `ChantSection` carries both `verses` and `items`, and `itemsOf` prefers
   * `items` whenever it is not empty — so a section that put ONE thing in
   * `items` and its verses in `verses` drew that one thing and nothing else.
   * Recorded here by reference and materialised at the end, so a verse that
   * gains a translation or an instruction after it was recorded still goes in
   * carrying it.
   */
  const order = new Map<string, Entry[]>();
  const entries = (sec: ChantSection): Entry[] =>
    order.get(sec.id) ?? order.set(sec.id, []).get(sec.id)!;
  /** What stands between a part's heading and its first chant waits for it. */
  let waiting: ChantItem[] = [];

  /** An item where it stands: in the section being read, or waiting. */
  const place = (item: ChantItem): void => {
    const sec = current();
    if (sec === null) waiting.push(item);
    else entries(sec).push({ item });
  };
  /** A comment line no verse came after keeps its place, as a note. */
  const flushNote = (): void => {
    if (pendingSource === undefined) return;
    const text = pendingSource;
    pendingSource = undefined;
    place({ t: 'instruction', instruction: { kind: 'note', text: { en: text }, comment: 'verse' } });
  };
  /** Anything that is not the verse a comment heads puts the comment down first. */
  const add = (item: ChantItem): void => { flushNote(); place(item); };

  const newSection = (titleText: string, role: WordParaRole, heading = true): ChantSection => {
    if (heading) flushNote(); // a section a verse needed keeps the line for it
    const id = `s-${sections.length + 1}`;
    /* No `n`: a number is the heading's own text when it has one — inventing
       one sent his `prathamo'nuvākaḥ` back out as `18. prathamo'nuvākaḥ`. */
    const made = {
      id,
      title: titleText,
      ...(part !== undefined ? { part } : {}),
      ...(!single && role === 'step' ? { sub: true as const } : {}),
      verses: [],
    } as ChantSection;
    sections.push(made);
    sectionRef = made;
    report.structure.sections += 1;
    verseN = 0;
    if (waiting.length > 0) {
      entries(made).push(...waiting.map((item) => ({ item })));
      waiting = [];
    }
    return made;
  };
  /* A section nobody headed has no heading: a second copy of the document's
     name over it, which a book's used to take, is a heading nobody wrote. */
  const anySection = (): ChantSection => current() ?? newSection('', 'section', false);

  const addFigure = (drawing: DocxDrawing): void => {
    const figure = opts.figure?.(drawing, current()?.id ?? 'doc') ?? null;
    if (figure !== null) add({ t: 'figure', figure });
  };

  /** A `Caption` paragraph belongs to the picture above it (Word's own style,
   *  which we write); without this it came back as a direction. */
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
    const sec: ChantSection = anySection();
    verseN += 1;
    const where = `${sec.id}/v-${verseN}`;
    /* A verse is read in the script it is written in, and its marks with it:
       a Devanāgarī line is the same IAST text and markings as any other. */
    const script = scriptOfLine(verseRuns.map((r) => r.text).join(''));
    const tokens = tokensFromRuns(verseRuns, report, where, script);
    const register = partOf(verseTag)?.register ?? null;
    const paras = verseParas;
    verseRuns = [];
    verseParas = [];
    verseTag = undefined;
    if (tokens.length === 0) return;
    /* The paragraphs, when there is more than one: they must account for every
       line, and a count that does not is reported rather than written. */
    const lines = tokens.filter((t) => t.t === 'br').length + 1;
    const counted = paras.reduce((a, b) => a + b, 0);
    if (paras.length > 1 && counted !== lines) {
      report.unresolved.push({ at: where, what: `its paragraphs hold ${counted} lines and the verse has ${lines}`, raw: '' });
    }
    const verse: ChantVerse = {
      id: `${sec.id}-v${verseN}`,
      n: String(verseN),
      tokens,
      ...(pendingSource !== undefined ? { source: pendingSource } : {}),
      ...(paras.length > 1 && counted === lines ? { paragraphs: paras } : {}),
    };
    pendingSource = undefined;
    registers.set(verse, register);
    sec.verses.push(verse);
    entries(sec).push({ verse });
    report.structure.verses += 1;
  };

  /** The verse the next translation line belongs to: the last thing read. */
  const translated = (): ChantVerse | undefined => {
    const sec = current();
    const list = sec === null ? [] : entries(sec);
    const last = list[list.length - 1];
    return last !== undefined && 'verse' in last ? last.verse : undefined;
  };

  for (const p of paragraphs) {
    const role = paraRoleOf(p.pStyle);
    const text = p.runs.map((r) => r.text).join('').trim();
    const heading = role === 'title' || role === 'part' || role === 'section' || role === 'step';

    /* A book's contents: its heading is kept, its entries are Word's to make. */
    if (p.pStyle === 'TOCHeading') { if (text !== '') contentsTitle = text; continue; }

    /* THE TITLE PAGE: what is centred before the first heading. */
    if (inFront && !heading && role === 'prose' && p.align === 'center' && text !== '') {
      cover.push(...text.split('\n').map((l) => l.trim()).filter((l) => l !== ''));
      continue;
    }
    if (heading) inFront = false;

    /* A picture stands where its paragraph stands — after the heading it is
       in, which opens the section it belongs to. */
    if (p.drawings !== undefined && !heading) {
      closeVerse();
      for (const d of p.drawings) addFigure(d);
    }

    if (role === 'drop') continue;
    /* ANYTHING that is not a line of the verse ends the verse — a translation
       above all, which belongs to the verse BEFORE it. */
    if (role !== 'verse-line') closeVerse();

    if (role === 'title') {
      closeVerse();
      if (ownTitle === undefined && text !== '') ownTitle = text;
      else { part = text; flushNote(); sectionRef = null; }
    } else if (role === 'part') {
      closeVerse();
      if (single && ownTitle === undefined && sections.length === 0 && text !== '') ownTitle = text;
      else { flushNote(); part = text; sectionRef = null; }
    } else if (single && role === 'section') {
      /* In a single document a chant's heading is its PART, as the app keeps
         it, and the steps under it are its sections. */
      closeVerse();
      flushNote();
      part = text === '' ? undefined : text;
      sectionRef = null;
    } else if (role === 'section' || role === 'step') {
      closeVerse();
      if (text !== '') newSection(text, role);
    }
    if (heading) {
      for (const d of p.drawings ?? []) addFigure(d);
      if (p.pageBreak === true && !inFront) add({ t: 'break' });
      continue;
    }

    /* AN EMPTY PARAGRAPH IS AN EMPTY LINE, of its own height — the way he
       spaces his blocks. In the front matter it is the title page's. */
    if (text === '' && p.drawings === undefined) {
      /* A paragraph holding only his page break IS the break, not a line. */
      if (p.pageBreak === true) { if (!inFront) add({ t: 'break' }); continue; }
      if (!inFront) {
        if (role === 'translation' && translated() !== undefined) {
          /* An empty line of the translation — between two of its paragraphs,
             or under a verse that has none, where it is a gap (see below). */
          const t = translationOf(translated()!);
          t.lines.push('');
          t.paras.push(1);
        } else if (role === 'verse-line') add({ t: 'gap', of: 'verse' });
        else if (role === 'insert') add({ t: 'gap', of: 'small' });
        else if (role === 'translation') add({ t: 'gap', of: 'translation' });
        else if (role === 'prose') add({ t: 'gap', of: 'body' });
      }
      continue;
    }

    /* A LINE WRITTEN WHOLLY IN HIS COMMENT STYLE is not a mantra: it is the
       small grey line over one — a source, a metre, a direction. On a mantra
       line (a `Translit` paragraph) it heads the verse after it, or the
       section when it stands right under the heading; in a prose paragraph it
       is a note in the comment face, where it stands. */
    /* A paragraph holding only a picture has nothing in it to read further. */
    if (text === '') continue;
    const commentOnly = p.runs.every((r) => r.text.trim() === '' || roleOf(r.rStyle) === 'comment');
    if ((role === 'verse-line' || role === 'insert') && commentOnly) {
      closeVerse();
      const sec = current() ?? (single && part !== undefined ? anySection() : null);
      /* Our `Source` paragraph is the section's — or, after its verses, begins
         one with no heading: the verses from that source (bhū sūktam's TB
         3.1.2.6). His comment lines right under a heading are the section's
         too, unless a `Source` came first — then they head the verse. */
      const ours = p.pStyle === 'Source';
      /* A line carrying our verse bookmark is the next verse's own. */
      if (sec !== null && p.ours === undefined && (ours || (entries(sec).length === 0 && pendingSource === undefined && !sealed.has(sec)))) {
        const into = ours && entries(sec).length > 0 ? newSection('', 'section', false) : sec;
        into.source = into.source == null ? text : `${into.source}\n${text}`;
        if (ours) sealed.add(into);
      } else {
        pendingSource = pendingSource === undefined ? text : `${pendingSource}\n${text}`;
      }
      continue;
    }
    if (role === 'prose' && commentOnly) {
      if (inFront) { front.push({ kind: 'note', text: { en: text }, comment: 'body' }); continue; }
      const kind = classifyProse(text);
      add({ t: 'instruction', instruction: { kind: kind === 'do' ? 'do' : 'note', text: { en: text }, comment: 'body' } });
      continue;
    }
    if (role === 'verse-line') {
      // Consecutive Translit paragraphs are one verse until a daṇḍa + number
      // closes it — the same grouping the PDF path uses.
      /* Our tag begins a verse; inside a verse of ours, so does an untagged line
         — typed in Word. Inside one of his, his lines run on to the number. */
      if (p.ours === 'start' || (verseOurs && p.ours === undefined)) closeVerse();
      if (verseRuns.length === 0) { verseTag = p.sdt; verseOurs = p.ours !== undefined; }
      verseRuns.push(...p.runs, wordRun('\n'));
      verseParas.push(linesIn(p));
      if (VERSE_END.test(mantraOf(p))) closeVerse();
      if (p.pageBreak === true) { closeVerse(); add({ t: 'break' }); }
      continue;
    }
    if (role === 'translation') {
      const last = translated();
      /* LINE BY LINE, as he writes them: a paragraph per line or a soft break
         between them, and which it was is kept (`translation.paragraphs`). */
      if (last !== undefined) {
        const t = translationOf(last);
        t.lines.push(...text.split('\n').map((l) => l.trim()));
        t.paras.push(text.split('\n').length);
      } else {
        add({ t: 'instruction', instruction: { kind: 'note', text: { en: text } } });
      }
      if (p.pageBreak === true) add({ t: 'break' });
      continue;
    }
    if (role === 'caption') {
      addCaption(text);
      continue;
    }
    // Prose: a locus, an option, a direction, or a note.
    const kind = classifyProse(text);
    /* In a single document, a note under a chant's heading and before its
       first verse is that chant's — not the document's front matter. */
    const sec = current() ?? (single && part !== undefined ? anySection() : null);
    if (inFront || sec === null) {
      /* Before any section: the document's own front matter — the title
         page's lines, the dedication, the instructions for the whole text.
         It used to be dropped, all 13 paragraphs of the sādhanā's. */
      front.push({ kind: kind === 'option' ? 'option' : kind === 'do' ? 'do' : 'note', text: { en: text } });
    } else if (kind === 'source' && entries(sec).length === 0) {
      sec.source = text;
    } else {
      const instr: ChantInstruction = {
        kind: kind === 'option' ? 'option' : kind === 'do' ? 'do' : 'note',
        text: { en: text },
      };
      const last = translated();
      if (last !== undefined) last.instructions = [...(last.instructions ?? []), instr];
      else add({ t: 'instruction', instruction: instr });
    }
    if (p.pageBreak === true) add({ t: 'break' });
  }
  closeVerse();
  flushNote();

  writeTranslations(translations, order);

  const norm = normalize(paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n'));
  report.normalisations = norm.changes;

  const withItems = materialise(sections, order);

  const title = opts.title ?? ownTitle ?? (cover.length > 0 ? cover.join(' ') : opts.fallbackTitle);
  /* A heading is kept though nothing stands under it (`śrī rudranyāsaḥ` then
     its first step at once): dropping it lost its words. */
  const kept = withItems.filter((s) => s.verses.length > 0 || (s.items?.length ?? 0) > 0 || (s.title ?? '') !== '');
  const { sections: marked, register } = registersOf(kept, registers, opts.register ?? null);
  const doc: ChantDoc = {
    title,
    titleForms: { iast: title },
    ...(front.length === 0 ? {} : { instructions: front }),
    sections: marked,
    ...(register === null ? {} : { profile: { preset: register } }),
    ...(single ? {} : { book: true as const }),
    ...(cover.length === 0 ? {} : { cover: { lines: cover } }),
    ...(contentsTitle === undefined ? {} : { contents: { title: contentsTitle } }),
    version: 3,
  };
  return doc;
}
