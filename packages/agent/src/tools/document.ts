/**
 * THE DOCUMENT TOOLS — marking it, and the author's edits.
 *
 * Each is a thin call into what the program already does: `apply` with an
 * `EditCommand` (a key press), the `recompute` command (Re-apply rules),
 * `setDocField` (the command line's set-field). None decides a mark. The
 * rules mark; the model only says which text, which source, which title.
 * Building one from its sources is `build-tool.ts`.
 */
import { addVerseCommand, removeVerseCommand, setTextCommand, splitLines } from '@siksamitra/edit';
import type { ChantProfileKey } from '@siksamitra/format';
import { cleanLine, numbered, unnumbered } from '../lines.js';
import { verseLetters, type Workspace } from '../workspace.js';
import { BUILD_TOOL, SOURCE, asTyped, lineRange, linesOf, spacedOf } from './build-tool.js';
import { markAll } from './marking.js';
import { arg, opt, params, str, type Tool } from './types.js';

export { lineRange } from './build-tool.js';
export { markAll } from './marking.js';

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
  BUILD_TOOL,
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
      description: 'Replace a verse’s letters. To correct it against a source — the base edition’s typo, a verse it has wrong — '
        + 'take the verse from the other witness: witness + at (and spaced, as in build_document), and its letters are checked against those lines. '
        + 'Typed text is only for what the person dictated or asked for; it is then no source’s. Lines split by "/" or newlines. Run auto_mark after.',
      parameters: params({
        verse: str('The verse id.'),
        text: str('Typed: the new text — only what the person dictated or asked for.'),
        witness: str('The witness to take the verse from, w1…, with at.'),
        at: str('Its lines: "46-47".'),
        spaced: { type: 'array', items: { type: 'string' }, description: 'Those lines in IAST with his word breaks, as in build_document.' },
        asked: { type: 'boolean', description: 'true only when the person asked for this wording: the verse is then theirs, and no longer held to its source.' },
      }, ['verse']),
    },
    async run(args, { ws }) {
      const verse = arg<string>(args, 'verse', 'string');
      const witness = opt<string>(args, 'witness', 'string');
      const at = opt<string>(args, 'at', 'string');
      /* From a witness, its letters are that source's — and the check holds them to it from now on. */
      if (witness !== undefined && at !== undefined) {
        const taken = spacedOf(linesOf(ws, witness, at), opt<string[]>(args, 'spaced', 'array'), `verse ${verse}`);
        /* Read as the builder reads a source's lines — into IAST, the source's
           own numbers taken off — and closed with the verse's own number. */
        const old = ws.need().sections.flatMap((s) => s.verses).find((v) => v.id === verse);
        const read = asTyped([...taken.lines]).map(cleanLine).filter((l) => l !== '')
          .map((l, i, all) => (i === all.length - 1 ? l.replace(/॥\s*[0-9०-९.]+\s*॥\s*$/u, '॥') : l));
        const n = old === undefined ? undefined : /॥\s*(\d+)\s*॥\s*$/u.exec(verseLetters(old))?.[1];
        const lines = n !== undefined ? numbered(read, Number(n)) : unnumbered(read);
        const done = setTextCommand(ws.need(), verse, lines);
        if (!done.ok) throw new Error(done.error);
        const said = ws.run(done.value);
        const [from, to] = lineRange(at, ws.witnesses.get(witness)!.lines.length);
        ws.builtFrom.set(verse, { witness, from, to, input: taken.lines, ...(taken.left.length === 0 ? {} : { left: taken.left }) });
        const left = taken.left.length === 0 ? '' : `\nleft out of ${witness} ${at}: ${taken.left.map((w) => `“${w}”`).join(' ')}`;
        return `${said}${left}`;
      }
      const text = opt<string>(args, 'text', 'string');
      if (text === undefined) throw new Error('give the verse from a witness (witness + at), or text the person dictated');
      const done = setTextCommand(ws.need(), verse, asTyped(splitLines(text)));
      if (!done.ok) throw new Error(done.error);
      /* Typed, it is still held to the lines it was built from — a model that
         retypes a verse to quiet the check is found — unless the person asked
         for these words: then it is theirs, and the check says it was typed. */
      if (args.asked === true) ws.builtFrom.delete(verse);
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
      const done = addVerseCommand(ws.need(), arg<string>(args, 'section', 'string'), asTyped(splitLines(arg<string>(args, 'text', 'string'))), opt<string>(args, 'after', 'string'));
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
