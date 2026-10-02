/**
 * THE AGENT IN A TERMINAL — one request, the real model, the real web, the
 * files written to `out/agent/`. The way the harness is tried end to end on
 * the owner's machine before the bot is, with the same host and the same
 * ledger the bot keeps.
 *
 *   npm run agent -- "the Puruṣa Sūktam, Taittirīya, as a PDF"
 *   npm run agent -- --mode document --open purusha-suktam "set the title to …"
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Session, type AgentEvent, type Mode } from '@siksamitra/agent';
import { ROOT, loadConfig } from './config.js';
import { nodeHost } from './host.js';
import { fileLedger } from './store.js';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const mode = (flag('mode') ?? 'deliver') as Mode;
const open = flag('open');
const request = args.join(' ').trim();
if (request === '') {
  console.error('usage: npm run agent -- [--mode deliver|document] [--open <library id>] "<request>"');
  process.exit(2);
}

const config = loadConfig();
/* `AGENT_OUT` for a run where the checkout is read-only — inside the bot's container, `/tmp`. */
const out = process.env.AGENT_OUT ?? join(ROOT, 'out/agent');
mkdirSync(out, { recursive: true });
const host = nodeHost(ROOT, async (file) => {
  writeFileSync(join(out, file.name), file.bytes);
  console.log(`\n  → ${join('out/agent', file.name)} (${Math.round(file.bytes.length / 1024)} KB, ${file.format})`);
}, config.vision);
const ledger = fileLedger(join(config.dataDir, 'ledger.jsonl'));

const show = (e: AgentEvent): void => {
  if (e.kind === 'tool') console.log(`  · ${e.name} ${e.args.length > 160 ? `${e.args.slice(0, 160)}…` : e.args}`);
  if (e.kind === 'result') console.log(`    ${e.failed ? '✗' : '✓'} ${e.text.split('\n')[0]!.slice(0, 150)}`);
  if (e.kind === 'usage') console.log(`    $${e.cost.toFixed(5)} — ${e.usage.input} in (${e.usage.cached} cached), ${e.usage.output} out`);
};

const session = new Session({
  id: `cli-${Date.now()}`, user: 'terminal', mode, model: config.model, price: config.price, host, ledger,
  limits: config.limits, onEvent: show,
});
try {
  if (open !== undefined) session.ws.open((await host.library.load(open)).doc, 'author');
  const done = await session.ask(request);
  console.log(`\n${done.text}\n`);
  console.log(`  ${done.steps} step(s), $${done.cost.toFixed(4)} — ${done.usage.input} tokens in (${done.usage.cached} from cache), ${done.usage.output} out`);
  console.log(`  spent in all so far: $${(await ledger.spent()).toFixed(4)} of $${config.limits.global?.toFixed(2)}`);
  writeFileSync(join(out, 'last-session.json'), JSON.stringify(session.save(), null, 1));
} finally {
  await host.exporters.close();
}
