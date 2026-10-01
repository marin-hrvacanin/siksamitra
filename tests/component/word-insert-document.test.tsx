/**
 * "BRING IN A DOCUMENT FROM THE APP" — the Settings section, as a person uses
 * it: choose a file, and be told what came in. The insertion itself is held
 * in the integration tier (`insert-document.test.ts`) and in real Word.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const insert = vi.fn();
vi.mock('../../apps/word-addin/src/word/insert-doc.js', () => ({ insertDocument: (...a: unknown[]) => insert(...a) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let el: HTMLElement;
let root: Root;
beforeEach(() => { el = document.createElement('div'); document.body.append(el); root = createRoot(el); insert.mockReset(); });
afterEach(() => { act(() => root.unmount()); el.remove(); });

async function draw(): Promise<void> {
  const { InsertDocument } = await import('../../apps/word-addin/src/ui/InsertDocument.js');
  await act(async () => { root.render(<InsertDocument />); });
}
async function choose(name: string): Promise<void> {
  const input = el.querySelector<HTMLInputElement>('input[type=file]')!;
  /* jsdom's File has no `arrayBuffer()`; a browser's does. */
  const file = { name, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); });
}

describe('bringing in a document from the app', () => {
  it('offers every kind of file the app opens', async () => {
    await draw();
    expect(el.querySelector('input[type=file]')!.getAttribute('accept')).toBe('.smdoc,.vuchant,.docx,.html');
    expect(el.textContent).toContain('Choose a document');
  });
  it('a document chosen goes in, and the pane says what came in', async () => {
    insert.mockResolvedValue({ title: 'Śrī Rudram', verses: 198, pictures: 0, note: null });
    await draw();
    await choose('rudram.smdoc');
    expect(insert).toHaveBeenCalledWith(expect.any(Uint8Array), 'rudram.smdoc');
    expect(el.querySelector('[role=status]')!.textContent).toContain('“Śrī Rudram” is in the document, after the line the caret was in: 198 verse(s).');
  });
  it('pictures that could not come are said, with where to get them in', async () => {
    insert.mockResolvedValue({ title: 'Pūjā', verses: 112, pictures: 1, note: null });
    await draw();
    await choose('puja.smdoc');
    expect(el.querySelector('[role=status]')!.textContent).toContain('1 picture(s) are marked where they go');
  });
  it('a file it cannot read is said, not swallowed', async () => {
    insert.mockRejectedValue(new Error('notes.txt: not a document this program opens (.smdoc, .vuchant, .docx, .html)'));
    await draw();
    await choose('notes.txt');
    expect(el.querySelector('[role=status]')!.textContent).toContain('not a document this program opens');
  });
});
