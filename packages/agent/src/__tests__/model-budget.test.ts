/**
 * The provider's wire and the money — read from what the providers actually
 * send, and stopped where the limits say.
 */
import { describe, expect, it } from 'vitest';
import {
  OverBudget, UnknownPrice, checkBudget, costOf, deepseek, memoryLedger, chatCompletions, priceOf, toWire, usageOf, type FetchLike,
} from '../index.js';

describe('usage, as each provider reports it', () => {
  it('DeepSeek names its cache hits prompt_cache_hit_tokens', () => {
    expect(usageOf({ prompt_tokens: 1200, completion_tokens: 80, prompt_cache_hit_tokens: 1024, prompt_cache_miss_tokens: 176 }))
      .toEqual({ input: 1200, cached: 1024, output: 80 });
  });
  it('the other common name is prompt_tokens_details.cached_tokens', () => {
    expect(usageOf({ prompt_tokens: 900, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 512 } }))
      .toEqual({ input: 900, cached: 512, output: 10 });
  });
  it('and nothing reported is nothing, never NaN', () => {
    expect(usageOf(undefined)).toEqual({ input: 0, cached: 0, output: 0 });
  });
});

describe('the price of a reply', () => {
  it('cached input at the cached rate, the rest at the full one', () => {
    const p = { input: 0.28, cached: 0.028, output: 0.42 };
    expect(costOf({ input: 1_000_000, cached: 800_000, output: 100_000 }, p)).toBeCloseTo(0.2 * 0.28 + 0.8 * 0.028 + 0.1 * 0.42, 10);
  });
  it('a model with no known price is refused, never guessed', () => {
    expect(() => priceOf('some-new-model')).toThrow(UnknownPrice);
    expect(priceOf('some-new-model', { 'some-new-model': { input: 1, cached: 0.1, output: 2 } }).output).toBe(2);
  });
});

describe('the limits', () => {
  const usage = { input: 1, cached: 0, output: 1 };
  it('the global limit counts every session, and stops the next call', async () => {
    const ledger = memoryLedger();
    await ledger.record({ at: '', session: 'a', model: 'm', usage, cost: 0.6 });
    await ledger.record({ at: '', session: 'b', model: 'm', usage, cost: 0.5 });
    await expect(checkBudget(ledger, { global: 1 }, 'c', 0)).rejects.toThrow(OverBudget);
    await expect(checkBudget(ledger, { global: 2 }, 'c', 0)).resolves.toBeUndefined();
  });
  it('a session’s limit is that session’s, and a turn’s that turn’s', async () => {
    const ledger = memoryLedger();
    await ledger.record({ at: '', session: 'a', model: 'm', usage, cost: 0.3 });
    await expect(checkBudget(ledger, { session: 0.25 }, 'a', 0)).rejects.toThrow(/session/);
    await expect(checkBudget(ledger, { session: 0.25 }, 'b', 0)).resolves.toBeUndefined();
    await expect(checkBudget(ledger, { turn: 0.1 }, 'b', 0.1)).rejects.toThrow(/turn/);
  });
});

describe('the wire', () => {
  it('with tools, a thinking model’s reasoning goes back for EVERY earlier turn, as DeepSeek requires', () => {
    const wire = toWire([
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'a', reasoning: 'old thoughts' },
      { role: 'user', content: 'two' },
      { role: 'assistant', content: null, toolCalls: [{ id: 'x', name: 'outline', arguments: '{}' }], reasoning: 'new thoughts' },
      { role: 'tool', toolCallId: 'x', content: 'r' },
    ]);
    expect(wire[1]).toMatchObject({ reasoning_content: 'old thoughts' });
    expect(wire[3]).toMatchObject({ reasoning_content: 'new thoughts', tool_calls: [{ id: 'x', type: 'function', function: { name: 'outline', arguments: '{}' } }] });
    expect(wire[4]).toEqual({ role: 'tool', content: 'r', tool_call_id: 'x' });
    /* Without tools it is ignored by the API, so it is not sent. */
    expect(toWire([{ role: 'assistant', content: 'a', reasoning: 'r' }], false)[0]).not.toHaveProperty('reasoning_content');
  });

  it('DeepSeek by name: V4.1 Flash, its URL, and its thinking switch in the body', async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetch: FetchLike = async (url, init) => {
      bodies.push({ url, ...JSON.parse(init.body!) as Record<string, unknown> });
      return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'ok' } }], usage: {} }) };
    };
    await deepseek({ apiKey: 'k', fetch }).complete({ messages: [], tools: [] });
    await deepseek({ apiKey: 'k', fetch, thinking: 'off' }).complete({ messages: [], tools: [] });
    expect(bodies[0]).toMatchObject({ url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-flash', thinking: { type: 'enabled' }, reasoning_effort: 'high' });
    expect(bodies[1]).toMatchObject({ thinking: { type: 'disabled' } });
    expect(bodies[1]).not.toHaveProperty('reasoning_effort');
  });

  it('one POST, temperature 0, the tools; a 429 is tried again and the tool calls are read', async () => {
    const sent: { url: string; body: Record<string, unknown>; auth: string }[] = [];
    let first = true;
    const fetch: FetchLike = async (url, init) => {
      sent.push({ url, body: JSON.parse(init.body!) as Record<string, unknown>, auth: init.headers.authorization! });
      if (first) { first = false; return { ok: false, status: 429, text: async () => 'slow down' }; }
      return {
        ok: true, status: 200,
        text: async () => JSON.stringify({
          choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'outline', arguments: '{}' } }] } }],
          usage: { prompt_tokens: 50, completion_tokens: 5, prompt_cache_hit_tokens: 0 },
        }),
      };
    };
    const model = chatCompletions({ baseUrl: 'https://api.deepseek.com/', apiKey: 'sk-test', model: 'deepseek-chat', fetch, wait: async () => undefined });
    const reply = await model.complete({ messages: [{ role: 'user', content: 'hi' }], tools: [{ name: 'outline', description: 'd', parameters: { type: 'object' } }] });
    expect(sent).toHaveLength(2);
    expect(sent[1]!.url).toBe('https://api.deepseek.com/chat/completions');
    expect(sent[1]!.auth).toBe('Bearer sk-test');
    expect(sent[1]!.body).toMatchObject({ model: 'deepseek-chat', temperature: 0, stream: true, tools: [{ type: 'function', function: { name: 'outline' } }] });
    expect(reply.message.toolCalls).toEqual([{ id: 't1', name: 'outline', arguments: '{}' }]);
    expect(reply.usage).toEqual({ input: 50, cached: 0, output: 5 });
  });

  it('a refusal that is not worth retrying is said, with the provider’s words', async () => {
    const fetch: FetchLike = async () => ({ ok: false, status: 401, text: async () => '{"error":"invalid key"}' });
    const model = chatCompletions({ baseUrl: 'https://x', apiKey: 'k', model: 'm', fetch });
    await expect(model.complete({ messages: [], tools: [] })).rejects.toThrow(/401.*invalid key/);
  });
});

describe('a provider that does not answer', () => {
  it('is given up after its time, tried again, and then said — never waited on for ever', async () => {
    let calls = 0;
    const fetch: FetchLike = () => { calls += 1; return new Promise(() => undefined); };
    const model = chatCompletions({ baseUrl: 'https://x', apiKey: 'k', model: 'm', fetch, timeoutMs: 20, retries: 1 });
    await expect(model.complete({ messages: [], tools: [] })).rejects.toThrow(/said nothing for/);
    expect(calls).toBe(2);
  });
});
