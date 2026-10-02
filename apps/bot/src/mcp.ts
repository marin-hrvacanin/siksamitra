/**
 * THE MCP SERVER, ON THIS MACHINE — stdio, for a harness to start.
 *
 *   npm run mcp
 *
 * Registered in a client as a local server — Claude Code (`.mcp.json`),
 * opencode / marincode (`opencode.json` → `mcp`) — it offers the bot's tools
 * over one workspace: his library on this machine (`Library/bot-library/`),
 * the web, the builder, the rules, the proof, the check, the second reader
 * (the `.env` key's reviewer model), the exporters. A file delivered is
 * written to `out/mcp/` (`SIKSAMITRA_OUT`), and its path is said.
 *
 * Nothing is printed to stdout but the protocol: the transport is stdout.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Session } from '@siksamitra/agent';
import { ROOT, loadConfig } from './config.js';
import { nodeHost } from './host.js';
import { mcpServer } from './mcp-server.js';
import { fileLedger } from './store.js';

/* Anything a tool would print goes to stderr: stdout is the protocol, and a
   stray line on it breaks the client's reading of every message after. */
console.log = (...said: unknown[]): void => { console.error(...said); };
const config = loadConfig();
const out = process.env.SIKSAMITRA_OUT ?? join(ROOT, 'out/mcp');
mkdirSync(out, { recursive: true });
const base = nodeHost(ROOT, async (file) => { writeFileSync(join(out, file.name), file.bytes); });
const host = {
  ...base,
  where: `an MCP client on the owner's machine: a file you deliver is written to ${out} — say its name`,
};
const session = new Session({
  id: `mcp-${Date.now()}`, user: 'mcp', mode: 'deliver', model: config.model, price: config.price, host,
  ledger: fileLedger(join(config.dataDir, 'ledger.jsonl')), limits: config.limits,
  ...(config.reviewer === undefined ? {} : { reviewer: config.reviewer }),
});
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
const server = mcpServer({ session, host, version });
await server.connect(new StdioServerTransport());
/* Its exporter's browser closes with it. */
const close = async (): Promise<void> => { await base.exporters.close(); process.exit(0); };
process.on('SIGINT', () => { void close(); });
process.on('SIGTERM', () => { void close(); });
process.stdin.on('end', () => { void close(); });
