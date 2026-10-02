/**
 * A CONVERSATION PER TOPIC, AND A NEW TOPIC FOR A NEW TASK.
 *
 * The owner wanted to start a new task without the old conversation leaking
 * into it, and to switch back and forth between tasks. With Threaded Mode on,
 * Telegram gives a private chat topics; each is its own conversation here.
 */
import { describe, expect, it } from 'vitest';
import type { Api, Context } from 'grammy';
import { NEW_TOPIC, OPENED, conversationOf, hasTopics, nameTask, openTask, threadOf } from '../topics.js';

const ctxOf = (o: { thread?: number; topics?: boolean; type?: string; sent?: unknown[]; chat?: number; under?: string; opens?: number }): Context => {
  const sent = o.sent ?? [];
  const api = {
    getMe: async () => ({ has_topics_enabled: o.topics === true }),
    createForumTopic: async (_chat: number, name: string) => { sent.push(['topic', name]); return { message_thread_id: o.opens ?? 77, name }; },
    sendMessage: async (_chat: number, text: string, other: unknown) => { sent.push(['message', text, other]); return {}; },
    editForumTopic: async (chat: number, thread: number, other: { name: string }) => { sent.push(['rename', chat, thread, other.name]); return true; },
  } as unknown as Api;
  const reply = o.under === undefined ? {} : { reply_to_message: { forum_topic_created: { name: o.under } } };
  return {
    chat: { id: o.chat ?? 42, type: o.type ?? 'private' },
    msg: o.thread === undefined ? { message_thread_id: undefined } : { is_topic_message: true, message_thread_id: o.thread, ...reply },
    api,
  } as unknown as Context;
};

describe('a conversation', () => {
  it('is the chat, or the chat and its topic', () => {
    expect(conversationOf(ctxOf({}))).toBe('42');
    expect(conversationOf(ctxOf({ thread: 5 }))).toBe('42:5');
    expect(threadOf(ctxOf({ thread: 5 }))).toBe(5);
    expect(threadOf(ctxOf({}))).toBeUndefined();
  });
});

describe('a new task', () => {
  it('opens a topic of its own, and says so in it, where the chat has topics', async () => {
    const sent: unknown[] = [];
    expect(await openTask(ctxOf({ topics: true, sent }))).toBe(true);
    expect(sent[0]).toEqual(['topic', NEW_TOPIC]);
    expect(sent[1]).toEqual(['message', OPENED, { message_thread_id: 77 }]);
  });
  it('and leaves the old conversation to be started over where it has not', async () => {
    const sent: unknown[] = [];
    expect(await openTask(ctxOf({ topics: false, sent }))).toBe(false);
    expect(sent).toEqual([]);
  });
  it('never in a group', async () => {
    expect(await openTask(ctxOf({ topics: true, type: 'group' }))).toBe(false);
  });
  it('is named after the first thing asked in it, once', async () => {
    const sent: unknown[] = [];
    await openTask(ctxOf({ topics: true, sent, chat: 5, opens: 8 }));
    await nameTask(ctxOf({ thread: 8, chat: 5, sent }), '/stop');
    await nameTask(ctxOf({ thread: 8, chat: 5, sent }), '  the bhū sūktam,\n kṛṣṇa yajurveda, as a PDF and a Word file please ');
    await nameTask(ctxOf({ thread: 8, chat: 5, sent }), 'and now the nīla sūktam');
    expect(sent.filter((s) => (s as unknown[])[0] === 'rename')).toEqual([['rename', 5, 8, 'the bhū sūktam, kṛṣṇa yajurveda, as a PDF and a…']]);
  });
  it('a topic it did not open is named only when it is still called "New task" — not one the person named', async () => {
    const sent: unknown[] = [];
    await nameTask(ctxOf({ thread: 9, chat: 6, sent, under: NEW_TOPIC }), 'puruṣa sūktam');
    await nameTask(ctxOf({ thread: 10, chat: 6, sent, under: 'My Gāyatrī' }), 'puruṣa sūktam');
    await nameTask(ctxOf({ chat: 6, sent }), 'outside any topic');
    expect(sent).toEqual([['rename', 6, 9, 'puruṣa sūktam']]);
  });
  it('asks the bot once whether it has topics', async () => {
    let asked = 0;
    const api = { getMe: async () => { asked += 1; return { has_topics_enabled: true }; } } as unknown as Api;
    await hasTopics(api); await hasTopics(api);
    expect(asked).toBe(1);
  });
});
