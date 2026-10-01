/**
 * A SESSION — one person's conversation with the agent, and its workspace.
 *
 * Every host keeps its own: the bot one per chat, the Word panel one per
 * document, the app one per window. The harness is shared and the sessions
 * are not ("individual sessions", the owner). A session can be saved and
 * restored — the bot restarts — as plain data: the conversation, the open
 * document in its file form, and the witnesses it was built from.
 *
 * THE REVIEWER is a session of its own for one task: a fresh conversation, the
 * review prompt, and only the tools that read — over the SAME workspace, so it
 * reads the document the agent made and the sources it was made from, and can
 * change neither. Its cost is this session's.
 *
 * A LONG CONVERSATION IS COMPACTED, not cut: when it outgrows its allowance,
 * the answers of tools from earlier turns are replaced by a note, which costs
 * one cache miss and keeps every decision and every word of the person's.
 */
import { readChantFile, writeChantFile } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import type { Ledger, Limits, Price } from './budget.js';
import { runTurn, type AgentEvent, type TurnResult } from './loop.js';
import type { Message, Model } from './model.js';
import { systemFor, toolsFor, type Mode } from './modes.js';
import type { Host, ToolContext } from './tools/types.js';
import { Workspace, type BuiltFrom, type Origin, type Witness } from './workspace.js';

export interface SessionOptions {
  readonly id: string;
  readonly user?: string;
  readonly mode: Mode;
  readonly model: Model;
  readonly price: Price;
  readonly host: Host;
  readonly ledger: Ledger;
  readonly limits: Limits;
  readonly maxSteps?: number;
  /** Characters of conversation kept before older tool answers are compacted. */
  readonly keep?: number;
  readonly onEvent?: (e: AgentEvent) => void;
}

export interface SessionState {
  readonly id: string;
  readonly mode: Mode;
  readonly messages: readonly Message[];
  /** The open document, as its file holds it. */
  readonly doc?: string;
  /** Where it came from — an author's text keeps its marks. */
  readonly origin?: Origin;
  readonly witnesses: readonly Witness[];
  readonly builtFrom: readonly (readonly [string, BuiltFrom])[];
}

const ELIDED = '[an earlier answer, left out to keep the conversation short — call the tool again if you need it]';

/** The conversation with the answers of tools before the last `turns` turns left out. */
export function compact(messages: readonly Message[], keep: number, turns = 2): Message[] {
  const size = messages.reduce((n, m) => n + (('content' in m && typeof m.content === 'string') ? m.content.length : 0), 0);
  if (size <= keep) return [...messages];
  const users = messages.flatMap((m, i) => (m.role === 'user' ? [i] : []));
  const from = users[Math.max(0, users.length - turns)] ?? 0;
  return messages.map((m, i) => (i < from && m.role === 'tool' && m.content !== ELIDED ? { ...m, content: ELIDED } : m));
}

export class Session {
  readonly ws = new Workspace();
  private messages: Message[] = [];

  constructor(private readonly opts: SessionOptions, state?: SessionState) {
    if (state === undefined) return;
    this.messages = [...state.messages];
    for (const w of state.witnesses) this.ws.witnesses.set(w.id, w);
    if (state.doc !== undefined) {
      const read = readChantFile(state.doc);
      if (read.ok) this.ws.open(openChantDoc(read.doc), state.origin ?? 'built');
    }
    for (const [k, v] of state.builtFrom) this.ws.builtFrom.set(k, v);
  }

  get conversation(): readonly Message[] { return this.messages; }

  async ask(text: string): Promise<TurnResult> {
    const o = this.opts;
    this.messages = compact(this.messages, o.keep ?? 160_000);
    const ctx: ToolContext = { ws: this.ws, host: o.host, review: (task) => this.review(task) };
    return runTurn({
      model: o.model, price: o.price, tools: toolsFor(o.mode, o.host), system: systemFor(o.mode),
      messages: this.messages, ctx, ledger: o.ledger, limits: o.limits, session: o.id,
      ...(o.user === undefined ? {} : { user: o.user }),
      ...(o.maxSteps === undefined ? {} : { maxSteps: o.maxSteps }),
      ...(o.onEvent === undefined ? {} : { onEvent: o.onEvent }),
    }, text);
  }

  private async review(task: string): Promise<string> {
    const o = this.opts;
    const ctx: ToolContext = { ws: this.ws, host: o.host, review: async () => 'a reviewer does not ask for a review' };
    const done = await runTurn({
      model: o.model, price: o.price, tools: toolsFor('review', o.host), system: systemFor('review'),
      messages: [], ctx, ledger: o.ledger, limits: o.limits, session: o.id, maxSteps: 14,
      ...(o.user === undefined ? {} : { user: o.user }),
    }, task);
    return `the reviewer reports:\n${done.text}`;
  }

  save(): SessionState {
    const doc = this.ws.doc;
    return {
      id: this.opts.id,
      mode: this.opts.mode,
      messages: this.messages,
      ...(doc === null ? {} : { doc: writeChantFile(doc), origin: this.ws.origin ?? 'built' }),
      witnesses: [...this.ws.witnesses.values()],
      builtFrom: [...this.ws.builtFrom.entries()],
    };
  }
}
