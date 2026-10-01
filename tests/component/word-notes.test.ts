/**
 * A LINE WITH A NOTE, AND A LINE THAT IS HIDDEN — pressed.
 *
 * His lines end in notes (`…ṛṣiḥ । svarabhakti`), and his Devī Māhātmyam hides
 * whole lines. What a button does to each is what a person sees: the note is
 * still there after the press, and a hidden line is left alone with a reason.
 * The Word side is `word-addin-harness.ts`; `blockedIn` and `lineNotes`
 * themselves are held in the unit tier.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { calls, host, line } from './word-addin-harness.js';

vi.mock('../../apps/word-addin/src/word/selection.js', async () => (await import('./word-addin-harness.js')).selectionMock);
vi.mock('../../apps/word-addin/src/word/client.js', async () => (await import('./word-addin-harness.js')).clientMock);
vi.mock('../../apps/word-addin/src/word/convert.js', async () => (await import('./word-addin-harness.js')).convertMock);
vi.mock('../../apps/word-addin/src/word/parts.js', async () => (await import('./word-addin-harness.js')).partsMock);
vi.mock('../../apps/word-addin/src/word/dialog.js', async (real) => ({
  ...(await real<object>()), ...(await import('./word-addin-harness.js')).dialogMock,
}));

let runtime: typeof import('../../apps/word-addin/src/runtime.js');
let table: typeof import('../../apps/word-addin/src/commands-table.js');
beforeAll(async () => {
  runtime = await import('../../apps/word-addin/src/runtime.js');
  table = await import('../../apps/word-addin/src/commands-table.js');
}, 120_000);
const press = async (id: string): Promise<void> => runtime.run(table.ALL_COMMANDS.find((c) => c.id === id)!);

const NOTE = { line: 0, lead: ' ', runs: [{ text: 'svarabhakti', rStyle: 'Comment', superscript: false }] };

describe('a line that ends in a note', () => {
  it('a marking writes the line WITH its note', async () => {
    host.lines = [line('agnim īḷe', 2, 2, { notes: [NOTE] })];
    await press('hold-short');
    expect(calls.writes).toHaveLength(1);
    expect(calls.writes[0]!.writes[0]).toMatchObject({ notes: [NOTE] });
  });
  it('and so does re-applying the rules over it', async () => {
    host.lines = [line('agnim īḷe purohitam', 0, 19, { notes: [NOTE] })];
    await press('reapply');
    expect(calls.writes[0]!.writes[0]).toMatchObject({ notes: [NOTE] });
  });
  it('and re-applying the rules to the whole document', async () => {
    host.docLines = [{
      index: 1, tm: { text: 'agnim īḷe purohitam', marks: [] }, style: 'Translit', blocked: [], part: null, script: 'iast',
      notes: [NOTE],
    } as never];
    await press('reapply');
    expect(calls.documentWrites[0]!.changed[0]).toMatchObject({ notes: [NOTE] });
  });
  it('and nothing is said about the note — it is not in the way', async () => {
    host.lines = [line('agnim īḷe', 2, 2, { notes: [NOTE] })];
    await press('svara-svarita');
    expect(calls.told.filter((t) => t.kind === 'warn')).toEqual([]);
  });
});

describe('a hidden line', () => {
  it('is left alone, and the person is told why', async () => {
    host.lines = [line('oṁ aruṇāṅ', 2, 2, { blocked: ['hidden text — unhide it first, or leave the line as it is'] })];
    await press('hold-short');
    expect(calls.writes).toEqual([]);
    expect(calls.told[0]).toEqual(expect.objectContaining({ kind: 'warn', text: expect.stringContaining('hidden text') }));
  });
});

describe('the conventions the document is set to', () => {
  it('reach the rules: the vy aid switched on is written', async () => {
    host.settings.set('siksamitra.conventions', { 'vy-aid': true });
    host.lines = [line('bhavyam', 0, 7)];
    await press('reapply');
    const sup = calls.writes[0]!.writes[0]!.tm.marks.filter((m) => m.k === 'sup');
    expect(sup.map((m) => m.v)).toContain('u');
  });
  it('and by default it is not', async () => {
    host.lines = [line('bhavyam', 0, 7)];
    await press('reapply');
    const sup = (calls.writes[0]?.writes[0]?.tm.marks ?? []).filter((m) => m.k === 'sup');
    expect(sup.map((m) => m.v)).not.toContain('u');
  });
});
