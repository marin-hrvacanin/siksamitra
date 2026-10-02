/**
 * A STEP THAT THINKS UNTIL IT IS CUT OFF.
 *
 * A real request for the bhū sūktam (2026-10-02) thought 166 000 characters
 * over whether one letter might be left out, until the provider cut the reply
 * off at its length — no call, no words — and the turn ended there, with
 * nothing to show for ten steps. Such a step is taken back now, and the model
 * told to act; twice, and then the person is told in words.
 */
import { describe, expect, it } from 'vitest';
import { RUNAWAY, memoryLedger, runTurn, type Message, type Model, type Reply } from '../index.js';

const usage = { input: 1, cached: 0, output: 1 };
const cutOff: Reply = { usage, finish: 'length', message: { role: 'assistant', content: null, reasoning: 'Hmm. '.repeat(50) } };
const answer: Reply = { usage, finish: 'stop', message: { role: 'assistant', content: 'Here it is.' } };

function scripted(replies: readonly Reply[], seen: Message[][]): Model {
  let n = 0;
  return {
    id: 'm',
    complete: async ({ messages }) => {
      seen.push([...messages]);
      const r = replies[Math.min(n, replies.length - 1)]!;
      n += 1;
      return r;
    },
  };
}

const turn = (model: Model, messages: Message[]) => runTurn({
  model, price: { input: 0, cached: 0, output: 0 }, tools: [], system: 's', messages,
  ctx: { ws: undefined as never, host: {}, review: async () => '' }, ledger: memoryLedger(),
  limits: { global: 9, session: 9, turn: 9 }, session: 't',
}, 'the bhū sūktam, please');

describe('a step cut off with nothing done', () => {
  it('is taken back, the model is told to act, and the turn goes on', async () => {
    const seen: Message[][] = [];
    const messages: Message[] = [];
    const done = await turn(scripted([cutOff, answer], seen), messages);
    expect(done.text).toBe('Here it is.');
    expect(done.steps).toBe(2);
    /* The second request carries the nudge, and not the cut-off reply — whose
       thinking, sent back, would be fifty thousand tokens of nothing. */
    const second = seen[1]!;
    expect(second.some((m) => m.role === 'user' && m.content === RUNAWAY)).toBe(true);
    expect(second.some((m) => m.role === 'assistant' && m.reasoning !== undefined)).toBe(false);
    expect(messages.filter((m) => m.role === 'assistant')).toEqual([answer.message]);
  });

  it('twice at most — then the person is told, in words', async () => {
    const seen: Message[][] = [];
    const done = await turn(scripted([cutOff, cutOff, cutOff, answer], seen), []);
    expect(seen).toHaveLength(3);
    expect(done.text).toMatch(/got stuck/);
  });

  it('a reply that simply ends is the answer, as before', async () => {
    const done = await turn(scripted([answer], []), []);
    expect(done.text).toBe('Here it is.');
    expect(done.steps).toBe(1);
  });
});
