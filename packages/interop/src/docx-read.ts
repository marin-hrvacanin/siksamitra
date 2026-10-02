/**
 * A MINIMAL OOXML READER — `word/document.xml` into paragraphs of runs.
 *
 * Split out of `docx.ts` when that file crossed the 400-line limit
 * `check:modules` holds new code to. The division is the honest one and it was
 * always there in the comments: reading XML into paragraphs is one job and
 * turning paragraphs into a chant is another. Only the first is regular
 * enough to be done with regular expressions.
 *
 * WHY REGULAR EXPRESSIONS AT ALL, in a file format with a schema. Because the
 * subset needed is tiny — paragraphs, runs, their two style attributes, tabs,
 * breaks and drawings — and pulling in an XML parser to read six element names
 * would put a dependency between the owner's documents and this program that
 * nothing here can hold to account. Every pattern that follows is anchored on
 * an element name and a quoted attribute; none of them are trying to be a
 * parser.
 */
import { xmlText } from './xml.js';
import { readDrawings, type DocxDrawing } from './docx-figures.js';
import { builtInStyleIds, canonicalStyleId } from './word/style-names.js';


/** One `<w:r>`: its text, its character style, and whether it is raised. */
export interface WordRun {
  text: string;
  rStyle: string | null;
  superscript: boolean;
  /**
   * Hidden text (`w:vanish`): in the file, and neither drawn nor printed.
   * What a line in an Indic script cannot show is said in a run of it
   * (`word/script-runs.ts`).
   */
  hidden?: true;
}

/** One run, as the reader and every test of it build one. */
export const wordRun = (text: string, rStyle: string | null = null, superscript = false): WordRun =>
  ({ text, rStyle, superscript });

export interface WordParagraph {
  pStyle: string | null;
  runs: WordRun[];
  /** The pictures in this paragraph. Absent when there are none, so every
   *  existing reader of a paragraph sees exactly what it saw before. */
  drawings?: DocxDrawing[];
  /** A self-closing `<w:p/>` — a real, empty paragraph. OOXML allows it, and
   *  the regex the reference counts were first taken with could not see it,
   *  which is the whole of the 845-vs-846 difference. */
  empty?: boolean;
  /**
   * The tag of the innermost BLOCK-level content control the paragraph sits
   * in (`<w:sdt>` around whole paragraphs), when there is one with a tag.
   * Absent otherwise. A content control is Word's own way of marking off a
   * region of a document, and the Word add-in keeps a part's rules on one.
   */
  sdt?: string;
  /** A page break in it (`<w:br w:type="page"/>`) — the page ends here. */
  pageBreak?: true;
  /**
   * Our tag on a mantra paragraph (`body-blocks.ts`): `start` where a verse
   * begins, `more` on its further paragraphs. His files end a verse with its
   * number; ours say where each begins, and an untagged mantra paragraph in a
   * file of ours was typed in Word.
   */
  ours?: 'start' | 'more';
  /** `w:jc`, when the paragraph sets one: his title page is centred. */
  align?: string;
  /** `w:spacing w:before`, in twips, when the paragraph sets it. */
  before?: number;
  /** The paragraph's OWN indent (`w:ind`), in twips, when it sets one: his
   *  verse lines with the hanging indent switched off say `left=0 firstLine=0`. */
  ind?: { left?: number; hanging?: number; firstLine?: number };
}

/**
 * A PARAGRAPH: self-closing FIRST, and the order is the whole point.
 *
 * With the paired form first, `<w:p\b[^>]*>` matched a SELF-CLOSING tag too —
 * `[^>]*` happily eats the `/` in `<w:p w14:paraId="6B1F"/>` — and then
 * `[\s\S]*?<\/w:p>` ran on to the next close and swallowed the paragraph AFTER
 * it as well. Two paragraphs read as one.
 *
 * MEASURED ON HIS OWN FILE: 872 `<w:p` opens against 845 closes, so 27 of his
 * paragraphs are empty and self-closing — and this reader answered 846 while
 * Word answered 872. That is not a cosmetic difference. `readDocument` and
 * `writeDocument` in the Word add-in address paragraphs BY INDEX across two
 * separate reads, so from the first empty paragraph onwards every index was
 * off by one more, and a whole-document re-mark would have written mantra text
 * into the wrong paragraphs of his document. `tools/word-live.mjs` compares
 * the two counts against a real Word now.
 *
 * Self-closing first is exact rather than clever: `[^>]*\/>` can only match a
 * tag that ends in `/>`, and an attribute value cannot contain a `>`.
 */
const RE_PARA = /<w:p\b[^>]*\/>|<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
const RE_RUN = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
const RE_PSTYLE = /<w:pStyle\s+w:val="([^"]*)"/;
/** Where a block content control opens, where it closes, and its tag. */
const RE_SDT = /<w:sdt(?:\s[^>]*)?>|<\/w:sdt>|<w:tag\s+w:val="([^"]*)"\s*\/>/g;
const RE_RSTYLE = /<w:rStyle\s+w:val="([^"]*)"/;
/** The paragraph's own properties, before its first run. */
const RE_PPR = /<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/;
const RE_JC = /<w:jc\s+w:val="([^"]*)"/;
const RE_BEFORE = /<w:spacing\b[^>]*\sw:before="(\d+)"/;
const RE_IND = /<w:ind\b([^>]*?)\/?>/;
const twipsOf = (attrs: string, name: string): number | undefined => {
  const m = new RegExp(`\\sw:${name}="(-?\\d+)"`).exec(attrs);
  return m === null ? undefined : Number(m[1]);
};
/** A run's content, in order: its text, a tab (a space here), a break or a carriage return (a line). */
const RE_CONTENT = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/?>|<w:(?:br|cr)\b[^>]*\/?>/g;

/**
 * Each paragraph's own XML, in the same order `readParagraphs` reads them —
 * one pattern for both, so an index into one is an index into the other.
 */
export function paragraphXml(documentXml: string): string[] {
  return [...documentXml.matchAll(RE_PARA)].map((m) => m[0]);
}

/**
 * Read `word/document.xml` into paragraphs of runs, in DOCUMENT ORDER.
 *
 * Pass the document's `word/styles.xml` (or any package containing it) and a
 * built-in paragraph style comes back under its English id whatever language
 * the Word that wrote it was in — see `word/style-names.ts`. Without it the
 * ids are returned as written.
 */
export function readParagraphs(documentXml: string, stylesXml?: string): WordParagraph[] {
  const table = stylesXml === undefined ? undefined : builtInStyleIds(stylesXml);
  const out: WordParagraph[] = [];
  RE_PARA.lastIndex = 0;
  let m: RegExpExecArray | null;
  /* The content controls open around the paragraph about to be read: what
     lies BETWEEN paragraphs, where a block-level `<w:sdt>` starts and ends.
     One inside a paragraph is inline and inside `m[1]`, never seen here. */
  const open: (string | null)[] = [];
  let seen = 0;
  while ((m = RE_PARA.exec(documentXml)) !== null) {
    RE_SDT.lastIndex = 0;
    const between = documentXml.slice(seen, m.index);
    let e: RegExpExecArray | null;
    while ((e = RE_SDT.exec(between)) !== null) {
      if (e[0].startsWith('</')) open.pop();
      else if (e[0].startsWith('<w:tag')) { if (open.length > 0) open[open.length - 1] = xmlText(e[1] ?? ''); }
      else open.push(null);
    }
    seen = m.index + m[0].length;
    const sdt = [...open].reverse().find((t) => t !== null) ?? undefined;
    const body = m[1] ?? '';
    const selfClosing = m[1] === undefined;
    const pStyle = canonicalStyleId(RE_PSTYLE.exec(body)?.[1] ?? null, table);
    const runs: WordRun[] = [];
    let pageBreak = false;
    RE_RUN.lastIndex = 0;
    let r: RegExpExecArray | null;
    while ((r = RE_RUN.exec(body)) !== null) {
      const rb = r[1] ?? '';
      let text = '';
      /* IN THE ORDER THEY STAND. A run may hold text, a break and more text —
         Word writes `vidmahe |`, the line break and `sa` of the next line into
         one run — and appending the break after all of the run's text moved
         it two letters on: his gāyatrī came back as `vidmahe | sa` / `tya`. */
      RE_CONTENT.lastIndex = 0;
      let t: RegExpExecArray | null;
      while ((t = RE_CONTENT.exec(rb)) !== null) {
        if (t[1] !== undefined) text += xmlText(t[1]);
        /* A PAGE break is not a line: the page ends here, and the paragraph
           says so rather than gaining an empty line. */
        else if (/w:type="page"/.test(t[0])) pageBreak = true;
        /* A tab is a tab: read as a space, the indent he puts before a pāda
           was written back as one. It is one character either way, as Word
           counts it. */
        else text += t[0].startsWith('<w:tab') ? '\t' : '\n';
      }
      runs.push({
        text,
        rStyle: canonicalStyleId(RE_RSTYLE.exec(rb)?.[1] ?? null, table),
        superscript: /vertAlign\s+w:val="superscript"/.test(rb),
        ...(/<w:vanish\s*\/>|<w:vanish\s+w:val="(?:true|1|on)"\s*\/>/.test(rb) ? { hidden: true as const } : {}),
      });
    }
    const drawings = readDrawings(body);
    const ppr = RE_PPR.exec(body)?.[1] ?? '';
    const align = RE_JC.exec(ppr)?.[1];
    const before = RE_BEFORE.exec(ppr)?.[1];
    const indAttrs = RE_IND.exec(ppr)?.[1];
    const left = indAttrs === undefined ? undefined : twipsOf(indAttrs, 'left') ?? twipsOf(indAttrs, 'start');
    const hanging = indAttrs === undefined ? undefined : twipsOf(indAttrs, 'hanging');
    const firstLine = indAttrs === undefined ? undefined : twipsOf(indAttrs, 'firstLine');
    out.push({
      pStyle,
      runs,
      ...(drawings.length === 0 ? {} : { drawings }),
      ...(selfClosing ? { empty: true } : {}),
      ...(sdt === undefined ? {} : { sdt }),
      ...(pageBreak ? { pageBreak: true as const } : {}),
      ...(/<w:bookmarkStart\b[^>]*w:name="_smv/.test(body) ? { ours: 'start' as const }
        : /<w:bookmarkStart\b[^>]*w:name="_smp/.test(body) ? { ours: 'more' as const } : {}),
      ...(align === undefined ? {} : { align }),
      ...(before === undefined ? {} : { before: Number(before) }),
      ...(indAttrs === undefined ? {} : {
        ind: {
          ...(left === undefined ? {} : { left }),
          ...(hanging === undefined ? {} : { hanging }),
          ...(firstLine === undefined ? {} : { firstLine }),
        },
      }),
    });
  }
  return out;
}

/**
 * Merge consecutive runs with the same signature.
 *
 * Word splits a run on revision ids and spell-check state for no semantic
 * reason, so a single styled letter can arrive as four runs. Merging first is
 * what makes the inverse (§ export) stable.
 */
export function mergeRuns(runs: WordRun[]): WordRun[] {
  const out: WordRun[] = [];
  for (const r of runs) {
    if (r.text === '') continue; // an empty run carries nothing to merge
    const last = out[out.length - 1];
    if (last !== undefined && last.rStyle === r.rStyle && last.superscript === r.superscript
      && last.hidden === r.hidden) {
      last.text += r.text;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

