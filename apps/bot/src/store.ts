/**
 * WHAT THE SERVER KEEPS — the money spent, and each person's session.
 *
 * THE LEDGER is one append-only file of JSON lines, every reply's cost on its
 * own line, read back whole to answer "how much so far". One file for every
 * chat, so the GLOBAL limit is one number however many people are using the
 * bot; append-only, so a crash loses at most the line being written and never
 * forgets money already spent.
 *
 * SESSIONS are one JSON file each, named by the chat: the conversation, the
 * open document, its witnesses — `Session.save()`'s shape.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Ledger, LedgerEntry, SessionState } from '@siksamitra/agent';

export function fileLedger(path: string): Ledger {
  mkdirSync(join(path, '..'), { recursive: true });
  const all = (): LedgerEntry[] => (existsSync(path)
    ? readFileSync(path, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as LedgerEntry)
    : []);
  return {
    async spent(session) {
      return all().filter((e) => session === undefined || e.session === session).reduce((n, e) => n + e.cost, 0);
    },
    async record(e) {
      appendFileSync(path, `${JSON.stringify(e)}\n`, 'utf8');
    },
  };
}

export interface SessionStore {
  load(id: string): SessionState | undefined;
  save(state: SessionState): void;
  forget(id: string): void;
}

export function fileSessions(dir: string): SessionStore {
  mkdirSync(dir, { recursive: true });
  const file = (id: string): string => join(dir, `${id.replace(/[^A-Za-z0-9_-]/g, '_')}.json`);
  return {
    load(id) {
      const f = file(id);
      return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as SessionState) : undefined;
    },
    save(state) { writeFileSync(file(state.id), JSON.stringify(state), 'utf8'); },
    forget(id) { if (existsSync(file(id))) writeFileSync(file(id), JSON.stringify({ id, mode: 'deliver', messages: [], witnesses: [], builtFrom: [] }), 'utf8'); },
  };
}
