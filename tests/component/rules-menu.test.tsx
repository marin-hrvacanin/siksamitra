/**
 * THE APP'S RULES MENU — the register and, now, the conventions the Word
 * add-in has, pressed as a person presses them. Never "the document's"
 * register: the menu names the sections it acts on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CONVENTIONS } from '@siksamitra/engine';
import { RegisterGroup } from '../../apps/web/src/shell/RegisterGroup.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let el: HTMLElement;
let root: Root;
beforeEach(() => { el = document.createElement('div'); document.body.append(el); root = createRoot(el); });
afterEach(() => { act(() => root.unmount()); el.remove(); document.body.innerHTML = ''; });

const doc = (patch?: object) => ({
  id: 'd', title: 't', sections: [{ id: 's1', title: 'Saṅkalpa', verses: [] }],
  ...(patch === undefined ? {} : { profile: { patch } }),
});
function session(patch?: object) {
  return {
    doc: doc(patch), sectionId: 's1', sectionRegister: null, register: null,
    setRegister: vi.fn(() => 'registered'), setConventions: vi.fn(() => 'switched'),
  };
}
async function open(s: ReturnType<typeof session>, onNote = vi.fn()): Promise<void> {
  await act(async () => { root.render(<RegisterGroup session={s as never} onNote={onNote} />); });
  await act(async () => { el.querySelector<HTMLButtonElement>('button')!.click(); });
}
const byText = (t: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(t));

describe('the Rules menu', () => {
  it('offers every convention, each with what it does to a typed example — or, greyed, where it applies', async () => {
    await open(session());
    for (const c of CONVENTIONS) {
      const b = byText(c.label)!;
      expect(b, c.id).toBeDefined();
      /* The default register is Taittirīya: a switch for Smārta verse only —
         the purāṇic svaras, a classical metre's yati — has nothing to do there. */
      if (c.onlyFor !== undefined) {
        expect(b.disabled).toBe(true);
        expect(b.textContent).toContain(c.onlyFor);
      } else {
        expect(b.disabled, c.id).toBe(false);
        expect(b.textContent).toContain(`${c.example.typed} → ${c.example.marked}`);
      }
    }
  });

  it('in a Smārta document the purāṇic svaras are a live switch', async () => {
    const s = session();
    s.doc = { ...s.doc, profile: { preset: 'smarta' } } as never;
    await open(s);
    const b = byText(CONVENTIONS.find((c) => c.id === 'puranic-svara')!.label)!;
    expect(b.disabled).toBe(false);
    expect(b.getAttribute('aria-checked')).toBe('true');
  });

  it('shows each as the document has it — the registry’s default where nothing is switched', async () => {
    await open(session());
    expect(byText('raised u')?.getAttribute('aria-checked') ?? byText(CONVENTIONS.find((c) => c.id === 'vy-aid')!.label)!.getAttribute('aria-checked')).toBe('false');
    expect(byText(CONVENTIONS.find((c) => c.id === 'nasal-before-nasal')!.label)!.getAttribute('aria-checked')).toBe('true');
  });

  it('and as the document’s own patch sets it', async () => {
    await open(session({ aids: { vy: true } }));
    expect(byText(CONVENTIONS.find((c) => c.id === 'vy-aid')!.label)!.getAttribute('aria-checked')).toBe('true');
  });

  it('pressing one switches it — for the sections without their own, and says what happened', async () => {
    const s = session();
    const onNote = vi.fn();
    await open(s, onNote);
    await act(async () => { byText(CONVENTIONS.find((c) => c.id === 'vy-aid')!.label)!.click(); });
    expect(s.setConventions).toHaveBeenCalledWith('document', { 'vy-aid': true });
    expect(onNote).toHaveBeenCalledWith('switched');
  });

  it('with the section chosen, for that section alone', async () => {
    const s = session();
    await open(s);
    await act(async () => { byText('Only “Saṅkalpa”')!.click(); });
    await act(async () => { byText(CONVENTIONS.find((c) => c.id === 'geminate-box')!.label)!.click(); });
    expect(s.setConventions).toHaveBeenCalledWith('section', { 'geminate-box': true });
  });

  it('names what it acts on, and never “the whole document”', async () => {
    await open(session());
    const text = document.body.textContent ?? '';
    expect(text).toContain('Sections without their own');
    expect(text).not.toMatch(/whole document|follows the document/);
  });
});
