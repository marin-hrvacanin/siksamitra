/**
 * THE ASK TAB — Śrutidhara in the Word panel, used as a person uses it.
 *
 * The first time, the panel asks for the person's own key and keeps it on
 * this computer. Then a request: the agent finds the text in the library the
 * panel publishes, checks it, and puts it into the document at the caret —
 * through the add-in's own writer, faked here at its Word edge. A choice it
 * offers is a row of buttons, and a press is the person's next message.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { scripted } from '../../packages/agent/src/__tests__/fixtures.js';

const inserted: { title: string; verses: number }[] = [];
vi.mock('../../apps/word-addin/src/word/insert-doc.js', () => ({
  insertChantDoc: vi.fn(async (doc: { title: string; sections: { verses: unknown[] }[] }) => {
    const verses = doc.sections.reduce((n, s) => n + s.verses.length, 0);
    inserted.push({ title: doc.title, verses });
    return { title: doc.title, verses, pictures: 0, note: null };
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/* The library the panel publishes: the corpus, as `chants/index.json` and `chants/<id>.json`. */
const realFetch = globalThis.fetch;
beforeEach(() => {
  inserted.length = 0;
  localStorage.clear();
  globalThis.fetch = vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.endsWith('chants/index.json')) {
      return new Response(JSON.stringify([{ id: 'purusha-suktam', title: 'puruṣa sūktam', kind: 'verified', source: 'taittiriya' }]));
    }
    const m = /chants\/([a-z-]+)\.json$/.exec(u);
    if (m !== null) return new Response(readFileSync(`corpus/chants/${m[1]}.json`, 'utf8'));
    return new Response('', { status: 404 });
  }) as typeof fetch;
});
afterEach(() => { globalThis.fetch = realFetch; });

let el: HTMLElement;
let root: Root;
beforeEach(() => { el = document.createElement('div'); document.body.append(el); root = createRoot(el); });
afterEach(() => { act(() => root.unmount()); el.remove(); });

const settle = async (): Promise<void> => {
  for (let i = 0; i < 30; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
};
const button = (text: string): HTMLButtonElement => [...el.querySelectorAll('button')].find((b) => b.textContent === text)!;
async function say(text: string): Promise<void> {
  const box = el.querySelector('textarea')!;
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    set.call(box, text);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { button('Send').click(); });
  await settle();
}

describe('the Ask tab', () => {
  it('the first time asks for the person’s own key, and keeps it on this computer only', async () => {
    const { AgentTab } = await import('../../apps/word-addin/src/ui/panel/AgentTab.js');
    await act(async () => { root.render(<AgentTab />); });
    expect(el.textContent).toContain('kept on this computer only');
    const key = el.querySelector<HTMLInputElement>('input[type="password"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(key, 'sk-mine');
      key.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { button('Save').click(); });
    expect(JSON.parse(localStorage.getItem('siksamitra.agent')!)).toMatchObject({ apiKey: 'sk-mine', model: 'deepseek-flash' });
    expect(el.querySelector('textarea')).not.toBeNull();
  });

  it('a request ends in the document: found in the library, checked, put in at the caret', async () => {
    const { AgentTab } = await import('../../apps/word-addin/src/ui/panel/AgentTab.js');
    const model = scripted([
      { calls: [{ name: 'find_text', args: { query: 'puruṣa sūktam' } }] },
      { calls: [{ name: 'open_text', args: { id: 'purusha-suktam' } }] },
      { calls: [{ name: 'check', args: {} }] },
      { calls: [{ name: 'deliver', args: {} }] },
      { say: 'Here is the **Puruṣa Sūktam**, from the verified library, at the caret.' },
    ]);
    await act(async () => { root.render(<AgentTab model={model} />); });
    expect(el.textContent).toContain('Namaste!');
    await say('the Puruṣa Sūktam please');
    expect(inserted).toEqual([{ title: 'puruṣa sūktam', verses: 26 }]);
    /* The answer is drawn, its Markdown as bold — no asterisks. */
    const answer = el.querySelector('.agent-line[data-who="agent"]')!;
    expect(answer.querySelector('b')!.textContent).toBe('Puruṣa Sūktam');
    expect(answer.textContent).not.toContain('**');
    /* The deliver tool chose "here" by itself: this host has no files to give. */
    expect(model.requests[0]!.tools).not.toContain('web_search');
  });

  it('a choice is a row of buttons, and a press is the next message', async () => {
    const { AgentTab } = await import('../../apps/word-addin/src/ui/panel/AgentTab.js');
    const model = scripted([
      { calls: [{ name: 'offer_choices', args: { question: 'Which recension?', options: ['Taittirīya', 'Ṛgveda'] } }] },
      { say: 'Which one?' },
      { say: 'The Ṛgveda one, then.' },
    ]);
    await act(async () => { root.render(<AgentTab model={model} />); });
    await say('the Puruṣa Sūktam');
    expect([...el.querySelectorAll('.agent-choices button')].map((b) => b.textContent)).toEqual(['Taittirīya', 'Ṛgveda']);
    await act(async () => { button('Ṛgveda').click(); });
    await settle();
    expect(el.querySelector('.agent-choices')).toBeNull();
    const asked = model.requests[2]!.messages.filter((m) => m.role === 'user').map((m) => (m as { content: string }).content);
    expect(asked).toEqual(['the Puruṣa Sūktam', 'Ṛgveda']);
  });
});
