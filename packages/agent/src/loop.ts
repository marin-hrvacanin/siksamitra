/**
 * THE LOOP — ask the model, run the tools it calls, until it answers.
 *
 * CHEAP BY CONSTRUCTION, because a provider's prompt cache is a prefix cache:
 *
 *   - the SYSTEM PROMPT and the TOOLS come first and never change within a
 *     session, in a fixed order — they are the long part, read from cache;
 *   - the conversation is APPEND-ONLY: nothing earlier is rewritten, so every
 *     call's prompt is the last call's plus what happened since;
 *   - a tool's answer is SHORT and capped, because it is read again on every
 *     later call of the turn.
 *
 * DETERMINISTIC WHERE IT CAN BE: temperature 0, tool calls run one after
 * another in the order the model gave them (two edits to one document are
 * not parallel), and every mark comes from the engine, not from the model.
 *
 * THE BUDGET IS ASKED BEFORE EVERY CALL, not after a turn, and every reply is
 * priced and recorded before the next one is made.
 */
import { checkBudget, costOf, type Ledger, type Limits, type Price } from './budget.js';
import type { Message, Model, Usage } from './model.js';
import type { Tool, ToolContext } from './tools/types.js';

export type AgentEvent =
  | { readonly kind: 'tool'; readonly name: string; readonly args: string; readonly sub?: true }
  | { readonly kind: 'result'; readonly name: string; readonly text: string; readonly failed: boolean; readonly sub?: true }
  | { readonly kind: 'reply'; readonly text: string }
  /** What the agent wrote beside its tool calls: what it is about to do, and why. */
  | { readonly kind: 'intent'; readonly text: string; readonly sub?: true }
  | { readonly kind: 'usage'; readonly usage: Usage; readonly cost: number };

export interface TurnOptions {
  readonly model: Model;
  readonly price: Price;
  readonly tools: readonly Tool[];
  readonly system: string;
  /** The session's conversation; the turn appends to it. */
  readonly messages: Message[];
  readonly ctx: ToolContext;
  readonly ledger: Ledger;
  readonly limits: Limits;
  readonly session: string;
  readonly user?: string;
  readonly maxSteps?: number;
  /** A tool's answer longer than this is cut, and says so. */
  readonly maxResult?: number;
  readonly onEvent?: (e: AgentEvent) => void;
  /**
   * What the person said while the turn ran — a steer. Read before each call
   * of the model and given to it as theirs; the turn goes on with it.
   */
  readonly steers?: () => readonly string[];
  /** The person asked it to stop: the turn ends at the next step. */
  readonly stopped?: () => boolean;
}

export interface TurnResult {
  readonly text: string;
  readonly cost: number;
  readonly steps: number;
  readonly usage: Usage;
  /** The person stopped it. */
  readonly stopped?: true;
}

const add = (a: Usage, b: Usage): Usage => ({ input: a.input + b.input, cached: a.cached + b.cached, output: a.output + b.output });

/**
 * An error as the model may see it: without a path of the machine. A tool's
 * failure is shown to the model, and what the model sees it may repeat to the
 * person — on a server that would be its folders.
 */
export function withoutPaths(message: string): string {
  return message
    .replace(/[A-Za-z]:[\\/][^\s'"`)]+/g, '(a file)')
    .replace(/(?<![\w.])\/(?:home|root|usr|var|etc|opt|srv|tmp|mnt|Users)\/[^\s'"`)]+/g, '(a file)');
}

/** A tool's answer, capped — and saying that it was, and how to see the rest. */
export function capped(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… (${text.length - max} more characters — ask for a narrower range)`;
}

/** What the model is told after a step that thought until it was cut off. */
export const RUNAWAY = '(from the program: your last step thought until it was cut off, and did nothing. Do not deliberate further — make the call you were weighing now. The tools check what you send and say exactly what is wrong: trying costs less than thinking it through.)';

/** What a call is answered with when the reply was cut off before it was written out. */
export const CUT_OFF = 'error: the reply was cut off at its length limit before this call was written out. Think less before it, and send it again — '
  + 'or in parts: build the first verses, then add_verse the rest.';

/** Base64 without Node's `Buffer`: the loop runs in the app and the add-in too. */
function base64Of(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function runTurn(opts: TurnOptions, userText: string): Promise<TurnResult> {
  /* Forty: a real request — two searches, two pages, finding the text in each,
     building, checking, a second look and the file — took twenty-four and
     still had the file to make. */
  const max = opts.maxSteps ?? 40;
  const maxResult = opts.maxResult ?? 6000;
  const byName = new Map(opts.tools.map((t) => [t.spec.name, t]));
  const specs = opts.tools.map((t) => t.spec);
  opts.messages.push({ role: 'user', content: userText });
  let cost = 0;
  let usage: Usage = { input: 0, cached: 0, output: 0 };
  /* Steps that thought until they were cut off — see where a reply is read. */
  let runaways = 0;
  /* What `deliver` handed over in this turn, said when the steps run out. */
  const delivered: string[] = [];

  /* What `look` showed this step, for the next request only (`tools/look.ts`):
     the picture goes with that request and is not kept in the conversation. */
  let shown: { at: number; images: string[] } | null = null;
  /* Pictures asked for while this step's tools run. They go in AFTER every
     result of the step: an answer between a call and its result is refused
     ("an assistant message with tool_calls must be followed by tool
     messages") — which a real run found the first time it looked. */
  let asked: { caption: string; images: string[] } | null = null;
  const ctx: ToolContext = {
    ...opts.ctx,
    show: (png, caption) => {
      const url = `data:image/png;base64,${base64Of(png)}`;
      if (asked === null) asked = { caption, images: [url] };
      else asked.images.push(url);
    },
  };

  for (let step = 1; step <= max; step += 1) {
    await checkBudget(opts.ledger, opts.limits, opts.session, cost);
    /* Told before the steps run out, and the last one answers in words: a
       turn that used every step on searching gave the person nothing at all. */
    if (opts.stopped?.() === true) {
      const text = 'Stopped, as you asked. Tell me how to go on.';
      opts.messages.push({ role: 'assistant', content: text });
      opts.onEvent?.({ kind: 'reply', text });
      return { text, cost, steps: step - 1, usage, stopped: true };
    }
    for (const said of opts.steers?.() ?? []) {
      opts.messages.push({ role: 'user', content: `(the person, while you work: ${said})` });
    }
    if (max >= 6 && step === max - 2) {
      opts.messages.push({ role: 'user', content: '(from the program: three steps are left in this turn — finish now: deliver what you have, or tell the person what you found and what you need from them)' });
    }
    const last = step === max;
    const seen = shown as { at: number; images: string[] } | null;
    const messages = seen === null ? opts.messages
      : opts.messages.map((m, i) => (i === seen.at && m.role === 'user' ? { ...m, images: seen.images } : m));
    shown = null;
    const reply = await opts.model.complete({ messages: [{ role: 'system', content: opts.system }, ...messages], tools: last ? [] : specs });
    const c = costOf(reply.usage, opts.price);
    cost += c;
    usage = add(usage, reply.usage);
    await opts.ledger.record({
      at: new Date().toISOString(), session: opts.session, ...(opts.user === undefined ? {} : { user: opts.user }),
      model: opts.model.id, usage: reply.usage, cost: c,
    });
    opts.onEvent?.({ kind: 'usage', usage: reply.usage, cost: c });
    opts.messages.push(reply.message);

    /* The last step is offered no tools, and a call it writes anyway is not
       run: a real one was, and the person got their PDF and then "Stopped
       after 40 steps without finishing" (2026-10-02). */
    const calls = last ? [] : reply.message.toolCalls ?? [];
    if (last && (reply.message.toolCalls ?? []).length > 0 && (reply.message.content ?? '').trim() === '') {
      const text = ending(max, delivered);
      opts.messages.push({ role: 'assistant', content: text });
      opts.onEvent?.({ kind: 'reply', text });
      return { text, cost, steps: step, usage };
    }
    if (calls.length === 0) {
      const text = reply.message.content ?? '';
      /* A step that thought until the provider cut it off, and did nothing: a
         real request thought 166 000 characters over one letter and ended the
         turn with nothing to show (2026-10-02). It is taken back, and the
         model told to act — twice at most; then the person is told. */
      if (reply.finish === 'length' && text.trim() === '' && !last) {
        opts.messages.pop();
        if (runaways < 2) {
          runaways += 1;
          opts.messages.push({ role: 'user', content: RUNAWAY });
          continue;
        }
        const stuck = 'I got stuck working this one out — tell me how to go on, or ask for less at once.';
        opts.messages.push({ role: 'assistant', content: stuck });
        opts.onEvent?.({ kind: 'reply', text: stuck });
        return { text: stuck, cost, steps: step, usage };
      }
      opts.onEvent?.({ kind: 'reply', text });
      return { text, cost, steps: step, usage };
    }
    const said = reply.message.content?.trim() ?? '';
    if (said !== '') opts.onEvent?.({ kind: 'intent', text: said });
    for (const call of calls) {
      opts.onEvent?.({ kind: 'tool', name: call.name, args: call.arguments });
      const tool = byName.get(call.name);
      let text: string;
      let failed = false;
      try {
        if (tool === undefined) throw new Error(`there is no tool "${call.name}"`);
        const args = JSON.parse(call.arguments === '' ? '{}' : call.arguments) as Record<string, unknown>;
        text = await tool.run(args, ctx);
      } catch (e) {
        failed = true;
        /* A call the length limit cut off half-written is said as that, and
           what to do: a real run was told only "Unterminated string in JSON",
           after thinking 60 000 tokens, and did it again (2026-10-02). */
        text = reply.finish === 'length' && e instanceof SyntaxError ? CUT_OFF
          : `error: ${withoutPaths(e instanceof Error ? e.message : String(e))}`;
      }
      opts.onEvent?.({ kind: 'result', name: call.name, text, failed });
      if (call.name === 'deliver' && !failed && text.startsWith('delivered')) delivered.push(text);
      opts.messages.push({ role: 'tool', toolCallId: call.id, content: capped(text, maxResult) });
    }
    const pictures = asked as { caption: string; images: string[] } | null;
    if (pictures !== null) {
      opts.messages.push({ role: 'user', content: pictures.caption });
      shown = { at: opts.messages.length - 1, images: pictures.images };
      asked = null;
    }
  }
  const text = ending(max, delivered);
  opts.messages.push({ role: 'assistant', content: text });
  return { text, cost, steps: max, usage };
}

/** How a turn that used every step ends — saying what it did deliver, if it did. */
function ending(max: number, delivered: readonly string[]): string {
  if (delivered.length === 0) return `Stopped after ${max} steps without finishing. Say how to go on, or ask for less at once.`;
  const files = delivered.map((d) => d.replace(/^delivered (?:his own file, )?/u, '').replace(/ \(.*$/u, ''));
  return `Sent: ${[...new Set(files)].join(', ')}. That took every step this request had — say if anything should be looked at again.`;
}
