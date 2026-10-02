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
import { KAMPA_CHAR, kampaOf, openChantDoc } from '@siksamitra/engine';
import {
  SVARA_BY_CHAR, VERSE_END, buildDocument, reportFor, wordRun, type WordParagraph, type WordRun,
} from '@siksamitra/interop';
import { advanceWidth, fitLine, type LineFit } from '@siksamitra/layout';
import {
  MANTRA_ADVANCE, MANTRA_ADVANCE_FALLBACK, MANTRA_LINE_FILL, WORD_PAGE, WORD_PARAGRAPHS,
} from '@siksamitra/tokens/word';
import { MARK_GEOMETRY } from '@siksamitra/tokens/source';
import { cleanLine, groupedBy, layoutOf, numbered, pairedPadas, paragraphsIn, unnumbered, type VerseLayout } from './lines.js';

/*
 * HIS COLUMN, and how wide a line of his may run in it: the width a line
 * that hangs in has (`Translit`: in by its indent, out by its negative right
 * one), at his share of it (`MANTRA_LINE_FILL`). A line the source gives
 * wider is divided evenly, at a word's end (`fitLine`).
 */
const VERSE = WORD_PARAGRAPHS.find((p) => p.role === 'verse-line')!;
const MANTRA_FIT: LineFit = {
  widthOf: advanceWidth(MANTRA_ADVANCE, MANTRA_ADVANCE_FALLBACK, VERSE.size, MARK_GEOMETRY.supScale),
  limit: MANTRA_LINE_FILL * (WORD_PAGE.widthPt - 2 * WORD_PAGE.marginPt - VERSE.indent - VERSE.right),
};

export interface OutlineVerse {
  /** The verse's lines — its pādas or half-verses — as the source has them. */
  readonly lines: readonly string[];
  readonly translation?: string;
  /** What stands above it, a line each: where else it is, its metre, its ṛṣi. */
  readonly note?: string;
  /** False for a verse he leaves without a number: the closing śānti, an optional verse. */
  readonly numbered?: boolean;
  /**
   * A verse some recite and some do not, set as his prastāvanā sets one
   * (sādhanā, its sarasvatī verse of ṚV 5.43.11): "(optional verse)" before
   * its source note, its lines in brackets — `( ā no̍ di̱vo …` to `… śṛ̍ṇotu ॥ )`
   * — and no number. Only with its source known: its note names it.
   */
  readonly optional?: boolean;
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
  /**
   * A remark of his under the name and tradition, in the comment's small
   * grey as body text — krimi saṁhāraka's "The taittirīya āraṇyaka
   * germ-destroying mantra". Shown on the page, where `description` is not.
   */
  readonly remark?: string;
  readonly sections: readonly OutlineSection[];
}

/*
 * A NAME'S NUMBER, RAISED AFTER IT — his Lalitā sahasranāma counts its names
 * so, `śrī mā̍tā¹ śrī̍ mahā̱rājñī²`, in a stotra whose verses are ślokas. The
 * model writes it as a superscript digit after the name, and it goes in as his
 * marker run (`Reference`), which the reader makes the raised `sup` on the
 * name's last letter: never a letter of the mantra.
 */
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const NAME_NUMBER_IN_LINE = /([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/u;
const plainDigits = (s: string): string => [...s].map((c) => String(SUPERSCRIPT.indexOf(c))).join('');

/** A line's runs: the letters plain, each svara character in `Svara`, a name's number in `Reference`. */
export function runsOf(line: string): WordRun[] {
  const runs: WordRun[] = [];
  for (const piece of line.split(NAME_NUMBER_IN_LINE)) {
    if (piece === '') continue;
    if (NAME_NUMBER_IN_LINE.test(piece)) runs.push(wordRun(plainDigits(piece), 'Reference'));
    else runs.push(...lettersRuns(piece));
  }
  return runs;
}

/** A piece of a line without numbers: the letters plain, and each svara character in `Svara`. */
function lettersRuns(line: string): WordRun[] {
  const runs: WordRun[] = [];
  let plain = '';
  /* A kampa — `३̱̍` as a Devanāgarī source gives it, `3̱̍` as his IAST writes
     it — is ONE svara: split mark by mark, it came out `3̱`, the stroke above
     lost, in the manyu sūktam (2026-10-02). */
  for (const piece of line.split(KAMPA_IN_LINE)) {
    const kampa = kampaOf(piece);
    if (kampa !== undefined) {
      if (plain !== '') runs.push(wordRun(plain));
      plain = '';
      runs.push(wordRun(KAMPA_CHAR.get(kampa)!, 'Svara'));
      continue;
    }
    for (const ch of piece) {
    if (SVARA_BY_CHAR.has(ch)) {
      if (plain !== '') runs.push(wordRun(plain));
      plain = '';
      runs.push(wordRun(ch, 'Svara'));
    } else {
      plain += ch;
    }
    }
  }
  if (plain !== '') runs.push(wordRun(plain));
  return runs;
}

/** Where a kampa stands in a line: a digit and its two marks. */
const KAMPA_IN_LINE = /([13१३](?:[\u0331\u0952][\u030d\u0951]|[\u030d\u0951][\u0331\u0952]))/u;

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
  /* A remark is a body paragraph in his comment style, where a source is a
     mantra line's — written AFTER the first section's source line: before it,
     with a subtitle over both, the reader began a section at the source and
     left the first one empty, and a real run was told "5 verse(s) given, 0
     made" (nīla sūktam, 2026-10-02). */
  const remark = (): void => {
    for (const line of (o.remark ?? '').split('\n').map((l) => l.trim()).filter((l) => l !== '')) {
      out.push(para(null, [wordRun(line, 'Comment')]));
    }
  };
  let n = 0;
  const counted = (v: OutlineVerse): boolean => v.numbered !== false && v.optional !== true;
  const total = o.sections.reduce((k, s) => k + [...versesOfFlow(s.flow ?? []), ...s.verses].filter(counted).length, 0);
  o.sections.forEach((s, si) => {
    const headed = s.title !== undefined && s.title.trim() !== '';
    /* Over a headed first section the remark is the text's, above its heading. */
    if (si === 0 && headed) remark();
    if (headed) out.push(para('Heading4', [wordRun(s.title!.trim())]));
    const cite = s.cite ?? (si === 0 ? o.locus : undefined);
    for (const line of (cite ?? '').split('\n').map((l) => l.trim()).filter((l) => l !== '')) {
      out.push(para('Source', [wordRun(line, 'Comment')]));
    }
    if (si === 0 && !headed) remark();
    for (const v of [...versesOfFlow(s.flow ?? []), ...s.verses]) {
      const given = v.lines.map((l, i) => ({ line: cleanLine(l), note: (v.lineNotes?.[i] ?? '').trim() }))
        .filter((x) => x.line !== '');
      /* His short pādas two to a line (`pairedPadas`), unless the outline sets the paragraphs. */
      const pairs = v.paragraphs === undefined
        ? pairedPadas(given.map((x) => x.line), (l) => MANTRA_FIT.widthOf(l) <= MANTRA_FIT.limit)
        : { lines: given.map((x) => x.line), from: given.map((_, i) => [i]) };
      const kept = pairs.from.map((ix, k) => ({ line: pairs.lines[k]!, note: ix.map((i) => given[i]!.note).filter((x) => x !== '').join(' ') }));
      const lines = kept.map((x) => x.line);
      if (lines.length === 0) continue;
      if (counted(v)) n += 1;
      let first = true;
      const tag = (): 'start' | 'more' => { const t = first ? 'start' : 'more'; first = false; return t; };
      const notes = (v.note ?? '').split('\n').map((l) => l.trim()).filter((l) => l !== '');
      /* His optional verse says so first, on its source line. */
      if (v.optional === true) notes[0] = `(optional verse) ${notes[0] ?? ''}`.trim();
      for (const note of notes) {
        out.push(para('Translit', [wordRun(note, 'Comment')], tag()));
      }
      /* Its paragraphs, their lines on soft breaks, its number at the end —
         the verse held together by its tags. */
      const layout = v.layout ?? layoutOf(lines);
      const closed = counted(v) ? numbered(lines, n, total) : unnumbered(lines);
      /* In brackets AFTER its ending: `… śṛ̍ṇotu ॥ )`, as his. */
      const ended = v.optional === true ? bracketed(closed) : closed;
      const groups = groupedBy(ended, v.paragraphs) ?? paragraphsIn(ended, layout);
      let at = 0;
      for (const p of groups) {
        /* A line too wide for his column is divided evenly where it is
           written — its parts soft breaks of its paragraph, hanging in as a
           wrapped line of his does, its note after the last (`fitLine`). */
        out.push(para('Translit', p.flatMap((l, i) => {
          const note = kept[at + i]!.note;
          const parts = fitLine(l, MANTRA_FIT);
          return [
            ...parts.flatMap((part, pi) => [...(i === 0 && pi === 0 ? [] : [wordRun('\n')]), ...runsOf(part)]),
            ...(note === '' ? [] : [wordRun(' '), wordRun(note, 'Comment')]),
          ];
        }), tag()));
        at += p.length;
      }
      /* A translation given a line a pāda goes with its pādas, two to a line too. */
      const said = (v.translation ?? '').split('\n').map((l) => l.trim()).filter((l) => l !== '');
      const t = said.length === given.length ? pairs.from.map((ix) => ix.map((i) => said[i]!).join(' ')) : said;
      const follows = t.length === lines.length ? groupedBy(t, groups.map((g) => g.length)) : undefined;
      for (const p of groupedBy(t, v.translationParagraphs) ?? follows ?? paragraphsIn(t, 'hang')) {
        out.push(para('Prijevod', [wordRun(p.join('\n'))]));
      }
    }
  });
  return out;
}

/*
 * HIS HEADINGS AND HIS SOURCE LINES — what a real run got wrong (nīla sūktam,
 * 2026-10-02): the closing śānti made a section of its own, headed
 * "Śāntipāṭha" over the source line "śāntimantraḥ", and so the first section
 * had to be headed too — "Nīla Sūktam", the title again. His headings are
 * lower case; a heading never repeats the title; a source line names a work
 * and the place in it ("taittirīya saṁhitā 1.5.3" — every one of his does).
 */
const IAST_LETTER = /[āīūṛṝḷḹṃṁḥñṅṇṭḍśṣĀĪŪṚṜḶḸṂṀḤÑṄṆṬḌŚṢ]/u;
const bare = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/gu, '');

/** What is wrong with the outline's headings or source lines, said as he would. */
export function headingFault(o: Outline): string | undefined {
  for (const t of [o.title, ...o.sections.map((s) => s.title ?? '')]) {
    if (IAST_LETTER.test(t) && /(?:^|\s)\p{Lu}/u.test(t)) {
      return `"${t}": his headings are lower case, as his files write them ("${t.toLowerCase()}")`;
    }
  }
  for (const s of o.sections) {
    if ((s.title ?? '').trim() !== '' && bare(s.title!) === bare(o.title)) {
      return `a section headed "${s.title}" repeats the title. A text of one part has no heading of its own, and a closing śānti is the last verse of the last section (numbered: false) — never a section`;
    }
  }
  for (const v of o.sections.flatMap((s) => s.verses)) {
    /* A VERSE OF ONE WORD is the sentence that opens the verse after it or
       closes the one before: the bot made `गृणाहि` a verse of the nīla sūktam
       (2026-10-02), where TITUS opens TS 4.4.12.5 with it, and sanskritdocuments'
       `३७` before it counts fifty words, not verses. */
    const words = v.lines.join(' ').replace(/[।॥|0-9०-९()]/gu, ' ').split(/\s+/u).filter((w) => w !== '');
    if (words.length === 1 && !/^(?:o[mṁṃ]|ओ[ंम्]|ॐ)$/u.test(words[0]!.normalize('NFC').replace(/\p{M}/gu, ''))) {
      return `a verse of one word ("${words[0]}") is the sentence that opens the verse after it or closes the one before — put it with its verse, as the edition's own verse numbers divide them; an edition's running count (sanskritdocuments' ३७, fifty words a pañcāśat) is no verse boundary`;
    }
    /* NO DIGIT, NO DASH IN A MANTRA LINE — its anukramaṇī's too. The bot set
       a modern edition's list as one (`chandaḥ — 1 virāḍjagatī ।2 triṣṭup ।3।6
       …`, the manyu sūktam, 2026-10-02); his anukramaṇī says it in Sanskrit.
       A kampa's numeral, after its vowel, is a svara, not a digit. */
    for (const line of v.lines) {
      /* A verse's own number at its end is the builder's to renumber (`numbered`)… */
      const bare = cleanLine(line).replace(/[aāiīuūṛṝeo][\u0300-\u036f]*[13१३]/gu, '')
        /* …and a source's reference after it, `॥ १०।०८३।०१`: the end's daṇḍas, digits and dots. */
        .replace(/[।॥|][\s0-9०-९।॥|.]*$/u, '');
      if (/[—–]|[0-9०-९]/u.test(bare)) {
        return `"${line.slice(0, 50)}…": a mantra line — its anukramaṇī's too — has no digits and no dashes. His anukramaṇī says a changing metre in Sanskrit: "prathamā dvitīyā caturthīnām ṛcām anuṣṭup । tṛtīyāyāś ca triṣṭup chandasī ॥" (his samāna sūktam); the program numbers the verses`;
      }
    }
    if (v.optional === true && !/[0-9]/u.test(v.note ?? '')) {
      return `an optional verse names where it is from in its note, as his prastāvanā does ("TS 1.8.22. ṚV 5.43.11 - bhaumo'trirṛṣiḥ, viśve devā devatāḥ, triṣṭup chandaḥ") — or it is left out`;
    }
  }
  for (const c of [o.locus, ...o.sections.map((s) => s.cite)]) {
    if (c !== undefined && c.trim() !== '' && !/[0-9]/u.test(c) && c.trim().split(/\s+/u).length < 2) {
      return `"${c}" is no source line: a source line names a work and the place in it ("taittirīya saṁhitā 4.4.12")`;
    }
  }
  return undefined;
}

/** An optional verse's lines in his brackets: `( ` before the first, ` )` after the last. */
export function bracketed(lines: readonly string[]): string[] {
  if (lines.length === 0) return [];
  const out = [...lines];
  out[0] = `( ${out[0]}`;
  out[out.length - 1] = `${out[out.length - 1]} )`;
  return out;
}

/** The document an outline describes, opened. */
export function documentOf(o: Outline): ChantDoc {
  const fault = headingFault(o);
  if (fault !== undefined) throw new Error(fault);
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
