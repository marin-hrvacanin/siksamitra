/**
 * THE TELEGRAM BOT — grammY, long polling, nothing else to run.
 *
 *   npm run bot        on his server (settings in .env: see .env.example)
 *
 * Telegram is only the wire: what a message does is `bot-core.ts`. Here:
 *
 *   - the answer is Telegram's HTML, made from the model's Markdown by a
 *     parser (`telegram-format.ts`); long answers go in several messages, and
 *     a piece Telegram refuses is sent again as plain text;
 *   - choices the agent offers are buttons; a tap is the person's next
 *     message, said back in the chat so the conversation reads as it went;
 *   - every chat is worked on by itself — one person's long request does not
 *     hold up another's — and a chat's own messages one after another;
 *   - AN UPDATE DOES NOT CUT A REQUEST OFF: on stop, the bot takes no new
 *     message, finishes what it is working on, answers, and only then exits
 *     (the container gives it five minutes — `docker-compose.yml`).
 */
import { join } from 'node:path';
import { Bot, GrammyError, InlineKeyboard, InputFile, type Context } from 'grammy';
import { ROOT, loadConfig } from './config.js';
import { botCore, type BotReply, type Who } from './bot-core.js';
import { nodeHost } from './host.js';
import { fileLedger, fileSessions } from './store.js';
import { plainOf, telegramPieces } from '@siksamitra/agent';

const config = loadConfig();
if (config.telegramToken === undefined) throw new Error('no TELEGRAM_BOT_TOKEN in .env');
if (config.allowed.size === 0) console.warn('BOT_ALLOWED_USERS is empty: the bot will answer nobody.');

const bot = new Bot(config.telegramToken);
const core = botCore({
  model: config.model,
  price: config.price,
  limits: config.limits,
  ledger: fileLedger(join(config.dataDir, 'ledger.jsonl')),
  sessions: fileSessions(join(config.dataDir, 'sessions')),
  host: (deliver) => nodeHost(ROOT, deliver),
  allowed: config.allowed,
  owners: config.owners,
  secrets: config.secrets,
  log: (line) => console.log(JSON.stringify({ at: new Date().toISOString(), ...line })),
});

/** The choices last offered in each chat, by the button's number. */
const offered = new Map<number, readonly string[]>();
/** Requests being worked on — what a stop waits for. */
const inflight = new Set<Promise<void>>();
let stopping = false;

/** One piece of the answer: Telegram's HTML, or its plain text if Telegram refuses that. */
async function sendPiece(ctx: Context, html: string, keyboard?: InlineKeyboard): Promise<void> {
  const markup = keyboard === undefined ? {} : { reply_markup: keyboard };
  try {
    await ctx.reply(html, { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...markup });
  } catch (e) {
    if (!(e instanceof GrammyError) || e.error_code !== 400) throw e;
    await ctx.reply(plainOf(html).slice(0, 4000), markup);
  }
}

async function answer(ctx: Context, reply: BotReply): Promise<void> {
  for (const f of reply.files) await ctx.replyWithDocument(new InputFile(f.bytes, f.name));
  const pieces = telegramPieces(reply.text);
  let keyboard: InlineKeyboard | undefined;
  if (reply.choices !== undefined && ctx.chat !== undefined) {
    const board = new InlineKeyboard();
    reply.choices.options.forEach((o, i) => { board.text(o.slice(0, 60), `choice:${i}`).row(); });
    keyboard = board;
    offered.set(ctx.chat.id, reply.choices.options);
  }
  for (let i = 0; i < pieces.length; i += 1) {
    await sendPiece(ctx, pieces[i]!, i === pieces.length - 1 ? keyboard : undefined);
  }
}

/** A request worked on by itself, tracked so a stop can wait for it. */
function work(ctx: Context, who: Who, text: string): void {
  const chat = String(ctx.chat!.id);
  const typing = setInterval(() => { void ctx.replyWithChatAction('typing').catch(() => undefined); }, 4500);
  void ctx.replyWithChatAction('typing').catch(() => undefined);
  const job: Promise<void> = core.handle(chat, who, text)
    .then((reply) => answer(ctx, reply))
    .catch(async (e: unknown) => {
      /* The fault is the server's log's; the person is told only that it failed. */
      console.error(e);
      await ctx.reply('Something went wrong on my side — please try again, or send /new.').catch(() => undefined);
    })
    .finally(() => { clearInterval(typing); inflight.delete(job); });
  inflight.add(job);
}

const whoOf = (ctx: Context): Who => ({
  id: String(ctx.from!.id), ...(ctx.from!.username === undefined ? {} : { username: ctx.from!.username }),
});

bot.on('message:text', (ctx) => {
  /* Private chats only: in a group every member would see what one asked
     for, and the allowed list is of people, not of rooms. */
  if (ctx.chat.type !== 'private' || stopping) return;
  work(ctx, whoOf(ctx), ctx.message.text);
});

bot.on('callback_query:data', async (ctx) => {
  const m = /^choice:(\d+)$/.exec(ctx.callbackQuery.data);
  const options = ctx.chat === undefined ? undefined : offered.get(ctx.chat.id);
  const picked = m === null || options === undefined ? undefined : options[Number(m[1])];
  await ctx.answerCallbackQuery().catch(() => undefined);
  if (ctx.chat?.type !== 'private' || stopping) return;
  if (picked === undefined) {
    await ctx.reply('Those choices are from before — please ask again.').catch(() => undefined);
    return;
  }
  offered.delete(ctx.chat.id);
  /* The buttons go, and the choice is said, so the chat reads as it went. */
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
  await ctx.reply(`→ ${picked}`).catch(() => undefined);
  work(ctx, whoOf(ctx), picked);
});

bot.catch((e) => console.error('telegram:', e.error));

async function stop(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: finishing ${inflight.size} request(s), then stopping`);
  await bot.stop();
  await Promise.allSettled([...inflight]);
  process.exit(0);
}
process.once('SIGTERM', () => { void stop('SIGTERM'); });
process.once('SIGINT', () => { void stop('SIGINT'); });

console.log(`śikṣāmitra bot: ${config.model.id}, global limit $${config.limits.global?.toFixed(2)}, ${config.allowed.size} allowed user(s)`);
await bot.start({ drop_pending_updates: false });
