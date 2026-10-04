// scratch (not committed): the MCP server's tools over one session, in-process.
import http from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Session, toolsFor, type ToolContext } from '@siksamitra/agent';
import { ROOT, loadConfig } from '../apps/bot/src/config.js';
import { nodeHost } from '../apps/bot/src/host.js';
import { fileLedger } from '../apps/bot/src/store.js';
const config = loadConfig();
const out = join(ROOT, 'out/mcp');
mkdirSync(out, { recursive: true });
const host = nodeHost(ROOT, async (file) => { writeFileSync(join(out, file.name), file.bytes); });
const session = new Session({ id: `bridge-${Date.now()}`, user: 'bridge', mode: 'deliver', model: config.model, price: config.price, host,
  ledger: fileLedger(join(config.dataDir, 'ledger.jsonl')), limits: config.limits });
const tools = new Map(toolsFor('deliver', host).map((t) => [t.spec.name, t]));
http.createServer(async (req, res) => {
  let body = ''; for await (const ch of req) body += ch;
  try {
    const { name, args } = JSON.parse(body || '{}') as { name: string; args?: Record<string, unknown> };
    let text: string;
    if (name === '__save') {
      const format = String(args?.format ?? 'smdoc') as 'smdoc';
      const file = await host.exporters![format]!(session.ws.need(), String(args?.name ?? 'document'));
      writeFileSync(join(out, file.name), file.bytes); text = `saved ${file.name}`;
    } else {
      const tool = tools.get(name); if (tool === undefined) throw new Error(`no tool ${name}`);
      const ctx: ToolContext = { ws: session.ws, host, review: (task) => session.secondReading(task), show: () => {} };
      text = await tool.run(args ?? {}, ctx);
    }
    res.end(JSON.stringify({ content: [{ type: 'text', text }] }));
  } catch (e) { res.end(JSON.stringify({ content: [{ type: 'text', text: `error: ${e instanceof Error ? e.message : String(e)}` }], isError: true })); }
}).listen(7811, () => { console.error('bridge on 7811'); });
