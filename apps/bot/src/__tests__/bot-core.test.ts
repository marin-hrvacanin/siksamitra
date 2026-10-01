/**
 * THE BOT, WITHOUT TELEGRAM — who it answers, what each chat keeps, where the
 * money stops, and the files that come back. The model plays a script.
 */
import { describe, expect, it } from 'vitest';
import { memoryLedger, type SessionState } from '@siksamitra/agent';
import { botCore } from '../bot-core.js';
import type { SessionStore } from '../store.js';
import { scripted, testHost } from '../../../../packages/agent/src/__tests__/fixtures.js';

const PRICE = { input: 0.3, cached: 0.006, output: 1.2 };

function memorySessions(): SessionStore & { all: Map<string, SessionState> } {
  const all = new Map<string, SessionState>();
  return {
    all,
    load: (id) => all.get(id),
    save: (s) => { all.set(s.id, JSON.parse(JSON.stringify(s)) as SessionState); },
    forget: (id) => { all.delete(id); },
  };
}

const deliverSteps = () => [
  { calls: [{ name: 'fetch_page', args: { url: 'https://sanskritdocuments.org/x' } }] },
  { calls: [{ name: 'build_document', args: { title: 'Puruṣa Sūktam', source: 'taittiriya', sections: [{ title: 'Puruṣa Sūktam', witness: 'w1', lines: '5-8' }] } }] },
  { calls: [{ name: 'deliver', args: {} }] },
  { say: 'Here it is, as a PDF.' },
];

function bot(steps = deliverSteps(), limits = { global: 5 }) {
  const model = scripted(steps);
  const ledger = memoryLedger();
  const sessions = memorySessions();
  const core = botCore({
    model, price: PRICE, limits, ledger, sessions, allowed: new Set(['42']),
    host: (deliver) => ({ ...testHost(), deliver }),
  });
  return { core, model, ledger, sessions };
}

describe('the bot', () => {
  it('answers only the people on its list, and tells anyone else their id', async () => {
    const { core, model } = bot();
    const r = await core.handle('c1', '7', 'the Puruṣa Sūktam please');
    expect(r.text).toContain('Your Telegram id is 7');
    expect(model.requests).toHaveLength(0);
  });

  it('a request comes back as its file and the answer, and the chat keeps its session', async () => {
    const { core, sessions, ledger } = bot();
    const r = await core.handle('c1', '42', 'the Puruṣa Sūktam, Taittirīya, please');
    expect(r.text).toBe('Here it is, as a PDF.');
    expect(r.files.map((f) => f.name)).toEqual(['Puruṣa Sūktam.pdf']);
    expect(sessions.all.get('c1')!.doc).toBeTypeOf('string');
    expect(sessions.all.get('c1')!.messages.some((m) => m.role === 'user')).toBe(true);
    expect(await ledger.spent('c1')).toBeGreaterThan(0);
  });

  it('/new forgets the chat, /spent says what was spent', async () => {
    const { core, sessions } = bot();
    await core.handle('c1', '42', 'the Puruṣa Sūktam');
    expect((await core.handle('c1', '42', '/spent')).text).toMatch(/^Spent: \$0\.\d{4} in this chat, \$0\.\d{4} in all of \$5\.00\./);
    await core.handle('c1', '42', '/new');
    expect(sessions.all.has('c1')).toBe(false);
  });

  it('at the global limit it rests, for everyone, without calling the model', async () => {
    const { core, model, ledger } = bot(deliverSteps(), { global: 0.01 });
    await ledger.record({ at: '', session: 'other-chat', model: 'm', usage: { input: 0, cached: 0, output: 0 }, cost: 0.02 });
    const r = await core.handle('c1', '42', 'anything');
    expect(r.text).toMatch(/spending limit and is resting/);
    expect(model.requests).toHaveLength(0);
  });

  it('two messages from one chat are worked on one after the other', async () => {
    const { core, model } = bot([{ say: 'first' }, { say: 'second' }]);
    const [a, b] = await Promise.all([core.handle('c1', '42', 'one'), core.handle('c1', '42', 'two')]);
    expect([a.text, b.text]).toEqual(['first', 'second']);
    /* The second request saw the first: its conversation carries "one" and the answer. */
    const second = model.requests[1]!.messages.filter((m) => m.role === 'user').map((m) => (m as { content: string }).content);
    expect(second).toEqual(['one', 'two']);
  });
});
