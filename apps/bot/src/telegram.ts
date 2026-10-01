/**
 * THE TELEGRAM BOT — grammY, long polling, nothing else to run.
 *
 *   npm run bot        on his server (settings in .env: see .env.example)
 *
 * Telegram is only the wire: what a message does is `bot-core.ts`. While a
 * request is worked on the chat shows "typing", and the files the agent
 * delivers are sent as documents with its answer.
 */
import { join } from 'node:path';
import { Bot, InputFile } from 'grammy';
import { ROOT, loadConfig } from './config.js';
import { botCore } from './bot-core.js';
import { nodeHost } from './host.js';
import { fileLedger, fileSessions } from './store.js';

const config = loadConfig();
if (config.telegramToken === undefined) throw new Error('no TELEGRAM_BOT_TOKEN in .env');
if (config.allowed.size === 0) console.warn('BOT_ALLOWED_USERS is empty: the bot will answer nobody but with their id.');

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
});

bot.on('message:text', async (ctx) => {
  const chat = String(ctx.chat.id);
  const who = { id: String(ctx.from.id), ...(ctx.from.username === undefined ? {} : { username: ctx.from.username }) };
  const typing = setInterval(() => { void ctx.replyWithChatAction('typing').catch(() => undefined); }, 4500);
  void ctx.replyWithChatAction('typing').catch(() => undefined);
  try {
    const reply = await core.handle(chat, who, ctx.message.text);
    for (const f of reply.files) await ctx.replyWithDocument(new InputFile(f.bytes, f.name));
    await ctx.reply(reply.text.slice(0, 4000));
  } catch (e) {
    /* The fault is the server's log's; the person is told only that it failed. */
    console.error(e);
    await ctx.reply('Something went wrong on my side — please try again, or send /new.');
  } finally {
    clearInterval(typing);
  }
});

bot.catch((e) => console.error('telegram:', e.error));
console.log(`śikṣāmitra bot: ${config.model.id}, global limit $${config.limits.global?.toFixed(2)}, ${config.allowed.size} allowed user(s)`);
await bot.start();
