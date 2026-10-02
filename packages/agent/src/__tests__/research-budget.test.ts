/**
 * ONE REQUEST READS SO MUCH OF THE WEB, AND THEN BUILDS.
 *
 * A real run (bhū sūktam, 2026-10-02) spent 18 of its 24 steps on seven
 * searches and eleven pages and never delivered. The tools now say when it is
 * enough, name what there is to build from, and are whole again for the next
 * request.
 */
import { describe, expect, it } from 'vitest';
import { RESEARCH, Workspace, toolsFor, type Host } from '../index.js';

const host: Host = {
  research: {
    search: async (q) => [{ title: `about ${q}`, url: `https://example.org/${encodeURIComponent(q)}`, snippet: '' }],
    fetch: async (url) => ({ title: url, text: 'bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā ।' }),
  },
} as unknown as Host;
const tools = toolsFor('deliver', host);
const call = (ws: Workspace, name: string, args: Record<string, unknown>) =>
  tools.find((t) => t.spec.name === name)!.run(args, { ws, host, review: async () => '' });

describe('the research a request may do', () => {
  it('stops at its budget, and says what there is to build from', async () => {
    const ws = new Workspace();
    for (let i = 0; i < RESEARCH.searches; i += 1) expect(await call(ws, 'web_search', { query: `q${i}` })).toMatch(/^1\. about/);
    expect(await call(ws, 'web_search', { query: 'one more' })).toMatch(/^enough searches/);
    for (let i = 0; i < RESEARCH.pages; i += 1) expect(await call(ws, 'fetch_page', { url: `https://example.org/${i}` })).toMatch(/^w\d+:/);
    const refused = await call(ws, 'fetch_page', { url: 'https://example.org/more' });
    expect(refused).toMatch(/^enough pages/);
    expect(refused).toContain('w1');
    /* Said so that it is not asked again — a real run asked three more times. */
    expect(refused).toMatch(/every further fetch_page is refused/);
    expect(await call(ws, 'web_search', { query: 'and another' })).toMatch(/every further web_search is refused/);
  });

  it('and is whole again when the next request begins', async () => {
    const ws = new Workspace();
    for (let i = 0; i <= RESEARCH.searches; i += 1) await call(ws, 'web_search', { query: `q${i}` });
    ws.newRequest();
    expect(await call(ws, 'web_search', { query: 'next request' })).toMatch(/^1\. about/);
  });
});

describe('what a page costs — a real run spent its five on a frame page read three times and a PDF (nīla sūktam, 2026-10-02)', () => {
  const failing: Host = {
    research: {
      search: async () => [],
      fetch: async (url: string) => {
        if (url.endsWith('.pdf')) throw new Error(`${url} is application/pdf, not a page to read`);
        return { title: url, text: 'bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā ।' };
      },
    },
  } as unknown as Host;
  const run = (ws: Workspace, args: Record<string, unknown>) =>
    toolsFor('deliver', failing).find((t) => t.spec.name === 'fetch_page')!.run(args, { ws, host: failing, review: async () => '' });

  it('a page asked for again is the one already read, and costs nothing', async () => {
    const ws = new Workspace();
    expect(await run(ws, { url: 'https://example.org/ts.htm' })).toMatch(/^w1:/);
    expect(await run(ws, { url: 'https://example.org/ts.htm' })).toMatch(/^w1 is that page, already read/);
    expect(ws.spent.pages).toBe(1);
  });

  it('but the same edition with another passage is another page', async () => {
    const ws = new Workspace();
    await run(ws, { url: 'https://example.org/ts.htm', find: 'bhūmir' });
    await run(ws, { url: 'https://example.org/ts.htm', find: 'dyaur' });
    expect(ws.spent.pages).toBe(2);
  });

  it('a fetch that fails costs nothing but its step', async () => {
    const ws = new Workspace();
    await expect(run(ws, { url: 'https://example.org/hymn.pdf' })).rejects.toThrow(/not a page to read/);
    expect(ws.spent.pages).toBe(0);
  });
});
