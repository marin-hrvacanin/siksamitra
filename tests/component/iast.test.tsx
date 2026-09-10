/**
 * TYPING IAST, DRIVEN THE WAY A PERSON DRIVES IT.
 *
 * `iast.test.ts` checks the table. This checks the two things that use it, in
 * a DOM, because both are about events rather than data:
 *
 *   the leader   F9, released, then a letter. What must be true is that the
 *                letter does NOT also arrive as itself, that Shift does not
 *                spend the leader (F9 then Shift+T is `ṭh`, and nine of the
 *                eighteen characters are typed that way), and that a miss
 *                inserts nothing rather than the letter that was pressed.
 *   the palette  a key inserts, the palette STAYS OPEN, and pressing one does
 *                not move the caret — a button that takes the focus takes it
 *                from the document, and the insertion then has no caret to
 *                land at.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IAST_PALETTE } from '../../apps/web/src/editor/iast.js';
import { useIast } from '../../apps/web/src/editor/useIast.js';
import { IastPalette } from '../../apps/web/src/shell/IastPalette.js';

/*
 * `cleanup` EXPLICITLY, and NOT `document.body.innerHTML = ''`.
 *
 * Two things learned here. The palette is PORTALLED to the body, so emptying
 * the body by hand pulls the portal's container out from under React and the
 * next unmount throws "the node to be removed is not a child of this node".
 * And Testing Library's automatic cleanup only runs when vitest's globals are
 * on, which this project does not turn on — so without this line the previous
 * test's palette is still in the document and `getByRole` finds two of
 * everything.
 */
afterEach(cleanup);

/** Press a key on the window, the way the leader listens for it. */
function press(key: string, init: KeyboardEventInit = {}): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key, bubbles: true, cancelable: true, ...init,
    }));
  });
}

describe('the F9 leader', () => {
  it('F9 then a letter inserts the diacritic', () => {
    const insert = vi.fn();
    const { result } = renderHook(() => useIast({ insert, editing: true }));
    expect(result.current.armed).toBe(false);
    press('F9');
    expect(result.current.armed).toBe(true);
    press('a');
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith('ā');
    expect(result.current.armed).toBe(false);
  });

  it('and the letter does not ALSO arrive as itself', () => {
    /*
     * The second key must be prevented, or F9+a types `āa` — the diacritic
     * from us and the plain letter from the input path, which is where every
     * printable character comes from (`keymap.ts`).
     */
    const insert = vi.fn();
    renderHook(() => useIast({ insert, editing: true }));
    press('F9');
    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
  });

  it('Shift does not spend the leader, because the capitals need it', () => {
    /*
     * F9 then Shift+T is `ṭh`. Nine of the eighteen characters are typed with
     * a capital, so consuming the leader on the Shift keydown would make half
     * the table unreachable — and the browser sends Shift's own keydown first.
     */
    const insert = vi.fn();
    const { result } = renderHook(() => useIast({ insert, editing: true }));
    press('F9');
    press('Shift', { shiftKey: true });
    expect(result.current.armed, 'still armed after Shift').toBe(true);
    press('T', { shiftKey: true });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith('ṭh');
  });

  it('a key the map does not have inserts NOTHING, and ends the leader', () => {
    /*
     * F9 then `q` means the person meant a diacritic and named one that does
     * not exist. Inserting `q` into a mantra is worse than inserting nothing,
     * so the press is swallowed either way — which is what v1 did.
     */
    const insert = vi.fn();
    const { result } = renderHook(() => useIast({ insert, editing: true }));
    press('F9');
    const event = new KeyboardEvent('keydown', { key: 'q', bubbles: true, cancelable: true });
    act(() => { window.dispatchEvent(event); });
    expect(insert).not.toHaveBeenCalled();
    expect(event.defaultPrevented, 'the plain letter must not get through').toBe(true);
    expect(result.current.armed).toBe(false);
  });

  it('a letter with no leader is not ours at all — the control', () => {
    /*
     * Without this the hook could be swallowing every keystroke in the
     * program and every check above would still pass.
     */
    const insert = vi.fn();
    renderHook(() => useIast({ insert, editing: true }));
    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    act(() => { window.dispatchEvent(event); });
    expect(insert).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('and F9 does nothing while the document is not being edited', () => {
    /* Read mode: F9 belongs to the browser, or to nobody. */
    const insert = vi.fn();
    const { result } = renderHook(() => useIast({ insert, editing: false }));
    press('F9');
    expect(result.current.armed).toBe(false);
    press('a');
    expect(insert).not.toHaveBeenCalled();
  });

  it('the leader survives being armed twice', () => {
    /* Someone who presses F9 and then wonders whether it worked presses it
       again. That must not consume the leader as a miss. */
    const insert = vi.fn();
    const { result } = renderHook(() => useIast({ insert, editing: true }));
    press('F9');
    press('F9');
    expect(result.current.armed).toBe(true);
    press('i');
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith('ī');
  });
});

describe('the on-screen keyboard', () => {
  const open = async (insert = vi.fn()): Promise<{ insert: typeof insert }> => {
    render(<IastPalette insert={insert} armed={false} enabled />);
    await userEvent.click(screen.getByRole('button', { name: /IAST/i }));
    return { insert };
  };

  it('opens, and offers every character the table has', async () => {
    await open();
    const wanted = IAST_PALETTE.flatMap((g) => g.keys).length;
    /* One button per key, plus the ribbon button that opened it. */
    expect(screen.getAllByRole('button').length).toBe(wanted + 1);
  });

  it('a key inserts its character', async () => {
    const { insert } = await open();
    await userEvent.click(screen.getByTitle(/^ā/));
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith('ā');
  });

  it('and it STAYS OPEN, because these are pressed in bursts', async () => {
    /* `ṛtaṁ ṛtena` needs four in a row. A palette that closed on each pick
       would be four trips to the ribbon. */
    const { insert } = await open();
    await userEvent.click(screen.getByTitle(/^ṛ/));
    await userEvent.click(screen.getByTitle(/^ṁ/));
    expect(insert).toHaveBeenCalledTimes(2);
    expect(screen.getByTitle(/^ṛ/)).toBeTruthy();
  });

  it('pressing a key does not take the focus from the document', async () => {
    /*
     * THE FAULT THIS PREVENTS. A button that takes the focus takes it from the
     * editor's own field, and the insertion then has no caret to land at —
     * measured once already as "editing is still not working" after opening a
     * menu. `onMouseDown` prevents the default, which is what moves focus.
     */
    const insert = vi.fn();
    render(<IastPalette insert={insert} armed={false} enabled />);
    await userEvent.click(screen.getByRole('button', { name: /IAST/i }));
    const key = screen.getByTitle(/^ā/);
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    act(() => { key.dispatchEvent(down); });
    expect(down.defaultPrevented).toBe(true);
  });

  it('a combining mark shows its carrier and inserts the bare mark', async () => {
    /* A lone U+0331 on a button is an invisible key. */
    const { insert } = await open();
    const anudatta = screen.getByTitle(/anudātta/);
    expect(anudatta.textContent).toContain('a');
    await userEvent.click(anudatta);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith('̱');
  });

  it('and the button is dead while the document is not being edited', () => {
    /* Nothing to insert into. A palette that inserted in read mode would
       change a document nobody had asked to change. */
    render(<IastPalette insert={vi.fn()} armed={false} enabled={false} />);
    expect(screen.getByRole('button', { name: /IAST/i })).toHaveProperty('disabled', true);
  });
});
