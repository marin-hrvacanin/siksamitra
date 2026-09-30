/**
 * THE ADD-IN'S DIALOGS, as a person meets them: what they say, and what their
 * buttons and keys send back to the runtime (`messageParent`).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Said, argsOf } from '../../apps/word-addin/src/dialog/Said.js';
import { TypeHelp } from '../../apps/word-addin/src/dialog/TypeHelp.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const sent: unknown[] = [];
(globalThis as { Office?: unknown }).Office = {
  context: { ui: { messageParent: (m: string) => { sent.push(JSON.parse(m)); } }, officeTheme: { bodyBackgroundColor: '#FFFFFF' } },
};
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
}

let host: HTMLElement;
let root: Root;
beforeEach(() => { sent.splice(0); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const draw = async (node: React.ReactNode): Promise<void> => { await act(async () => { root.render(node); }); };
const buttons = (): string[] => [...host.querySelectorAll('button')].map((b) => b.textContent ?? '');
const key = async (k: string): Promise<void> => { await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k })); }); };

describe('a message', () => {
  it('says its sentence and the detail under it, with one OK', async () => {
    await draw(<Said args={argsOf('?text=Nothing%20to%20mark.&kind=warn&lines=%5B%22Type%20the%20letter%20first.%22%5D')} />);
    expect(host.querySelector('.dlg__text')?.textContent).toBe('Nothing to mark.');
    expect(host.querySelector('.dlg__line')?.textContent).toBe('Type the letter first.');
    expect(buttons()).toEqual(['OK']);
    await act(async () => { host.querySelector('button')!.click(); });
    expect(sent).toEqual([{ close: true }]);
  });

  it('is read defensively: a damaged query is a plain, empty message', () => {
    expect(argsOf('?lines=not-json&kind=shout')).toEqual({ text: '', kind: 'plain', lines: [], yes: 'Yes' });
  });
});

describe('a question', () => {
  const q = argsOf('?text=Re-apply%3F&kind=ask&yes=Re-apply&lines=%5B%5D');
  it('offers Cancel and its own yes', async () => {
    await draw(<Said args={q} />);
    expect(buttons()).toEqual(['Cancel', 'Re-apply']);
  });
  it('Enter says yes, Escape says no', async () => {
    await draw(<Said args={q} />);
    await key('Enter');
    await key('Escape');
    expect(sent).toEqual([{ answer: 'yes' }, { answer: 'no' }]);
  });
});

describe('the typing help', () => {
  it('draws every key of the palette', async () => {
    await draw(<TypeHelp />);
    const keys = [...host.querySelectorAll('button')].map((b) => b.textContent ?? '');
    for (const ch of ['ā', 'ṛ', 'ṅ', 'ñ', 'ṭ', 'ḍ', 'ṇ', 'ś', 'ṣ', 'ṁ', 'ḥ']) {
      expect(keys.some((k) => k.includes(ch)), ch).toBe(true);
    }
  });
  it('a letter pressed types its long or dotted form and closes — s is ś, Shift+S is ṣ', async () => {
    await draw(<TypeHelp />);
    await key('s');
    await key('S');
    expect(sent).toEqual([{ ch: 'ś', close: true }, { ch: 'ṣ', close: true }]);
  });
  it('a key clicked types it and stays open; Escape closes', async () => {
    await draw(<TypeHelp />);
    const ā = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('ā'));
    await act(async () => { ā!.click(); });
    await key('Escape');
    expect(sent).toEqual([{ ch: 'ā' }, { close: true }]);
  });
  it('a chord is Word’s, not the palette’s', async () => {
    await draw(<TypeHelp />);
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true })); });
    expect(sent).toEqual([]);
  });
});
