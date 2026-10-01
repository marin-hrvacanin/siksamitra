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
vi.mock('../../apps/word-addin/src/word/convert.js', async () => (await import('./word-addin-harness.js')).convertMock);
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
  it('offers every register, with the one recorded for the lines outside every part chosen', async () => {
    host.settings.set('siksamitra.register', 'rigveda');
    await draw();
    expect(radios()).toHaveLength(4);
    expect(checked()).toEqual(['Ṛgveda']);
    /* "Remove the prose" (the owner, 2026-10-01): offered nowhere. */
    expect(el.textContent).not.toMatch(/Prose/);
    /* And no register claims a text that is recorded under another. */
    expect(el.textContent).not.toMatch(/Ṛgved[^—]*— [^.]*Durgā/);
    expect(el.textContent).toContain('Register — lines outside every part');
    expect(el.textContent).not.toMatch(/the document’s|— the document/);
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
    const boxes = [...el.querySelectorAll<HTMLInputElement>('.set__stages input[type=checkbox]')];
    expect(boxes.map((b) => b.checked)).toEqual([true, true, true, true, true]);
    await act(async () => { boxes[2]!.click(); });
    expect(host.settings.get('siksamitra.stages')).toEqual(['sandhi', 'change', 'svara', 'aids']);
  });
});

describe('the conventions', () => {
  const rows = (): HTMLLabelElement[] => [...el.querySelectorAll<HTMLLabelElement>('.set__convrow')];
  const box = (label: string): HTMLInputElement => rows().find((r) => r.textContent!.includes(label))!.querySelector('input')!;
  it('each is offered with what it does, shown', async () => {
    await draw();
    expect(rows()).toHaveLength(4);
    expect(el.textContent).toContain('puraṁ mahā · śagmāṁ no → puram mahā · śagmān no');
    expect(el.textContent).toContain('devyaḥ krodha');
    expect(el.textContent).toContain('bhavᵘyam');
    expect(el.textContent).toContain('u[tt]amam');
  });
  it('on and off as ruled: ṁ before a nasal and ḥ before k on, the vy aid and the geminate box off', async () => {
    await draw();
    expect(box('before a nasal').checked).toBe(true);
    expect(box('before k or kh').checked).toBe(true);
    expect(box('raised u on v').checked).toBe(false);
    expect(box('whole geminate').checked).toBe(false);
  });
  it('switching one keeps it in the document, and only that one', async () => {
    await draw();
    await act(async () => { box('raised u on v').click(); });
    expect(host.settings.get('siksamitra.conventions')).toEqual({ 'vy-aid': true });
    await act(async () => { box('before k or kh').click(); });
    expect(host.settings.get('siksamitra.conventions')).toEqual({ 'vy-aid': true, 'visarga-before-velar': false });
  });
  it('what the document has chosen is what is shown', async () => {
    host.settings.set('siksamitra.conventions', { 'geminate-box': true });
    await draw();
    expect(box('whole geminate').checked).toBe(true);
  });
});

describe('the styles', () => {
  it('says all are here when they are', async () => {
    await draw();
    expect(el.textContent).toContain('All 11 śikṣāmitra styles are here.');
  });
  it('lists what is missing, and Import styles brings them in', async () => {
    host.missing = ['Mantra', 'Svara'];
    await draw();
    expect(el.textContent).toContain('Missing: Mantra, Svara.');
    const b = [...el.querySelectorAll('button')].find((x) => x.textContent === 'Import styles');
    await act(async () => { b!.click(); });
    await act(async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); });
    expect(calls.addStyles).toEqual([false]);
    expect(el.textContent).toContain('All 11 śikṣāmitra styles are here.');
  });
});

describe('a document in his older style names', () => {
  it('is told, in the clean names it will have, and nothing of Word’s own is listed', async () => {
    host.older = ['Translit', 'Holding'];
    await draw();
    expect(el.textContent).toContain('This document uses the older style names (Translit, Holding)');
    expect(el.textContent).toContain('Mantra, Translation, Holding · Short');
    expect(el.textContent).not.toMatch(/Heading1|Heading2|Caption|Title/);
  });
  it('and Import styles converts it', async () => {
    host.older = ['Translit'];
    await draw();
    const b = [...el.querySelectorAll('button')].find((x) => x.textContent === 'Import styles');
    await act(async () => { b!.click(); });
    await act(async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); });
    expect(calls.converted).toBe(1);
    expect(el.textContent).not.toContain('older style names');
  });
  it('a document that is already clean is not converted', async () => {
    host.missing = ['Mantra'];
    await draw();
    const b = [...el.querySelectorAll('button')].find((x) => x.textContent === 'Import styles');
    await act(async () => { b!.click(); });
    await act(async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); });
    expect(calls.converted).toBe(0);
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
