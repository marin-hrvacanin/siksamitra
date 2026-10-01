/**
 * THE CONVENTIONS SWITCHED UNDER MARKED TEXT — and switched back.
 *
 * Measured in real Word (`tools/word-ui/dirty.ts`): with the visarga before
 * `k` marked as a change, then that convention switched off, Re-apply left the
 * change mark where it was — taken for a person's, because the re-run asked
 * the NEW conventions what the rules had made. The text now records what it
 * was last marked with (`recordedMarkedWith`), and a re-run undoes that.
 * The expectation is the engine's line for the text, not the add-in's.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { STAGES, conventionsPatch, rerun, resolveProfile } from '@siksamitra/engine';
import type { TextAndMarks } from '@siksamitra/format';
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
let settings: typeof import('../../apps/word-addin/src/word/settings.js');
beforeAll(async () => {
  runtime = await import('../../apps/word-addin/src/runtime.js');
  table = await import('../../apps/word-addin/src/commands-table.js');
  settings = await import('../../apps/word-addin/src/word/settings.js');
}, 120_000);
const press = async (id: string): Promise<void> => runtime.run(table.ALL_COMMANDS.find((c) => c.id === id)!);

const TEXT = 'namaḥ kavaye bhavyāya ca';
const engine = (c: Record<string, boolean>): TextAndMarks => {
  const out = rerun({ text: TEXT, marks: [] }, {
    stages: STAGES, mode: 'keep-hand', from: 0, to: TEXT.length,
    profile: resolveProfile([{ preset: 'taittiriya', patch: conventionsPatch(c) as never }]),
  });
  /* As Word gives it back: no record of which marks were the rules'. */
  return { text: out.text, marks: out.marks.map(({ stage: _s, ...m }) => ({ ...m, by: 'hand' as const })) };
};
const bare = (tm: { text: string; marks: readonly { k: string; from: number; to: number; v?: string }[] }) =>
  [tm.text, tm.marks.filter((m) => m.k !== 'syl').map((m) => `${m.k}:${m.from}-${m.to}:${m.v ?? ''}`).sort()];
const OFF = { 'visarga-before-velar': false, 'vy-aid': true };
const docLine = (tm: TextAndMarks) => ({ index: 0, tm, style: 'Mantra', blocked: [], part: null, script: 'iast' as const });

describe('switching the conventions under marked text', () => {
  it('the conventions switched: exactly the engine’s line in them — the old ones’ marks undone', async () => {
    host.settings.set('siksamitra.register', 'taittiriya');
    host.docLines = [docLine(engine({}))];
    await settings.recordConventions(OFF);
    await press('reapply');
    expect(calls.documentWrites).toHaveLength(1);
    expect(bare(calls.documentWrites[0]!.changed[0]!.tm)).toEqual(bare(engine(OFF)));
    expect(settings.recordedMarkedWith()).toEqual(OFF);
  });

  it('and switched back: the defaults again, the switched ones’ marks undone', async () => {
    host.settings.set('siksamitra.register', 'taittiriya');
    host.settings.set('siksamitra.conventions.markedWith', OFF);
    host.docLines = [docLine(engine(OFF))];
    await settings.recordConventions({});
    await press('reapply');
    expect(bare(calls.documentWrites[0]!.changed[0]!.tm)).toEqual(bare(engine({})));
  });

  it('the first change records what the text was marked with until then', async () => {
    host.settings.set('siksamitra.conventions', { 'vy-aid': true });
    await settings.recordConventions({});
    expect(settings.recordedMarkedWith()).toEqual({ 'vy-aid': true });
  });

  it('a run over some lines leaves the record as it was', async () => {
    host.settings.set('siksamitra.conventions.markedWith', {});
    host.settings.set('siksamitra.conventions', OFF);
    host.lines = [line('agnim īḷe purohitam', 0, 19)];
    await press('reapply');
    expect(calls.writes).toHaveLength(1);
    expect(settings.recordedMarkedWith()).toEqual({});
  });
});
