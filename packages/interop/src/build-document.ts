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
import type { ChantDoc, ChantFigure, ChantItem, ChantProfileKey, ChantSection, ChantVerse } from '@siksamitra/format';
import { normalize } from '@siksamitra/engine';
import { paraRoleOf, roleOf, type WordParaRole } from './word-styles.js';
import type { DocxDrawing } from './docx-figures.js';
import { wordRun, type WordParagraph, type WordRun } from './docx-read.js';
import { tokensFromRuns } from './docx-runs.js';
import type { ImportReport } from './docx-report.js';
import { scriptOfLine } from './word/script-reader.js';
import { partOf } from './word/rule-parts.js';

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
 * PDF's text layer has or the ASCII bars his Word files type — and its number
 * in any script's digits, `॥ १४ ॥` as `॥ 14 ॥`. A SINGLE daṇḍa
 * with no number is the half-verse: it used to close the verse there, so
 * kanakadhārā's 21 ślokas read as 41 and agnimīḻe's 9 as 19.
 */
const VERSE_END = /(?:॥|\|\|)\s*\p{Nd}*\s*(?:॥|\|\|)?\s*$|(?:[।॥]|\|{1,2})\s*\p{Nd}+\s*(?:[।॥]|\|{1,2})?\s*$/u;

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
  /** The part the verse being read is in: its first line's content control. */
  let verseTag: string | undefined;
  /** Which register marks each verse — a Word part's, or none. */
  const registers = new Map<ChantVerse, ChantProfileKey | null>();
  let verseN = 0;

  // Returns the section rather than only assigning it: TypeScript cannot see a
  // closure's assignment, so reads after `if (section === null) newSection()`
  // narrowed to `never`.
  /*
   * THE SHAPE OF THE FILE says what its headings are. A single document — his
   * Śivopāsana, and every file `exportWord` writes — names itself once, in
   * Heading 2, and gives its chants Heading 3 and their steps Heading 4: the
   * three levels the app draws (`ROLE_OF_ELEMENT` in the tokens). A BOOK — his
   * sādhanā — has a title page and many Heading 2 parts, one level more than a
   * document has, and there Heading 2 is the part and Heading 3 and 4 the
   * sections, as before.
   */
  const roles = paragraphs.map((p) => paraRoleOf(p.pStyle));
  const single = !roles.includes('title') && roles.filter((r) => r === 'part').length === 1;

  /* A section nobody headed. A book's takes the book's title, as before; a
     single document's has none, because its name is already its Heading 2
     and a second copy under it would be a heading nobody wrote. */
  const untitled = (): string => (single ? '' : titleNow());

  const newSection = (titleText: string, _role: WordParaRole): ChantSection => {
    const id = `s-${sections.length + 1}`;
    /* No `n`: a number is written as the heading's own text when it has one.
       This used to invent one from the count of sections, and his
       `prathamo'nuvākaḥ` went back out to Word as `18. prathamo'nuvākaḥ`. */
    const made = {
      id,
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
    const sec = current() ?? newSection(untitled(), 'section');
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
    const sec: ChantSection = current() ?? newSection(untitled(), 'section');
    verseN += 1;
    const where = `${sec.id}/v-${verseN}`;
    /* A verse is read in the script it is written in, and its marks with it:
       a Devanāgarī line is the same IAST text and markings as any other. */
    const script = scriptOfLine(verseRuns.map((r) => r.text).join(''));
    const tokens = tokensFromRuns(verseRuns, report, where, script);
    const register = partOf(verseTag)?.register ?? null;
    verseRuns = [];
    verseTag = undefined;
    if (tokens.length === 0) return;
    const verse: ChantVerse = {
      id: `${sec.id}-v${verseN}`,
      n: String(verseN),
      tokens,
      ...(pendingSource !== undefined ? { source: pendingSource } : {}),
    };
    pendingSource = undefined;
    registers.set(verse, register);
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
      if (single && ownTitle === undefined && sections.length === 0 && text !== '') { ownTitle = text; continue; }
      part = text;
      sectionRef = null;
      continue;
    }
    /* In a single document a chant's heading is its PART, as the app keeps it,
       and the steps under it are its sections. */
    if (single && role === 'section') {
      closeVerse();
      part = text === '' ? undefined : text;
      sectionRef = null;
      continue;
    }
    if (role === 'section' || role === 'step') {
      closeVerse();
      if (text !== '') newSection(text, role);
      continue;
    }
    /* A MANTRA-STYLE LINE WRITTEN WHOLLY IN HIS COMMENT STYLE is not a mantra:
       it is the small grey label over one — `śivopāsana mantrāḥ`, `(anuṣṭup
       chandaḥ, 8 syllables per pāda…)` — and read as a verse it had no
       letters and was dropped. It is the next verse's source line. */
    const commentOnly = text !== '' && p.runs.every((r) => r.text.trim() === '' || roleOf(r.rStyle) === 'comment');
    if (role === 'verse-line' && commentOnly) {
      closeVerse();
      pendingSource = pendingSource === undefined ? text : `${pendingSource} ${text}`;
      continue;
    }
    /* So is a plain paragraph wholly in the Comment style, which is how a
       source line is written (`body.ts`): the section's when it opens a
       section that has none yet, else the next verse's. */
    if (role === 'prose' && commentOnly) {
      const sec = current();
      if (sec !== null && sec.verses.length === 0 && sec.source === undefined && pendingSource === undefined) sec.source = text;
      else pendingSource = pendingSource === undefined ? text : `${pendingSource} ${text}`;
      continue;
    }
    if (role === 'verse-line') {
      // Consecutive Translit paragraphs are one verse until a daṇḍa + number
      // closes it — the same grouping the PDF path uses.
      if (verseRuns.length === 0) verseTag = p.sdt;
      verseRuns.push(...p.runs, wordRun('\n'));
      if (VERSE_END.test(text)) closeVerse();
      continue;
    }
    if (role === 'translation') {
      const sec = current();
      const last = sec === null ? undefined : sec.verses[sec.verses.length - 1];
      /* LINE BY LINE, as he writes them: a translation of three lines is
         three paragraphs in his files, one per pāda, and runs on as one block
         when joined with a space. */
      if (last !== undefined && text !== '') {
        last.translation = {
          en: last.translation?.en === undefined ? text : `${last.translation.en}\n${text}`,
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
    /* In a single document, a note under a chant's heading and before its
       first verse is that chant's — not the document's front matter. */
    const sec = current() ?? (single && part !== undefined ? newSection(untitled(), 'section') : null);
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
  const kept = withItems.filter((s) => s.verses.length > 0 || (s.items?.length ?? 0) > 0);
  const { sections: marked, register } = registersOf(kept, registers, opts.register ?? null);
  const doc: ChantDoc = {
    title,
    titleForms: { iast: title },
    ...(front.length === 0 ? {} : { instructions: front }),
    sections: marked,
    ...(register === null ? {} : { profile: { preset: register } }),
    version: 3,
  };
  return doc;
}

/**
 * THE REGISTERS THE PARTS SAID, as the app keeps them: a register every verse
 * of the document was marked in is the DOCUMENT's, and one every verse of a
 * section was is the SECTION's — the shape `exportWord` writes them from, so a
 * document goes out and comes back the same. A verse in a part its section
 * does not share keeps its own. Outside every part, the document's recorded
 * register marks a verse, and when there is none nothing is said: the app's
 * default is the add-in's.
 */
function registersOf(
  sections: readonly ChantSection[], registers: ReadonlyMap<ChantVerse, ChantProfileKey | null>,
  /** What marks a verse in no part: the document's recorded register. */
  outside: ChantProfileKey | null,
): { sections: ChantSection[]; register: ChantProfileKey | null } {
  const of = (v: ChantVerse): ChantProfileKey | null => registers.get(v) ?? outside;
  const shared = (regs: readonly (ChantProfileKey | null)[]): ChantProfileKey | null =>
    (regs.length > 0 && regs.every((r) => r !== null && r === regs[0]) ? regs[0]! : null);
  const whole = shared(sections.flatMap((s) => s.verses.map(of)));
  if (whole !== null) return { sections: [...sections], register: whole };
  return {
    register: null,
    sections: sections.map((s) => {
      const regs = s.verses.map(of);
      const one = shared(regs);
      if (one !== null) return { ...s, profile: { preset: one } };
      if (regs.every((r) => r === null)) return s;
      const verses = s.verses.map((v) => (of(v) === null ? v : { ...v, profile: { preset: of(v)! } }));
      const byId = new Map(verses.map((v) => [v.id, v]));
      return {
        ...s,
        verses,
        ...(s.items === undefined ? {} : {
          items: s.items.map((it) => (it.t === 'verse' ? { t: 'verse' as const, ...(byId.get(it.id) ?? it) } : it)),
        }),
      };
    }),
  };
}
