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
vi.mock('../../apps/word-addin/src/word/sources.js', async () => (await import('./word-addin-harness.js')).sourcesMock);
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
    const expected = table.ALL_COMMANDS.filter((c) => c.does !== 'panel').map((c) => c.fn);
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
    expect(calls.asked).toEqual(['Auto-mark the whole document?']);
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

  it('the typing help opens the panel on its Type tab — the palette beside the document, not a dialog over it', async () => {
    const nav = await import('../../apps/word-addin/src/ui/panel/nav.js');
    nav.openTab('mark');
    const before = calls.taskpane;
    await press('typing-help');
    expect(calls.taskpane).toBe(before + 1);
    expect(calls.dialogs).toEqual([]);
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

  it('Panel opens the side panel, and the guide opens in the browser', async () => {
    await press('panel');
    await press('guide');
    expect(calls.taskpane).toBe(1);
    expect(calls.browser).toHaveLength(1);
  });
});

describe('sources', () => {
  /* What the rules make of a plain line in a source — the engine's answer,
     computed here independently of the runtime. */
  const T = 'yā devī sarvabhūteṣu śaktirūpeṇa saṁsthitā';
  const byRules = async (source: string): Promise<string> => {
    const { rerun, resolveProfile, STAGES } = await import('@siksamitra/engine');
    const out = rerun({ text: T, marks: [] }, {
      stages: [...STAGES], mode: 'keep-hand', profile: resolveProfile([{ preset: source as never }]), from: 0, to: T.length,
    });
    return out.text;
  };
  /* The lines Word now holds: what was last written to each, as a person would see. */
  const follow = (): void => {
    const last = calls.writes.at(-1);
    if (last === undefined) return;
    for (const w of last.writes) host.lines[w.line] = { ...host.lines[w.line]!, tm: structuredClone(w.tm) as never };
  };
  const whole = (text = T, more = {}) => line(text, 0, text.length, more);

  it('with nothing selected it asks, then every line takes it and it is the document’s own', async () => {
    host.settings.set('siksamitra.register', 'smarta');
    host.docLines = [
      { index: 0, tm: { text: T, marks: [] }, style: 'Translit', blocked: [], part: null, script: 'iast' },
      { index: 1, tm: { text: T, marks: [] }, style: 'Translit', blocked: [], part: { register: 'rigveda' }, script: 'iast' },
    ];
    await press('reg-taittiriya');
    expect(calls.asked).toEqual(['Mark every line as Taittirīya?']);
    expect(calls.sources).toEqual([{ scope: 'document', source: 'taittiriya' }]);
    expect(host.settings.get('siksamitra.register')).toBe('taittiriya');
    const wrote = calls.documentWrites[0]!.changed.map((l) => l.tm.text);
    expect(wrote).toEqual([await byRules('taittiriya'), await byRules('taittiriya')]);
    expect(calls.told[0]!.text).toMatch(/^Every line is Taittirīya now\./);
  });

  it('declined, nothing is recorded and nothing written', async () => {
    host.answer = false;
    await press('reg-rigveda');
    expect(calls.sources).toEqual([]);
    expect(calls.documentWrites).toEqual([]);
    expect(calls.writes).toEqual([]);
  });

  it('selected lines take it without a question, and only they — the document’s own stays', async () => {
    host.settings.set('siksamitra.register', 'smarta');
    host.lines = [whole()];
    await press('reg-taittiriya');
    expect(calls.asked).toEqual([]);
    expect(calls.sources).toEqual([{ scope: 'selection', source: 'taittiriya' }]);
    expect(host.lines[0]!.part).toEqual({ register: 'taittiriya' });
    expect(host.settings.get('siksamitra.register')).toBe('smarta');
    expect(calls.writes[0]!.writes[0]!.tm.text).toBe(await byRules('taittiriya'));
    expect(calls.told[0]!.text).toMatch(/^This line is Taittirīya now\./);
  });

  it('ONE LETTER selected is its whole line: the ṁ before s becomes the gum (the owner’s case)', async () => {
    host.settings.set('siksamitra.register', 'smarta');
    const at = T.indexOf('ṁ');
    host.lines = [line(T, at, at + 1)];
    await press('reg-taittiriya');
    expect(calls.writes[0]!.writes[0]!.tm.text).toBe(await byRules('taittiriya'));
    expect(calls.writes[0]!.writes[0]!.tm.text).not.toBe(T);
  });

  it('any direction and back: Ṛgveda → Taittirīya → Smārta → Ṛgveda is what Ṛgveda made', async () => {
    host.settings.set('siksamitra.register', 'smarta');
    host.lines = [whole()];
    await press('reg-rigveda'); follow();
    const first = structuredClone(host.lines[0]!.tm);
    await press('reg-taittiriya'); follow();
    expect(host.lines[0]!.tm.text).toBe(await byRules('taittiriya'));
    await press('reg-smarta'); follow();
    /* The document's own: the record comes off. */
    expect(host.lines[0]!.part).toBeNull();
    expect(host.lines[0]!.tm.text).toBe(await byRules('smarta'));
    await press('reg-rigveda'); follow();
    expect(host.lines[0]!.tm).toEqual(first);
    /* And again: nothing to change. */
    const before = calls.writes.length;
    await press('reg-rigveda');
    expect(calls.writes.length === before || calls.writes.at(-1)!.writes.length === 0).toBe(true);
  });

  it('a selection across two sources: all take the one chosen, each undone from its own', async () => {
    host.settings.set('siksamitra.register', 'smarta');
    host.lines = [whole(T, { part: { register: 'taittiriya' } })];
    await press('reg-taittiriya'); follow();
    /* Line 1 as Taittirīya marked it, line 2 as Smārta did. */
    host.lines = [host.lines[0]!, whole(await byRules('smarta'))];
    await press('reg-rigveda'); follow();
    expect(host.lines.map((l) => l.part)).toEqual([{ register: 'rigveda' }, { register: 'rigveda' }]);
    expect(host.lines.map((l) => l.tm.text)).toEqual([await byRules('rigveda'), await byRules('rigveda')]);
    expect(calls.told.at(-1)!.text).toMatch(/^These 2 lines are Ṛgveda now\./);
  });

  it('a heading in the selection takes no source and is not marked', async () => {
    host.settings.set('siksamitra.register', 'smarta');
    host.lines = [whole('Durgā Sūktam', { style: 'Heading2', isVerse: false }), whole()];
    await press('reg-taittiriya');
    expect(calls.writes[0]!.writes.map((w) => w.line)).toEqual([1]);
    expect(calls.told[0]!.text).toMatch(/^This line is Taittirīya now\./);
  });

  it('only headings and translations selected: nothing recorded, and it says why', async () => {
    host.lines = [whole('Durgā Sūktam', { style: 'Heading2', isVerse: false }), whole('prijevod', { style: 'Prijevod', isVerse: false })];
    await press('reg-taittiriya');
    expect(calls.sources).toEqual([]);
    expect(calls.told[0]).toEqual(expect.objectContaining({ kind: 'warn', text: 'Nothing to mark: these are not mantra lines.' }));
  });

  it('a line the rules may not rewrite is refused BEFORE its source changes', async () => {
    host.lines = [whole(T, { blocked: ['a picture'] })];
    await press('reg-taittiriya');
    expect(calls.sources).toEqual([]);
    expect(calls.writes).toEqual([]);
    expect(calls.told[0]!.kind).toBe('warn');
  });

  it('Auto-mark over a heading and a mantra line marks only the mantra line', async () => {
    host.lines = [whole('Durgā Sūktam', { style: 'Heading2', isVerse: false }), whole()];
    await press('reapply');
    expect(calls.writes[0]!.writes.map((w) => w.line)).toEqual([1]);
  });

  it('nothing it says speaks of parts', async () => {
    host.docLines = [{ index: 0, tm: { text: T, marks: [] }, style: 'Translit', blocked: [], part: null, script: 'iast' }];
    await press('reg-rigveda');
    host.lines = [whole()];
    await press('reg-smarta');
    expect(JSON.stringify([calls.asked, calls.told])).not.toMatch(/\bparts?\b/i);
  });
});
