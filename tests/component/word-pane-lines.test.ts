/**
 * A SELECTION OVER SEVERAL LINES — bold's rule over all of them, in one write.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/word-addin/src/word/client.js',
  async () => (await import('./word-pane-harness.js')).clientMock);
vi.mock('../../apps/word-addin/src/word/selection.js',
  async () => (await import('./word-pane-harness.js')).selectionMock);
const {
  button, calls, host, located, mount, refresh, settle, text,
} = await import('./word-pane-harness.js');

const line = (t: string, extra: Partial<typeof located> = {}): typeof located => ({
  ...structuredClone(located), tm: { text: t, marks: [] }, from: 0, to: t.length, wordText: t, ...extra,
});

describe('three lines selected', () => {
  const three = async (): Promise<void> => {
    located.from = 0;
    located.to = located.tm.text.length;
    host.more = [line('agnim īḷe'), line('purohitam')];
    await mount();
    await refresh();
    await settle();
  };
  it('the pane says so, rather than showing the first line alone', async () => {
    await three();
    expect(text()).toContain('Selected 3 lines');
  });
  it('Short boxes all three, in ONE write', async () => {
    await three();
    button('Short')?.click();
    await settle();
    expect(calls.writeParagraph).toBe(1);
    expect(calls.linesWritten).toBe(3);
    expect(text()).toContain('3 of 3 lines changed');
  });
  it('the rules over the selection re-mark each line', async () => {
    await three();
    button('Run over the selection')?.click();
    await settle();
    expect(calls.writeParagraph).toBe(1);
    expect(calls.linesWritten).toBeGreaterThan(0);
  });
  it('one line with a comment on it: nothing is written at all', async () => {
    located.from = 0;
    located.to = located.tm.text.length;
    host.more = [line('agnim īḷe', { blocked: ['a comment'] }), line('purohitam')];
    await mount();
    await refresh();
    await settle();
    expect(button('Short')?.disabled).toBe(true);
    expect(text()).toContain('a comment on it');
    expect(calls.linesWritten).toBe(0);
  });
  it('a selection that starts at the very end of a line still marks the next', async () => {
    located.from = located.tm.text.length;
    located.to = located.tm.text.length;
    host.more = [line('purohitam')];
    await mount();
    await refresh();
    await settle();
    expect(button('Short')?.disabled).toBe(false);
    button('Short')?.click();
    await settle();
    expect(calls.linesWritten).toBe(1);
  });
});
