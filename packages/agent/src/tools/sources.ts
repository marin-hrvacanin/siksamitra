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
import { toIast } from '@siksamitra/engine';
import { fold } from '../library.js';
import { outlineOf, versesOf, type Witness, type Workspace } from '../workspace.js';
import { arg, opt, params, str, type Tool } from './types.js';

const DEVA = /[ऀ-ॿ]/u;
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
      description: 'Look for a text in the library: the verified corpus (already marked and checked — prefer it) and the owner\'s own files.',
      parameters: params({ query: str('A title or a few words: "puruṣa sūktam", "rudram", "durgā".') }, ['query']),
    },
    async run(args, { host }) {
      const hits = await host.library!.find(arg<string>(args, 'query', 'string'));
      if (hits.length === 0) return 'nothing in the library matches — search the web';
      return hits.slice(0, 12).map((h) => `${h.id} · ${h.title} · ${h.kind}${h.source === undefined ? '' : ` · ${h.source}`}${h.note === undefined ? '' : ` · ${h.note}`}`).join('\n');
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
      return `${outlineOf(ws.need())}\n\n(its marks are its author's: deliver it as it is; the rules are not run over it unless the person asks)`;
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
      description: 'Fetch a page and keep it as a witness. Answers its id, and where on it the Devanāgarī and IAST text is — read those lines with read_witness.',
      parameters: params({ url: str('The page.') }, ['url']),
    },
    async run(args, { ws, host }) {
      if (ws.spent.pages >= RESEARCH.pages) return enough(ws, 'pages');
      ws.spent.pages += 1;
      const url = arg<string>(args, 'url', 'string');
      const page = await host.research!.fetch(url);
      const lines = page.text.split(/\r?\n/);
      const w = ws.keep(url, page.title, lines);
      const blocks = blocksOf(lines);
      const where = blocks.length === 0
        ? 'no Devanāgarī or IAST text found on it'
        : blocks.slice(0, 20).map((b) => `lines ${b.from}-${b.to}: ${b.script} (${b.to - b.from + 1}) — ${b.start}`).join('\n');
      return `${w.id}: "${page.title}", ${lines.length} lines\n${where}`;
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
      parameters: params({ witness: str('Its id: w1…'), from: { type: 'number' }, to: { type: 'number' } }, ['witness']),
    },
    async run(args, { ws }) {
      const w = ws.witnesses.get(arg<string>(args, 'witness', 'string'));
      if (w === undefined) throw new Error('no such witness');
      const from = Math.max(1, Math.floor(opt<number>(args, 'from', 'number') ?? 1));
      const to = Math.min(w.lines.length, Math.floor(opt<number>(args, 'to', 'number') ?? from + 59), from + MAX_LINES - 1);
      const out = [];
      for (let i = from; i <= to; i += 1) out.push(`${i}| ${w.lines[i - 1]}`);
      return `${w.id} lines ${from}-${to} of ${w.lines.length}\n${out.join('\n')}`;
    },
  },
];
