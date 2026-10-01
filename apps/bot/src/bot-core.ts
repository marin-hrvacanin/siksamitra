/**
 * WHAT THE BOT DOES WITH A MESSAGE — without Telegram, so it can be tested.
 *
 *   - only the people on the allowed list are answered; anyone else is told
 *     their id, which is what the owner adds to the list;
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
  OverBudget, Session, type Delivered, type Host, type Ledger, type Limits, type Model, type Price,
} from '@siksamitra/agent';
import type { SessionStore } from './store.js';

export interface BotDeps {
  readonly model: Model;
  readonly price: Price;
  readonly limits: Limits;
  readonly ledger: Ledger;
  readonly sessions: SessionStore;
  /** The host for a chat; `deliver` is the bot's, so files come back with the answer. */
  readonly host: (deliver: (f: Delivered) => Promise<void>) => Host;
  readonly allowed: ReadonlySet<string>;
  /** Progress while a request is worked on — a tool's name. */
  readonly progress?: (chat: string, what: string) => void;
}

export interface BotReply {
  readonly text: string;
  readonly files: readonly Delivered[];
}

const HELP = 'Send me what you need, in your own words — for example: '
  + '“the Puruṣa Sūktam, as the Taittirīya has it” or “Durgā Sūktam as a Word file”. '
  + 'I find the text, mark it by the śikṣā rules, check it and send it back, as a PDF unless you ask for a Word '
  + 'file (.docx), a śikṣāmitra file (.smdoc) or the VedaUnion website upload. /new starts over.';

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
    async handle(chat: string, user: string, text: string): Promise<BotReply> {
      if (!deps.allowed.has(user)) {
        return { text: `This bot is private. Your Telegram id is ${user} — send it to the owner to be added.`, files: [] };
      }
      const said = text.trim();
      if (said === '/start' || said === '/help') return { text: HELP, files: [] };
      if (said === '/new') { deps.sessions.forget(chat); return { text: 'Started over — what do you need?', files: [] }; }
      if (said === '/spent') {
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
        try {
          const done = await session.ask(said);
          return { text: done.text || 'Done.', files };
        } catch (e) {
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
    },
  };
}
