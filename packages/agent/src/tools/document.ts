/**
 * THE DOCUMENT TOOLS — building one, marking it, and the author's edits.
 *
 * Each is a thin call into what the program already does: `documentOf` (the
 * importers' builder), `apply` with an `EditCommand` (a key press), the
 * `recompute` command (Re-apply rules), `setDocField` (the command line's
 * set-field). None decides a mark. The rules mark; the model only says which
 * text, which source, which title.
 *
 * BUILT FROM A SOURCE, A TEXT'S LETTERS ARE THE SOURCE'S. A section names a
 * witness and a range of its lines, and those lines go in as they are — the
 * model never retypes a mantra it has read. Typed lines are for what has no
 * source: a title, a line the person dictated, a correction they asked for.
 */
import { addVerseCommand, removeVerseCommand, setTextCommand, splitLines } from '@siksamitra/edit';
import { CHANT_PROFILE_KEYS, type ChantProfileKey } from '@siksamitra/format';
import { STAGES } from '@siksamitra/engine';
import { documentOf, versesOfFlow, type OutlineSection, type OutlineVerse } from '../build.js';
import { hisJunctions } from '../junctions.js';
import { letterChange, withSourceDandas, withSourceSvaras } from '../letters.js';
import type { VerseLayout } from '../lines.js';
import { outlineOf, type Workspace } from '../workspace.js';
import { arg, opt, params, str, type Tool } from './types.js';

const SOURCE = {
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

function linesOf(ws: Workspace, witness: string, at: string): string[] {
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
    numbered?: boolean; layout?: VerseLayout; lineNotes?: string[]; paragraphs?: number[]; translationParagraphs?: number[];
  }[];
}

type From = { witness: string; at: string };

/**
 * HIS WORD BREAKS, OVER A SOURCE'S LETTERS. A web source runs words together
 * (`bhūmirbhūmnā dyaurvariṇā'ntarikṣam`) where his page separates them
 * (`bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣam`) and marks a junction
 * (`devya-dite`, `agnima-nnādam`). The model may give the lines so, in IAST —
 * and only if every letter and svara is the source's own (`letters.ts` says
 * what that means): the bot never retypes a mantra (2026-10-02).
 */
function spacedOf(lines: readonly string[], spaced: readonly string[] | undefined, where: string): readonly string[] {
  if (spaced === undefined || spaced.length === 0) return lines;
  /* His junctions written out (`junctions.ts`), then the source's svaras and
     its half-line daṇḍas carried onto them (`letters.ts`) — and then held to
     the source's letters. */
  const joined = spaced.map(hisJunctions);
  const marked = withSourceDandas(lines, withSourceSvaras(lines, joined) ?? joined);
  const changed = letterChange(lines, marked);
  if (changed !== null) throw new Error(`${where}, ${changed}`);
  return marked;
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

/** One section of `build_document`, its letters taken from where it says — and, per verse, from where. */
function sectionOf(ws: Workspace, s: SectionArg): { section: OutlineSection; from?: From; verseFrom: (From | undefined)[] } {
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
  const verses: OutlineVerse[] = given.map((v) => {
    const taken = v.witness !== undefined && v.at !== undefined ? linesOf(ws, v.witness, v.at) : (v.lines ?? []);
    const lines = spacedOf(taken, v.spaced, `section "${s.title ?? ''}"`);
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
      ...(v.layout === undefined ? {} : { layout: v.layout }),
      ...(v.lineNotes === undefined || v.lineNotes.every((x) => x.trim() === '') ? {} : { lineNotes: v.lineNotes.map((n) => pageNote(n, `section "${s.title ?? ''}"`)) }),
      ...(v.paragraphs === undefined ? {} : { paragraphs: v.paragraphs }),
      ...(v.translationParagraphs === undefined ? {} : { translationParagraphs: v.translationParagraphs }),
    };
  });
  if (verses.length === 0) throw new Error(`section "${s.title ?? ''}" has no verses — give witness + lines, or verses`);
  const verseFrom = given.map((v) => (v.witness !== undefined && v.at !== undefined ? { witness: v.witness, at: v.at } : undefined));
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
      if (f !== undefined) ws.builtFrom.set(v.id, { ...span(f), ...(input === undefined ? {} : { input }) });
    });
  });
}

/** Every verse of every section (or of one) run by the rules — Re-apply rules, pressed. */
export function markAll(ws: Workspace, mode: 'keep-hand' | 'replace-all', only?: string, previous?: ChantProfileKey): string {
  const doc = ws.need();
  const said: string[] = [];
  for (const s of doc.sections) {
    if (only !== undefined && s.id !== only) continue;
    if (s.verses.length === 0) continue;
    said.push(`${s.id}: ${ws.run({
      k: 'recompute', sectionId: s.id, verseIds: s.verses.map((v) => v.id), stages: STAGES, mode,
      ...(previous === undefined ? {} : { previous }),
    })}`);
  }
  return said.join('\n');
}

/** The rules are not run over an author's text unless the person asked for it. */
function refuseOverAuthor(ws: Workspace, args: Record<string, unknown>): void {
  if (ws.origin === 'author' && args.asked !== true) {
    throw new Error('this text\'s marks are its author\'s (a verified or reference text): the rules are not run over it. '
      + 'Only if the person asked for it to be re-marked, call again with asked: true.');
  }
}

const registerOf = (ws: Workspace, section?: string): ChantProfileKey | undefined => {
  const doc = ws.need();
  const s = section === undefined ? undefined : doc.sections.find((x) => x.id === section);
  return (s?.profile?.preset ?? doc.profile?.preset) as ChantProfileKey | undefined;
};

export const DOCUMENT_TOOLS: readonly Tool[] = [
  {
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
                numbered: { type: 'boolean', description: 'false for a verse he leaves unnumbered: the closing śānti, an optional verse.' },
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
      const built = arg<SectionArg[]>(args, 'sections', 'array').map((s) => sectionOf(ws, s));
      ws.open(documentOf({
        title, ...(subtitle === undefined ? {} : { subtitle }), ...(locus === undefined ? {} : { locus }),
        ...(description === undefined ? {} : { description }),
        ...(remark === undefined ? {} : { remark }),
        sections: built.map((b) => b.section),
      }));
      recordSources(ws, built);
      ws.run({ k: 'profile', scope: 'document', preset: source });
      const marked = markAll(ws, 'keep-hand');
      return `${outlineOf(ws.need())}\n\nmarked by the rules:\n${marked}`;
    },
  },
  {
    writes: true,
    spec: {
      name: 'set_source',
      description: 'Change whose rules mark the document, or one section, and re-mark it: what the old source made is undone first.',
      parameters: params({
        source: SOURCE, section: str('A section id, for that section only.'),
        asked: { type: 'boolean', description: 'true only when the person asked for an author\'s text to be re-marked.' },
      }, ['source']),
    },
    async run(args, { ws }) {
      const source = arg<ChantProfileKey>(args, 'source', 'string');
      const section = opt<string>(args, 'section', 'string');
      refuseOverAuthor(ws, args);
      const was = registerOf(ws, section);
      ws.run(section === undefined
        ? { k: 'profile', scope: 'document', preset: source }
        : { k: 'profile', scope: 'section', sectionId: section, preset: source });
      return markAll(ws, 'keep-hand', section, was);
    },
  },
  {
    writes: true,
    spec: {
      name: 'auto_mark',
      description: 'Run the śikṣā rules over the document or one section. keep-hand keeps marks placed by hand; replace-all lets the rules decide every mark.',
      parameters: params({
        section: str('A section id; all sections when left out.'),
        mode: { type: 'string', enum: ['keep-hand', 'replace-all'] },
        asked: { type: 'boolean', description: 'true only when the person asked for an author\'s text to be re-marked.' },
      }),
    },
    async run(args, { ws }) {
      refuseOverAuthor(ws, args);
      return markAll(ws, (opt<string>(args, 'mode', 'string') ?? 'keep-hand') as 'keep-hand' | 'replace-all', opt<string>(args, 'section', 'string'));
    },
  },
  {
    writes: true,
    spec: {
      name: 'set_field',
      description: 'Set a title, subtitle, section heading or source line, verse number or translation. Paths: title, subtitle, '
        + 'section.<id>.title, section.<id>.source, verse.<id>.n, verse.<id>.translation, verse.<id>.source. value null clears it.',
      parameters: params({ path: str('Which field.'), value: { type: ['string', 'null'] } }, ['path', 'value']),
    },
    async run(args, { ws }) {
      const value = args.value === null ? null : arg<string>(args, 'value', 'string');
      return ws.setField(arg<string>(args, 'path', 'string'), value);
    },
  },
  {
    writes: true,
    spec: {
      name: 'replace_text',
      description: 'Replace a verse\'s letters — only to correct it against a source, or because the person asked. Lines split by "/" or newlines. Run auto_mark after.',
      parameters: params({ verse: str('The verse id.'), text: str('The new text.') }, ['verse', 'text']),
    },
    async run(args, { ws }) {
      const done = setTextCommand(ws.need(), arg<string>(args, 'verse', 'string'), splitLines(arg<string>(args, 'text', 'string')));
      if (!done.ok) throw new Error(done.error);
      return ws.run(done.value);
    },
  },
  {
    writes: true,
    spec: {
      name: 'add_verse',
      description: 'Add a verse to a section, at its end or after a verse. Run auto_mark after.',
      parameters: params({ section: str('The section id.'), text: str('The verse\'s lines, split by "/" or newlines.'), after: str('A verse id.') }, ['section', 'text']),
    },
    async run(args, { ws }) {
      const done = addVerseCommand(ws.need(), arg<string>(args, 'section', 'string'), splitLines(arg<string>(args, 'text', 'string')), opt<string>(args, 'after', 'string'));
      if (!done.ok) throw new Error(done.error);
      return ws.run(done.value);
    },
  },
  {
    writes: true,
    spec: {
      name: 'remove_verse',
      description: 'Take a verse out of its section.',
      parameters: params({ verse: str('The verse id.') }, ['verse']),
    },
    async run(args, { ws }) {
      const done = removeVerseCommand(ws.need(), arg<string>(args, 'verse', 'string'));
      if (!done.ok) throw new Error(done.error);
      return ws.run(done.value);
    },
  },
];
