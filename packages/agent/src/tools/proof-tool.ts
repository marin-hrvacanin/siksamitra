/**
 * THE PROOF, AS A TOOL — the whole document as it will print, read before it
 * is said to be done, with what a proofreader finds on it (`proof.ts`).
 *
 * The agent that sent a Devanāgarī verse in an IAST text had read an outline,
 * a few verses and two of four pages as pictures; the verse was on the third
 * (2026-10-02). This is every page, as text, at a few tokens a line.
 */
import { proofOf } from '../proof.js';
import { proofFindings } from './check.js';
import { opt, params, type Tool } from './types.js';

export const PROOF_TOOLS: readonly Tool[] = [{
  writes: false,
  spec: {
    name: 'proof',
    description: 'Read the open document whole, as it will print: its name, each heading and source line, every verse line with its number, '
      + 'each note, the first words of each translation — and what a proofreader finds on it. Read it as the person will, before check and review, '
      + 'and fix what is not as his pages are.',
    parameters: params({ from: { type: 'integer', description: 'From which verse, counting from 1, for a long document.' } }),
  },
  async run(args, { ws }) {
    const doc = ws.need();
    const from = Math.max(1, Math.round(opt<number>(args, 'from', 'number') ?? 1));
    const found = ws.origin === 'author' ? [] : proofFindings(ws);
    const said = found.length === 0 ? 'the proofreader finds nothing'
      : `the proofreader finds:\n${found.map((f) => `${f.severity === 'error' ? 'ERROR' : 'warn'} ${f.where}: ${f.what}`).join('\n')}`;
    return `${proofOf(doc, from)}\n\n${said}`;
  },
}];
