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
import { documentOf, type OutlineSection, type OutlineVerse } from '../build.js';
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
  title: string;
  cite?: string;
  witness?: string;
  lines?: string;
  verses?: { lines?: string[]; witness?: string; at?: string; translation?: string }[];
}

type From = { witness: string; at: string };

/** One section of `build_document`, its letters taken from where it says — and, per verse, from where. */
function sectionOf(ws: Workspace, s: SectionArg): { section: OutlineSection; from?: From; verseFrom: (From | undefined)[] } {
  if (typeof s.title !== 'string') throw new Error('every section needs a title');
  if (s.witness !== undefined && s.lines !== undefined) {
    /* The source's own lines, grouped into verses by its own numbering
       (a daṇḍa and a number end a verse) — the builder's rule for his files. */
    const flow = linesOf(ws, s.witness, s.lines);
    return {
      section: { title: s.title, ...(s.cite === undefined ? {} : { cite: s.cite }), verses: [], flow },
      from: { witness: s.witness, at: s.lines },
      verseFrom: [],
    };
  }
  const given = s.verses ?? [];
  const verses: OutlineVerse[] = given.map((v) => {
    const lines = v.witness !== undefined && v.at !== undefined ? linesOf(ws, v.witness, v.at) : (v.lines ?? []);
    return { lines, ...(v.translation === undefined ? {} : { translation: v.translation }) };
  });
  if (verses.length === 0) throw new Error(`section "${s.title}" has no verses — give witness + lines, or verses`);
  const verseFrom = given.map((v) => (v.witness !== undefined && v.at !== undefined ? { witness: v.witness, at: v.at } : undefined));
  return { section: { title: s.title, ...(s.cite === undefined ? {} : { cite: s.cite }), verses }, verseFrom };
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
      throw new Error(`section "${s.title}": ${b.verseFrom.length} verse(s) given, ${s.verses.length} made — a line inside a verse ends with a daṇḍa and a number; give each verse its own lines`);
    }
    s.verses.forEach((v, j) => {
      const f = b.verseFrom[j];
      if (f !== undefined) ws.builtFrom.set(v.id, span(f));
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
      description: 'Make a new document and mark it by the rules of its source. Each section takes its letters from a '
        + 'witness (witness + lines: the source\'s own lines, grouped into verses by its own verse numbers), or from '
        + 'verses you give (each verse: lines typed, or witness + at). Never retype a text you have a witness for.',
      parameters: params({
        title: str('The document\'s title, as the person would say it.'),
        source: SOURCE,
        sections: {
          type: 'array',
          items: params({
            title: str('The section\'s heading.'),
            cite: str('Where it is from: "Taittirīya Āraṇyaka 3.12", a book, a URL.'),
            witness: str('A witness id (w1…), with lines.'),
            lines: str('Its lines, 1-based inclusive: "12-58".'),
            verses: {
              type: 'array',
              items: params({
                lines: { type: 'array', items: { type: 'string' }, description: 'Typed lines.' },
                witness: str('A witness id, with at.'),
                at: str('Its lines: "12-13".'),
                translation: str('A translation of the verse.'),
              }),
            },
          }, ['title']),
        },
      }, ['title', 'source', 'sections']),
    },
    async run(args, { ws }) {
      const title = arg<string>(args, 'title', 'string');
      const source = arg<ChantProfileKey>(args, 'source', 'string');
      if (!CHANT_PROFILE_KEYS.includes(source)) throw new Error(`source must be one of ${CHANT_PROFILE_KEYS.join(', ')}`);
      const built = arg<SectionArg[]>(args, 'sections', 'array').map((s) => sectionOf(ws, s));
      ws.open(documentOf({ title, sections: built.map((b) => b.section) }));
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
