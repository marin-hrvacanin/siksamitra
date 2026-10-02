/**
 * THE FILES THE PERSON SENDS, OPENED — and a document of theirs VERIFIED.
 *
 * What is kept where is the host's (`attachments.ts`); what a file becomes is
 * decided here, once, for every host:
 *
 *   - a document of ours or his — `.docx`, `.smdoc`, `.vuchant`, a PDF of ours
 *     with its document inside — becomes the open document, as its AUTHOR made
 *     it: nothing re-marks it unasked, and `verify` says how it stands;
 *   - a text — `.txt`, `.html`, a source's `.itx` — is kept as a witness, to
 *     build from as from a page;
 *   - a picture is shown to a model that sees (`view_attachment`).
 *
 * `verify` is the owner's "check/verify uploaded documents" (2026-10-02):
 * where the rules would mark the document otherwise, verse by verse, and —
 * given a source — where its letters part from it, all without changing it.
 */
import { recitationText, toTextAndMarks, type ChantVerse, type Mark } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import { openDocumentFile } from '@siksamitra/interop';
import { kindOf } from '../attachments.js';
import { letterDifference } from '../letters.js';
import { Workspace, outlineOf } from '../workspace.js';
import { markAll } from './marking.js';
import { proofFindings } from './check.js';
import { arg, opt, params, str, type Tool } from './types.js';

/** A text file's lines: its HTML taken off, if it had any. */
function textLines(bytes: Uint8Array): string[] {
  const text = new TextDecoder('utf-8').decode(bytes);
  const plain = /<html|<body|<p[\s>]/iu.test(text)
    ? text.replace(/<(script|style)[\s\S]*?<\/\1>/giu, '').replace(/<br\s*\/?>|<\/p>|<\/div>/giu, '\n').replace(/<[^>]+>/gu, '')
    : text;
  return plain.split(/\r?\n/u);
}

/**
 * A verse's text without its spacing, and where each offset falls in it:
 * re-marking writes `tanūnām ॥4॥` where a file has `tanūnām॥4॥`, and a space
 * is no letter — counted, it made a verified document "otherwise" in five of
 * its nine verses.
 */
function unspaced(text: string): { letters: string; at: number[] } {
  const at: number[] = [];
  let letters = '';
  for (let i = 0; i <= text.length; i += 1) {
    at.push(letters.length);
    if (i < text.length && !/\s/u.test(text[i]!)) letters += text[i];
  }
  return { letters, at };
}

/** Where two forms of one verse differ: its letters first, then each marking one has and the other not. */
function differences(theirs: ChantVerse, rules: ChantVerse): string[] {
  const a = toTextAndMarks(theirs);
  const b = toTextAndMarks(rules);
  const x = unspaced(a.text);
  const y = unspaced(b.text);
  if (x.letters !== y.letters) {
    let i = 0;
    while (i < x.letters.length && x.letters[i] === y.letters[i]) i += 1;
    const near = (s: string): string => s.slice(Math.max(0, i - 8), i + 8);
    return [`the rules write its letters otherwise: “${near(x.letters)}” → “${near(y.letters)}”`];
  }
  const keyIn = (u: { at: number[] }) => (m: Mark): string => `${m.k}:${u.at[m.from]}-${u.at[m.to]}:${m.v ?? ''}`;
  const inA = new Set(a.marks.map(keyIn(x)));
  const inB = new Set(b.marks.map(keyIn(y)));
  const key = keyIn(x);
  const keyB = keyIn(y);
  const on = (m: Mark, t: string): string => `${m.k}${m.v === undefined ? '' : ` ${m.v}`} on “${t.slice(m.from, Math.max(m.to, m.from + 1))}”`;
  return [
    ...a.marks.filter((m) => !inB.has(key(m))).map((m) => `it has ${on(m, a.text)}`),
    ...b.marks.filter((m) => !inA.has(keyB(m))).map((m) => `the rules put ${on(m, b.text)}`),
  ];
}

export const ATTACHMENT_TOOLS: readonly Tool[] = [
  {
    writes: true,
    needs: 'attachments',
    spec: {
      name: 'open_attachment',
      description: 'Open a file the person sent, by the attachment id their message names. A document of ours or theirs '
        + '(.docx, .smdoc, .vuchant, a PDF of ours) becomes the open document AS ITS AUTHOR MADE IT — verify it, or mark '
        + 'or deliver it only as they ask; a text file is kept as a witness, to build from as from a page; a picture is '
        + 'seen with view_attachment.',
      parameters: params({ attachment: str('Its id, as the message names it.') }, ['attachment']),
    },
    async run(args, { ws, host }) {
      const a = await host.attachments!.get(arg<string>(args, 'attachment', 'string'));
      if (a === undefined) throw new Error('no such attachment — it was not sent in this conversation, or is no longer kept');
      const kind = kindOf(a.name, a.mime);
      if (kind === 'document' || kind === 'pdf') {
        try {
          const opened = await openDocumentFile(a.bytes, a.name);
          ws.open(openChantDoc(opened.doc), 'author');
        } catch (e) {
          if (kind === 'document') throw new Error(`“${a.name}” could not be opened: ${(e as Error).message}`);
          return `“${a.name}” is a PDF that is not one of ours, and its text cannot be read here — ask the person for its Word file, or a photograph of a page (view_attachment)`;
        }
        return `opened “${a.name}” as the document, as its author made it:\n${outlineOf(ws.need())}\n\n`
          + 'verify says where the rules would mark it otherwise and, given a source, where its letters part from it.';
      }
      if (kind === 'text') {
        const lines = textLines(a.bytes);
        const w = ws.keep(`attachment:${a.id}`, a.name, lines);
        return `${w.id}: “${a.name}”, ${lines.length} lines, kept as a witness — read_witness or find_in_witness it, and build from it as from a page`;
      }
      if (kind === 'image') return `“${a.name}” is a picture — view_attachment shows it to you`;
      return `“${a.name}” (${a.mime}) is no kind of file this can read`;
    },
  },
  {
    writes: false,
    needs: 'attachments',
    spec: {
      name: 'view_attachment',
      description: 'See a picture the person sent — a photograph of a page, a scan — by its attachment id.',
      parameters: params({ attachment: str('Its id, as the message names it.') }, ['attachment']),
    },
    async run(args, { host, show }) {
      const a = await host.attachments!.get(arg<string>(args, 'attachment', 'string'));
      if (a === undefined) throw new Error('no such attachment');
      if (kindOf(a.name, a.mime) !== 'image') return `“${a.name}” is not a picture — open_attachment opens it`;
      if (show === undefined) return `“${a.name}” could not be shown here`;
      show(a.bytes, `(the person's picture “${a.name}”)`, a.mime);
      return `“${a.name}” — shown to you as a picture with your next message`;
    },
  },
  {
    writes: false,
    spec: {
      name: 'verify',
      description: 'Verify the open document as its author made it, WITHOUT changing it: where the rules would mark it '
        + 'otherwise, verse by verse — and, given a witness and its lines, where its letters part from that source.',
      parameters: params({
        witness: str('Optional: a witness to hold its letters against — w1…'),
        lines: str('Optional, with witness: which of its lines, "12-40".'),
      }),
    },
    async run(args, { ws }) {
      const doc = ws.need();
      const copy = new Workspace();
      copy.open(structuredClone(doc));
      markAll(copy, 'replace-all');
      const after = copy.need();
      const out: string[] = [];
      let verses = 0;
      for (const s of doc.sections) {
        const t = after.sections.find((x) => x.id === s.id);
        s.verses.forEach((v, i) => {
          verses += 1;
          const r = t?.verses[i];
          if (r === undefined) return;
          const d = differences(v, r);
          if (d.length > 0) out.push(`${v.id}: ${d.slice(0, 4).join('; ')}${d.length > 4 ? ` … and ${d.length - 4} more` : ''}`);
        });
      }
      const said = [out.length === 0
        ? `its marks: all ${verses} verse(s) as the rules make them`
        : `its marks: ${out.length} of ${verses} verse(s) where the rules would mark otherwise —\n${out.slice(0, 30).join('\n')}${out.length > 30 ? `\n… and ${out.length - 30} more` : ''}`];
      /* Its page, as a proofreader reads it: a draft's half-done letters, a
         verse's end inside another, a half-verse outside its metre. */
      const page = proofFindings(ws);
      if (page.length > 0) said.push(`its page, as a proofreader reads it —\n${page.slice(0, 20).map((f) => `${f.where}: ${f.what}`).join('\n')}`);
      const wid = opt<string>(args, 'witness', 'string');
      if (wid !== undefined) {
        const w = ws.witnesses.get(wid);
        if (w === undefined) throw new Error('no such witness');
        const [a, b] = (opt<string>(args, 'lines', 'string') ?? `1-${w.lines.length}`).split('-').map((n) => Number(n));
        const source = w.lines.slice(Math.max(0, (a ?? 1) - 1), b ?? w.lines.length);
        const ours = doc.sections.flatMap((s) => s.verses.flatMap((v) => recitationText(v.tokens, 'iast').split('\n')));
        const d = letterDifference(source, ours, true);
        said.push(d === null ? `its letters: the same as ${w.id}'s` : `its letters part from ${w.id}'s — ${d.where}: it has “${d.have}”, the source “${d.source}”`);
      }
      return said.join('\n\n');
    },
  },
];
