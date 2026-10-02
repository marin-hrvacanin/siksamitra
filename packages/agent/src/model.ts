/**
 * THE MODEL, BEHIND ONE INTERFACE — any provider that speaks the chat
 * completions protocol, as DeepSeek and most others do, and a model run
 * locally can too.
 *
 * WHAT THE HARNESS NEEDS FROM A MODEL is four things: a reply, the tool calls
 * in it, how many tokens it cost, and how many of those were read from the
 * provider's prompt cache. The last is what makes a long session cheap — a
 * DeepSeek cache hit is a tenth of a miss — and the providers report it in
 * different places (`prompt_cache_hit_tokens`, `prompt_tokens_details.
 * cached_tokens`), so it is read here, once, and every caller sees `Usage`.
 *
 * NO SDK. The request is one POST with a JSON body; a provider's SDK would be
 * a dependency per provider for the same POST. `fetch` is the host's — the
 * browser's in the Word panel and the app, Node's on the server — so this
 * module touches nothing a host may lack.
 */
import { callsInText } from './dsml.js';
import { BrokeOff, TimedOut, readReply, within, type ByteStream } from './stream.js';

/** A JSON Schema, as the providers take it for a tool's parameters. */
export type JsonSchema = { readonly [k: string]: unknown };

export interface ToolSpec {
  readonly name: string;
  readonly description: string;
  readonly parameters: JsonSchema;
}

export interface ToolCall {
  readonly id: string;
  readonly name: string;
  /** The arguments as the model wrote them: JSON, not yet trusted. */
  readonly arguments: string;
}

export type Message =
  | { readonly role: 'system'; readonly content: string }
  /** `images`: pictures shown with it, as `data:` URLs — DeepSeek takes an
   *  image in a user message only (api-docs.deepseek.com/guides/vision). */
  | { readonly role: 'user'; readonly content: string; readonly images?: readonly string[] }
  | {
    readonly role: 'assistant';
    readonly content: string | null;
    readonly toolCalls?: readonly ToolCall[];
    /** A thinking model's reasoning — sent back only within its own turn. */
    readonly reasoning?: string;
  }
  | { readonly role: 'tool'; readonly toolCallId: string; readonly content: string };

export interface Usage {
  /** Prompt tokens, cached or not. */
  readonly input: number;
  /** Of `input`, how many the provider read from its cache. */
  readonly cached: number;
  readonly output: number;
}

export interface Reply {
  readonly message: Extract<Message, { role: 'assistant' }>;
  readonly usage: Usage;
  /** Why the model stopped: `stop`, `tool_calls`, `length`… */
  readonly finish: string;
}

export interface CompleteRequest {
  readonly messages: readonly Message[];
  readonly tools: readonly ToolSpec[];
  readonly maxTokens?: number;
  /** 0 by default: the harness wants the same answer twice. */
  readonly temperature?: number;
}

export interface Model {
  /** The provider's name for it — what a price is looked up by. */
  readonly id: string;
  /** It takes pictures, in a user message: the agent may `look` at its page. */
  readonly sees?: boolean;
  complete(req: CompleteRequest): Promise<Reply>;
}

/**
 * DeepSeek's models that take pictures — V4.1 Flash does, at most 1024 tokens
 * an image (api-docs.deepseek.com/guides/vision). One list, read by every
 * host: the bot's and the app's panel ask the same question here.
 */
export const SEEING: ReadonlySet<string> = new Set(['deepseek-flash']);

/** The part of `fetch` this module uses, so no host has to have more. */
export type FetchLike = (url: string, init: {
  method: string;
  headers: Record<string, string>;
  body?: string;
  /** An `AbortSignal` where the host has one: how a request that never answers is given up. */
  signal?: unknown;
}) => Promise<{ ok: boolean; status: number; text(): Promise<string>; body?: ByteStream | null }>;

export interface ChatCompletionsOptions {
  /** e.g. `https://api.deepseek.com`. */
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly fetch?: FetchLike;
  /** How many times a 429 or a 5xx is tried again. */
  readonly retries?: number;
  /** Waits between tries, in ms; injected so tests do not sleep. */
  readonly wait?: (ms: number) => Promise<void>;
  /** Fields of the provider's own, added to every request body — DeepSeek's `thinking`. */
  readonly extra?: Readonly<Record<string, unknown>>;
  /** It takes pictures (`Model.sees`) — said by whoever knows the provider. */
  readonly sees?: boolean;
  /**
   * How long the provider may say NOTHING before the request is given up and
   * tried again. A provider under load can answer the headers and then hold
   * the body open for minutes — DeepSeek did, on the evening this was written
   * — and a bot waiting on it forever answers nobody. A model that is writing
   * is never cut off: every piece of its reply starts the time again.
   */
  readonly timeoutMs?: number;
}

/** How hard a thinking model thinks; `off` turns thinking off, and only then is temperature honoured. */
export type Thinking = 'off' | 'low' | 'high' | 'max';

/**
 * DeepSeek, by name: its base URL, and its thinking switch in the body
 * (`thinking`, `reasoning_effort`). V4.1 Flash is `deepseek-flash`.
 */
export function deepseek(o: {
  apiKey: string; model?: string; thinking?: Thinking; fetch?: FetchLike; baseUrl?: string;
  timeoutMs?: number; retries?: number;
}): Model {
  const thinking = o.thinking ?? 'high';
  const model = o.model ?? 'deepseek-flash';
  return chatCompletions({
    baseUrl: o.baseUrl ?? 'https://api.deepseek.com',
    apiKey: o.apiKey,
    model,
    sees: SEEING.has(model),
    ...(o.fetch === undefined ? {} : { fetch: o.fetch }),
    ...(o.timeoutMs === undefined ? {} : { timeoutMs: o.timeoutMs }),
    ...(o.retries === undefined ? {} : { retries: o.retries }),
    extra: thinking === 'off'
      ? { thinking: { type: 'disabled' } }
      : { thinking: { type: 'enabled' }, reasoning_effort: thinking },
  });
}

export class ModelError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/* ── the wire format ───────────────────────────────────────────────────── */

interface WireToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
type WirePart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail: 'high' } };
interface WireMessage {
  role: string;
  content: string | null | WirePart[];
  tool_calls?: WireToolCall[];
  tool_call_id?: string;
  reasoning_content?: string;
}

/**
 * The messages as the wire takes them.
 *
 * A thinking model's reasoning: DeepSeek requires that, in a request carrying
 * tools, the `reasoning_content` of EVERY earlier assistant message is sent
 * back, "even for turns where the model did not perform a tool call"
 * (api-docs.deepseek.com/guides/thinking_mode); without tools it is ignored.
 * So it goes back whenever there are tools, and not otherwise.
 */
export function toWire(messages: readonly Message[], withTools = true): WireMessage[] {
  return messages.map((m): WireMessage => {
    if (m.role === 'tool') return { role: 'tool', content: m.content, tool_call_id: m.toolCallId };
    if (m.role === 'user' && m.images !== undefined && m.images.length > 0) {
      return {
        role: 'user',
        content: [{ type: 'text', text: m.content }, ...m.images.map((url) => ({ type: 'image_url' as const, image_url: { url, detail: 'high' as const } }))],
      };
    }
    if (m.role !== 'assistant') return { role: m.role, content: m.content };
    return {
      role: 'assistant',
      content: m.content,
      ...(m.toolCalls === undefined || m.toolCalls.length === 0 ? {} : {
        tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: c.arguments } })),
      }),
      ...(m.reasoning !== undefined && withTools ? { reasoning_content: m.reasoning } : {}),
    };
  });
}

/** What a provider's `usage` says, in the harness's terms. */
export function usageOf(raw: unknown): Usage {
  const u = (raw ?? {}) as Record<string, unknown>;
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const details = (u.prompt_tokens_details ?? {}) as Record<string, unknown>;
  return {
    input: n(u.prompt_tokens),
    /* DeepSeek's name, then the other common one. */
    cached: n(u.prompt_cache_hit_tokens) || n(details.cached_tokens),
    output: n(u.completion_tokens),
  };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => { setTimeout(r, ms); });

/** An `AbortController` where the host has one: how a request given up is ended. */
const controller = (): { signal: unknown; abort(): void } | undefined => {
  const Abort = (globalThis as { AbortController?: new () => { signal: unknown; abort(): void } }).AbortController;
  return Abort === undefined ? undefined : new Abort();
};

export function chatCompletions(opts: ChatCompletionsOptions): Model {
  const doFetch = opts.fetch ?? (globalThis as unknown as { fetch: FetchLike }).fetch;
  const wait = opts.wait ?? sleep;
  const url = `${opts.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  return {
    id: opts.model,
    ...(opts.sees === true ? { sees: true } : {}),
    async complete(req: CompleteRequest): Promise<Reply> {
      const body = JSON.stringify({
        model: opts.model,
        messages: toWire(req.messages, req.tools.length > 0),
        ...(req.tools.length === 0 ? {} : {
          tools: req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
        }),
        temperature: req.temperature ?? 0,
        ...(req.maxTokens === undefined ? {} : { max_tokens: req.maxTokens }),
        /* Streamed, so a model that is writing is never mistaken for one
           that is not (`stream.ts`); the usage comes in the last piece. */
        stream: true,
        stream_options: { include_usage: true },
        ...opts.extra,
      });
      const tries = (opts.retries ?? 2) + 1;
      const silence = opts.timeoutMs ?? 180_000;
      for (let attempt = 1; ; attempt += 1) {
        const control = controller();
        try {
          const res = await within(silence, doFetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.apiKey}` },
            body,
            ...(control === undefined ? {} : { signal: control.signal }),
          }));
          if (!res.ok) {
            const said = await within(silence, res.text()).catch(() => '');
            const again = res.status === 429 || res.status >= 500;
            if (again && attempt < tries) { await wait(1000 * 2 ** (attempt - 1)); continue; }
            throw new ModelError(res.status, `the model answered ${res.status}: ${said.slice(0, 300)}`);
          }
          return replyOf(await readReply(res, silence, () => control?.abort()));
        } catch (e) {
          if (!(e instanceof TimedOut) && !(e instanceof BrokeOff)) throw e;
          control?.abort();
          if (attempt < tries) { if (e instanceof BrokeOff) await wait(1000 * 2 ** (attempt - 1)); continue; }
          if (e instanceof TimedOut) throw new ModelError(408, `the model said nothing for ${Math.round(silence / 1000)} s, ${tries} times`);
          throw new ModelError(502, `${e.message}, ${tries} times`);
        }
      }
    },
  };
}

function replyOf(json: Record<string, unknown>): Reply {
  const choice = ((json.choices as unknown[] | undefined) ?? [])[0] as Record<string, unknown> | undefined;
  if (choice === undefined) throw new ModelError(200, 'the model answered with no choice');
  const m = (choice.message ?? {}) as WireMessage;
  let calls = (m.tool_calls ?? []).map((c): ToolCall => ({ id: c.id, name: c.function.name, arguments: c.function.arguments ?? '{}' }));
  /* An answer is text; parts are what WE send, never what comes back. */
  let content = typeof m.content === 'string' ? m.content : null;
  /* A call it wrote into its message instead of making it (`dsml.ts`). */
  const written = calls.length === 0 && content !== null ? callsInText(content) : null;
  if (written !== null) {
    calls = written.calls.map((c, i) => ({ id: `text-call-${i + 1}`, ...c }));
    content = written.rest === '' ? null : written.rest;
  }
  return {
    message: {
      role: 'assistant',
      content,
      ...(calls.length === 0 ? {} : { toolCalls: calls }),
      ...(typeof m.reasoning_content === 'string' && m.reasoning_content !== '' ? { reasoning: m.reasoning_content } : {}),
    },
    usage: usageOf(json.usage),
    finish: written !== null ? 'tool_calls' : typeof choice.finish_reason === 'string' ? choice.finish_reason : 'stop',
  };
}
