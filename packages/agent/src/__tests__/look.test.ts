/**
 * THE AGENT CAN SEE ITS PAGE — selectively, and once.
 *
 * DeepSeek V4.1 Flash takes an image in a user message only, at most 1024
 * tokens a picture. `look` asks the host for a page; the loop shows it with the
 * next request and keeps only the caption, so a session does not carry its
 * pictures from turn to turn, and a host that cannot render, or a model that
 * cannot see, is never offered the tool.
 */
import { describe, expect, it } from 'vitest';
import { Workspace, documentOf, memoryLedger, runTurn, toWire, toolsFor, type Host, type Message, type Model } from '../index.js';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const host: Host = { look: async (_doc, page) => ({ png: PNG, page, pages: 3 }) };

describe('a picture on the wire', () => {
  it('is a user message’s content parts: its text, then the image', () => {
    const wire = toWire([{ role: 'user', content: 'page 1', images: ['data:image/png;base64,AAAA'] }]);
    expect(wire[0]).toEqual({
      role: 'user',
      content: [{ type: 'text', text: 'page 1' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA', detail: 'high' } }],
    });
    expect(toWire([{ role: 'user', content: 'plain' }])[0]).toEqual({ role: 'user', content: 'plain' });
  });
});

describe('look, in a turn', () => {
  it('shows the page with the next request only, and keeps its caption, not the picture', async () => {
    const seen: Message[][] = [];
    let step = 0;
    const model: Model = {
      id: 'deepseek-flash',
      complete: async ({ messages }) => {
        seen.push(messages.map((m) => ({ ...m })));
        step += 1;
        const usage = { input: 1, cached: 0, output: 1 };
        if (step === 1) return { usage, finish: 'tool_calls', message: { role: 'assistant', content: null, toolCalls: [{ id: 'l1', name: 'look', arguments: '{"page":2}' }] } };
        if (step === 2) return { usage, finish: 'tool_calls', message: { role: 'assistant', content: null, toolCalls: [{ id: 'o1', name: 'outline', arguments: '{}' }] } };
        return { usage, finish: 'stop', message: { role: 'assistant', content: 'The page looks right.' } };
      },
    };
    const ws = new Workspace();
    ws.open(documentOf({ title: 'x', sections: [{ verses: [{ lines: ['oṁ ।'] }] }] }));
    const messages: Message[] = [];
    const tools = toolsFor('document', host);
    const done = await runTurn({
      model, price: { input: 0, cached: 0, output: 0 }, tools, system: 's', messages,
      ctx: { ws, host, review: async () => '' }, ledger: memoryLedger(), limits: { global: 9, session: 9, turn: 9 }, session: 't',
    }, 'how does page 2 look?');
    expect(done.text).toBe('The page looks right.');
    const withImage = (ms: Message[]) => ms.filter((m) => m.role === 'user' && (m as { images?: string[] }).images !== undefined);
    /* The request right after the look carries the picture … */
    expect(withImage(seen[1]!)).toHaveLength(1);
    expect((withImage(seen[1]!)[0] as { images: string[] }).images[0]).toMatch(/^data:image\/png;base64,/);
    /* … the one after it does not, and the conversation keeps only the caption. */
    expect(withImage(seen[2]!)).toHaveLength(0);
    expect(withImage(messages)).toHaveLength(0);
    expect(messages.some((m) => m.role === 'user' && m.content.includes('page 2 of 3'))).toBe(true);
  });
});

describe('who is offered look', () => {
  it('a host that can render', () => {
    expect(toolsFor('deliver', host).some((t) => t.spec.name === 'look')).toBe(true);
  });
  it('and no other — the Word panel, or a model that does not see', () => {
    expect(toolsFor('deliver', {}).some((t) => t.spec.name === 'look')).toBe(false);
  });
});
