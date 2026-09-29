/**
 * A LINE THAT REWRITING WOULD DAMAGE IS LEFT ALONE — and a document already
 * marked is not rewritten at all.
 */
import { describe, expect, it, vi } from 'vitest';
import { STAGES, rerun, resolveProfile } from '@siksamitra/engine';

vi.mock('../../apps/word-addin/src/word/client.js',
  async () => (await import('./word-pane-harness.js')).clientMock);
const {
  button, calls, host, located, mount, refresh, settle, text,
} = await import('./word-pane-harness.js');

describe('a line that rewriting would damage', () => {
  it('a picture on the line: Short writes nothing, and says what is in the way', async () => {
    located.blocked = ['a picture, a shape or a text box'];
    await mount();
    await refresh();
    await settle();
    button('Short')?.click();
    await settle();
    expect(calls.writeParagraph).toBe(0);
    expect(text()).toContain('this line has a picture');
  });
  it('the rules over the selection refuse it the same way', async () => {
    located.blocked = ['a comment'];
    await mount();
    await refresh();
    await settle();
    button('Run over the selection')?.click();
    await settle();
    expect(calls.writeParagraph).toBe(0);
  });
  it('the whole-document run leaves such a line alone and lists it', async () => {
    host.docLines = [
      { index: 0, tm: { text: 'taṁ tvā', marks: [] }, style: 'Translit', blocked: [] },
      { index: 2, tm: { text: 'taṁ tvā', marks: [] }, style: 'Translit', blocked: ['a comment'] },
    ];
    await mount();
    const all = button('Run over the document');
    all?.click();
    await settle();
    all?.click();
    await settle();
    expect(calls.written).toBe(1);
    expect(text()).toContain('line 3: it has a comment on it');
  });
  it('a second run over a marked document writes nothing — idempotent', async () => {
    /* The line as the first run left it: the same rules, the same register. */
    const once = rerun({ text: 'agnim īḷe purohitam', marks: [] }, {
      stages: [...STAGES], mode: 'keep-hand', profile: resolveProfile([{ preset: 'taittiriya' }]),
      from: 0, to: 'agnim īḷe purohitam'.length,
    });
    host.docLines = [{ index: 0, tm: { text: once.text, marks: once.marks }, style: 'Translit', blocked: [] }];
    await mount();
    const all = button('Run over the document');
    all?.click();
    await settle();
    all?.click();
    await settle();
    expect(calls.written).toBe(0);
    expect(text()).toContain('Nothing to change');
  });
});
