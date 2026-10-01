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
  | { readonly kind: 'tool'; readonly name: string; readonly args: string }
  | { readonly kind: 'result'; readonly name: string; readonly text: string; readonly failed: boolean }
  | { readonly kind: 'reply'; readonly text: string }
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
}

export interface TurnResult {
  readonly text: string;
  readonly cost: number;
  readonly steps: number;
  readonly usage: Usage;
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

export async function runTurn(opts: TurnOptions, userText: string): Promise<TurnResult> {
  const max = opts.maxSteps ?? 24;
  const maxResult = opts.maxResult ?? 6000;
  const byName = new Map(opts.tools.map((t) => [t.spec.name, t]));
  const specs = opts.tools.map((t) => t.spec);
  opts.messages.push({ role: 'user', content: userText });
  let cost = 0;
  let usage: Usage = { input: 0, cached: 0, output: 0 };

  for (let step = 1; step <= max; step += 1) {
    await checkBudget(opts.ledger, opts.limits, opts.session, cost);
    /* Told before the steps run out, and the last one answers in words: a
       turn that used every step on searching gave the person nothing at all. */
    if (max >= 6 && step === max - 2) {
      opts.messages.push({ role: 'user', content: '(from the program: three steps are left in this turn — finish now: deliver what you have, or tell the person what you found and what you need from them)' });
    }
    const last = step === max;
    const reply = await opts.model.complete({ messages: [{ role: 'system', content: opts.system }, ...opts.messages], tools: last ? [] : specs });
    const c = costOf(reply.usage, opts.price);
    cost += c;
    usage = add(usage, reply.usage);
    await opts.ledger.record({
      at: new Date().toISOString(), session: opts.session, ...(opts.user === undefined ? {} : { user: opts.user }),
      model: opts.model.id, usage: reply.usage, cost: c,
    });
    opts.onEvent?.({ kind: 'usage', usage: reply.usage, cost: c });
    opts.messages.push(reply.message);

    const calls = reply.message.toolCalls ?? [];
    if (calls.length === 0) {
      const text = reply.message.content ?? '';
      opts.onEvent?.({ kind: 'reply', text });
      return { text, cost, steps: step, usage };
    }
    for (const call of calls) {
      opts.onEvent?.({ kind: 'tool', name: call.name, args: call.arguments });
      const tool = byName.get(call.name);
      let text: string;
      let failed = false;
      try {
        if (tool === undefined) throw new Error(`there is no tool "${call.name}"`);
        const args = JSON.parse(call.arguments === '' ? '{}' : call.arguments) as Record<string, unknown>;
        text = await tool.run(args, opts.ctx);
      } catch (e) {
        failed = true;
        text = `error: ${withoutPaths(e instanceof Error ? e.message : String(e))}`;
      }
      opts.onEvent?.({ kind: 'result', name: call.name, text, failed });
      opts.messages.push({ role: 'tool', toolCallId: call.id, content: capped(text, maxResult) });
    }
  }
  const text = `Stopped after ${max} steps without finishing. Say how to go on, or ask for less at once.`;
  opts.messages.push({ role: 'assistant', content: text });
  return { text, cost, steps: max, usage };
}
