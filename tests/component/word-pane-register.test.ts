/**
 * THE REGISTER A DOCUMENT IS MARKED IN — recorded in the document, shown, and
 * changed only by running the rules.
 */
import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';

vi.mock('../../apps/word-addin/src/word/client.js',
  async () => (await import('./word-pane-harness.js')).clientMock);
vi.mock('../../apps/word-addin/src/word/selection.js',
  async () => (await import('./word-pane-harness.js')).selectionMock);
const H = await import('./word-pane-harness.js');
const { button, host, located, mount, refresh, settle, text } = H;

const KEY = 'siksamitra.register';
const select = (): HTMLSelectElement => H.root.querySelector('select.tb__sel')!;
const choose = async (key: string): Promise<void> => {
  await act(async () => {
    const s = select();
    s.value = key;
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
};
const runDocument = async (): Promise<void> => {
  const all = button('Run over the document');
  all?.click();
  await settle();
  all?.click();
  await settle();
};

describe('the recorded register', () => {
  it('a document marked as Ṛgveda opens with the Ṛgveda chosen', async () => {
    host.settings.set(KEY, 'rigveda');
    await mount();
    expect(select().value).toBe('rigveda');
    expect(text()).not.toContain('Marked as');
  });
  it('an unknown value in the settings is ignored, not trusted', async () => {
    host.settings.set(KEY, '<script>');
    await mount();
    expect(select().value).toBe('taittiriya');
  });
  it('choosing another register rewrites nothing, and says what running will do', async () => {
    host.settings.set(KEY, 'taittiriya');
    await mount();
    await choose('rigveda');
    expect(text()).toContain('Marked as');
    expect(H.calls.linesWritten + H.calls.written).toBe(0);
    expect(host.settings.get(KEY)).toBe('taittiriya');
  });
  it('running over the document records the new register', async () => {
    host.settings.set(KEY, 'taittiriya');
    await mount();
    await choose('rigveda');
    await runDocument();
    expect(host.settings.get(KEY)).toBe('rigveda');
    expect(text()).not.toContain('Marked as');
  });
  it('running over a selection alone keeps the document\'s, and says the rest stays', async () => {
    host.settings.set(KEY, 'taittiriya');
    located.tm = { text: 'tvā yuvase', marks: [] };
    located.wordText = 'tvā yuvase';
    located.from = 0;
    located.to = 10;
    await mount();
    await refresh();
    await settle();
    await choose('rigveda');
    button('Run over the selection')?.click();
    await settle();
    expect(host.settings.get(KEY)).toBe('taittiriya');
    expect(text()).toContain('the rest of the document stays');
  });
  it('a document never run records the register of its first run', async () => {
    await mount();
    await runDocument();
    expect(host.settings.get(KEY)).toBe('taittiriya');
  });
});
