#!/usr/bin/env tsx
/**
 * THE BOT, ASKED FOR A TEXT HE HAS — and its page held against his.
 *
 * His idea (2026-10-02): "Why don't you give it some example text that we
 * already have (and hide it from its library) and then see what it gives you
 * and then you can compare and catch bugs and so on? And monitor yourself."
 *
 * For each of his documents: the request a person would make, the real agent
 * (`npm run agent`, the bot's own harness and model), his document hidden from
 * its library so it must research and build the text, and the PDF it delivers
 * compared with his own, line by line (`compare_pdf.py` — which knows nothing
 * of how either page was made). What it costs is printed with the result.
 *
 *   PATH=.venv/Scripts:$PATH npx tsx tools/fidelity/agent-eval.ts [name…] [--out out/eval]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Target {
  /** A short name, for the command line and the folder. */
  readonly name: string;
  /** What a person would ask the bot. */
  readonly request: string;
  /** His document, as the bot's library names it — hidden for the run. */
  readonly hide: string;
  /** His PDF, the page to be matched. */
  readonly his: string;
}

const TARGETS: readonly Target[] = [
  { name: 'bhu', request: 'bhū sūktam, kṛṣṇa yajurveda (taittirīya), as a PDF', hide: 'his:bhu-suktam-v1-1', his: 'Library/reference/pdf-only/bhū sūktam v1.1.pdf' },
  { name: 'agni', request: 'agnimīḻe sūktam, ṛgveda 1.1, as a PDF', hide: 'his:agnimile-suktam-iast-v0-1', his: 'Library/reference/agnimīḻe sūktam IAST v0.1.pdf' },
  { name: 'surya', request: 'sūryopaniṣat, atharvaveda, as a PDF', hide: 'his:suryopanisat-v0', his: 'Library/reference/pdf-only/sūryopaniṣat v0.pdf' },
  { name: 'purnakumbha', request: 'pūrṇakumbha mantra (for welcoming with the pūrṇakumbha), as a PDF', hide: 'his:purnakumbha-mantra-v0', his: 'Library/reference/pdf-only/pūrṇakumbha mantra v0.pdf' },
  { name: 'krimi', request: 'krimi saṁhāraka sūktam, as a PDF', hide: 'his:krimi-samharaka-suktam-v0-iast', his: 'Library/reference/krimi saṁhāraka sūktam v0 IAST.pdf' },
];

const at = process.argv.indexOf('--out');
const OUT = at > 0 ? process.argv[at + 1]! : 'out/eval';
const asked = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--out');
const chosen = asked.length === 0 ? TARGETS : TARGETS.filter((t) => asked.includes(t.name));

const rows: string[] = [];
for (const t of chosen) {
  const dir = join(OUT, t.name);
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  console.log(`\n── ${t.name}: "${t.request}" (his document hidden)`);
  const started = Date.now();
  const run = spawnSync('npm', ['run', '-s', 'agent', '--', t.request], {
    encoding: 'utf8', shell: true, timeout: 40 * 60_000,
    env: { ...process.env, AGENT_OUT: dir, AGENT_HIDE: t.hide },
  });
  writeFileSync(join(dir, 'log.txt'), `${run.stdout ?? ''}\n${run.stderr ?? ''}`);
  const log = run.stdout ?? '';
  const steps = /(\d+) step\(s\), \$(\d+\.\d+)/.exec(log);
  const pdf = readdirSync(dir).find((f) => f.endsWith('.pdf'));
  const minutes = ((Date.now() - started) / 60_000).toFixed(1);
  if (pdf === undefined) {
    rows.push(`${t.name.padEnd(12)} no PDF delivered · ${steps?.[1] ?? '?'} steps · $${steps?.[2] ?? '?'} · ${minutes} min`);
    console.log(`   no PDF — see ${join(dir, 'log.txt')}`);
    continue;
  }
  const json = join(dir, 'compare.json');
  const cmp = spawnSync('python', ['tools/fidelity/compare_pdf.py', t.his, join(dir, pdf), '--json', json, '--show', '12'], { encoding: 'utf8' });
  writeFileSync(join(dir, 'compare.txt'), `${cmp.stdout ?? ''}\n${cmp.stderr ?? ''}`);
  let summary = '(comparison failed — see compare.txt)';
  if (existsSync(json)) {
    const c = (JSON.parse(readFileSync(json, 'utf8')) as { summary: Record<string, unknown> }).summary;
    const pages = c.pages as { his: number; ours: number };
    const faults = Object.entries(c).filter(([k, v]) => typeof v === 'number' && v > 0 && !['lines', 'ours', 'matched', 'perfect', 'but_page'].includes(k))
      .sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(', ');
    summary = `PERFECT ${c.perfect} of his ${c.lines} lines (matched ${c.matched}, ours ${c.ours}; pages ${pages.his}/${pages.ours})${faults === '' ? '' : ` — ${faults}`}`;
  }
  rows.push(`${t.name.padEnd(12)} ${summary} · ${steps?.[1] ?? '?'} steps · $${steps?.[2] ?? '?'} · ${minutes} min`);
  console.log(`   ${summary}`);
}
console.log(`\n${rows.join('\n')}\n\nEach run's log, PDF and comparison: ${OUT}/<name>/`);
