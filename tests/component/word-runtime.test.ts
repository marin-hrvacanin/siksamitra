/**
 * EVERY BUTTON ON THE TAB, PRESSED — against a Word faked at its edges.
 *
 * `runtime.ts` is what the ribbon, the right-click menu and every keyboard
 * shortcut run. These press its commands the way Word does and look at what
 * reached the document and what was said: a marking on the letter before the
 * caret, a refusal in words, a question before the whole document is touched,
 * a line written in another script. The Word side is `word-addin-harness.ts`.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { calls, dialogReplies, host, lastWritten, line } from './word-addin-harness.js';

vi.mock('../../apps/word-addin/src/word/selection.js', async () => (await import('./word-addin-harness.js')).selectionMock);
vi.mock('../../apps/word-addin/src/word/client.js', async () => (await import('./word-addin-harness.js')).clientMock);
vi.mock('../../apps/word-addin/src/word/convert.js', async () => (await import('./word-addin-harness.js')).convertMock);
vi.mock('../../apps/word-addin/src/word/parts.js', async () => (await import('./word-addin-harness.js')).partsMock);
vi.mock('../../apps/word-addin/src/word/dialog.js', async (real) => ({
  ...(await real<object>()), ...(await import('./word-addin-harness.js')).dialogMock,
}));

type Runtime = typeof import('../../apps/word-addin/src/runtime.js');
type Table = typeof import('../../apps/word-addin/src/commands-table.js');
let runtime: Runtime;
let table: Table;

beforeAll(async () => {
  runtime = await import('../../apps/word-addin/src/runtime.js');
  table = await import('../../apps/word-addin/src/commands-table.js');
}, 120_000);

const press = async (id: string): Promise<void> => {
  const c = table.ALL_COMMANDS.find((x) => x.id === id);
  if (c === undefined) throw new Error(`no command ${id}`);
  await runtime.run(c);
};
const marksOf = (k: string) => calls.writes.at(-1)!.writes[0]!.tm.marks.filter((m) => m.k === k);

describe('every command is there to be pressed', () => {
  it('as the global the manifest names, and for its keyboard shortcut', () => {
    runtime.registerAll();
    const expected = table.ALL_COMMANDS.filter((c) => c.does !== 'settings').map((c) => c.fn);
    for (const fn of expected) expect(typeof (globalThis as Record<string, unknown>)[fn], fn).toBe('function');
    expect(calls.associated).toEqual(expected);
  });

  it('and every one completes, even when Word fails under it', async () => {
    runtime.registerAll();
    const { selectionMock } = await import('./word-addin-harness.js');
    selectionMock.locate.mockRejectedValueOnce(new Error('Word went away'));
    vi.spyOn(console, 'error').mockImplementationOnce(() => undefined);
    const completed = vi.fn();
    await (globalThis as unknown as Record<string, (e: unknown) => Promise<void>>).smHoldShort!({ completed });
    expect(completed).toHaveBeenCalledOnce();
    expect(calls.told).toEqual([expect.objectContaining({ text: 'Short did not work.', kind: 'warn', lines: ['Word went away'] })]);
  });
});

describe('a marking with nothing selected', () => {
  it('goes on the letter before the caret, and says nothing', async () => {
    host.lines = [line('agnim', 2)];
    await press('hold-short');
    expect(lastWritten()).toBe('agnim');
    expect(marksOf('hold').map((m) => [m.from, m.to, m.v])).toEqual([[1, 2, 'short']]);
    expect(calls.writes.at(-1)!.caret).toEqual({ line: 0, at: 2 });
    expect(calls.told).toEqual([]);
  });

  it('after a space there is nothing to mark, and it says so', async () => {
    host.lines = [line('agnim ', 6)];
    await press('svara-svarita');
    expect(calls.writes).toEqual([]);
    expect(calls.told[0]).toEqual(expect.objectContaining({ kind: 'warn', text: expect.stringContaining('Nothing to mark') }));
  });

  it('a pause goes AT the caret', async () => {
    host.lines = [line('agnim īḻe', 5)];
    await press('pause-short');
    expect(marksOf('pause').map((m) => [m.from, m.to])).toEqual([[5, 5]]);
  });
});

describe('a marking over a selection', () => {
  it('marks the letters and keeps them selected', async () => {
    host.lines = [line('agnim īḻe', 6, 9)];
    await press('svara-anudatta');
    expect(marksOf('svara').map((m) => [m.from, m.to, m.v])).toEqual([[6, 9, 'anudatta']]);
    expect(calls.writes.at(-1)!.caret).toEqual({ line: 0, at: 6, to: 9 });
  });

  it('over three lines marks all three, in one write', async () => {
    host.lines = [line('agnim', 0, 5), line('īḻe', 0, 3), line('purohitam', 0, 2)];
    await press('change-visarga');
    expect(calls.writes).toHaveLength(1);
    expect(calls.writes[0]!.writes.map((w) => w.line)).toEqual([0, 1, 2]);
  });

  it('refuses the whole press when one line has a picture on it', async () => {
    host.lines = [line('agnim', 0, 5), line('īḻe', 0, 3, { blocked: ['a picture'] })];
    await press('hold-long');
    expect(calls.writes).toEqual([]);
    expect(calls.told[0]).toEqual(expect.objectContaining({ kind: 'warn', text: expect.stringContaining('line 2 of the selection') }));
  });
});

describe('the rules', () => {
  it('with nothing selected, ask first — and No touches nothing', async () => {
    host.docLines = [{ index: 1, tm: { text: 'agnim īḻe', marks: [] }, style: 'Translit', blocked: [], part: null, script: 'iast' }];
    host.answer = false;
    await press('reapply');
    expect(calls.asked).toEqual(['Re-apply the rules to the whole document?']);
    expect(calls.documentWrites).toEqual([]);
  });

  it('and Yes marks every mantra line of the document', async () => {
    host.docLines = [{ index: 1, tm: { text: 'agnim īḻe purohitam', marks: [] }, style: 'Translit', blocked: [], part: null, script: 'iast' }];
    await press('reapply');
    expect(calls.documentWrites).toHaveLength(1);
    expect(calls.documentWrites[0]!.changed[0]!.tm.marks.length).toBeGreaterThan(0);
  });

  it('over a selection, run without asking', async () => {
    host.lines = [line('agnim īḻe purohitam', 0, 19)];
    await press('reapply');
    expect(calls.asked).toEqual([]);
    expect(calls.writes).toHaveLength(1);
  });
});

describe('the script menu', () => {
  it('writes the selected lines in Devanāgarī, every mark kept', async () => {
    host.lines = [line('agnim', 0, 5), line('īḻe', 0, 3)];
    await press('script-deva');
    expect(calls.writes[0]!.writes.map((w) => [w.line, w.script, w.tm.text])).toEqual([[0, 'deva', 'agnim'], [1, 'deva', 'īḻe']]);
  });

  it('leaves a line that is already in it — the page already shows what was asked', async () => {
    host.lines = [line('agnim', 0, 5, { script: 'deva' })];
    await press('script-deva');
    expect(calls.writes).toEqual([]);
    expect(calls.told).toEqual([]);
  });

  it('with nothing selected, asks, then writes the whole document', async () => {
    host.docLines = [
      { index: 0, tm: { text: 'agnim', marks: [] }, style: 'Translit', blocked: [], part: null, script: 'iast' },
      { index: 2, tm: { text: 'īḻe', marks: [] }, style: 'Translit', blocked: [], part: null, script: 'tel' },
    ];
    await press('script-tam');
    expect(calls.asked).toEqual(['Write the whole document in Tamil?']);
    expect(calls.documentWrites[0]!.changed.map((c) => [c.index, c.script])).toEqual([[0, 'tam'], [2, 'tam']]);
  });

  it('never touches a heading or a translation', async () => {
    host.lines = [line('Invocation', 0, 10, { isVerse: false }), line('agnim', 0, 5)];
    await press('script-deva');
    expect(calls.writes[0]!.writes.map((w) => w.line)).toEqual([1]);
  });
});

describe('typing', () => {
  it('Alt+S types ś at the caret', async () => {
    host.lines = [line('a', 1)];
    await press('alt-s');
    expect(lastWritten()).toBe('aś');
  });

  it('in a Devanāgarī line a vowel after a consonant is its sign — क then ā is का', async () => {
    host.lines = [line('ka', 2, 2, { script: 'deva' })];
    await press('alt-a');
    expect(lastWritten()).toBe('kā');
  });

  it('and a capital is its letter, since a script has no capitals', async () => {
    host.lines = [line('ka', 2, 2, { script: 'deva' })];
    await press('alt-s-up');
    expect(lastWritten()).toBe('kaṣ');
  });

  it('the typing help types what its keys send, at the caret', async () => {
    host.lines = [line('k', 1)];
    dialogReplies.push({ ch: 'ṛ' });
    await press('typing-help');
    expect(calls.dialogs).toEqual(['type.html']);
    expect(lastWritten()).toBe('kṛ');
  });
});

describe('Import styles on one of his documents', () => {
  it('converts it to the clean styles and says so', async () => {
    host.older = ['Translit', 'Prijevod'];
    await press('import-styles');
    expect(calls.converted).toBe(1);
    expect(calls.told[0]!.lines.join(' ')).toContain('now in the clean styles, looking as they did');
    expect(calls.told[0]!.lines.join(' ')).toContain('The older styles went: Translit, Prijevod.');
  });
  it('and does not convert a clean document', async () => {
    await press('import-styles');
    expect(calls.converted).toBe(0);
  });
});

describe('the document buttons', () => {
  it('Import styles puts the styles in and says how many', async () => {
    host.missing = ['Mantra'];
    await press('import-styles');
    expect(calls.addStyles).toEqual([false]);
    expect(calls.told[0]!.text).toBe('The 11 śikṣāmitra styles are in this document.');
  });

  it('Specimen keeps the passage, and says where it is', async () => {
    await press('specimen');
    expect(calls.addStyles).toEqual([true]);
    expect(calls.told[0]!.lines[0]).toContain('end of the document');
  });

  it('Settings opens the side panel, and the guide opens in the browser', async () => {
    await press('settings');
    await press('guide');
    expect(calls.taskpane).toBe(1);
    expect(calls.browser).toHaveLength(1);
  });
});

describe('parts and registers', () => {
  it('a register chosen at a bare caret outside every part is those lines’ — never “the document’s”', async () => {
    host.docLines = [{ index: 0, tm: { text: 'agnim īḻe', marks: [] }, style: 'Translit', blocked: [], part: null, script: 'iast' }];
    await press('reg-rigveda');
    expect(host.settings.get('siksamitra.register')).toBe('rigveda');
    expect(calls.asked).toEqual(['Re-mark the lines outside every part as Ṛgveda?']);
    expect(host.part).toBeNull();
  });

  it('a register chosen over SELECTED lines outside every part makes them a part in it', async () => {
    host.settings.set('siksamitra.register', 'smarta');
    host.lines = [line('agnim īḻe', 0, 9), line('purohitam', 0, 9)];
    await press('reg-rigveda');
    expect(calls.asked).toEqual(['Mark these lines as Ṛgveda?']);
    expect(host.part).toEqual({ register: 'rigveda' });
    /* The lines outside every part keep theirs. */
    expect(host.settings.get('siksamitra.register')).toBe('smarta');
    expect(calls.writes).toHaveLength(1);
  });

  it('a selection partly in a part and partly not is refused — it has no one place to choose for', async () => {
    host.settings.set('siksamitra.register', 'smarta');
    host.lines = [line('agnim īḻe', 0, 9, { part: { register: 'rigveda' } }), line('purohitam', 0, 9)];
    await press('reg-taittiriya');
    expect(calls.told[0]).toEqual(expect.objectContaining({ kind: 'warn', text: 'The selection is in more than one place.' }));
    expect(calls.asked).toEqual([]);
    expect(host.settings.get('siksamitra.register')).toBe('smarta');
    expect(calls.writes).toHaveLength(0);
  });

  it('and so is one over parts of different registers', async () => {
    host.lines = [line('agnim īḻe', 0, 9, { part: { register: 'rigveda' } }), line('purohitam', 0, 9, { part: { register: 'smarta' } })];
    await press('reg-taittiriya');
    expect(calls.told[0]!.lines[0]).toContain('different registers');
    expect(calls.writes).toHaveLength(0);
  });

  it('a selection inside one part re-marks that part', async () => {
    host.part = { register: 'rigveda' };
    host.lines = [line('agnim īḻe', 0, 9, { part: { register: 'rigveda' } }), line('purohitam', 0, 9, { part: { register: 'rigveda' } })];
    await press('reg-smarta');
    expect(calls.asked[0]).toContain('Re-mark this part');
    expect(host.part).toEqual({ register: 'smarta' });
  });

  it('declined, nothing is made and nothing re-marked', async () => {
    host.answer = false;
    host.lines = [line('agnim īḻe', 0, 9), line('purohitam', 0, 9)];
    await press('reg-rigveda');
    expect(host.part).toBeNull();
    expect(calls.writes).toHaveLength(0);
  });

  it('no wording anywhere speaks of the register “of the document”', async () => {
    host.docLines = [{ index: 0, tm: { text: 'agnim īḻe', marks: [] }, style: 'Translit', blocked: [], part: null, script: 'iast' }];
    await press('reg-rigveda');
    host.part = { register: 'smarta' };
    await press('part-dissolve');
    const said = JSON.stringify([calls.asked, calls.told]);
    expect(said).not.toMatch(/the document’s|of the document|document is marked|Re-mark the document/);
  });

  it('a new part from the selection is marked in the register here', async () => {
    host.settings.set('siksamitra.register', 'smarta');
    await press('part-new');
    expect(host.part).toEqual({ register: 'smarta' });
    expect(calls.told[0]!.text).toContain('Smārta');
  });

  it('dissolving where there is no part says so', async () => {
    await press('part-dissolve');
    expect(calls.told[0]).toEqual(expect.objectContaining({ kind: 'warn', text: 'The caret is not in a part.' }));
  });
});
