/**
 * A FILE ADDED TO A MESSAGE, IN THE PANEL — the same pipeline as the bot's
 * (the owner, 2026-10-02: "Should work in the desktop application as well as
 * in the word extension also... Same pipeline"). The add-in's Ask tab, used as
 * a person uses it: + File, a file chosen, its name shown, sent — and the
 * agent's first request carries the line that names it, with the tools that
 * open it on offer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { scripted } from '../../packages/agent/src/__tests__/fixtures.js';

vi.mock('../../apps/word-addin/src/word/insert-doc.js', () => ({ insertChantDoc: vi.fn(async () => ({ title: '', verses: 0, pictures: 0, note: null })) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let el: HTMLElement;
let root: Root;
beforeEach(() => { el = document.createElement('div'); document.body.append(el); root = createRoot(el); });
afterEach(() => { act(() => root.unmount()); el.remove(); });
const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
};
const button = (text: string): HTMLButtonElement | undefined => [...el.querySelectorAll('button')].find((b) => b.textContent === text);

describe('a file in the panel', () => {
  it('is chosen, shown by its name, and sent as the line that names it', async () => {
    const { AgentTab } = await import('../../apps/word-addin/src/ui/panel/AgentTab.js');
    const model = scripted([{ say: 'I have it.' }]);
    await act(async () => { root.render(<AgentTab model={model} />); });
    expect(button('+ File')).toBeDefined();

    const input = el.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['jātavedase sunavāma somam'], 'durgā.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    await settle();
    expect(button('durgā.txt ✕')).toBeDefined();

    await act(async () => { button('Send')!.click(); });
    await settle();
    const asked = JSON.stringify(model.requests[0]!.messages);
    expect(asked).toMatch(/\[sent “durgā\.txt”, a text file of \d+ B — attachment [0-9a-f]{32}\]/u);
    expect(model.requests[0]!.tools).toContain('open_attachment');
    /* Sent, the chip goes. */
    expect(button('durgā.txt ✕')).toBeUndefined();
  });
});
