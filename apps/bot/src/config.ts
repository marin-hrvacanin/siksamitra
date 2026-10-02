/**
 * THE SERVER'S SETTINGS — from `.env` at the repository's root (gitignored),
 * or from the environment, which wins.
 *
 * The owner's key is read here and nowhere else: the bot and a terminal run
 * on his machine. Nothing built for anyone else reads this file.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PRICES, deepseek, chatCompletions, type Limits, type Model, type Price, type Thinking } from '@siksamitra/agent';

export const ROOT = resolve(import.meta.dirname, '../../..');

export interface BotConfig {
  readonly model: Model;
  readonly price: Price;
  readonly limits: Limits;
  readonly telegramToken?: string;
  /** Who may use the bot: `@usernames` or numeric Telegram ids. Empty: nobody. */
  readonly allowed: ReadonlySet<string>;
  /** Who may ask what has been spent. */
  readonly owners: ReadonlySet<string>;
  /** Whom someone not on the list writes to, to be added. */
  readonly contact?: string;
  /** What must never appear in a reply. */
  readonly secrets: readonly string[];
  /** Where the ledger, the sessions and the files go. */
  readonly dataDir: string;
}

const num = (v: string | undefined, fallback: number): number => {
  const n = v === undefined || v.trim() === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function loadConfig(): BotConfig {
  const env = join(ROOT, '.env');
  if (existsSync(env)) process.loadEnvFile(env);
  const e = process.env;
  const modelId = e.AGENT_MODEL?.trim() || 'deepseek-flash';
  const base = e.AGENT_BASE_URL?.trim() || 'https://api.deepseek.com';
  const key = e.DEEPSEEK_API_KEY?.trim() || e.AGENT_API_KEY?.trim();
  if (key === undefined || key === '') throw new Error('no API key: set DEEPSEEK_API_KEY in .env');
  const thinking = (e.AGENT_THINKING?.trim() || 'high') as Thinking;
  /* A chat cannot wait nine minutes on one call: two minutes, one more try,
     then the person is told the provider is busy. */
  const timeoutMs = num(e.AGENT_TIMEOUT_S, 120) * 1000;
  const retries = num(e.AGENT_RETRIES, 1);
  const made = base.includes('deepseek.com')
    ? deepseek({ apiKey: key, model: modelId, thinking, baseUrl: base, timeoutMs, retries })
    : chatCompletions({ baseUrl: base, apiKey: key, model: modelId, timeoutMs, retries });
  /* Whether it takes pictures is the agent's to know (`SEEING`); AGENT_VISION
     says so for another provider's model, or 0 turns it off. */
  const vision = e.AGENT_VISION?.trim() ?? '';
  const model: Model = vision === '' ? made : { ...made, sees: vision !== '0' };
  const price = PRICES[modelId] ?? {
    input: num(e.AGENT_PRICE_INPUT, NaN), cached: num(e.AGENT_PRICE_CACHED, NaN), output: num(e.AGENT_PRICE_OUTPUT, NaN),
  };
  if (!Number.isFinite(price.input) || !Number.isFinite(price.output)) {
    throw new Error(`no price for ${modelId}: set AGENT_PRICE_INPUT, AGENT_PRICE_CACHED and AGENT_PRICE_OUTPUT (USD per million tokens)`);
  }
  const token = e.TELEGRAM_BOT_TOKEN?.trim();
  const contact = e.BOT_CONTACT?.trim();
  return {
    model,
    price,
    limits: {
      global: num(e.BOT_GLOBAL_LIMIT_USD, 5),
      session: num(e.BOT_SESSION_LIMIT_USD, 1),
      turn: num(e.BOT_TURN_LIMIT_USD, 0.5),
    },
    ...(token === undefined || token === '' ? {} : { telegramToken: token }),
    allowed: new Set((e.BOT_ALLOWED_USERS ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '')),
    owners: new Set((e.BOT_OWNERS ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '')),
    ...(contact === undefined || contact === '' ? {} : { contact }),
    secrets: [key, token ?? ''].filter((s) => s !== ''),
    dataDir: resolve(ROOT, e.BOT_DATA_DIR?.trim() || 'out/bot'),
  };
}
