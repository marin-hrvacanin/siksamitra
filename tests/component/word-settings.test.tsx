/**
 * THE SETTINGS PANEL — what it shows, and that a choice made there is kept in
 * the document (`word/settings.ts`), for the part the caret is in or the
 * document outside every part.
 */
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { calls, host } from './word-addin-harness.js';

vi.mock('../../apps/word-addin/src/word/selection.js', async () => (await import('./word-addin-harness.js')).selectionMock);
vi.mock('../../apps/word-addin/src/word/client.js', async () => (await import('./word-addin-harness.js')).clientMock);
vi.mock('../../apps/word-addin/src/word/parts.js', async () => (await import('./word-addin-harness.js')).partsMock);
vi.mock('../../apps/word-addin/src/word/dialog.js', async (real) => ({
  ...(await real<object>()), ...(await import('./word-addin-harness.js')).dialogMock,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
type SettingsModule = typeof import('../../apps/word-addin/src/ui/Settings.js');
let S: SettingsModule;
beforeAll(async () => { S = await import('../../apps/word-addin/src/ui/Settings.js'); }, 120_000);

let el: HTMLElement;
let root: Root;
beforeEach(() => { el = document.createElement('div'); document.body.append(el); root = createRoot(el); });
afterEach(() => { act(() => root.unmount()); el.remove(); });
const draw = async (): Promise<void> => {
  await act(async () => { root.render(<S.Settings />); });
  await act(async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); });
};
const radios = (): HTMLInputElement[] => [...el.querySelectorAll<HTMLInputElement>('input[type=radio]')];
const checked = (): string[] => radios().filter((r) => r.checked).map((r) => r.closest('label')?.querySelector('strong')?.textContent ?? '');

describe('the register', () => {
  it('offers every register, with the one recorded for the document chosen', async () => {
    host.settings.set('siksamitra.register', 'rigveda');
    await draw();
    expect(radios()).toHaveLength(5);
    expect(checked()).toEqual(['Ṛgveda']);
    expect(el.textContent).toContain('Register — the document');
  });

  it('in a part, is that part’s, and choosing one records it for the part alone', async () => {
    host.part = { register: 'smarta' };
    await draw();
    expect(el.textContent).toContain('Register — this part');
    expect(checked()).toEqual(['Smārta / purāṇic']);
    await act(async () => { radios()[1]!.click(); });
    expect(host.part).toEqual({ register: 'rigveda' });
    expect(host.settings.has('siksamitra.register')).toBe(false);
  });

  it('outside every part, choosing one records it for the document', async () => {
    await draw();
    await act(async () => { radios()[3]!.click(); });
    expect(host.settings.get('siksamitra.register')).toBe('smarta');
  });
});

describe('the stages', () => {
  it('are all ticked until one is taken off, and that is kept in the document', async () => {
    await draw();
    const boxes = [...el.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
    expect(boxes.map((b) => b.checked)).toEqual([true, true, true, true, true]);
    await act(async () => { boxes[2]!.click(); });
    expect(host.settings.get('siksamitra.stages')).toEqual(['sandhi', 'change', 'svara', 'aids']);
  });
});

describe('the styles', () => {
  it('says all are here when they are', async () => {
    await draw();
    expect(el.textContent).toContain('All 19 śikṣāmitra styles are here.');
  });
  it('lists what is missing, and Import styles brings them in', async () => {
    host.missing = ['Mantra', 'Svara'];
    await draw();
    expect(el.textContent).toContain('Missing: Mantra, Svara.');
    const b = [...el.querySelectorAll('button')].find((x) => x.textContent === 'Import styles');
    await act(async () => { b!.click(); });
    await act(async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); });
    expect(calls.addStyles).toEqual([false]);
    expect(el.textContent).toContain('All 19 śikṣāmitra styles are here.');
  });
});

describe('the keyboard shortcuts', () => {
  it('lists the tab’s and every Alt letter, from the one table', async () => {
    await draw();
    const keys = [...el.querySelectorAll('kbd')].map((k) => k.textContent);
    expect(keys).toContain('Ctrl+H');
    expect(keys).toContain('Alt+S');
    expect(keys).toContain('Alt+Shift+S');
  });
});
