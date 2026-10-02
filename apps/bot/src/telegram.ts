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
 *   - WHAT IT IS DOING IS SHOWN: a checklist under the request, each step
 *     with its detail and ticked when done ("✓ Looked in the library for
 *     “gāyatrī” — found …"), the model's slowness said, and the list taken
 *     away when the answer comes;
 *   - AN UPDATE DOES NOT CUT A REQUEST OFF: on stop, the bot takes no new
 *     message, finishes what it is working on, answers, and only then exits
 *     (the container gives it five minutes — `docker-compose.yml`).
 */
import { join } from 'node:path';
import { Bot, GrammyError, InlineKeyboard, InputFile, type Context } from 'grammy';
import { ROOT, loadConfig } from './config.js';
import { botCore, listed, type BotReply, type Who } from './bot-core.js';
import { COMMANDS, conversationOf, nameTask, openTask } from './topics.js';
import { StatusLog, type Ending } from './status.js';
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
  host: (deliver) => nodeHost(ROOT, deliver, join(config.dataDir, 'library')),
  allowed: config.allowed,
  ...(config.contact === undefined ? {} : { contact: config.contact }),
  owners: config.owners,
  secrets: config.secrets,
  log: (line) => console.log(JSON.stringify({ at: new Date().toISOString(), ...line })),
  progress: (chat, step) => {
    const status = statuses.get(chat);
    if (status === undefined) return;
    if ('intent' in step) status.thinking(step.intent);
    else if ('started' in step) status.started(step.tool, step.started, step.by);
    else status.finished(step.tool, step.outcome, step.failed, step.by);
  },
});

/**
 * THE STATUS MESSAGE OF ONE REQUEST — `StatusLog` (`status.ts`) on Telegram.
 *
 * Posted when the work is not quick, and edited as it goes (at most every two
 * seconds, which Telegram allows). NEVER DELETED: when the answer comes it is
 * edited one last time to say how the request ended, and stays in the chat
 * as the record of what was done.
 */
/* The way to stop a request, under its status while it runs — a button, as
   Telegram's own bots have it, rather than a command to remember. */
const STOP = new InlineKeyboard().text('⏹ Stop', 'stop');

class Status {
  private message: Promise<number | null> | null = null;
  private readonly log = new StatusLog();
  private readonly began = Date.now();
  private last = 0;
  private pending: ReturnType<typeof setTimeout> | undefined;
  private quiet: ReturnType<typeof setTimeout> | undefined;
  private readonly start: ReturnType<typeof setTimeout>;
  private closed = false;

  constructor(private readonly ctx: Context) {
    this.start = setTimeout(() => this.show(), 2500);
    this.listen();
  }

  started(tool: string, what: string, by: 'agent' | 'reviewer' = 'agent'): void {
    this.log.started(tool, what, by);
    this.listen();
    this.render();
  }

  finished(tool: string, outcome: string, failed: boolean, by: 'agent' | 'reviewer' = 'agent'): void {
    this.log.finished(tool, outcome, failed, by);
    this.listen();
    this.render();
  }

  thinking(text: string): void { this.log.thinking(text); this.render(); }

  /** The person said something while this request runs. */
  noted(what: string): void { this.log.noted(what); this.render(); }

  /** The request is over: the message says how, and stays. */
  async done(how: Ending = 'answered'): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.start);
    clearTimeout(this.quiet);
    clearTimeout(this.pending);
    if (this.message === null) return;
    this.log.end(how, Date.now() - this.began);
    await this.edit(this.log.text(), true);
  }

  private show(): void {
    if (this.message !== null || this.closed) return;
    this.message = this.ctx.reply(this.log.text(), { reply_markup: STOP }).then((m) => m.message_id, () => null);
  }

  /* An edit at most every two seconds; the last one always goes. */
  private render(): void {
    if (this.message === null || this.closed) return;
    clearTimeout(this.pending);
    const wait = Math.max(0, 2000 - (Date.now() - this.last));
    this.pending = setTimeout(() => {
      this.last = Date.now();
      void this.edit(this.log.text());
    }, wait);
  }

  /* A minute with no step: the model is taking its time — said, not hidden. */
  private listen(): void {
    clearTimeout(this.quiet);
    this.quiet = setTimeout(() => { this.log.quiet(); this.show(); this.render(); }, 60_000);
  }

  /** Every edit keeps the Stop button, but the last, which takes it away. */
  private async edit(text: string, last = false): Promise<void> {
    const id = await this.message;
    if (id == null) return;
    await this.ctx.api.editMessageText(this.ctx.chat!.id, id, text, { reply_markup: last ? { inline_keyboard: [] } : STOP })
      .catch(() => undefined);
  }
}

/** The status line of each chat's request in progress. */
const statuses = new Map<string, Status>();

/** The choices last offered in each conversation, by the button's number. */
const offered = new Map<string, readonly string[]>();
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
  /* Each file goes with what the program says it is — from its own document. */
  for (const f of reply.files) {
    await ctx.replyWithDocument(new InputFile(f.bytes, f.name), f.summary === undefined ? {} : { caption: f.summary.slice(0, 1000) });
  }
  const pieces = telegramPieces(reply.text);
  let keyboard: InlineKeyboard | undefined;
  if (reply.choices !== undefined && ctx.chat !== undefined) {
    const board = new InlineKeyboard();
    reply.choices.options.forEach((o, i) => { board.text(o.slice(0, 60), `choice:${i}`).row(); });
    keyboard = board;
    offered.set(conversationOf(ctx), reply.choices.options);
  } else if (reply.files.length > 0) {
    /* A document delivered: the next thing may be a new task — one press. */
    keyboard = new InlineKeyboard().text('🆕 New task', 'new');
  }
  for (let i = 0; i < pieces.length; i += 1) {
    await sendPiece(ctx, pieces[i]!, i === pieces.length - 1 ? keyboard : undefined);
  }
}

/** A request worked on by itself, tracked so a stop can wait for it. */
function work(ctx: Context, who: Who, text: string): void {
  const chat = conversationOf(ctx);
  /* A request is running here: this message is a note to it, answered at
     once and shown in its checklist — not a second request. */
  const running = statuses.get(chat);
  if (running !== undefined) {
    void core.handle(chat, who, text).then(async (reply) => {
      if (reply.steered === true && text.trim() !== '/stop') running.noted(text.trim());
      await ctx.reply(reply.text);
    }).catch((e: unknown) => { console.error(e); });
    return;
  }
  const typing = setInterval(() => { void ctx.replyWithChatAction('typing').catch(() => undefined); }, 4500);
  void ctx.replyWithChatAction('typing').catch(() => undefined);
  const status = new Status(ctx);
  statuses.set(chat, status);
  const job: Promise<void> = core.handle(chat, who, text)
    .then(async (reply) => { await status.done(reply.stopped === true ? 'stopped' : 'answered'); await answer(ctx, reply); })
    .catch(async (e: unknown) => {
      /* The fault is the server's log's; the person is told only that it failed. */
      console.error(e);
      await status.done('failed');
      await ctx.reply('Something went wrong on my side — please try again, or send /new.').catch(() => undefined);
    })
    .finally(() => {
      clearInterval(typing);
      void status.done();
      if (statuses.get(chat) === status) statuses.delete(chat);
      inflight.delete(job);
    });
  inflight.add(job);
}

const whoOf = (ctx: Context): Who => ({
  id: String(ctx.from!.id), ...(ctx.from!.username === undefined ? {} : { username: ctx.from!.username }),
});

bot.on('message:text', (ctx) => {
  /* Private chats only: in a group every member would see what one asked
     for, and the allowed list is of people, not of rooms. */
  if (ctx.chat.type !== 'private' || stopping) return;
  void (async () => {
    const who = whoOf(ctx);
    const text = ctx.message.text;
    /* A new task is a new topic, where the chat has topics (`topics.ts`). */
    if (text.trim() === '/new' && listed(config.allowed, who) && await openTask(ctx)) return;
    if (listed(config.allowed, who)) void nameTask(ctx, text);
    work(ctx, who, text);
  })();
});

bot.on('callback_query:data', async (ctx) => {
  if (ctx.callbackQuery.data === 'stop') {
    const running = ctx.chat === undefined ? undefined : statuses.get(conversationOf(ctx));
    await ctx.answerCallbackQuery(running === undefined ? {} : { text: 'Stopping at the next step.' }).catch(() => undefined);
    if (running === undefined || ctx.chat?.type !== 'private' || !listed(config.allowed, whoOf(ctx))) return;
    await core.handle(conversationOf(ctx), whoOf(ctx), '/stop').catch((e: unknown) => { console.error(e); });
    return;
  }
  if (ctx.callbackQuery.data === 'new') {
    await ctx.answerCallbackQuery().catch(() => undefined);
    if (ctx.chat?.type !== 'private' || stopping || !listed(config.allowed, whoOf(ctx))) return;
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
    if (await openTask(ctx)) return;
    const reply = await core.handle(conversationOf(ctx), whoOf(ctx), '/new');
    await ctx.reply(reply.text).catch(() => undefined);
    return;
  }
  const m = /^choice:(\d+)$/.exec(ctx.callbackQuery.data);
  const options = ctx.chat === undefined ? undefined : offered.get(conversationOf(ctx));
  const picked = m === null || options === undefined ? undefined : options[Number(m[1])];
  await ctx.answerCallbackQuery().catch(() => undefined);
  if (ctx.chat?.type !== 'private' || stopping) return;
  if (picked === undefined) {
    await ctx.reply('Those choices are from before — please ask again.').catch(() => undefined);
    return;
  }
  offered.delete(conversationOf(ctx));
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

/* The commands in Telegram's menu, so nobody has to remember them. */
await bot.api.setMyCommands([...COMMANDS]).catch((e: unknown) => { console.error('setMyCommands:', e); });
console.log(`śikṣāmitra bot: ${config.model.id}, global limit $${config.limits.global?.toFixed(2)}, ${config.allowed.size} allowed user(s)`);
await bot.start({ drop_pending_updates: false });
