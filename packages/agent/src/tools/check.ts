/**
 * IS IT RIGHT — asked of the program first, and of a second agent after.
 *
 * THE CHECK IS CODE, NOT AN OPINION. Three questions with answers a reader
 * produces (CLAUDE.md rule 9), none of them computed from the document being
 * checked:
 *
 *   the LETTERS: each section built from a witness is built again from the
 *     same lines by the same builder, and its verses must come out letter for
 *     letter as the document has them — so a verse the model retyped, dropped
 *     or split differently is found;
 *   the MARKS: the rules run once more over a copy must change nothing — so a
 *     document whose marks are not the rules' (an edit not re-marked) is found;
 *   the ACCENTS: a Vedic text with no svara at all came from an unaccented
 *     source, and its svaras cannot be made up — they are the text's.
 *
 * THE REVIEW is the adversarial pass: another model, with only the tools that
 * read, told to find what is wrong — a verse missing against a second source,
 * the wrong recension, a title that is not the text's. It reports; the agent
 * that built the document has to answer each finding.
 *
 * DELIVERY WAITS FOR THE CHECK. A file is not made from a document the check
 * finds wrong.
 */
import { toTextAndMarks, type ChantDoc, type ChantVerse } from '@siksamitra/format';
import { documentOf } from '../build.js';
import { Workspace, verseLetters } from '../workspace.js';
import { markAll } from './document.js';
import { arg, opt, params, str, type DeliveryFormat, type Tool } from './types.js';

export interface Finding {
  readonly severity: 'error' | 'warn';
  readonly where: string;
  readonly what: string;
}

const VEDIC = new Set(['taittiriya', 'rigveda', 'sukla-yajurveda']);

/**
 * What a verse IS, for "did the rules change it": its text and each marking's
 * kind, place and value. Not who placed it, and not the syllable division —
 * the renderer's, never a run's — the same comparison `recompute` makes.
 */
const settledKey = (v: ChantVerse): string => {
  const tm = toTextAndMarks(v);
  return `${tm.text}\u0000${tm.marks.filter((m) => m.k !== 'syl').map((m) => `${m.k}:${m.from}:${m.to}:${m.v ?? ''}`).sort().join('|')}`;
};

/** Letters compared as a reader sees them: the rules may widen a space for a pause. */
const spaced = (s: string): string => s.replace(/[ \t ]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
const cut = (s: string, n = 90): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * The source's lines as the document would have them: built by the same
 * builder and marked by the same rules in the same register. The rules
 * TRANSFORM the accents — the Ṛgveda lengthens a svarita and draws its
 * overline — so the text's own accents and the marked page's are not the same
 * characters, and comparing them called every verse of the Nāsadīya Sūkta
 * wrong. Both sides marked alike, a difference can only be a difference in
 * what went in: a letter retyped, a verse dropped, an accent moved.
 */
function asMarked(o: Parameters<typeof documentOf>[0], doc: ChantDoc): ChantVerse[] {
  const copy = new Workspace();
  copy.open(documentOf(o));
  const preset = doc.profile?.preset;
  if (preset !== undefined) copy.run({ k: 'profile', scope: 'document', preset });
  markAll(copy, 'keep-hand');
  return copy.need().sections[0]?.verses ?? [];
}

export function checkDocument(ws: Workspace): Finding[] {
  const doc = ws.need();
  const out: Finding[] = [];
  if (doc.title.trim() === '') out.push({ severity: 'error', where: 'title', what: 'the document has no title' });
  if (doc.sections.length === 0) out.push({ severity: 'error', where: 'document', what: 'the document has no sections' });

  for (const s of doc.sections) {
    if (s.verses.length === 0) out.push({ severity: 'error', where: s.id, what: 'the section has no verses' });
    /* THE LETTERS of each verse built from a witness's lines on its own. */
    for (const v of s.verses) {
      const vf = ws.builtFrom.get(v.id);
      const vw = vf === undefined ? undefined : ws.witnesses.get(vf.witness);
      if (vf === undefined || vw === undefined) continue;
      const lines = vw.lines.slice(vf.from - 1, vf.to);
      const again = asMarked({ title: '_', sections: [{ verses: [{ lines }] }] }, doc);
      const want = again.map((x) => spaced(verseLetters(x))).join('\n');
      const have = spaced(verseLetters(v));
      if (want !== have) out.push({ severity: 'error', where: v.id, what: `differs from ${vw.id} lines ${vf.from}-${vf.to}: has "${cut(have)}", the source "${cut(want)}"` });
    }
    /* THE LETTERS, against the witness the section was built from. */
    const from = ws.builtFrom.get(s.id);
    const w = from === undefined ? undefined : ws.witnesses.get(from.witness);
    if (from !== undefined && w !== undefined) {
      const flow = w.lines.slice(from.from - 1, from.to);
      const again = asMarked({ title: '_', sections: [{ verses: [], flow }] }, doc);
      const want = again.map((v) => spaced(verseLetters(v)));
      const have = s.verses.map((v) => spaced(verseLetters(v)));
      if (want.length !== have.length) {
        out.push({ severity: 'error', where: s.id, what: `${have.length} verse(s), but ${w.id} lines ${from.from}-${from.to} make ${want.length}` });
      }
      const n = Math.min(want.length, have.length);
      for (let i = 0; i < n; i += 1) {
        if (want[i] !== have[i]) {
          out.push({ severity: 'error', where: s.verses[i]!.id, what: `differs from ${w.id}: has "${cut(have[i]!)}", the source "${cut(want[i]!)}"` });
          break;
        }
      }
    }
    /* A verse with no source the program can name was typed. Said, so a
       reviewer and the person know which letters nobody can check. */
    if (ws.origin !== 'author' && from === undefined) {
      const typed = s.verses.filter((v) => !ws.builtFrom.has(v.id));
      if (typed.length > 0) out.push({ severity: 'warn', where: s.id, what: `typed, not taken from a source: ${typed.map((v) => v.id).join(', ')}` });
    }
    /* THE ACCENTS of a Vedic text. */
    const register = s.profile?.preset ?? doc.profile?.preset;
    if (register !== undefined && VEDIC.has(register) && s.verses.length > 0
      && !s.verses.some((v) => toTextAndMarks(v).marks.some((m) => m.k === 'svara'))) {
      out.push({ severity: 'warn', where: s.id, what: 'a Vedic text with no svaras: its source was unaccented — find an accented one' });
    }
  }

  /* THE MARKS: the rules once more, over a copy, change nothing — for a
     document the rules marked. An author's text is not theirs to judge. */
  if (ws.origin === 'author') return out;
  const copy = new Workspace();
  copy.open(doc);
  markAll(copy, 'keep-hand');
  const after = copy.need();
  for (const s of doc.sections) {
    const t = after.sections.find((x) => x.id === s.id);
    const moved = t === undefined ? [] : s.verses.filter((v, i) => t.verses[i] === undefined || settledKey(t.verses[i]!) !== settledKey(v));
    if (moved.length > 0) {
      out.push({ severity: 'error', where: s.id, what: `the marks of ${moved.map((v) => v.id).join(', ')} are not what the rules make — run auto_mark` });
    }
  }
  return out;
}

const said = (ws: Workspace, doc: ChantDoc, findings: readonly Finding[]): string => {
  const verses = doc.sections.reduce((n, s) => n + s.verses.length, 0);
  if (findings.length === 0) {
    return ws.origin === 'author'
      ? `OK — ${doc.sections.length} section(s), ${verses} verse(s), as their author marked them.`
      : `OK — ${doc.sections.length} section(s), ${verses} verse(s): the letters are the sources', and the rules have nothing left to change.`;
  }
  return findings.map((f) => `${f.severity === 'error' ? 'ERROR' : 'warn'} ${f.where}: ${f.what}`).join('\n');
};

const MIME: Readonly<Record<DeliveryFormat, string>> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  smdoc: 'application/zip',
  vedaunion: 'application/zip',
};

export const CHECK_TOOLS: readonly Tool[] = [
  {
    writes: false,
    spec: {
      name: 'check',
      description: 'Check the open document: its letters against the witnesses it was built from, its marks against the rules, and a Vedic text for its accents.',
      parameters: params({}),
    },
    async run(_args, { ws }) { return said(ws, ws.need(), checkDocument(ws)); },
  },
  {
    writes: false,
    spec: {
      name: 'review',
      description: 'Ask a second agent to find what is wrong with the document — a missing or extra verse against another source, the wrong recension, a wrong title. Answer every finding it reports.',
      parameters: params({ focus: str('What to look at hardest, and what the person asked for.') }, ['focus']),
    },
    async run(args, { ws, review }) {
      /* What the reviewer cannot see: where each part was taken from. Handed
         over, so it spends its calls comparing rather than finding out. */
      const sources = [...ws.builtFrom.entries()].map(([k, f]) => `${k} ← ${f.witness} lines ${f.from}-${f.to}`);
      const witnesses = [...ws.witnesses.values()].map((w) => `${w.id}: ${w.origin} — "${w.title}", ${w.lines.length} lines`);
      return review([
        arg<string>(args, 'focus', 'string'),
        sources.length === 0 ? 'Nothing in it was taken from a witness by line.' : `Built from:\n${sources.join('\n')}`,
        witnesses.length === 0 ? 'No witnesses were fetched.' : `Witnesses:\n${witnesses.join('\n')}`,
      ].join('\n\n'));
    },
  },
  {
    writes: false,
    needs: 'exporters',
    spec: {
      name: 'deliver',
      description: 'Make the file and hand it to the person. pdf unless they asked for another: docx (Word), smdoc (śikṣāmitra), '
        + 'or vedaunion — ONLY when they ask for the VedaUnion website upload. Refused while check finds an error.',
      parameters: params({
        format: { type: 'string', enum: ['pdf', 'docx', 'smdoc', 'vedaunion'] },
        name: str('The file name without extension; the title when left out.'),
      }),
    },
    async run(args, { ws, host }) {
      const doc = ws.need();
      const errors = checkDocument(ws).filter((f) => f.severity === 'error');
      if (errors.length > 0) return `not delivered — the check finds:\n${said(ws, doc, errors)}`;
      const format = (opt<string>(args, 'format', 'string') ?? 'pdf') as DeliveryFormat;
      const make = host.exporters?.[format];
      if (make === undefined) return `this host cannot make a ${format}`;
      const stem = (opt<string>(args, 'name', 'string') ?? doc.title).replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'document';
      const file = await make(doc, stem);
      if (host.deliver === undefined) return `made ${file.name} (${Math.round(file.bytes.length / 1024)} KB), but this host cannot hand it over`;
      await host.deliver({ ...file, mime: file.mime || MIME[format] });
      return `delivered ${file.name} (${Math.round(file.bytes.length / 1024)} KB)`;
    },
  },
];
