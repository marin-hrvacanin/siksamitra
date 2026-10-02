/**
 * WHERE A TEXT COMES FROM, AND READING WHAT IS OPEN.
 *
 * The library first: the verified corpus and the owner's own files, which
 * are already checked. Then the web, page by page, each page kept as a
 * WITNESS with numbered lines, so a document can be built from its lines and
 * checked against them.
 *
 * A PAGE IS NEVER HANDED OVER WHOLE. `fetch_page` answers where the Indic
 * text is on it — which lines are Devanāgarī, which IAST — and how each
 * stretch begins; `read_witness` reads the lines asked for. A sūkta's page is
 * a few hundred lines of menus and notes around fifty of mantra, and paying
 * for the menus on every later call of the turn is what this avoids.
 */
import type { ChantDoc } from '@siksamitra/format';
import { toIast } from '@siksamitra/engine';
import { asIast } from '../letters.js';
import { KIND_SAID, kindOfPage, passageOf } from '../pages.js';
import { isItransPage, readItrans } from '../itrans-page.js';
import { fold } from '../library.js';
import { outlineOf, verseLetters, versesOf, type Witness, type Workspace } from '../workspace.js';
import { arg, opt, params, str, type Tool } from './types.js';

/* Devanāgarī LETTERS — not the daṇḍas and digits an IAST line has too: a
   romanised page with daṇḍas was reported to the model as Devanāgarī. */
const DEVA = /[\u0900-\u0963\u0970-\u097F]/u;
const IAST = /[āīūṛṝḷṁṃḥśṣṇṭḍñṅ]/u;

/** A stretch of a page's lines in one script. */
export interface Block { readonly from: number; readonly to: number; readonly script: 'Devanāgarī' | 'IAST'; readonly start: string }

/** Where the Indic text is on a page: stretches of at least `min` lines, blank lines bridged. */
export function blocksOf(lines: readonly string[], min = 2): Block[] {
  const kind = (l: string): 'Devanāgarī' | 'IAST' | null => (DEVA.test(l) ? 'Devanāgarī' : IAST.test(l) ? 'IAST' : null);
  const out: Block[] = [];
  let open: { from: number; to: number; script: 'Devanāgarī' | 'IAST'; count: number } | null = null;
  const close = (): void => {
    if (open !== null && open.count >= min) {
      out.push({ from: open.from, to: open.to, script: open.script, start: lines[open.from - 1]!.trim().slice(0, 60) });
    }
    open = null;
  };
  lines.forEach((l, i) => {
    if (l.trim() === '') return;
    const k = kind(l);
    if (k === null) { close(); return; }
    if (open !== null && open.script === k) { open.to = i + 1; open.count += 1; return; }
    close();
    open = { from: i + 1, to: i + 1, script: k, count: 1 };
  });
  close();
  return out;
}

const MAX_LINES = 150;

/**
 * A line as letters only, for finding: Devanāgarī read into IAST, then the
 * diacritics, accents, punctuation, numbers and spaces taken away — so
 * "tat savitur", "तत्स॑वि॒तुर्" and "tatsavitur" all find the same line.
 */
export const lettersKey = (line: string): string => {
  const iast = DEVA.test(line) ? toIast(line, 'deva').iast : line;
  return fold(iast).replace(/[^a-z]/g, '');
};

/** Where a phrase is in a witness: each line it starts on, a line and the next searched together. */
export function findLines(w: Witness, query: string, max = 12): number[] {
  const want = lettersKey(query);
  if (want.length < 3) return [];
  const keys = w.lines.map(lettersKey);
  const out: number[] = [];
  for (let i = 0; i < keys.length && out.length < max; i += 1) {
    /* The line a match STARTS on: one wholly inside the next line is that line's. */
    const at = (keys[i]! + (keys[i + 1] ?? '')).indexOf(want);
    if (at !== -1 && at < keys[i]!.length) out.push(i + 1);
  }
  return out;
}

/**
 * A ROMANISATION OF ITS OWN, said when the page is read. vignanam's "English"
 * pages write ch for c — its `rōcha̠nā` is IAST `rocanā` — and no fold can
 * undo that, because ch is an IAST letter too (छ): a real run built from one
 * had its `ca` refused against the page's `cha`, twice (2026-10-02). Said, so
 * that a Devanāgarī witness is built from instead.
 */
function ownRomanisation(lines: readonly string[], blocks: readonly Block[]): string {
  const text = blocks.filter((b) => b.script === 'IAST').flatMap((b) => lines.slice(b.from - 1, b.to)).join(' ').normalize('NFC');
  const ch = (text.match(/ch/gu) ?? []).length;
  const c = (text.match(/c(?!h)/gu) ?? []).length;
  if (ch === 0 || c > 0) return '';
  const also = /[ēō]/u.test(text) ? ', and ē, ō for e, o' : '';
  return `\nits romanisation is its own, not IAST (ch for c${also}): build from a Devanāgarī witness, read with iast: true`;
}

/**
 * HOW MUCH ONE REQUEST MAY READ OF THE WEB. The prompt asks for the best two
 * independent sources; a real run read eleven pages after seven searches and
 * never delivered. So the tools themselves say when it is enough — and what
 * there is to build from.
 */
export const RESEARCH = { searches: 4, pages: 5 } as const;

/* Said so that it is not asked again: a real run, told once, fetched three
   more pages and was told three more times (2026-10-02). */
const enough = (ws: Workspace, what: 'searches' | 'pages'): string => {
  const kept = [...ws.witnesses.values()].map((w) => `${w.id} "${w.title}"`).join(', ');
  return `enough ${what} for this request (${what === 'pages' ? RESEARCH.pages : RESEARCH.searches}) — every further `
    + `${what === 'pages' ? 'fetch_page' : 'web_search'} is refused, however it is asked: `
    + (kept === '' ? 'tell the person what you could not find.' : `build now from what you have read — ${kept} — or tell the person what is missing.`);
};

/**
 * A DOCUMENT OF HIS, AS ITS SHAPE: each part and heading, its source line,
 * how many verses and whether they are numbered, the first line of each part.
 * What a real run never saw (2026-10-02): it read four verses of an example
 * and set a stotra's viniyoga, nyāsa and dhyāna as numbered verses of one
 * section, where his are each a part under its heading, unnumbered.
 */
export function structureOf(doc: ChantDoc, sections = 40): string {
  const out = [`AN EXAMPLE, not the document — the structure of "${doc.title}"${doc.subtitle === undefined ? '' : ` · ${doc.subtitle}`}${typeof doc.source === 'string' ? ` · ${doc.source}` : ''}:`];
  for (const s of doc.sections.slice(0, sections)) {
    const head = [s.part, s.title].filter((x) => typeof x === 'string' && x.trim() !== '').join(' › ') || '(no heading)';
    const numbered = s.verses.filter((v) => /॥\s*[0-9.]+\s*॥\s*$/u.test(verseLetters(v, { prose: false }).trim().split('\n').at(-1)?.trim() ?? '')).length;
    const first = s.verses[0] === undefined ? '' : verseLetters(s.verses[0], { prose: false, names: true }).split('\n')[0]!.slice(0, 70);
    out.push(`${s.id} ${head}${typeof s.source === 'string' && s.source.trim() !== '' ? ` · ${s.source.split('\n')[0]!.slice(0, 80)}` : ''}`
      + ` — ${s.verses.length} verse(s), ${numbered === 0 ? 'unnumbered' : numbered === s.verses.length ? 'numbered' : `${numbered} numbered`}`
      + `${first === '' ? '' : `: “${first}…”`}`);
  }
  if (doc.sections.length > sections) out.push(`… and ${doc.sections.length - sections} more section(s)`);
  out.push('read_example with section: "s-9" to read a part in full, or verses: "1-4".');
  return out.join('\n');
}

export const SOURCE_TOOLS: readonly Tool[] = [
  {
    writes: false,
    spec: { name: 'outline', description: 'The open document: its title, source, sections and the first words of each verse, with their ids.', parameters: params({}) },
    async run(_args, { ws }) { return outlineOf(ws.need()); },
  },
  {
    writes: false,
    spec: {
      name: 'read_verses',
      description: 'Verses of the open document in full: the letters as typed, with svaras, and what the rules marked on them.',
      parameters: params({ verses: { type: 'array', items: { type: 'string' } }, section: str('A section id: all its verses.') }),
    },
    async run(args, { ws }) {
      return versesOf(ws.need(), opt<string[]>(args, 'verses', 'array'), opt<string>(args, 'section', 'string'));
    },
  },
  {
    writes: false,
    needs: 'library',
    spec: {
      name: 'find_text',
      description: 'Look for a text in the library: the verified corpus and his own documents. Each is shown with its tradition, its locus and its FIRST WORDS — what tells the text asked for from a namesake.',
      parameters: params({ query: str('A title or a few words: "puruṣa sūktam", "rudram", "durgā".') }, ['query']),
    },
    async run(args, { host }) {
      const hits = await host.library!.find(arg<string>(args, 'query', 'string'));
      if (hits.length === 0) return 'nothing in the library matches — search the web';
      return hits.slice(0, 12).map((h) => `${h.id} · ${h.title} · ${h.kind === 'verified' ? 'verified' : 'his own'}`
        + `${h.source === undefined ? '' : ` · ${h.source}`}${h.note === undefined ? '' : ` · ${h.note}`}`
        + `${h.first === undefined ? '' : ` · begins "${h.first}"`}`).join('\n');
    },
  },
  {
    writes: true,
    needs: 'library',
    spec: {
      name: 'open_text',
      description: 'Open a library text as the document to work on (replaces what is open).',
      parameters: params({ id: str('Its id from find_text.') }, ['id']),
    },
    async run(args, { ws, host }) {
      const id = arg<string>(args, 'id', 'string');
      const { doc } = await host.library!.load(id);
      /* Verified or his own: its marks are its author's, kept as they are. */
      ws.open(doc, 'author');
      ws.opened = { id, doc: ws.need() };
      return `${outlineOf(ws.need())}\n\n(its marks are its author's: deliver it as it is; the rules are not run over it unless the person asks)`;
    },
  },
  {
    writes: false,
    needs: 'library',
    spec: {
      name: 'read_example',
      description: 'Read a library text — one of his own documents best — as an EXAMPLE of how he sets such a text. Without verses: its WHOLE '
        + 'STRUCTURE — each part and heading, its source line, how many verses, whether they are numbered, the first line of each — to set '
        + 'yours the same way. With section: that part of it in full (its id from the structure: "s-9"). With verses: those verses in full, '
        + 'his word breaks, lines and translations. It is NOT opened as the document, and nothing of it is delivered.',
      parameters: params({
        id: str('Its id from find_text.'),
        section: str('One of its sections, by the id its structure gives ("s-9"): read in full, at most eight verses.'),
        verses: str('Which of its verses, as 1-4 — at most eight. Left out, with no section: its structure.'),
      }, ['id']),
    },
    async run(args, { host }) {
      /* AN EXAMPLE CANNOT BE SENT. Read here and never opened, so the document
         the person gets is the one the agent built — his own concern: "I don't
         want it to misinterpret something as being found in the library and
         send something wrong, but it is nice as an example" (2026-10-02). */
      const { doc } = await host.library!.load(arg<string>(args, 'id', 'string'));
      const all = doc.sections.flatMap((s) => s.verses.map((v) => ({ s, v })));
      if (all.length === 0) return 'it has no verses to show';
      const asked = opt<string>(args, 'verses', 'string');
      const part = opt<string>(args, 'section', 'string');
      if (part !== undefined) {
        const at = all.findIndex((x) => x.s.id === part);
        if (at < 0) throw new Error(`no section "${part}" in it — its structure (read_example without section) names them`);
      }
      if (asked === undefined && part === undefined) return structureOf(doc);
      /* As much of the range as the text has: an example is read, not cited. */
      const first = part === undefined ? undefined : all.findIndex((x) => x.s.id === part) + 1;
      const spec = asked ?? `${first}-${first! + all.filter((x) => x.s.id === part).length - 1}`;
      const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/u.exec(spec);
      if (m === null) throw new Error(`"${spec}" is not a range of verses like 1-4`);
      const a = Math.min(Math.max(1, Number(m[1])), all.length);
      const b = Math.min(all.length, Math.max(a, Number(m[2] ?? m[1])), a + 7);
      const head = [doc.subtitle, doc.source].filter((x) => typeof x === 'string' && x.trim() !== '').join(' · ');
      const out = [`AN EXAMPLE, not the document: "${doc.title}"${head === '' ? '' : ` · ${head}`} — verses ${a}-${b} of ${all.length}`];
      let section: string | null = null;
      for (const { s, v } of all.slice(a - 1, b)) {
        if (s.id !== section) {
          section = s.id;
          const named = [s.title, s.source].filter((x) => typeof x === 'string' && x.trim() !== '').join(' · ');
          if (named !== '') out.push(`[${named}]`);
        }
        for (const line of verseLetters(v).split('\n')) out.push(`  ${line}`);
        if (v.translation?.en !== undefined) out.push(`  — ${v.translation.en.replace(/\n/g, ' / ')}`);
      }
      return out.join('\n');
    },
  },
  {
    writes: false,
    needs: 'research',
    spec: {
      name: 'web_search',
      description: 'Search the web. For a Vedic or purāṇic text prefer scholarly and traditional sources: sanskritdocuments.org, GRETIL, TITUS, vedavid.org, a printed edition.',
      parameters: params({ query: str('What to look for.') }, ['query']),
    },
    async run(args, { ws, host }) {
      if (ws.spent.searches >= RESEARCH.searches) return enough(ws, 'searches');
      ws.spent.searches += 1;
      const hits = await host.research!.search(arg<string>(args, 'query', 'string'));
      if (hits.length === 0) return 'no results';
      return hits.slice(0, 8).map((h, i) => `${i + 1}. ${h.title}\n   ${h.url}\n   ${h.snippet.slice(0, 160)}`).join('\n');
    },
  },
  {
    writes: false,
    needs: 'research',
    spec: {
      name: 'fetch_page',
      description: 'Fetch a page and keep it as a witness. Answers its id, WHAT KIND of page it is — a scholarly edition, a collection, a devotional compilation, '
        + 'machine-written commentary — and where on it the Devanāgarī and IAST text is; read those lines with read_witness.',
      parameters: params({
        url: str('The page.'),
        find: str('For a WHOLE EDITION (a saṁhitā, brāhmaṇa or āraṇyaka of many MB): the passage\'s first words, in any script — the whole of it is read, and only the lines around them are kept.'),
      }, ['url']),
    },
    async run(args, { ws, host }) {
      const url = arg<string>(args, 'url', 'string');
      const find = opt<string>(args, 'find', 'string');
      /* A page asked for again is the one already read, and costs nothing: a
         real run read a TITUS frame page three times, and its budget with it. */
      const asked = `${url}#${find ?? ''}`;
      const again = ws.fetched.get(asked);
      if (again !== undefined && ws.witnesses.has(again)) return `${again} is that page, already read — read_witness or find_in_witness it`;
      if (ws.spent.pages >= RESEARCH.pages) return enough(ws, 'pages');
      /* Counted when a page comes back: one that fails — a PDF, a 404 — cost nothing but its step. */
      const page = await host.research!.fetch(url, find === undefined ? undefined : { large: true });
      ws.spent.pages += 1;
      /* An ITRANS file — sanskritdocuments' `.itx`, the source of its pages — read into IAST, a line for a line. */
      const raw = page.text.split(/\r?\n/);
      const itrans = isItransPage(url, raw.slice(0, 40));
      let lines: readonly string[] = itrans ? readItrans(raw) : raw;
      let around = '';
      if (find !== undefined) {
        const p = passageOf(lines, find);
        if (p === null) return `"${find}" is not in ${url} (${lines.length} lines) — nothing kept`;
        around = ` — the passage around "${find}", lines ${p.from}-${p.from + p.lines.length - 1} of its ${p.total}`;
        lines = p.lines;
      }
      const w = ws.keep(url, page.title, [...lines]);
      ws.fetched.set(asked, w.id);
      const blocks = blocksOf(lines);
      const own = ownRomanisation(lines, blocks);
      const where = blocks.length === 0
        ? 'no Devanāgarī or IAST text found on it'
        : blocks.slice(0, 20).map((b) => `lines ${b.from}-${b.to}: ${b.script} (${b.to - b.from + 1}) — ${b.start}`).join('\n');
      const read = itrans ? '\nan ITRANS file, read into IAST by the program a line for a line: build from these lines, with spaced in IAST' : '';
      return `${w.id}: "${page.title}"${around}, ${lines.length} lines — ${KIND_SAID[kindOfPage(url, lines)]}${read}\n${where}${itrans ? '' : own}`;
    },
  },
  {
    writes: false,
    spec: {
      name: 'find_in_witness',
      description: 'Find where a phrase is in a witness, by its letters — the query in IAST or Devanāgarī, with or without '
        + 'accents and spaces. Answers the line numbers; read_witness reads around them. Use it on a long page instead of guessing lines.',
      parameters: params({ witness: str('Its id: w1…'), phrase: str('A few words of the text: "tat savitur vareṇyam".') }, ['witness', 'phrase']),
    },
    async run(args, { ws }) {
      const w = ws.witnesses.get(arg<string>(args, 'witness', 'string'));
      if (w === undefined) throw new Error('no such witness');
      const found = findLines(w, arg<string>(args, 'phrase', 'string'));
      if (found.length === 0) return `not found in ${w.id} (${w.lines.length} lines)`;
      return found.map((n) => `${n}| ${w.lines[n - 1]!.trim().slice(0, 90)}`).join('\n');
    },
  },
  {
    writes: false,
    spec: {
      name: 'read_witness',
      description: `Read lines of a witness, numbered. At most ${MAX_LINES} at a time.`,
      parameters: params({
        witness: str('Its id: w1…'), from: { type: 'number' }, to: { type: 'number' },
        iast: { type: 'boolean', description: 'Show Devanāgarī lines in IAST, svaras and all, as the program reads them — copy these letters into "spaced" rather than transliterating by hand.' },
      }, ['witness']),
    },
    async run(args, { ws }) {
      const w = ws.witnesses.get(arg<string>(args, 'witness', 'string'));
      if (w === undefined) throw new Error('no such witness');
      const from = Math.max(1, Math.floor(opt<number>(args, 'from', 'number') ?? 1));
      const to = Math.min(w.lines.length, Math.floor(opt<number>(args, 'to', 'number') ?? from + 59), from + MAX_LINES - 1);
      /* A model that transliterates a mantra by hand drops a svara now and then,
         and each one costs a build: a real run dropped two (2026-10-02). */
      const iast = args.iast === true;
      const out = [];
      for (let i = from; i <= to; i += 1) {
        const line = w.lines[i - 1]!;
        out.push(`${i}| ${iast && DEVA.test(line) ? asIast(line) : line}`);
      }
      return `${w.id} lines ${from}-${to} of ${w.lines.length}${iast ? ' (Devanāgarī shown in IAST)' : ''}\n${out.join('\n')}`;
    },
  },
];
