/**
 * ONE CONVERSATION PER TOPIC — and a fresh one when the person asks.
 *
 * The owner, 2026-10-02: "if I am talking with it and I create some documents
 * … and tomorrow want something new, it will pass the old conversation and
 * 'poison' the future conversation … the best would be some sort of session
 * system where I can switch back and forth between different contexts."
 *
 * Telegram gives exactly that now (Bot API 9.3 and 9.4): a private chat with
 * a bot can have TOPICS once the bot's owner turns on Threaded Mode in
 * @BotFather (Bot Settings → Threads Settings), and a bot may open one itself
 * (`createForumTopic`). So a conversation is a chat AND a topic: each topic
 * keeps its own context, and switching topics is switching tasks. Without
 * topics everything is as it was — one conversation a chat, `/new` to start
 * it over.
 */
import type { Api, Context } from 'grammy';

/** The topic a message is in, when the chat has topics. */
export const threadOf = (ctx: Context): number | undefined =>
  ctx.msg?.is_topic_message === true ? ctx.msg.message_thread_id : undefined;

/** The conversation a message belongs to: its chat, and its topic if any. */
export function conversationOf(ctx: Context): string {
  const thread = threadOf(ctx);
  return thread === undefined ? String(ctx.chat!.id) : `${ctx.chat!.id}:${thread}`;
}

/** Does this bot have topics in private chats? Asked once a bot, and remembered. */
const known = new WeakMap<Api, Promise<boolean>>();
export function hasTopics(api: Api): Promise<boolean> {
  const was = known.get(api);
  if (was !== undefined) return was;
  const now = api.getMe().then((me) => (me as { has_topics_enabled?: boolean }).has_topics_enabled === true).catch(() => false);
  known.set(api, now);
  return now;
}

/** What the person sees when a new task is opened for them. */
export const NEW_TOPIC = 'New task';
export const OPENED = 'New task — what would you like?';

/**
 * A TOPIC'S ICON SAYS WHERE ITS TASK STANDS — the one picture in Telegram's
 * list of threads, from Telegram's own topic icons (any bot may set them;
 * `getForumTopicIconStickers`). The owner (2026-10-02): "custom thread icons
 * are possible, for the actions". Data: a state, and the icon for it.
 */
export const TOPIC_ICON = { working: '✍️', yours: '💬', delivered: '✅', failed: '❗️' } as const;
export type TaskState = keyof typeof TOPIC_ICON;

/** An emoji as Telegram may give it back: with or without its presentation selector. */
const bare = (e: string): string => e.replace(/\uFE0F/gu, '');

/** Telegram's ids for its topic icons, by emoji — asked once a bot. */
const iconIds = new WeakMap<Api, Promise<ReadonlyMap<string, string>>>();
function iconsOf(api: Api): Promise<ReadonlyMap<string, string>> {
  const was = iconIds.get(api);
  if (was !== undefined) return was;
  /* Without icons a task goes on without them — the lookup never stops one. */
  const now = Promise.resolve().then(() => api.getForumTopicIconStickers())
    .then((all) => new Map(all.flatMap((s) => (s.emoji === undefined || s.custom_emoji_id === undefined ? [] : [[bare(s.emoji), s.custom_emoji_id] as const]))))
    .catch(() => new Map<string, string>());
  iconIds.set(api, now);
  return now;
}

/** The id of a state's icon, or nothing when Telegram does not offer it. */
export async function iconFor(api: Api, state: TaskState): Promise<string | undefined> {
  return (await iconsOf(api)).get(bare(TOPIC_ICON[state]));
}

/** Set the icon of the topic this message is in to its task's state. */
export async function markTask(ctx: Context, state: TaskState): Promise<void> {
  const thread = threadOf(ctx);
  if (thread === undefined || ctx.chat === undefined) return;
  const id = await iconFor(ctx.api, state);
  if (id === undefined) return;
  await ctx.api.editForumTopic(ctx.chat.id, thread, { icon_custom_emoji_id: id }).catch(() => undefined);
}

/** A delivered document names its topic: "nīla sūktam", not the request that asked for it. */
export async function nameDelivered(ctx: Context, file: string): Promise<void> {
  const thread = threadOf(ctx);
  const name = shortName(file.replace(/\.[a-z0-9]{2,6}$/iu, ''));
  if (thread === undefined || ctx.chat === undefined || name === '') return;
  await ctx.api.editForumTopic(ctx.chat.id, thread, { name }).catch(() => undefined);
}

/** How long a topic's name is let be: a line in Telegram's list of topics. */
const NAME_MAX = 48;

/** A request, as a topic's name: one line, cut at a word, and said to be cut. */
export function shortName(request: string): string {
  const flat = request.replace(/\s+/g, ' ').trim();
  if ([...flat].length <= NAME_MAX) return flat;
  const cut = [...flat].slice(0, NAME_MAX).join('');
  const space = cut.lastIndexOf(' ');
  return `${(space > NAME_MAX / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/u, '')}…`;
}

/** Topics this bot opened and nobody has asked anything in yet. */
const unnamed = new Set<string>();

/**
 * Open a new topic for a new task, and say so in it. Answers whether it could.
 * The person's own `/new` is taken away by the caller: left where it was
 * typed, it sat in the old thread with its answer in the new one (2026-10-02).
 */
export async function openTask(ctx: Context): Promise<boolean> {
  if (ctx.chat?.type !== 'private' || !(await hasTopics(ctx.api))) return false;
  try {
    const icon = await iconFor(ctx.api, 'yours');
    const topic = await ctx.api.createForumTopic(ctx.chat.id, NEW_TOPIC, icon === undefined ? {} : { icon_custom_emoji_id: icon });
    unnamed.add(`${ctx.chat.id}:${topic.message_thread_id}`);
    await ctx.api.sendMessage(ctx.chat.id, OPENED, { message_thread_id: topic.message_thread_id });
    return true;
  } catch {
    return false;
  }
}

/**
 * A topic still called "New task" is named after the first thing asked in it.
 * Known two ways: the bot opened it (since it last started), or the message
 * hangs from the topic's own first line, as Telegram gives it in a forum.
 */
export async function nameTask(ctx: Context, request: string): Promise<void> {
  const thread = threadOf(ctx);
  if (thread === undefined || ctx.chat === undefined) return;
  const key = `${ctx.chat.id}:${thread}`;
  const topicName = (ctx.msg as { reply_to_message?: { forum_topic_created?: { name?: string } } } | undefined)
    ?.reply_to_message?.forum_topic_created?.name;
  if (!unnamed.has(key) && topicName !== NEW_TOPIC) return;
  const name = shortName(request);
  if (name === '' || name.startsWith('/')) return;
  unnamed.delete(key);
  await ctx.api.editForumTopic(ctx.chat.id, thread, { name }).catch(() => undefined);
}

/** The commands in Telegram's menu — the person need not remember them. */
export const COMMANDS = [
  { command: 'new', description: 'Start a new task — a fresh conversation' },
  { command: 'stop', description: 'Stop what I am working on' },
  { command: 'help', description: 'What I can do' },
] as const;
