/**
 * A REPLY THAT ARRIVES AS IT IS WRITTEN — chat completions with `stream: true`.
 *
 * Asked for in one piece, a reply is nothing at all until it is finished, so a
 * client cannot tell a model that is writing from a provider that is stuck:
 * both are a connection with nothing on it. It waited a fixed time and gave up
 * on the one that was working — a real request for the bhū sūktam was dropped
 * twice at 120 s while the model wrote it out (2026-10-02). Streamed, every
 * piece of thinking is a sign of life, and a request is given up only when the
 * provider says NOTHING for that long. A keep-alive comment is not a piece of
 * the reply: it is what DeepSeek sends while the request waits in its queue.
 *
 * The pieces are put back together into the very object a reply in one piece
 * is (`choices[0].message`, `usage`), so one function reads both (`replyOf`);
 * a provider that ignores `stream` and answers in one piece is read as it is.
 * The event stream is parsed by `eventsource-parser`, not by us.
 */
import { createParser } from 'eventsource-parser';

/** The part of a response body read here: its bytes, as they come. */
export interface ByteStream {
  getReader(): {
    read(): Promise<{ done: boolean; value?: Uint8Array }>;
    cancel(reason?: unknown): Promise<void>;
  };
}

/** The provider said nothing for as long as it may. */
export class TimedOut extends Error {}

/** The reply stopped before it was finished: worth asking again. */
export class BrokeOff extends Error {}

/** `work`, or `TimedOut` after `ms`. */
export async function within<T>(ms: number, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new TimedOut()), Math.max(0, ms)); });
  try {
    return await Promise.race([work, late]);
  } finally {
    clearTimeout(timer);
  }
}

interface CallDelta { index?: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }
interface Delta { content?: string | null; reasoning_content?: string | null; tool_calls?: CallDelta[] }

/** Pieces in, a reply in one piece out. */
export function assembler() {
  let content = '';
  let wrote = false;
  let reasoning = '';
  const calls: { id: string; type: 'function'; function: { name: string; arguments: string } }[] = [];
  let finish: string | null = null;
  let usage: unknown;
  let pieces = 0;
  let done = false;
  const parser = createParser({
    onEvent(e) {
      pieces += 1;
      if (e.data.trim() === '[DONE]') { done = true; return; }
      let chunk: { choices?: { delta?: Delta; finish_reason?: string | null }[]; usage?: unknown; error?: { message?: string } };
      try {
        chunk = JSON.parse(e.data) as typeof chunk;
      } catch {
        throw new BrokeOff('a piece of the reply could not be read');
      }
      if (chunk.error !== undefined) throw new BrokeOff(chunk.error.message ?? 'the provider sent an error');
      if (chunk.usage != null) usage = chunk.usage;
      const choice = chunk.choices?.[0];
      if (choice === undefined) return;
      const d = choice.delta ?? {};
      if (typeof d.content === 'string') { content += d.content; wrote = true; }
      if (typeof d.reasoning_content === 'string') reasoning += d.reasoning_content;
      /* As OpenAI's own client does: the name is said whole, the arguments in pieces. */
      for (const c of d.tool_calls ?? []) {
        const at = (calls[c.index ?? 0] ??= { id: '', type: 'function', function: { name: '', arguments: '' } });
        if (c.id) at.id = c.id;
        if (c.function?.name) at.function.name = c.function.name;
        if (c.function?.arguments) at.function.arguments += c.function.arguments;
      }
      if (typeof choice.finish_reason === 'string') finish = choice.finish_reason;
    },
  });
  return {
    feed(text: string): void { parser.feed(text); },
    /** Events seen — what tells writing from silence. */
    get pieces(): number { return pieces; },
    get done(): boolean { return done; },
    /** The reply, in the shape a reply in one piece has; `raw` is what came, for a provider that sent one. */
    result(raw: string): Record<string, unknown> {
      if (pieces === 0) {
        if (raw.trim().startsWith('{')) return JSON.parse(raw) as Record<string, unknown>;
        throw new BrokeOff('the reply could not be read');
      }
      if (!done && finish === null) throw new BrokeOff('the reply broke off before it was finished');
      const toolCalls = calls.filter((c) => c !== undefined);
      return {
        choices: [{
          finish_reason: finish,
          message: {
            role: 'assistant',
            content: wrote ? content : null,
            ...(toolCalls.length === 0 ? {} : { tool_calls: toolCalls }),
            ...(reasoning === '' ? {} : { reasoning_content: reasoning }),
          },
        }],
        ...(usage === undefined ? {} : { usage }),
      };
    },
  };
}

/** What a reply in one piece could be at most: past this it is not one. */
const RAW_LIMIT = 4_000_000;

/**
 * Read a streamed reply, giving up when the provider says nothing for `silence`
 * ms. `stop` ends the request (its `AbortController`) when it is given up.
 */
export async function readReply(
  res: { text(): Promise<string>; body?: ByteStream | null },
  silence: number,
  stop: () => void,
): Promise<Record<string, unknown>> {
  const a = assembler();
  const reader = res.body?.getReader();
  if (reader === undefined) {
    const raw = await within(silence, res.text());
    a.feed(raw);
    a.feed('\n\n');
    return a.result(raw);
  }
  const decoder = new TextDecoder();
  let raw = '';
  let heard = Date.now();
  try {
    for (;;) {
      const next = await within(silence - (Date.now() - heard), reader.read());
      if (next.done) break;
      const text = decoder.decode(next.value, { stream: true });
      const before = a.pieces;
      a.feed(text);
      if (a.pieces > before) heard = Date.now();
      if (a.pieces === 0 && raw.length < RAW_LIMIT) raw += text;
      if (a.done) break;
    }
  } catch (e) {
    stop();
    void reader.cancel().catch(() => undefined);
    throw e;
  }
  if (a.done) void reader.cancel().catch(() => undefined);
  const tail = decoder.decode();
  a.feed(`${tail}\n\n`);
  if (a.pieces === 0) raw += tail;
  return a.result(raw);
}
