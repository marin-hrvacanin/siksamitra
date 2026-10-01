/**
 * THE ŚIKṢĀMITRA PANEL — drawn, pressed, and what it keeps in the document.
 *
 * Every tab, and every button on them pressed the way a person presses it:
 * the marking tiles reach the line under the caret and light up for what the
 * selection already carries; a source chosen there is the ribbon's command;
 * the stages and switches are kept in the document; what the add-in says
 * appears inside the panel. Word is faked at its edges by the harness, as for
 * the runtime's own tests.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { calls, host, line } from './word-addin-harness.js';

vi.mock('../../apps/word-addin/src/word/selection.js', async () => (await import('./word-addin-harness.js')).selectionMock);
vi.mock('../../apps/word-addin/src/word/client.js', async () => (await import('./word-addin-harness.js')).clientMock);
vi.mock('../../apps/word-addin/src/word/convert.js', async () => (await import('./word-addin-harness.js')).convertMock);
vi.mock('../../apps/word-addin/src/word/sources.js', async () => (await import('./word-addin-harness.js')).sourcesMock);
vi.mock('../../apps/word-addin/src/word/dialog.js', async (real) => ({
  ...(await real<object>()), ...(await import('./word-addin-harness.js')).dialogMock,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
type PanelModule = typeof import('../../apps/word-addin/src/ui/Panel.js');
type NoticesModule = typeof import('../../apps/word-addin/src/ui/notices.js');
type NavModule = typeof import('../../apps/word-addin/src/ui/panel/nav.js');
let P: PanelModule;
let N: NoticesModule;
let nav: NavModule;
beforeAll(async () => {
  P = await import('../../apps/word-addin/src/ui/Panel.js');
  N = await import('../../apps/word-addin/src/ui/notices.js');
  nav = await import('../../apps/word-addin/src/ui/panel/nav.js');
}, 120_000);

let el: HTMLElement;
let root: Root;
beforeEach(() => { el = document.createElement('div'); document.body.append(el); root = createRoot(el); nav.openTab('mark'); });
afterEach(() => { act(() => root.unmount()); el.remove(); });

const settle = async (): Promise<void> => {
  await act(async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 260)); });
  await act(async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); });
};
const draw = async (): Promise<void> => { await act(async () => { root.render(<P.Panel />); }); await settle(); };
const button = (text: string): HTMLButtonElement =>
  [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === text || b.querySelector('.pnl-tile__label')?.textContent === text)!;
const tab = async (label: string): Promise<void> => {
  const t = [...el.querySelectorAll<HTMLButtonElement>('.pnl-tab')].find((b) => b.textContent?.includes(label))!;
  await act(async () => { t.click(); });
  await settle();
};
const press = async (b: HTMLButtonElement): Promise<void> => { await act(async () => { b.click(); }); await settle(); };

describe('the tabs', () => {
  it('are Mark, Rules, Script, Type and Document, and each draws its own', async () => {
    await draw();
    expect([...el.querySelectorAll('.pnl-tab')].map((t) => t.textContent)).toEqual(['Mark', 'Rules', 'Script', 'Type', 'Document']);
    await tab('Rules');
    expect(el.textContent).toContain('What Auto-mark marks');
    await tab('Script');
    expect(el.textContent).toContain('Devanāgarī');
    await tab('Type');
    expect(el.querySelectorAll('.iast__key').length).toBeGreaterThan(20);
    await tab('Document');
    expect(el.textContent).toContain('Styles in this document');
  });
});

describe('the Mark tab', () => {
  it('draws the line under the caret with the app’s renderer, and the letter a press would mark lit', async () => {
    host.lines = [line('agnim īḻe', 3)];
    await draw();
    const lit = [...el.querySelectorAll('.pnl-here .is-target')].map((u) => u.textContent);
    expect(lit).toEqual(['n']);
  });

  it('shows each mark on its tile as the rules give it — the holding boxes, the svaras, the pauses', async () => {
    await draw();
    const tile = (label: string): Element => button(label);
    expect(tile('Short').querySelector('.hold-short')).not.toBeNull();
    expect(tile('Long').querySelector('.hold-long')).not.toBeNull();
    expect(tile('Anudātta').querySelector('.sv-anudatta')).not.toBeNull();
    expect(tile('Svarita').querySelector('.sv-svarita')).not.toBeNull();
    expect(tile('Short pause').querySelector('.pause--short')).not.toBeNull();
    expect(tile('Long pause').querySelector('.pause--long')).not.toBeNull();
    /* ONE bar each — colour is length. */
    expect(tile('Long pause').querySelector('.pause')!.textContent).toBe('|');
    /* The candrabindu is kept by the rules, as typed. */
    expect(tile('Candrabindu').textContent).toContain('m̐');
  });

  it('a tile pressed marks the letter before the caret, and then shows pressed', async () => {
    host.lines = [line('agnim', 3)];
    await draw();
    await press(button('Long'));
    const wrote = calls.writes.at(-1)!.writes[0]!.tm;
    expect(wrote.marks.some((m) => (m as { k: string; v?: string }).k === 'hold' && (m as { v?: string }).v === 'long')).toBe(true);
    /* Word now holds the mark; the panel reads it again, as on a new caret. */
    host.lines = [line('agnim', 3, 3, { tm: wrote as never })];
    act(() => root.unmount());
    root = createRoot(el);
    await draw();
    expect(button('Long').getAttribute('aria-pressed')).toBe('true');
    expect(button('Short').getAttribute('aria-pressed')).toBe('false');
  });

  it('Auto-mark over a selection marks it by the rules', async () => {
    host.lines = [line('agnim īḻe purohitam', 0, 19)];
    await draw();
    await press(button('Auto-mark the selection'));
    expect(calls.writes.at(-1)!.writes[0]!.tm.marks.length).toBeGreaterThan(0);
  });
});

describe('the source', () => {
  it('is named once, in the header, for the line at the caret', async () => {
    host.settings.set('siksamitra.register', 'smarta');
    host.lines = [line('agnim īḻe', 3, 3, { part: { register: 'rigveda' } })];
    await draw();
    expect([...el.querySelectorAll('.pnl-chip--accent')].map((c) => c.textContent)).toEqual(['Ṛgveda']);
  });

  it('a selection across two sources names both, lights both, and chooses neither', async () => {
    host.settings.set('siksamitra.register', 'smarta');
    host.lines = [line('agnim īḻe', 0, 9, { part: { register: 'rigveda' } }), line('yā devī', 0, 7)];
    await draw();
    expect(el.querySelector('.pnl-chip--accent')!.textContent).toBe('Ṛgveda and Smārta / purāṇic');
    await tab('Rules');
    const cards = [...el.querySelectorAll('.pnl-reg')];
    expect(cards.filter((c) => c.getAttribute('data-here') === 'yes').map((c) => c.querySelector('.pnl-reg__name')!.textContent))
      .toEqual(['Ṛgveda', 'Smārta / purāṇic']);
    expect(cards.filter((c) => c.getAttribute('aria-checked') === 'true')).toHaveLength(0);
    expect(el.textContent).toContain('Source · these 2 lines');
  });

  it('a card pressed is the ribbon’s Source command: the selected lines take it', async () => {
    host.settings.set('siksamitra.register', 'smarta');
    host.lines = [line('yā devī sarvabhūteṣu śaktirūpeṇa saṁsthitā', 0, 42)];
    await draw();
    await tab('Rules');
    const card = [...el.querySelectorAll<HTMLButtonElement>('.pnl-reg')].find((c) => c.textContent!.includes('Taittirīya'))!;
    await press(card);
    expect(calls.sources).toEqual([{ scope: 'selection', source: 'taittiriya' }]);
    expect(calls.writes).toHaveLength(1);
  });
});

describe('the Rules tab', () => {
  it('offers the four sources, the one at the caret chosen, and no prose', async () => {
    host.settings.set('siksamitra.register', 'rigveda');
    await draw();
    await tab('Rules');
    const radios = [...el.querySelectorAll('.pnl-reg')];
    expect(radios).toHaveLength(4);
    expect(radios.filter((r) => r.getAttribute('aria-checked') === 'true').map((r) => r.querySelector('.pnl-reg__name')!.textContent)).toEqual(['Ṛgveda']);
    expect(el.textContent).not.toMatch(/Prose/);
  });

  it('keeps the stages and the switches in the document, and the purāṇic svaras are a switch', async () => {
    await draw();
    await tab('Rules');
    const boxes = [...el.querySelectorAll<HTMLInputElement>('.pnl-switch input')];
    /* Five stages, then every convention. */
    await act(async () => { boxes[2]!.click(); });
    expect(host.settings.get('siksamitra.stages')).toEqual(['sandhi', 'change', 'svara', 'aids']);
    expect(el.textContent).toContain('Svaras on a purāṇic śloka, by its metre');
    const vy = [...el.querySelectorAll<HTMLLabelElement>('.pnl-switch')].find((l) => l.textContent!.includes('raised u on v'))!.querySelector('input')!;
    await act(async () => { vy.click(); });
    expect(host.settings.get('siksamitra.conventions')).toEqual({ 'vy-aid': true });
  });

  it('the purāṇic svaras are greyed on a Vedic line, saying where they apply, and live on a Smārta one', async () => {
    const puranic = (): HTMLLabelElement => [...el.querySelectorAll<HTMLLabelElement>('.pnl-switch')]
      .find((l) => l.textContent!.includes('purāṇic śloka'))!;
    host.lines = [line('agnim īḻe', 3, 3, { part: { register: 'rigveda' } })];
    await draw();
    await tab('Rules');
    expect(puranic().querySelector('input')!.disabled).toBe(true);
    expect(puranic().getAttribute('data-applies')).toBe('no');
    expect(puranic().textContent).toContain('Smārta and purāṇic lines');
    /* Greyed, it still shows what the Smārta lines have: on, by default. */
    expect(puranic().querySelector('input')!.checked).toBe(true);
    act(() => root.unmount());
    root = createRoot(el);
    host.lines = [line('yā devī', 3, 3, { part: { register: 'smarta' } })];
    await draw();
    await tab('Rules');
    expect(puranic().querySelector('input')!.disabled).toBe(false);
    await act(async () => { puranic().querySelector('input')!.click(); });
    expect(host.settings.get('siksamitra.conventions')).toEqual({ 'puranic-svara': false });
  });
});

describe('the Document tab', () => {
  it('says how many styles are here, and Import styles brings the rest', async () => {
    host.missing = ['Mantra', 'Svara'];
    await draw();
    await tab('Document');
    expect(el.textContent).toContain('9 of 11 are here');
    await press(button('Import styles'));
    expect(calls.addStyles).toEqual([false]);
  });
});

describe('what the add-in says', () => {
  it('appears inside the panel, and a question is answered there', async () => {
    await draw();
    await act(async () => { N.notify({ kind: 'warn', text: 'Nothing to mark here.', lines: ['Type a letter first.'] }); });
    expect(el.querySelector('.pnl-note[data-kind="warn"]')!.textContent).toContain('Nothing to mark here.');
    let answer: boolean | null = null;
    await act(async () => { void N.confirmInPanel('Auto-mark the whole document?', 'Auto-mark', []).then((a) => { answer = a; }); });
    const yes = [...el.querySelectorAll<HTMLButtonElement>('.pnl-note[data-kind="ask"] button')].find((b) => b.textContent === 'Auto-mark')!;
    await act(async () => { yes.click(); });
    await settle();
    expect(answer).toBe(true);
    expect(el.querySelector('.pnl-note[data-kind="ask"]')).toBeNull();
  });
});
