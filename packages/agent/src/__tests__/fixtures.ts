/**
 * What the agent's tests share: a model that answers from a script, a host
 * whose web is one page, and the page — the first two verses of the Puruṣa
 * Sūktam as sanskritdocuments.org prints them, accents and all.
 */
import type { Delivered, Host, Message, Model, Reply, ToolCall } from '../index.js';

export const PURUSHA_PAGE = [
  'Purusha Suktam',
  'Home | Index | Search',
  '',
  'पुरुषसूक्तम्',
  'ॐ स॒हस्र॑शीर्षा॒ पुरु॑षः । स॒ह॒स्रा॒क्षः स॒हस्र॑पात् ।',
  'स भूमिं॑ वि॒श्वतो॑ वृ॒त्वा । अत्य॑तिष्ठद्दशाङ्गु॒लम् ॥ १॥',
  'पुरु॑ष ए॒वेदꣳ सर्वम्᳚ । यद्भू॒तं यच्च॒ भव्यम्᳚ ।',
  'उ॒ता॒मृ॒त॒त्वस्येशा॑नः । य॒दन्ने॑नाति॒रोह॑ति ॥ २॥',
  '',
  'Encoded and proofread by volunteers',
].join('\n');

/** One step of a scripted conversation: tool calls, or a final answer. */
export type Step = { calls: { name: string; args: Record<string, unknown> }[] } | { say: string };

/**
 * A model that plays a script, recording every request it was sent — so a
 * test can see what the provider would have been asked, cache prefix and all.
 */
export function scripted(steps: Step[], id = 'deepseek-chat'): Model & { requests: { messages: readonly Message[]; tools: string[] }[] } {
  const requests: { messages: readonly Message[]; tools: string[] }[] = [];
  let at = 0;
  let n = 0;
  return {
    id,
    requests,
    async complete(req): Promise<Reply> {
      requests.push({ messages: [...req.messages], tools: req.tools.map((t) => t.name) });
      const step = steps[at++] ?? { say: '(the script ran out)' };
      const usage = { input: 1000, cached: requests.length > 1 ? 800 : 0, output: 50 };
      if ('say' in step) return { message: { role: 'assistant', content: step.say }, usage, finish: 'stop' };
      const toolCalls: ToolCall[] = step.calls.map((c) => ({ id: `c${++n}`, name: c.name, arguments: JSON.stringify(c.args) }));
      return { message: { role: 'assistant', content: null, toolCalls }, usage, finish: 'tool_calls' };
    },
  };
}

/** A host with one web page, an empty library, and exporters that only record. */
/** A verified text for the library: the Puruṣa page, marked as its author marked it. */
export type LoadedDoc = Awaited<ReturnType<NonNullable<Host['library']>['load']>>;

export function testHost(library?: { id: string; title: string; load: () => LoadedDoc }): Host & { delivered: Delivered[]; fetched: string[] } {
  const delivered: Delivered[] = [];
  const fetched: string[] = [];
  const make = (format: Delivered['format'], ext: string) => async (_doc: unknown, name: string): Promise<Delivered> => ({
    name: `${name}.${ext}`, mime: '', bytes: new Uint8Array([1, 2, 3]), format,
  });
  return {
    delivered,
    fetched,
    library: {
      find: async () => (library === undefined ? [] : [{ id: library.id, title: library.title, kind: 'verified' as const }]),
      load: async (id) => {
        if (library === undefined || id !== library.id) throw new Error('empty library');
        return library.load();
      },
    },
    research: {
      search: async () => [{ title: 'Purusha Suktam', url: 'https://sanskritdocuments.org/doc_veda/purusha.html', snippet: 'accented' }],
      fetch: async (url) => { fetched.push(url); return { title: 'Purusha Suktam', text: PURUSHA_PAGE }; },
    },
    exporters: { pdf: make('pdf', 'pdf'), docx: make('docx', 'docx'), smdoc: make('smdoc', 'smdoc'), vedaunion: make('vedaunion', 'vuchant') },
    deliver: async (f) => { delivered.push(f); },
  };
}
