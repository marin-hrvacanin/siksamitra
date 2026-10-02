/**
 * THE BOT'S PAGES AGAINST HIS — every one of his PDFs, a ratchet.
 *
 * For each PDF in `Library/reference/` (his, not in the repository; the gate
 * says SKIPPED loudly where the folder is not), `bot-page.ts` makes the
 * document the bot would make from the best outline it could be given and
 * prints it as the bot does, and `compare_pdf.py` counts the lines that are
 * his in every respect a reader sees — place, size, face, colour, page. The
 * counts ratchet in `corpus/bot-page-baseline.json` (numbers only — no text
 * of his): a count may rise; a fall fails, naming the document.
 *
 * Each document is marked in the register recorded for it there, because the
 * agent chooses the register and this measures the page, not the choice. A
 * document listed with `"skip"` is a book — his sādhanā — which the bot does
 * not make.
 *
 *   npx tsx --tsconfig tools/export/tsconfig.render.json --import ./tools/export/no-css.mjs \
 *     tools/fidelity/bot-pages.ts [--write]
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const DIR = 'Library/reference';
const BASELINE = 'corpus/bot-page-baseline.json';
const OUT = 'out/fid/bot-pages';

if (!existsSync(DIR)) {
  console.log(`\n  SKIPPED — ${DIR} is not here. It holds the owner's own documents,`);
  console.log('  which are not in the repository. Put them there to run this gate.\n');
  process.exit(0);
}

type Row = { source?: string; perfect?: number; lines?: number; pages?: string; skip?: string };
const baseline: Record<string, Row> = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const pdfs = [DIR, join(DIR, 'pdf-only')]
  .filter(existsSync)
  .flatMap((d) => readdirSync(d).filter((f) => /\.pdf$/i.test(f)).map((f) => join(d, f)))
  .sort();

const env = { ...process.env, PATH: `${join(process.cwd(), '.venv', 'Scripts')}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}` };
const measured: Record<string, Row> = {};
let fell = 0;
console.log('\n── the bot\'s pages against his\n');
for (const pdf of pdfs) {
  const name = pdf.split(/[\\/]/).pop()!;
  const was = baseline[name] ?? {};
  if (was.skip !== undefined) { measured[name] = was; console.log(`  skip  ${name} — ${was.skip}`); continue; }
  const source = was.source ?? 'taittiriya';
  const r = spawnSync(process.execPath, [
    ...process.execArgv, 'tools/fidelity/bot-page.ts', pdf, '--source', source, '--out', OUT,
  ], { encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
  const stem = name.replace(/\.pdf$/i, '');
  const at = join(OUT, `${stem}.compare.json`);
  if (r.status !== 0 || !existsSync(at)) {
    console.log(`  FAIL  ${name}: the bot's path did not complete\n${(r.stderr || r.stdout).split('\n').slice(-6).join('\n')}`);
    fell += 1;
    continue;
  }
  const { summary } = JSON.parse(readFileSync(at, 'utf8')) as { summary: { lines: number; perfect: number; pages: { his: number; ours: number } } };
  const row: Row = { source, perfect: summary.perfect, lines: summary.lines, pages: `${summary.pages.his}/${summary.pages.ours}` };
  measured[name] = row;
  const drop = was.perfect !== undefined && summary.perfect < was.perfect;
  if (drop) fell += 1;
  const pct = ((100 * summary.perfect) / Math.max(1, summary.lines)).toFixed(1);
  console.log(`  ${drop ? 'FAIL' : 'ok  '}  ${String(summary.perfect).padStart(4)} of ${String(summary.lines).padStart(4)} lines his (${pct}%), pages ${row.pages}  ${name}${drop ? `  — was ${was.perfect}` : ''}`);
}

if (process.argv.includes('--write')) {
  writeFileSync(BASELINE, `${JSON.stringify(measured, null, 2)}\n`);
  console.log(`\n  baseline written — ${BASELINE}\n`);
  process.exit(0);
}
if (fell > 0) {
  console.log(`\n${fell} document(s) fell below their baseline, or did not complete.\n`);
  process.exit(1);
}
console.log('\n  THE BOT\'S PAGES HOLD.\n');
