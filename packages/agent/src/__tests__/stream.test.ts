/**
 * A REPLY THAT ARRIVES AS IT IS WRITTEN — and is given up only when the
 * provider goes silent.
 *
 * A real request for the bhū sūktam was dropped twice at 120 s while the model
 * wrote the whole text out (2026-10-02): asked for in one piece, a model that
 * is writing and a provider that is stuck look the same. These hold the
 * difference, and that the pieces come back together as the reply they were.
 */
import { describe, expect, it } from 'vitest';
import { chatCompletions, type FetchLike } from '../index.js';
import { assembler } from '../stream.js';

const enc = new TextEncoder();
const sleep = (ms: number): Promise<void> => new Promise((r) => { setTimeout(r, ms); });

/** A body that gives `parts` one by one, each after its pause. */
function body(parts: readonly { after?: number; text?: string; bytes?: Uint8Array }[], onCancel?: () => void) {
  return {
    getReader() {
      let i = 0;
      return {
        async read(): Promise<{ done: boolean; value?: Uint8Array }> {
          const p = parts[i];
          if (p === undefined) return { done: true };
          i += 1;
          if (p.after !== undefined) await sleep(p.after);
          return { done: false, value: p.bytes ?? enc.encode(p.text ?? '') };
        },
        async cancel() { onCancel?.(); },
      };
    },
  };
}
const event = (o: unknown): string => `data: ${JSON.stringify(o)}\n\n`;
const delta = (d: Record<string, unknown>, finish: string | null = null) => event({ choices: [{ index: 0, delta: d, finish_reason: finish }] });

const streamed = (parts: Parameters<typeof body>[0]): FetchLike => async () => ({ ok: true, status: 200, text: async () => '', body: body(parts) });
const modelOf = (fetch: FetchLike, timeoutMs = 1000, retries = 1) =>
  chatCompletions({ baseUrl: 'https://x', apiKey: 'k', model: 'm', fetch, timeoutMs, retries, wait: async () => undefined });

describe('a streamed reply comes back together', () => {
  it('its thinking, its words, a call whose arguments come in pieces, and the usage at the end', async () => {
    const reply = await modelOf(streamed([
      { text: delta({ role: 'assistant', reasoning_content: 'Let me ' }) },
      { text: delta({ reasoning_content: 'build it.' }) },
      { text: delta({ content: 'Building ' }) },
      { text: delta({ content: 'now.' }) },
      { text: delta({ tool_calls: [{ index: 0, id: 'c1', type: 'function', function: { name: 'build_document', arguments: '{"title":' } }] }) },
      { text: delta({ tool_calls: [{ index: 0, function: { arguments: '"bhū sūktam"}' } }] }) },
      { text: delta({ tool_calls: [{ index: 1, id: 'c2', type: 'function', function: { name: 'check', arguments: '{}' } }] }, 'tool_calls') },
      { text: event({ choices: [], usage: { prompt_tokens: 900, completion_tokens: 40, prompt_cache_hit_tokens: 800 } }) },
      { text: 'data: [DONE]\n\n' },
    ])).complete({ messages: [], tools: [] });
    expect(reply.message).toEqual({
      role: 'assistant', content: 'Building now.', reasoning: 'Let me build it.',
      toolCalls: [{ id: 'c1', name: 'build_document', arguments: '{"title":"bhū sūktam"}' }, { id: 'c2', name: 'check', arguments: '{}' }],
    });
    expect(reply.finish).toBe('tool_calls');
    expect(reply.usage).toEqual({ input: 900, cached: 800, output: 40 });
  });

  it('a letter cut in two between pieces is one letter — his Devanāgarī, byte by byte', async () => {
    const whole = enc.encode(delta({ content: 'भूमि॑र्भू॒म्ना' }, 'stop'));
    const parts = [...whole].map((b) => ({ bytes: new Uint8Array([b]) }));
    const reply = await modelOf(streamed([...parts, { text: 'data: [DONE]\n\n' }])).complete({ messages: [], tools: [] });
    expect(reply.message.content).toBe('भूमि॑र्भू॒म्ना');
  });

  it('a provider that ignores `stream` and answers in one piece is read as it is', async () => {
    const one = JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'whole' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
    const reply = await modelOf(streamed([{ text: one.slice(0, 20) }, { text: one.slice(20) }])).complete({ messages: [], tools: [] });
    expect(reply.message.content).toBe('whole');
  });

  it('and a test’s fetch with no body at all, in either form', async () => {
    const asText = (text: string): FetchLike => async () => ({ ok: true, status: 200, text: async () => text });
    expect((await modelOf(asText(`${delta({ content: 'sse' }, 'stop')}data: [DONE]\n\n`)).complete({ messages: [], tools: [] })).message.content).toBe('sse');
    expect((await modelOf(asText(JSON.stringify({ choices: [{ message: { content: 'json' } }] }))).complete({ messages: [], tools: [] })).message.content).toBe('json');
  });

  it('asks for the usage, which only the last piece carries', async () => {
    let sent: Record<string, unknown> = {};
    const fetch: FetchLike = async (_u, init) => {
      sent = JSON.parse(init.body!) as Record<string, unknown>;
      return { ok: true, status: 200, text: async () => '', body: body([{ text: delta({ content: 'x' }, 'stop') }, { text: 'data: [DONE]\n\n' }]) };
    };
    await modelOf(fetch).complete({ messages: [], tools: [] });
    expect(sent).toMatchObject({ stream: true, stream_options: { include_usage: true } });
  });
});

describe('writing is not silence', () => {
  it('a model that writes for longer than the time it may be silent is NOT cut off — the bhū sūktam', async () => {
    let calls = 0;
    const fetch: FetchLike = async () => {
      calls += 1;
      /* Twelve pieces, 25 ms apart: 300 ms of writing against 80 ms of silence allowed. */
      const parts = Array.from({ length: 12 }, (_, i) => ({ after: 25, text: delta({ reasoning_content: `step ${i}. ` }) }));
      return { ok: true, status: 200, text: async () => '', body: body([...parts, { text: delta({ content: 'done' }, 'stop') }, { text: 'data: [DONE]\n\n' }]) };
    };
    const reply = await modelOf(fetch, 80).complete({ messages: [], tools: [] });
    expect(reply.message.content).toBe('done');
    expect(calls).toBe(1);
  });

  it('a provider that only keeps the line open — keep-alives, nothing else — is given up, asked again, then said', async () => {
    let calls = 0;
    let cancelled = 0;
    const aborted: boolean[] = [];
    const fetch: FetchLike = async (_u, init) => {
      calls += 1;
      const signal = init.signal as { aborted: boolean };
      setTimeout(() => aborted.push(signal.aborted), 200);
      const alive = Array.from({ length: 40 }, () => ({ after: 10, text: ': keep-alive\n\n' }));
      return { ok: true, status: 200, text: async () => '', body: body(alive, () => { cancelled += 1; }) };
    };
    await expect(modelOf(fetch, 60).complete({ messages: [], tools: [] })).rejects.toThrow(/said nothing for/);
    expect(calls).toBe(2);
    expect(cancelled).toBe(2);
    await sleep(250);
    expect(aborted).toEqual([true, true]);
  });

  it('a reply that breaks off half-way is asked for again', async () => {
    let calls = 0;
    const fetch: FetchLike = async () => {
      calls += 1;
      const parts = calls === 1
        ? [{ text: delta({ content: 'half' }) }]
        : [{ text: delta({ content: 'whole' }, 'stop') }, { text: 'data: [DONE]\n\n' }];
      return { ok: true, status: 200, text: async () => '', body: body(parts) };
    };
    expect((await modelOf(fetch).complete({ messages: [], tools: [] })).message.content).toBe('whole');
    expect(calls).toBe(2);
  });

  it('an error the provider sends in the stream is asked about again, then said', async () => {
    const fetch: FetchLike = async () => ({ ok: true, status: 200, text: async () => '', body: body([{ text: event({ error: { message: 'overloaded' } }) }]) });
    await expect(modelOf(fetch).complete({ messages: [], tools: [] })).rejects.toThrow(/overloaded, 2 times/);
  });
});

describe('the assembler, alone', () => {
  it('nothing read is not a reply', () => {
    expect(() => assembler().result('')).toThrow(/could not be read/);
  });
  it('a comment is not a piece of the reply', () => {
    const a = assembler();
    a.feed(': keep-alive\n\n');
    expect(a.pieces).toBe(0);
    a.feed(delta({ content: 'x' }));
    expect(a.pieces).toBe(1);
  });
});
