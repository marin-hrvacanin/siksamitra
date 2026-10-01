/**
 * WHAT IT COSTS, AND WHERE IT STOPS.
 *
 * Every reply is priced from its `Usage` — cached input, fresh input and
 * output, each at the model's own rate — and recorded in a ledger BEFORE the
 * next call is allowed. The limits are checked before every call, not after a
 * turn: a bot on a server with a global limit must not be talked past it by
 * one long turn.
 *
 * The ledger is the host's. In the Word panel it can live in memory; on the
 * server it is a file every bot process shares, so the GLOBAL limit is one
 * number however many people are talking to it.
 *
 * PRICES ARE DATA, in US dollars per million tokens, and a host may give its
 * own for a model this table does not know — a price is never guessed.
 */
import type { Usage } from './model.js';

export interface Price {
  /** Per million prompt tokens not read from the cache. */
  readonly input: number;
  /** Per million prompt tokens read from the cache. */
  readonly cached: number;
  readonly output: number;
}

/**
 * Known rates. DeepSeek's are its PEAK list prices (api-docs.deepseek.com/
 * quick_start/pricing, 2026-10-01) — off-peak is half — so a limit counted at
 * these is never passed; a model not here needs its price from the host.
 */
export const PRICES: Readonly<Record<string, Price>> = {
  'deepseek-flash': { input: 0.3, cached: 0.006, output: 1.2 },
  'deepseek-v4-pro': { input: 1.32, cached: 0.044, output: 3.96 },
  'deepseek-chat': { input: 0.28, cached: 0.028, output: 0.42 },
  'deepseek-reasoner': { input: 0.28, cached: 0.028, output: 0.42 },
  'gpt-4.1-mini': { input: 0.4, cached: 0.1, output: 1.6 },
  'gpt-4.1': { input: 2, cached: 0.5, output: 8 },
};

export class UnknownPrice extends Error {
  constructor(model: string) {
    super(`no price is known for the model "${model}" — give one in the configuration (input, cached, output per million tokens)`);
  }
}

export function priceOf(model: string, given?: Readonly<Record<string, Price>>): Price {
  const p = given?.[model] ?? PRICES[model];
  if (p === undefined) throw new UnknownPrice(model);
  return p;
}

/** The cost of one reply, in dollars. */
export function costOf(u: Usage, p: Price): number {
  const fresh = Math.max(0, u.input - u.cached);
  return (fresh * p.input + u.cached * p.cached + u.output * p.output) / 1_000_000;
}

export interface LedgerEntry {
  readonly at: string;
  readonly session: string;
  readonly user?: string;
  readonly model: string;
  readonly usage: Usage;
  readonly cost: number;
}

export interface Ledger {
  /** Spent in all, or by one session. */
  spent(session?: string): Promise<number>;
  record(e: LedgerEntry): Promise<void>;
}

/** A ledger in memory — a panel's, or a test's. */
export function memoryLedger(): Ledger & { readonly entries: readonly LedgerEntry[] } {
  const entries: LedgerEntry[] = [];
  return {
    entries,
    async spent(session) {
      return entries.filter((e) => session === undefined || e.session === session).reduce((n, e) => n + e.cost, 0);
    },
    async record(e) { entries.push(e); },
  };
}

export interface Limits {
  /** Across every session and person — a server's whole allowance. */
  readonly global?: number;
  /** One session's. */
  readonly session?: number;
  /** One request's, however many calls it takes. */
  readonly turn?: number;
}

export class OverBudget extends Error {
  constructor(readonly which: keyof Limits, readonly limit: number, readonly spent: number) {
    super(`the ${which} spending limit of $${limit.toFixed(2)} is reached ($${spent.toFixed(4)} spent)`);
  }
}

/** Throws when the next call would start over a limit. */
export async function checkBudget(ledger: Ledger, limits: Limits, session: string, turnSpent: number): Promise<void> {
  if (limits.turn !== undefined && turnSpent >= limits.turn) throw new OverBudget('turn', limits.turn, turnSpent);
  if (limits.session !== undefined) {
    const s = await ledger.spent(session);
    if (s >= limits.session) throw new OverBudget('session', limits.session, s);
  }
  if (limits.global !== undefined) {
    const g = await ledger.spent();
    if (g >= limits.global) throw new OverBudget('global', limits.global, g);
  }
}
