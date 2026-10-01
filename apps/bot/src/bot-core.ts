/**
 * WHAT THE BOT DOES WITH A MESSAGE — without Telegram, so it can be tested.
 *
 *   - only the people on the allowed list are answered — by Telegram
 *     username (`@name`, the owner's choice) or by id; anyone else is told
 *     only that the bot is private;
 *   - NOTHING INTERNAL LEAVES: every reply is scrubbed of the server's
 *     secrets and paths before it is sent — the model never has the key, and
 *     this is the last line in case a page or a fault ever puts one in front
 *     of it;
 *   - each chat has its own session, kept on disk between messages and
 *     restarts ("individual sessions");
 *   - one request at a time per chat: a second message while the first is
 *     being worked on waits for it;
 *   - the money: every reply is in the one ledger, and the GLOBAL limit stops
 *     the bot for everyone when it is reached;
 *   - what the agent delivers comes back as files with the answer.
 *
 * `/new` forgets the chat's session; `/spent` says what has been spent.
 */
import {
  OverBudget, Session, withoutPaths, type Delivered, type Host, type Ledger, type Limits, type Model, type Price,
} from '@siksamitra/agent';
import { createHash } from 'node:crypto';
import type { SessionStore } from './store.js';

export interface BotDeps {
  readonly model: Model;
  readonly price: Price;
  readonly limits: Limits;
  readonly ledger: Ledger;
  readonly sessions: SessionStore;
  /** The host for a chat; `deliver` is the bot's, so files come back with the answer. */
  readonly host: (deliver: (f: Delivered) => Promise<void>) => Host;
  /** Who may use it: `@username` (any case) or a numeric Telegram id. */
  readonly allowed: ReadonlySet<string>;
  /** Who may ask what has been spent. */
  readonly owners?: ReadonlySet<string>;
  /** Strings that must never appear in a reply: the key, the token. */
  readonly secrets?: readonly string[];
  /** Progress while a request is worked on — a tool's name. */
  readonly progress?: (chat: string, what: string) => void;
  /** One line per request for the server's log: never what was asked or answered. */
  readonly log?: (line: TurnLog) => void;
}

/** What the server's log keeps of a request: how it went, and nothing anyone said. */
export interface TurnLog {
  readonly chat: string;
  readonly steps: number;
  readonly cost: number;
  readonly files: readonly string[];
  readonly ms: number;
  readonly outcome: 'answered' | 'over-budget' | 'failed';
}

export interface BotReply {
  readonly text: string;
  readonly files: readonly Delivered[];
}

const HELP = 'Send me what you need, in your own words — for example: '
  + '“the Puruṣa Sūktam, as the Taittirīya has it” or “Durgā Sūktam as a Word file”. '
  + 'I find the text, mark it by the śikṣā rules, check it and send it back, as a PDF unless you ask for a Word '
  + 'file (.docx), a śikṣāmitra file (.smdoc) or the VedaUnion website upload. /new starts over.';

/** A Telegram user as the bot sees them. */
export interface Who { readonly id: string; readonly username?: string }

/** Is this person on a list of `@usernames` and ids? */
export function listed(list: ReadonlySet<string>, who: Who): boolean {
  if (list.has(who.id)) return true;
  if (who.username === undefined || who.username === '') return false;
  const name = who.username.toLowerCase();
  for (const entry of list) if (entry.replace(/^@/, '').toLowerCase() === name) return true;
  return false;
}

/** What may be said: no secret, no API-key-shaped string, no bot token, no path of the server. */
export function scrubbed(text: string, secrets: readonly string[] = []): string {
  let out = text;
  for (const s of secrets) if (s.length >= 8) out = out.split(s).join('[hidden]');
  out = out.replace(/\bsk-[A-Za-z0-9_-]{16,}/g, '[hidden]').replace(/\b\d{6,}:[A-Za-z0-9_-]{30,}\b/g, '[hidden]');
  return withoutPaths(out);
}

/** A chat as the log names it: a short tag, not its id. */
export const chatTag = (chat: string): string => createHash('sha256').update(`siksamitra:${chat}`).digest('hex').slice(0, 10);

/** Messages from one chat run one after another. */
const queues = new Map<string, Promise<unknown>>();
function serially<T>(chat: string, work: () => Promise<T>): Promise<T> {
  const before = queues.get(chat) ?? Promise.resolve();
  const next = before.then(work, work);
  queues.set(chat, next.catch(() => undefined));
  return next;
}

export function botCore(deps: BotDeps) {
  return {
    async handle(chat: string, who: Who, text: string): Promise<BotReply> {
      const reply = await answer(chat, who, text);
      return { ...reply, text: scrubbed(reply.text, deps.secrets) };
    },
  };

  async function answer(chat: string, who: Who, text: string): Promise<BotReply> {
      const user = who.id;
      if (!listed(deps.allowed, who)) return { text: 'This bot is private.', files: [] };
      const said = text.trim();
      if (said === '/start' || said === '/help') return { text: HELP, files: [] };
      if (said === '/new') { deps.sessions.forget(chat); return { text: 'Started over — what do you need?', files: [] }; }
      if (said === '/spent') {
        if (deps.owners === undefined || !listed(deps.owners, who)) return { text: HELP, files: [] };
        const all = await deps.ledger.spent();
        const mine = await deps.ledger.spent(chat);
        return { text: `Spent: $${mine.toFixed(4)} in this chat, $${all.toFixed(4)} in all${deps.limits.global === undefined ? '' : ` of $${deps.limits.global.toFixed(2)}`}.`, files: [] };
      }
      return serially(chat, async () => {
        const files: Delivered[] = [];
        const session = new Session({
          id: chat, user, mode: 'deliver', model: deps.model, price: deps.price, limits: deps.limits, ledger: deps.ledger,
          host: deps.host(async (f) => { files.push(f); }),
          ...(deps.progress === undefined ? {} : { onEvent: (e) => { if (e.kind === 'tool') deps.progress!(chat, e.name); } }),
        }, deps.sessions.load(chat));
        const started = Date.now();
        const note = (outcome: TurnLog['outcome'], steps = 0, cost = 0): void => deps.log?.({
          chat: chatTag(chat), steps, cost, files: files.map((f) => f.format), ms: Date.now() - started, outcome,
        });
        try {
          const done = await session.ask(said);
          note('answered', done.steps, done.cost);
          return { text: done.text || 'Done.', files };
        } catch (e) {
          note(e instanceof OverBudget ? 'over-budget' : 'failed');
          if (e instanceof OverBudget) {
            return {
              text: e.which === 'global'
                ? 'The bot has reached its spending limit and is resting. The owner can raise it.'
                : `This ${e.which === 'session' ? 'conversation' : 'request'} has reached its spending limit. Send /new to start over.`,
              files,
            };
          }
          throw e;
        } finally {
          deps.sessions.save(session.save());
        }
      });
  }
}
