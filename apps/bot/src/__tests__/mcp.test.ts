/**
 * THE ENGINE'S TOOLS, DRIVEN BY ANOTHER HARNESS — over the Model Context
 * Protocol, a client as Claude Code or opencode would be one. It is told the
 * method, finds the tools, builds from a page, proofs, is read by the second
 * reader, and the file goes — through the same gates as the bot's.
 */
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Session, memoryLedger } from '@siksamitra/agent';
import { scripted, testHost } from '../../../../packages/agent/src/__tests__/fixtures.js';
import { mcpServer } from '../mcp-server.js';

const PRICE = { input: 0.28, cached: 0.028, output: 0.42 };

async function connected() {
  const host = testHost();
  const reviewer = scripted([{ say: 'Compared s-1 with w1 lines 5-8.\nVERDICT: clean' }]);
  const session = new Session({
    id: 'mcp-test', mode: 'deliver', model: scripted([]), price: PRICE, host, ledger: memoryLedger(), limits: {},
    reviewer: { model: reviewer, price: PRICE },
  });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await mcpServer({ session, host, version: 'test' }).connect(a);
  const client = new Client({ name: 'a harness', version: '1' });
  await client.connect(b);
  const call = async (name: string, args: Record<string, unknown> = {}): Promise<{ text: string; isError: boolean }> => {
    const r = await client.callTool({ name, arguments: args }) as { content: { type: string; text?: string }[]; isError?: boolean };
    return { text: r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n'), isError: r.isError === true };
  };
  return { client, call, host, reviewer };
}

describe('śikṣāmitra over MCP', () => {
  it('a client is told the method, and offered the bot’s tools', async () => {
    const { client } = await connected();
    expect(client.getInstructions()).toMatch(/Delivering a text — in this order, every time/);
    const names = (await client.listTools()).tools.map((t) => t.name);
    for (const n of ['find_text', 'fetch_page', 'read_witness', 'build_document', 'house_style', 'proof', 'check', 'review', 'deliver']) {
      expect(names).toContain(n);
    }
    expect((await client.listTools()).tools.find((t) => t.name === 'build_document')!.inputSchema).toMatchObject({ type: 'object', required: ['title', 'source', 'sections'] });
  });

  it('from a page to a file, through the same gates', async () => {
    const { call, host, reviewer } = await connected();
    expect((await call('house_style')).text).toMatch(/^HIS HOUSE STYLE/);
    expect((await call('fetch_page', { url: 'https://sanskritdocuments.org/doc_veda/purusha.html' })).text).toMatch(/^w1: "Purusha Suktam"/);
    await call('build_document', { title: 'puruṣa sūktam', source: 'taittiriya', locus: 'taittirīya āraṇyaka 3.12', sections: [{ witness: 'w1', lines: '5-8' }] });
    expect((await call('proof')).text).toMatch(/^“puruṣa sūktam”[\s\S]*the proofreader finds nothing$/);
    /* Not before a second reading. */
    expect((await call('deliver')).text).toMatch(/^not delivered — a document built here is read by a second reader first/);
    expect((await call('review', { focus: 'the Taittirīya puruṣa sūktam' })).text).toMatch(/VERDICT: clean/);
    expect(reviewer.requests).toHaveLength(1);
    expect((await call('deliver')).text).toMatch(/^delivered puruṣa sūktam\.pdf/);
    expect(host.delivered.map((f) => f.name)).toEqual(['puruṣa sūktam.pdf']);
  });

  it('a tool that fails says so, as an error the client can read', async () => {
    const { call } = await connected();
    expect(await call('proof')).toEqual({ text: expect.stringMatching(/^error: no document is open/), isError: true });
    expect((await call('no_such_tool')).isError).toBe(true);
  });
});
