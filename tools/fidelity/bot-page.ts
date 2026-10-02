/**
 * THE BOT'S PAGE AGAINST HIS — the whole path a PDF in the chat takes.
 *
 * The outline the agent would write for one of his documents — from his PDF
 * itself (`outline-of.ts`), or from a JSON outline — is handed to the agent's
 * own `build_document` and `deliver`, with the bot's own host, exactly as the
 * model calls them: the rules mark it, the check passes it, and
 * `nodeExporters` prints it. Then `compare_pdf.py` says, line by line, how far
 * that page is from his, and the Word file, the `.smdoc` and the page's HTML
 * are written beside it to look into.
 *
 *   PATH=.venv/Scripts:$PATH npx tsx --tsconfig tools/export/tsconfig.render.json \
 *     --import ./tools/export/no-css.mjs tools/fidelity/bot-page.ts \
 *     "Library/reference/pdf-only/bhū sūktam v1.1.pdf" [--source taittiriya] [--out out/fid/bot]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Workspace, toolsFor, type Delivered, type Outline } from '@siksamitra/agent';
import { nodeHost } from '../../apps/bot/src/host.js';
import { outlineOfPdf } from './outline-of.js';
// @ts-expect-error — a JavaScript module of the tools, without types
import { buildPage } from '../export/page.mjs';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
};
const input = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (input === undefined) {
  console.error('usage: bot-page.ts <his.pdf | outline.json> [--source <register>] [--out <dir>]');
  process.exit(2);
}
const outDir = flag('out') ?? 'out/fid/bot';
const fromJson = input.endsWith('.json')
  ? JSON.parse(readFileSync(input, 'utf8')) as { pdf: string; source?: string; outline: Outline }
  : undefined;
const his = fromJson?.pdf ?? input;
const outline = fromJson?.outline ?? outlineOfPdf(input);
const source = flag('source') ?? fromJson?.source ?? 'taittiriya';
mkdirSync(outDir, { recursive: true });
const stem = basename(input).replace(/\.(json|pdf)$/, '');
writeFileSync(join(outDir, `${stem}.outline.json`), JSON.stringify({ pdf: his, source, outline }, null, 1));

const written: string[] = [];
const host = nodeHost(process.cwd(), async (file: Delivered) => {
  const at = join(outDir, `${stem}.${file.name.split('.').pop()}`);
  writeFileSync(at, file.bytes);
  written.push(at);
  if (file.summary !== undefined) console.log(`\n── what the chat is told with ${file.name}\n${file.summary}`);
});
const tools = toolsFor('document', host);
const call = async (name: string, a: Record<string, unknown>): Promise<string> => {
  const tool = tools.find((t) => t.spec.name === name);
  if (tool === undefined) throw new Error(`the bot has no ${name} tool`);
  return tool.run(a, { ws, host, review: async () => 'no review in this tool' });
};

const ws = new Workspace();
try {
  console.log(await call('build_document', { ...outline, source }));
  /* The page the PDF is printed from, to look into when a line differs. */
  writeFileSync(join(outDir, `${stem}.html`), (await buildPage(ws.need(), { style: 'veda-union' })).html);
  for (const format of ['pdf', 'docx', 'smdoc']) console.log(await call('deliver', { format }));
} finally {
  await host.exporters.close();
}

const pdf = written.find((w) => w.endsWith('.pdf'));
if (pdf === undefined) { console.error('no PDF was delivered'); process.exit(1); }
console.log(`\n── ${pdf} against ${his}\n`);
const r = spawnSync('python', ['tools/fidelity/compare_pdf.py', his, pdf, '--show', '40', '--json', join(outDir, `${stem}.compare.json`)], {
  stdio: 'inherit', env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
});
process.exit(r.status ?? 1);
