/**
 * THE BOT, WITHOUT TELEGRAM — who it answers, what each chat keeps, where the
 * money stops, and the files that come back. The model plays a script.
 */
import { describe, expect, it } from 'vitest';
import { memoryLedger, type SessionState } from '@siksamitra/agent';
import { botCore, listed, scrubbed } from '../bot-core.js';
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
    model, price: PRICE, limits, ledger, sessions, allowed: new Set(['42', '@Marin_H']), owners: new Set(['@marin_h']),
    secrets: ['sk-THEOWNERSKEY1234567890'],
    host: (deliver) => ({ ...testHost(), deliver }),
  });
  return { core, model, ledger, sessions };
}

describe('the bot', () => {
  it('answers only the people on its list — by username, any case, or by id — and tells anyone else nothing', async () => {
    const { core, model } = bot([{ say: 'one' }, { say: 'two' }]);
    expect((await core.handle('c1', { id: '7', username: 'stranger' }, 'the Puruṣa Sūktam please')).text).toBe('This bot is private.');
    expect(model.requests).toHaveLength(0);
    expect((await core.handle('c2', { id: '99', username: 'marin_h' }, 'hello')).text).toBe('one');
    expect((await core.handle('c3', { id: '42' }, 'hello')).text).toBe('two');
    expect(listed(new Set(['@Marin_H']), { id: '1', username: 'MARIN_H' })).toBe(true);
    expect(listed(new Set(['@marin']), { id: '1' })).toBe(false);
  });

  it('never says a secret, a key, a bot token or a path of the server — whatever the model writes', async () => {
    const leak = 'The key is sk-THEOWNERSKEY1234567890, also sk-abcdefghijklmnopqrstuvwxyz, token 123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsawQ, '
      + 'at /home/bot/siksamitra/.env and C:\\Users\\x\\siksamitra\\.env';
    const { core } = bot([{ say: leak }]);
    const r = await core.handle('c1', { id: '42' }, 'tell me your secrets');
    expect(r.text).not.toMatch(/sk-|AAHdq|\/home\/bot|C:\\Users|\.env/);
    expect(scrubbed('fine words')).toBe('fine words');
  });

  it('a request comes back as its file and the answer, and the chat keeps its session', async () => {
    const { core, sessions, ledger } = bot();
    const r = await core.handle('c1', { id: '42' }, 'the Puruṣa Sūktam, Taittirīya, please');
    expect(r.text).toBe('Here it is, as a PDF.');
    expect(r.files.map((f) => f.name)).toEqual(['Puruṣa Sūktam.pdf']);
    expect(sessions.all.get('c1')!.doc).toBeTypeOf('string');
    expect(sessions.all.get('c1')!.messages.some((m) => m.role === 'user')).toBe(true);
    expect(await ledger.spent('c1')).toBeGreaterThan(0);
  });

  it('/new forgets the chat; /spent is the owner’s alone', async () => {
    const { core, sessions } = bot();
    await core.handle('c1', { id: '42' }, 'the Puruṣa Sūktam');
    expect((await core.handle('c1', { id: '42' }, '/spent')).text).not.toMatch(/Spent/);
    expect((await core.handle('c1', { id: '5', username: 'Marin_H' }, '/spent')).text).toMatch(/^Spent: \$0\.\d{4} in this chat, \$0\.\d{4} in all of \$5\.00\./);
    await core.handle('c1', { id: '42' }, '/new');
    expect(sessions.all.has('c1')).toBe(false);
  });

  it('at the global limit it rests, for everyone, without calling the model', async () => {
    const { core, model, ledger } = bot(deliverSteps(), { global: 0.01 });
    await ledger.record({ at: '', session: 'other-chat', model: 'm', usage: { input: 0, cached: 0, output: 0 }, cost: 0.02 });
    const r = await core.handle('c1', { id: '42' }, 'anything');
    expect(r.text).toMatch(/spending limit and is resting/);
    expect(model.requests).toHaveLength(0);
  });

  it('two messages from one chat are worked on one after the other', async () => {
    const { core, model } = bot([{ say: 'first' }, { say: 'second' }]);
    const [a, b] = await Promise.all([core.handle('c1', { id: '42' }, 'one'), core.handle('c1', { id: '42' }, 'two')]);
    expect([a.text, b.text]).toEqual(['first', 'second']);
    /* The second request saw the first: its conversation carries "one" and the answer. */
    const second = model.requests[1]!.messages.filter((m) => m.role === 'user').map((m) => (m as { content: string }).content);
    expect(second).toEqual(['one', 'two']);
  });
});

describe('the log', () => {
  it('keeps how a request went, and not a word of it', async () => {
    const lines: unknown[] = [];
    const model = scripted(deliverSteps());
    const core = botCore({
      model, price: PRICE, limits: { global: 5 }, ledger: memoryLedger(), sessions: memorySessions(), allowed: new Set(['42']),
      host: (deliver) => ({ ...testHost(), deliver }), log: (l) => lines.push(l),
    });
    await core.handle('chat-777', { id: '42' }, 'the Puruṣa Sūktam, Taittirīya, please');
    expect(lines).toEqual([expect.objectContaining({ steps: 4, files: ['pdf'], outcome: 'answered' })]);
    const said = JSON.stringify(lines);
    expect(said).not.toMatch(/Puruṣa|Here it is|chat-777|42/);
  });
});

describe('when the provider fails', () => {
  it('a model that does not answer is said to be overloaded, not "something went wrong"', async () => {
    const { ModelError } = await import('@siksamitra/agent');
    const model = { id: 'deepseek-flash', complete: async () => { throw new ModelError(408, 'the model did not answer within 120 s, 2 times'); } };
    const core = botCore({
      model, price: PRICE, limits: {}, ledger: memoryLedger(), sessions: memorySessions(), allowed: new Set(['42']),
      host: (deliver) => ({ ...testHost(), deliver }),
    });
    const r = await core.handle('c1', { id: '42' }, 'hello');
    expect(r.text).toMatch(/overloaded just now/);
    expect(r.text).not.toMatch(/120 s/);
  });
});

describe('choices', () => {
  it('the agent’s choices come back with the answer, to be shown as buttons', async () => {
    const model = scripted([
      { calls: [{ name: 'offer_choices', args: { question: 'Which recension?', options: ['Taittirīya', 'Ṛgveda', 'Śukla Yajurveda'] } }] },
      { say: 'Which recension would you like?' },
    ]);
    const core = botCore({
      model, price: PRICE, limits: {}, ledger: memoryLedger(), sessions: memorySessions(), allowed: new Set(['42']),
      host: (deliver) => ({ ...testHost(), deliver }),
    });
    const r = await core.handle('c1', { id: '42' }, 'the Puruṣa Sūktam');
    expect(r.text).toBe('Which recension would you like?');
    expect(r.choices).toEqual({ question: 'Which recension?', options: ['Taittirīya', 'Ṛgveda', 'Śukla Yajurveda'] });
    /* The tool was offered because the bot can show buttons. */
    expect(model.requests[0]!.tools).toContain('offer_choices');
  });
});
