/**
 * BUILDING A DOCUMENT FROM ITS SOURCES — `build_document`, and the rules every
 * letter the model gives is held to.
 *
 * BUILT FROM A SOURCE, A TEXT'S LETTERS ARE THE SOURCE'S. A section names a
 * witness and a range of its lines, and those lines go in as they are — the
 * model never retypes a mantra it has read. It may give them again with his
 * word breaks (`spaced`), and leave out whole words of the source that are no
 * part of the text; nothing else. Typed lines are for what has no source: a
 * line the person dictated, a correction they asked for.
 */
import { CHANT_PROFILE_KEYS, type ChantProfileKey } from '@siksamitra/format';
import { detectScript, toIast } from '@siksamitra/engine';
import { documentOf, versesOfFlow, type OutlineSection, type OutlineVerse } from '../build.js';
import { hisJunctions } from '../junctions.js';
import { letterChange, withSourceDandas, withSourceSvaras, withWholeKampas, wordsLeftOut } from '../letters.js';
import type { VerseLayout } from '../lines.js';
import { withReadings, type Reading } from '../readings.js';
import { outlineOf, type Workspace } from '../workspace.js';
import { markAll } from './marking.js';
import { arg, opt, params, str, type Tool } from './types.js';

export const SOURCE = {
  type: 'string', enum: [...CHANT_PROFILE_KEYS],
  description: 'Whose rules mark the text: taittiriya (Kṛṣṇa Yajurveda), rigveda, sukla-yajurveda, or smarta (purāṇic, stotras, smṛti).',
};

/** `12-40` or `12` — 1-based and inclusive, as `read_witness` numbers them. */
export function lineRange(at: string, count: number): [number, number] {
  const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(at);
  if (m === null) throw new Error(`"${at}" is not a line range like 12-40`);
  const from = Number(m[1]);
  const to = m[2] === undefined ? from : Number(m[2]);
  if (from < 1 || to < from || to > count) throw new Error(`lines ${at} are outside the witness's 1-${count}`);
  return [from, to];
}

export function linesOf(ws: Workspace, witness: string, at: string): string[] {
  const w = ws.witnesses.get(witness);
  if (w === undefined) throw new Error(`no witness "${witness}" — fetch_page or open a library text first`);
  const [from, to] = lineRange(at, w.lines.length);
  return w.lines.slice(from - 1, to).map((l) => l.trim()).filter((l) => l !== '');
}

interface SectionArg {
  title?: string;
  cite?: string;
  witness?: string;
  lines?: string;
  verses?: {
    lines?: string[]; witness?: string; at?: string; translation?: string; note?: string; spaced?: string[];
    numbered?: boolean; optional?: boolean; layout?: VerseLayout; lineNotes?: string[]; paragraphs?: number[]; translationParagraphs?: number[];
    irregular?: boolean;
    readings?: Reading[];
  }[];
}

/** Where a verse's letters came from — and what of those lines it left out, and whether it is irregular by the edition's own word. */
type From = { witness: string; at: string; left?: readonly string[]; irregular?: true; readings?: readonly Reading[] };

/**
 * HIS WORD BREAKS, OVER A SOURCE'S LETTERS. A web source runs words together
 * (`bhūmirbhūmnā dyaurvariṇā'ntarikṣam`) where his page separates them
 * (`bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣam`) and marks a junction
 * (`devya-dite`, `agnima-nnādam`). The model may give the lines so, in IAST —
 * and only if every letter and svara is the source's own (`letters.ts` says
 * what that means): the bot never retypes a mantra (2026-10-02).
 */
export function spacedOf(source: readonly string[], spaced: readonly string[] | undefined, where: string): { lines: readonly string[]; left: readonly string[] } {
  if (spaced === undefined || spaced.length === 0) return { lines: source, left: [] };
  /* His junctions written out (`junctions.ts`), then the source's svaras and
     its half-line daṇḍas carried onto them (`letters.ts`) — and then held to
     the source's letters. Whole words of the source that are no part of the
     text — a variant beside a line, a table's other column — may be left
     out; then everything runs over the source without them (`wordsLeftOut`). */
  const joined = spaced.map(hisJunctions);
  const carried = (lines: readonly string[]): string[] => withSourceDandas(lines, withSourceSvaras(lines, joined) ?? joined);
  const whole = carried(source);
  if (letterChange(source, whole) === null) return { lines: whole, left: [] };
  const fewer = wordsLeftOut(source, joined);
  const marked = fewer === null ? whole : carried(fewer.kept);
  const changed = letterChange(fewer?.kept ?? source, marked);
  if (changed !== null) {
    throw new Error(`${where}, ${letterChange(source, whole) ?? changed} — if the source itself has the word wrong, give it as another witness has it: `
      + 'readings: [{ source, read, witness }]');
  }
  return { lines: marked, left: fewer?.left ?? [] };
}

/**
 * A NOTE IS HIS PAGE'S, NEVER THE WORK'S. His pages state their one source and
 * print no apparatus (AUTHORING-CHANTS §5G: "the comparisons live in the
 * generator … and nowhere else"); a real run printed "vignanam: abhī̎hi (with
 * dīrgha svarita)" over a pāda of the manyu sūktam (2026-10-02). A note that
 * names a website or a witness is refused, so the page cannot carry one.
 */
const WORKING_NOTE = /\b(?:vignanam|sanskritdocuments|vishvasa|wikisource|wisdomlib|gretil|titus|vedavid|witness|witnesses|website|the page|the source has|https?|www)\b|\.(?:org|com|net|in)\b/iu;
function pageNote(note: string, where: string): string {
  if (WORKING_NOTE.test(note)) {
    throw new Error(`${where}: "${note.slice(0, 60)}" names a website or a witness — his pages state their one source and print no comparison between sources; leave it out`);
  }
  return note;
}

/**
 * LETTERS THE MODEL TYPES, AS THE DOCUMENT HOLDS THEM: IAST. A line in an
 * Indic script is read into IAST by the program's own reader — the reader the
 * builder uses — and never left as it is: a real run corrected a verse with
 * `replace_text` in Devanāgarī, and the PDF carried a Devanāgarī verse in an
 * IAST text (2026-10-02). Two scripts in one line is no line at all.
 */
export function asTyped(lines: readonly string[]): string[] {
  return lines.map((line) => {
    const script = detectScript(line);
    if (script === 'mixed') throw new Error(`"${line.slice(0, 40)}…" mixes two scripts — give it in one, IAST or Devanāgarī`);
    if (script === 'iast' || script === 'unknown') return line;
    /* A Latin letter beside the Indic ones is a line half-transliterated by hand. */
    if (/[a-zA-Zāīūṛṝḷṅñṇṭḍśṣṁḥ]/u.test(line)) throw new Error(`"${line.slice(0, 40)}…" mixes IAST and another script — give it in one`);
    return toIast(line, script).iast.normalize('NFC');
  });
}

/** One section of `build_document`, its letters taken from where it says — and, per verse, from where. */
function sectionOf(ws: Workspace, s: SectionArg, source?: ChantProfileKey): { section: OutlineSection; from?: From; verseFrom: (From | undefined)[] } {
  const title = typeof s.title === 'string' && s.title.trim() !== '' ? { title: s.title } : {};
  if (s.witness !== undefined && s.lines !== undefined) {
    /* The source's own lines, grouped into verses by its own numbering
       (a daṇḍa and a number end a verse) — the builder's rule for his files. */
    const flow = linesOf(ws, s.witness, s.lines);
    return {
      section: { ...title, ...(s.cite === undefined ? {} : { cite: s.cite }), verses: [], flow },
      from: { witness: s.witness, at: s.lines },
      verseFrom: [],
    };
  }
  const given = s.verses ?? [];
  const left: (readonly string[])[] = [];
  const verses: OutlineVerse[] = given.map((v) => {
    const read = v.witness !== undefined && v.at !== undefined ? linesOf(ws, v.witness, v.at) : asTyped(v.lines ?? []);
    /* A word the base edition has wrong, as another witness has it (`readings.ts`). */
    const taken = v.readings === undefined || v.readings.length === 0 ? read : withReadings(read, v.readings, ws.witnesses, v.witness);
    const given1 = spacedOf(taken, v.spaced, `section "${s.title ?? ''}"`);
    left.push(given1.left);
    const spaced = given1.lines;
    /* A Ṛgveda source's bare kampa, written whole (`withWholeKampas`). */
    const lines = source === 'rigveda' ? spaced.map(withWholeKampas) : spaced;
    /* A verse given is ONE verse: lines that the source's own numbering makes
       two (a line inside ends with a daṇḍa and a number) are refused. */
    const made = versesOfFlow(lines).length;
    if (made > 1) {
      throw new Error(`section "${s.title ?? ''}": 1 verse(s) given, ${made} made — a line inside a verse ends with a daṇḍa and a number; give each verse its own lines`);
    }
    return {
      lines,
      ...(v.translation === undefined ? {} : { translation: v.translation }),
      ...(v.note === undefined || v.note.trim() === '' ? {} : { note: pageNote(v.note, `section "${s.title ?? ''}"`) }),
      ...(v.numbered === false ? { numbered: false } : {}),
      ...(v.optional === true ? { optional: true } : {}),
      ...(v.layout === undefined ? {} : { layout: v.layout }),
      ...(v.lineNotes === undefined || v.lineNotes.every((x) => x.trim() === '') ? {} : { lineNotes: v.lineNotes.map((n) => pageNote(n, `section "${s.title ?? ''}"`)) }),
      ...(v.paragraphs === undefined ? {} : { paragraphs: v.paragraphs }),
      ...(v.translationParagraphs === undefined ? {} : { translationParagraphs: v.translationParagraphs }),
    };
  });
  if (verses.length === 0) throw new Error(`section "${s.title ?? ''}" has no verses — give witness + lines, or verses`);
  const verseFrom = given.map((v, i): From | undefined => (v.witness !== undefined && v.at !== undefined
    ? {
      witness: v.witness, at: v.at, ...(left[i]!.length === 0 ? {} : { left: left[i] }), ...(v.irregular === true ? { irregular: true as const } : {}),
      ...(v.readings === undefined || v.readings.length === 0 ? {} : { readings: v.readings }),
    }
    : undefined));
  return { section: { ...title, ...(s.cite === undefined ? {} : { cite: s.cite }), verses }, verseFrom };
}

/** Which witness lines each section, or each verse, was built from — what `check` compares. */
function recordSources(ws: Workspace, built: ReturnType<typeof sectionOf>[]): void {
  const span = (f: From) => {
    const [a, b] = lineRange(f.at, ws.witnesses.get(f.witness)!.lines.length);
    return { witness: f.witness, from: a, to: b };
  };
  ws.need().sections.forEach((s, i) => {
    const b = built[i];
    if (b === undefined) return;
    if (b.from !== undefined) { ws.builtFrom.set(s.id, span(b.from)); return; }
    /* A verse given is a verse made, or the builder split one: a line inside
       it ends with a verse's number, which closes a verse in his files. */
    if (s.verses.length !== b.verseFrom.length) {
      throw new Error(`section "${s.title ?? s.id}": ${b.verseFrom.length} verse(s) given, ${s.verses.length} made — a line inside a verse ends with a daṇḍa and a number; give each verse its own lines`);
    }
    s.verses.forEach((v, j) => {
      const f = b.verseFrom[j];
      const input = b.section.verses[j]?.lines;
      if (f !== undefined) {
        ws.builtFrom.set(v.id, {
          ...span(f), ...(input === undefined ? {} : { input }),
          ...(f.left === undefined ? {} : { left: f.left }), ...(f.irregular === undefined ? {} : { irregular: f.irregular }),
          ...(f.readings === undefined ? {} : { readings: f.readings }),
        });
      }
    });
  });
}

export const BUILD_TOOL: Tool = {
    writes: true,
    spec: {
      name: 'build_document',
      description: 'Make a new document, laid out as his own — the name; under it the tradition; the source line; each '
        + 'verse with its translation under it — and mark it by the rules of its source. Each section takes its letters '
        + 'from a witness (witness + lines: the source\'s own lines, grouped into verses by its own verse numbers), or '
        + 'from verses you give (each verse: witness + at, or lines typed). Never retype a text you have a witness for. '
        + 'The source\'s own reference numbers are taken off, and each verse is numbered as he numbers his (॥ 1॥). '
        + 'Names and loci in lower-case IAST, as he writes them: "puruṣa sūktam", "ṛgvedasaṁhitā 10.90".',
      parameters: params({
        title: str('The text\'s name: "bhū sūktam".'),
        subtitle: str('Under the name: its tradition ("kṛṣṇa yajurvedīya", "ṛgvedīya", "śukla yajurvedīya") or its other name ("saṁnyāsa sūktam").'),
        locus: str('Where it is from: "taittirīya saṁhitā 1.5.3", "ṛgvedasaṁhitā 10.129" — the source line above the verses.'),
        description: str('What it is, in one line of English: "The hymn of creation". For the website; not shown on the page.'),
        remark: str('Only when his page would carry one: a remark under the name, shown in small grey ("The taittirīya āraṇyaka germ-destroying mantra").'),
        source: SOURCE,
        sections: {
          type: 'array',
          items: params({
            title: str('The section\'s own heading — only when the text has more than one section ("prathamo\'nuvākaḥ").'),
            cite: str('That section\'s own source line, when it differs from the locus. Verses from another source, with no heading of their own, are a section with only a cite ("taittirīya brāhmaṇam 3.1.2.6").'),
            witness: str('A witness id (w1…), with lines.'),
            lines: str('Its lines, 1-based inclusive: "12-58".'),
            verses: {
              type: 'array',
              items: params({
                lines: { type: 'array', items: { type: 'string' }, description: 'Typed lines.' },
                witness: str('A witness id, with at.'),
                at: str('Its lines: "12-13".'),
                spaced: {
                  type: 'array', items: { type: 'string' },
                  description: 'The same lines in IAST with his word breaks: a space between words, a hyphen where a word\'s last consonant '
                    + 'joins the next word\'s vowel ("devya-dite", "agnima-nnādam"), an apostrophe where two vowels merged ("variṇā\'ntarikṣam"). '
                    + 'Every letter and svara must be the source\'s own — the program checks, and refuses any change.',
                },
                translation: str('Its translation, in English: a line for each of its lines.'),
                note: str('A line above the verse, when it has one: "Also in maitrāyaṇī saṁhitā 1.7.1.1", "optional", its metre, its ṛṣi.'),
                numbered: { type: 'boolean', description: 'false for a verse he leaves unnumbered: the closing śānti.' },
                readings: {
                  type: 'array',
                  items: params({
                    source: str('The word as the base edition has it, as read_witness with iast: true shows it.'),
                    read: str('The word as it is read.'),
                    witness: str('The OTHER witness that has it, letter for letter: w2…'),
                  }, ['source', 'read', 'witness']),
                  description: 'Only where the base edition has a word wrong — a typo, a letter dropped — and another witness has it right: '
                    + 'the program checks that witness has the word, puts it in, and tells the reviewer.',
                },
                irregular: { type: 'boolean', description: 'true only when the edition itself has this verse outside its metre (a line more or less) — the proof then says nothing of its metre.' },
                optional: { type: 'boolean', description: 'true for a verse some recite and some do not — only when more than one verified edition has it and its source is known (its note names it): set as his prastāvanā sets one, "(optional verse)" before the note, its lines in brackets, unnumbered.' },
                paragraphs: {
                  type: 'array', items: { type: 'integer' },
                  description: 'Only when his page sets it otherwise than layout says: how many lines each of its paragraphs holds, [9, 1].',
                },
                translationParagraphs: { type: 'array', items: { type: 'integer' }, description: 'The same for the translation.' },
                lineNotes: {
                  type: 'array', items: { type: 'string' },
                  description: 'A short note at the end of a line, one per line ("" for none): another source\'s reading, '
                    + '"p.b. sūryā̍d (with svarita)", or why a line is there, "required as per taittirīya āraṇyaka 2.11.".',
                },
                layout: {
                  type: 'string', enum: ['hang', 'halves', 'flush'],
                  description: 'Only to override his rule: hang = one paragraph, lines after the first hanging in (a verse of two lines, prose); '
                    + 'halves = a paragraph per half-verse (a stanza of four or six pādas, the default for one); flush = each line at the margin (a refrain).',
                },
              }),
            },
          }),
        },
      }, ['title', 'source', 'sections']),
    },
    async run(args, { ws }) {
      const title = arg<string>(args, 'title', 'string');
      const locus = opt<string>(args, 'locus', 'string');
      const subtitle = opt<string>(args, 'subtitle', 'string');
      const description = opt<string>(args, 'description', 'string');
      const remark = opt<string>(args, 'remark', 'string');
      const source = arg<ChantProfileKey>(args, 'source', 'string');
      if (!CHANT_PROFILE_KEYS.includes(source)) throw new Error(`source must be one of ${CHANT_PROFILE_KEYS.join(', ')}`);
      const built = arg<SectionArg[]>(args, 'sections', 'array').map((s) => sectionOf(ws, s, source));
      ws.open(documentOf({
        title, ...(subtitle === undefined ? {} : { subtitle }), ...(locus === undefined ? {} : { locus }),
        ...(description === undefined ? {} : { description }),
        ...(remark === undefined ? {} : { remark }),
        sections: built.map((b) => b.section),
      }));
      recordSources(ws, built);
      ws.run({ k: 'profile', scope: 'document', preset: source });
      const marked = markAll(ws, 'keep-hand');
      /* What each verse left out of its lines, said — the reviewer is told it too. */
      const left = ws.need().sections.flatMap((s) => s.verses.flatMap((v) => {
        const f = ws.builtFrom.get(v.id);
        return f?.left === undefined ? [] : [`${v.id} leaves out of ${f.witness} ${f.from}-${f.to}: ${f.left.map((w) => `“${w}”`).join(' ')}`];
      }));
      return `${outlineOf(ws.need())}\n\nmarked by the rules:\n${marked}${left.length === 0 ? '' : `\n\nleft out, as no part of the text:\n${left.join('\n')}`}`;
    },
  };
