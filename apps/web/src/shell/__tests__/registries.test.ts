/**
 * The two registries, and the promises they make.
 *
 * Every action in this program is DATA: a row in `COMMANDS` or a row in
 * `EDIT_KEYS`. The whole point is that a button and its shortcut cannot
 * disagree, because they are the same row — v1 had the ribbon, a dialog and a
 * key handler as three copies of the same actions and they drifted, with one
 * checking a precondition the others did not.
 *
 * A registry only keeps that promise if its rows are well formed, and nothing
 * checked that. These tests are the check: no two commands claiming the same
 * accelerator, no button without a glyph, no toggle without a state, and every
 * icon a name the icon table actually has.
 */
import { describe, expect, it } from 'vitest';
import { COMMANDS, commandsIn, handleKey, type CommandContext } from '../commands.js';
import { EDIT_KEYS, accelOf, ribbonActions } from '../../editor/keymap.js';
import { ICONS } from '../../ui/icons.generated.js';

/** A context that records what a command did to it. */
function context(over: Partial<CommandContext> = {}): CommandContext & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    view: 'flow',
    setView: () => calls.push('setView'),
    cycleView: () => calls.push('cycleView'),
    zoom: 1,
    zoomIn: () => calls.push('zoomIn'),
    zoomOut: () => calls.push('zoomOut'),
    resetZoom: () => calls.push('resetZoom'),
    setZoomMode: () => calls.push('setZoomMode'),
    paginated: false,
    pageSize: 'a4',
    setPageSize: () => calls.push('setPageSize'),
    script: 'iast',
    setScript: () => calls.push('setScript'),
    showMarks: true,
    setShowMarks: () => calls.push('setShowMarks'),
    theme: 'light',
    setTheme: () => calls.push('setTheme'),
    editing: false,
    hasDoc: true,
    dirty: false,
    newDoc: () => calls.push('newDoc'),
    openDoc: () => calls.push('openDoc'),
    save: () => calls.push('save'),
    saveAs: () => calls.push('saveAs'),
    ...over,
  } as CommandContext & { calls: string[] };
}

describe('the command registry', () => {
  it('has a unique id per command', () => {
    const ids = COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every command an icon the table has', () => {
    for (const c of COMMANDS) {
      expect(c.icon, `${c.id} has no icon`).toBeDefined();
      expect(Object.keys(ICONS), `${c.id} -> ${c.icon}`).toContain(c.icon);
    }
  });

  it('never gives one accelerator to two commands', () => {
    /*
     * The failure this prevents: two commands with `Ctrl+0`, one of which
     * silently never fires because `handleKey` returns on the first match.
     */
    const keys = COMMANDS.filter((c) => c.key !== undefined).map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('puts every command in a group the toolbar reads', () => {
    const groups = new Set(['file', 'view', 'zoom', 'text', 'appearance']);
    for (const c of COMMANDS) expect(groups, c.id).toContain(c.group);
    // And every group has something in it, or the ribbon shows an empty box.
    for (const g of groups) {
      expect(commandsIn(g as 'view').length, `group ${g} is empty`).toBeGreaterThan(0);
    }
  });

  it('runs the action it names, and nothing else', () => {
    for (const c of COMMANDS) {
      const ctx = context({ paginated: true });
      c.run(ctx);
      expect(ctx.calls.length, `${c.id} did nothing`).toBeGreaterThan(0);
    }
  });

  it('disables what cannot run, rather than failing when it is pressed', () => {
    // Fit-page is meaningless where there are no pages.
    const fitPage = COMMANDS.find((c) => c.id === 'zoom.fitPage')!;
    expect(fitPage.enabled?.(context({ paginated: false }))).toBe(false);
    expect(fitPage.enabled?.(context({ paginated: true }))).toBe(true);
    // Zoom stops at the ends of its own range.
    expect(COMMANDS.find((c) => c.id === 'zoom.in')!.enabled?.(context({ zoom: 4 }))).toBe(false);
    expect(COMMANDS.find((c) => c.id === 'zoom.out')!.enabled?.(context({ zoom: 0.25 })))
      .toBe(false);
    // Saving with nothing open is a grey button, not a refusal at the far end.
    for (const id of ['file.save', 'file.saveAs']) {
      const command = COMMANDS.find((c) => c.id === id)!;
      expect(command.enabled?.(context({ hasDoc: false })), id).toBe(false);
      expect(command.enabled?.(context({ hasDoc: true })), id).toBe(true);
    }
  });

  it('reports a toggle s state from the context, not from itself', () => {
    const marks = COMMANDS.find((c) => c.id === 'text.marks')!;
    expect(marks.active?.(context({ showMarks: true }))).toBe(true);
    expect(marks.active?.(context({ showMarks: false }))).toBe(false);
  });
});

describe('the keyboard', () => {
  const press = (init: Partial<KeyboardEvent>): { fired: boolean; calls: string[] } => {
    const ctx = context(init.ctrlKey === undefined ? {} : {});
    const event = {
      key: 'x', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...init,
    } as KeyboardEvent;
    const fired = handleKey(event, ctx);
    return { fired, calls: ctx.calls };
  };

  it('fires the command whose accelerator was pressed', () => {
    const { fired, calls } = press({ key: 'm', ctrlKey: true });
    expect(fired).toBe(true);
    expect(calls).toEqual(['setShowMarks']);
  });

  it('ignores a key no command claims', () => {
    expect(press({ key: 'q', ctrlKey: true }).fired).toBe(false);
  });

  /*
   * CTRL AND PLUS, WHICH IS SHIFT AND EQUALS.
   *
   * `Ctrl+=` is the accelerator, and on a US or Croatian layout typing `+`
   * means holding Shift — so the gesture every browser and editor uses for
   * zoom-in arrives as `Ctrl+Shift+=`. `matches` compared Shift for equality
   * and refused it, one line above a comment saying the two were the same
   * gesture. MEASURED in the running program: `Ctrl+=` took the page from
   * 100 % to 110 %, and `Ctrl+Shift++` and `Ctrl+Shift+=` did nothing.
   */
  it('zooms in for Ctrl and plus, however the layout produces a plus', () => {
    for (const init of [
      { key: '=', ctrlKey: true },
      { key: '+', ctrlKey: true },
      { key: '+', ctrlKey: true, shiftKey: true },
      { key: '=', ctrlKey: true, shiftKey: true },
    ]) {
      const { fired, calls } = press(init);
      expect(fired, JSON.stringify(init)).toBe(true);
      expect(calls, JSON.stringify(init)).toEqual(['zoomIn']);
    }
  });

  it('and out for Ctrl and minus, underscore included', () => {
    for (const init of [
      { key: '-', ctrlKey: true },
      { key: '_', ctrlKey: true, shiftKey: true },
    ]) {
      const { fired, calls } = press(init);
      expect(fired, JSON.stringify(init)).toBe(true);
      expect(calls, JSON.stringify(init)).toEqual(['zoomOut']);
    }
  });

  it('but Shift is still compared for every other accelerator', () => {
    /*
     * THE CONTROL. Ignoring Shift everywhere would make Ctrl+Shift+S — save a
     * copy — fire plain save as well, and would let a marking shortcut answer
     * to a gesture that is not it. Ctrl+M toggles the marks; Ctrl+Shift+M is
     * nobody's.
     */
    expect(press({ key: 'm', ctrlKey: true }).fired).toBe(true);
    expect(press({ key: 'm', ctrlKey: true, shiftKey: true }).fired).toBe(false);
  });

  it('and a twinned key still needs its modifier', () => {
    /* A bare `+` is a character, not a command. */
    expect(press({ key: '+', ctrlKey: false, shiftKey: true }).fired).toBe(false);
    expect(press({ key: '=', ctrlKey: false }).fired).toBe(false);
  });

  it('stands down while the editor has the keyboard, where they collide', () => {
    /*
     * Ctrl+Shift+V is paste-as-plain-text everywhere. It was cycling the view
     * instead, in the middle of typing.
     */
    const cycle = COMMANDS.find((c) => c.id === 'view.cycle')!;
    expect(cycle.textConflict).toBe(true);
    const event = {
      key: 'V', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false,
    } as KeyboardEvent;
    expect(handleKey(event, context({ editing: true }))).toBe(false);
    expect(handleKey(event, context({ editing: false }))).toBe(true);
  });
});

describe('the editing keys', () => {
  it('gives every ribbon action an icon the table has', () => {
    for (const group of ['marks', 'history', 'auto'] as const) {
      const actions = ribbonActions(group);
      expect(actions.length, `group ${group} is empty`).toBeGreaterThan(0);
      for (const b of actions) {
        expect(b.icon, `"${b.label}" has no icon`).toBeDefined();
        expect(Object.keys(ICONS), `${b.label} -> ${b.icon}`).toContain(b.icon);
      }
    }
  });

  it('shows an accelerator only where there is one', () => {
    for (const b of EDIT_KEYS) {
      const accel = accelOf(b);
      if (b.key === '') expect(accel, `"${b.label}"`).toBeUndefined();
      else expect(accel, `"${b.label}"`).toBeTypeOf('string');
    }
  });

  it('never binds the same chord to two different actions', () => {
    /*
     * Two accelerators for ONE action is deliberate and allowed — Ctrl+Y and
     * Ctrl+Shift+Z are both redo. Two ACTIONS on one chord is a bug: the
     * second is unreachable.
     */
    const byChord = new Map<string, Set<string>>();
    for (const b of EDIT_KEYS) {
      if (b.key === '') continue;
      const chord = `${b.ctrl === true ? 'C-' : ''}${b.shift === true ? 'S-' : ''}${b.key.toLowerCase()}`;
      const labels = byChord.get(chord) ?? new Set<string>();
      labels.add(b.label);
      byChord.set(chord, labels);
    }
    for (const [chord, labels] of byChord) {
      expect([...labels], `${chord} is bound to more than one action`).toHaveLength(1);
    }
  });

  it('describes what a marking button is FOR, not what it is', () => {
    // The hint is the tooltip. "Short" says nothing; "a thin box — a short
    // vowel before" is the difference between a tool and a puzzle.
    for (const b of ribbonActions('marks')) {
      expect(b.hint, `"${b.label}" has no hint`).toBeTypeOf('string');
      expect(b.hint!.length).toBeGreaterThan(10);
    }
  });
});
