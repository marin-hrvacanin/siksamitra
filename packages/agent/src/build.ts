/**
 * A DOCUMENT FROM AN OUTLINE — through the one builder every importer uses.
 *
 * The agent says what the document is: its name, its tradition, where it is
 * from, its sections, which lines of which source each verse is. It does not
 * build a `ChantDoc`. The outline is written out as the paragraphs of one of
 * HIS single documents — bhū sūktam v1.1, pūrṇakumbha mantra, sūryopaniṣat,
 * krimi saṁhāraka are the model:
 *
 *   Heading 2   the text's name                    "bhū sūktam"
 *   Heading 3   its tradition, or its other name    "kṛṣṇa yajurvedīya"
 *   Heading 4   a section's title, when the text has sections
 *   Source      where it is from, a line each       "taittirīya saṁhitā 1.5.3"
 *   a comment   above a verse: where else it is, its metre, its ṛṣi
 *               ("Also in maitrāyaṇī saṁhitā 1.7.1.1")
 *   Translit    a verse: ONE paragraph, its lines after the first hanging in
 *               on soft breaks, its number at the end ("॥ 1॥"); a stanza of
 *               four or six pādas a paragraph per half-verse (bhū sūktam 8,
 *               12); a refrain repeated line after line, each line its own
 *               paragraph at the margin (bhū sūktam 11) — `layoutOf`
 *   Prijevod    its translation, under it — by half-verses too, when it has a
 *               line for each of the verse's
 *
 * A note at the END of a line — another reading, "p.b. sūryā̍d (with
 * svarita)", or why a line is there, "required as per taittirīya āraṇyaka
 * 2.11." — is his comment run after the line and its number, as sūryopaniṣat
 * 4 and 13 have them.
 *
 * A verse he does not number — the closing śānti, a verse marked "optional"
 * — ends with the double daṇḍa alone, and the count goes on without it.
 * A source line in the middle of the text, with no heading over it ("taittirīya
 * brāhmaṇam 3.1.2.6" over bhū sūktam 12), begins the verses from that source.
 *
 * — and handed to `buildDocument` in interop, the builder `importDocx` and
 * the PDF reader end in. So a document the agent makes is read exactly as his
 * own files are, and laid out as they are.
 *
 * A SVARA TYPED IN IAST — `a̱gnimī̍ḻe` — is a combining character, and his
 * files carry each one in the `Svara` style. A plain run of them would be read
 * as letters. So each svara character goes into a run of that style here.
 */
import type { ChantDoc } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import {
  SVARA_BY_CHAR, VERSE_END, buildDocument, reportFor, wordRun, type WordParagraph, type WordRun,
} from '@siksamitra/interop';
import { cleanLine, groupedBy, layoutOf, numbered, paragraphsIn, unnumbered, type VerseLayout } from './lines.js';

export interface OutlineVerse {
  /** The verse's lines — its pādas or half-verses — as the source has them. */
  readonly lines: readonly string[];
  readonly translation?: string;
  /** What stands above it, a line each: where else it is, its metre, its ṛṣi. */
  readonly note?: string;
  /** False for a verse he leaves without a number: the closing śānti, an optional verse. */
  readonly numbered?: boolean;
  /** How its lines are set, when his rule (`layoutOf`) would set them otherwise. */
  readonly layout?: VerseLayout;
  /** A note at the end of each line, `''` where it has none: "p.b. sūryā̍d (with svarita)". */
  readonly lineNotes?: readonly string[];
  /** How many of its lines each of his paragraphs holds, when `layout` cannot say it: `[9, 1]`. */
  readonly paragraphs?: readonly number[];
  /** The same for its translation. Unsaid, a translation of a line for each of the
   *  verse's follows the verse's paragraphs, and any other is one paragraph. */
  readonly translationParagraphs?: readonly number[];
}

export interface OutlineSection {
  /** Its own heading — or, for verses from another source, only its `cite`. */
  readonly title?: string;
  /** Where it is from, a line each: "taittirīya saṁhitā 1.5.3". */
  readonly cite?: string;
  readonly verses: readonly OutlineVerse[];
  /**
   * A source's lines as they come, grouped into verses by the source's own
   * numbering — a daṇḍa and a number end a verse. Before `verses`, when both
   * are given.
   */
  readonly flow?: readonly string[];
}

export interface Outline {
  /** The text's name, as his documents write it. His Heading 2. */
  readonly title: string;
  /** Its tradition — "kṛṣṇa yajurvedīya" — or its other name. His Heading 3. */
  readonly subtitle?: string;
  /** Where the whole text is from: the first section's source line when it has none. */
  readonly locus?: string;
  /** What it is, in a line of English — for the website. */
  readonly description?: string;
  readonly sections: readonly OutlineSection[];
}

/** A line's runs: the letters plain, and each svara character in `Svara`. */
export function runsOf(line: string): WordRun[] {
  const runs: WordRun[] = [];
  let plain = '';
  for (const ch of line) {
    if (SVARA_BY_CHAR.has(ch)) {
      if (plain !== '') runs.push(wordRun(plain));
      plain = '';
      runs.push(wordRun(ch, 'Svara'));
    } else {
      plain += ch;
    }
  }
  if (plain !== '') runs.push(wordRun(plain));
  return runs;
}

const para = (pStyle: string | null, runs: WordRun[], ours?: 'start' | 'more'): WordParagraph =>
  ({ pStyle, runs, ...(ours === undefined ? {} : { ours }) });

/** A source's lines, as verses: each ends where the source's own number ends one. */
export function versesOfFlow(flow: readonly string[]): OutlineVerse[] {
  const out: OutlineVerse[] = [];
  let lines: string[] = [];
  for (const l of flow.map((x) => x.trim()).filter((x) => x !== '')) {
    lines.push(l);
    if (VERSE_END.test(l)) { out.push({ lines }); lines = []; }
  }
  if (lines.length > 0) out.push({ lines });
  return out;
}

/** The outline as the paragraphs of one of his single documents. */
export function paragraphsOf(o: Outline): WordParagraph[] {
  const out: WordParagraph[] = [para('Heading2', [wordRun(o.title)])];
  if (o.subtitle !== undefined && o.subtitle.trim() !== '') out.push(para('Heading3', [wordRun(o.subtitle.trim())]));
  let n = 0;
  const counted = (v: OutlineVerse): boolean => v.numbered !== false;
  const total = o.sections.reduce((k, s) => k + [...versesOfFlow(s.flow ?? []), ...s.verses].filter(counted).length, 0);
  o.sections.forEach((s, si) => {
    if (s.title !== undefined && s.title.trim() !== '') out.push(para('Heading4', [wordRun(s.title.trim())]));
    const cite = s.cite ?? (si === 0 ? o.locus : undefined);
    for (const line of (cite ?? '').split('\n').map((l) => l.trim()).filter((l) => l !== '')) {
      out.push(para('Source', [wordRun(line, 'Comment')]));
    }
    for (const v of [...versesOfFlow(s.flow ?? []), ...s.verses]) {
      const kept = v.lines.map((l, i) => ({ line: cleanLine(l), note: (v.lineNotes?.[i] ?? '').trim() }))
        .filter((x) => x.line !== '');
      const lines = kept.map((x) => x.line);
      if (lines.length === 0) continue;
      if (counted(v)) n += 1;
      let first = true;
      const tag = (): 'start' | 'more' => { const t = first ? 'start' : 'more'; first = false; return t; };
      for (const note of (v.note ?? '').split('\n').map((l) => l.trim()).filter((l) => l !== '')) {
        out.push(para('Translit', [wordRun(note, 'Comment')], tag()));
      }
      /* Its paragraphs, their lines on soft breaks, its number at the end —
         the verse held together by its tags. */
      const layout = v.layout ?? layoutOf(lines);
      const ended = counted(v) ? numbered(lines, n, total) : unnumbered(lines);
      const groups = groupedBy(ended, v.paragraphs) ?? paragraphsIn(ended, layout);
      let at = 0;
      for (const p of groups) {
        out.push(para('Translit', p.flatMap((l, i) => {
          const note = kept[at + i]!.note;
          return [...(i === 0 ? [] : [wordRun('\n')]), ...runsOf(l), ...(note === '' ? [] : [wordRun(' '), wordRun(note, 'Comment')])];
        }), tag()));
        at += p.length;
      }
      const t = (v.translation ?? '').split('\n').map((l) => l.trim()).filter((l) => l !== '');
      const follows = t.length === lines.length ? groupedBy(t, groups.map((g) => g.length)) : undefined;
      for (const p of groupedBy(t, v.translationParagraphs) ?? follows ?? paragraphsIn(t, 'hang')) {
        out.push(para('Prijevod', [wordRun(p.join('\n'))]));
      }
    }
  });
  return out;
}

/** The document an outline describes, opened. */
export function documentOf(o: Outline): ChantDoc {
  /* A section after the first stands apart by its heading, or by its own
     source line; one with neither would run into the one before it. */
  const named = (s: OutlineSection): boolean => (s.title ?? '').trim() !== '' || (s.cite ?? '').trim() !== '';
  if (o.sections.length > 1 && o.sections.some((s, i) => (s.title ?? '').trim() === '' && (i === 0 ? false : !named(s)))) {
    throw new Error('a text with more than one section needs a title or a source line for each after the first — or they run together');
  }
  if (o.sections.length > 1 && (o.sections[0]!.title ?? '').trim() === '' && o.sections.slice(1).some((s) => (s.title ?? '').trim() !== '')) {
    throw new Error('the first section needs a title when the others have one');
  }
  const paragraphs = paragraphsOf(o);
  const built = buildDocument(paragraphs, { fallbackTitle: o.title, title: o.title, report: reportFor('docx', 0, paragraphs) });
  /* What the website shows beside the name, and where the text is from. */
  const doc = {
    ...built,
    ...(o.description === undefined || o.description.trim() === '' ? {} : { subtitle: o.description.trim() }),
    ...(o.locus === undefined || o.locus.trim() === '' ? {} : { source: o.locus.trim() }),
  };
  return openChantDoc(doc);
}
