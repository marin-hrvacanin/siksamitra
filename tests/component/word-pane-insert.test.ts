/**
 * THE INSERT PALETTE — a key through the model, with the caret after it.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/word-addin/src/word/client.js',
  async () => (await import('./word-pane-harness.js')).clientMock);
vi.mock('../../apps/word-addin/src/word/selection.js',
  async () => (await import('./word-pane-harness.js')).selectionMock);
const H = await import('./word-pane-harness.js');
const { calls, host, located, mount, refresh, settle, text } = H;

const key = (label: string): HTMLButtonElement | undefined =>
  [...H.root.querySelectorAll<HTMLButtonElement>('.insert .iast__key')].find((b) => b.getAttribute('aria-label') === label);

const at = async (text: string, from: number, to = from): Promise<void> => {
  located.tm = { text, marks: [] };
  located.wordText = text;
  located.from = from;
  located.to = to;
  await mount();
  await refresh();
  await settle();
};

describe('the insert palette', () => {
  it('draws the app\'s keys, without the F9 hints Word has no use for', async () => {
    await at('agne', 4);
    expect(H.root.querySelectorAll('.insert .iast__key').length).toBeGreaterThan(40);
    expect(H.root.querySelector('.insert .iast__f9')).toBeNull();
  });
  it('a letter is typed at the caret, and the caret goes after it', async () => {
    await at('agne', 2);
    key('ṅ')?.click();
    await settle();
    expect(calls.lastWrites[0]?.tm.text).toBe('agṅne');
    expect(calls.caret).toEqual({ line: 0, at: 3 });
  });
  it('the svarita key places a svara on the letter before, in its style', async () => {
    await at('agne', 4);
    key('svarita (U+030D)')?.click();
    await settle();
    expect(calls.lastWrites[0]?.tm.text).toBe('agne');
    expect(calls.lastWrites[0]?.tm.marks).toContainEqual(expect.objectContaining({ k: 'svara', v: 'svarita' }));
  });
  it('an accent with no letter before it writes nothing, and says why', async () => {
    await at('agne', 0);
    key('svarita (U+030D)')?.click();
    await settle();
    expect(calls.linesWritten).toBe(0);
    expect(text()).toContain('no letter before the caret');
  });
  it('a selection over several lines is not typed over', async () => {
    await at('agne', 2, 4);
    host.more = [structuredClone(located)];
    await refresh();
    await settle();
    key('ṅ')?.click();
    await settle();
    expect(calls.linesWritten).toBe(0);
    expect(text()).toContain('Select within one line');
  });
});
