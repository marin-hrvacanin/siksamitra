/**
 * FINDING A PASSAGE, AND FINISHING IN TIME — what the Gāyatrī request lacked.
 *
 * The agent fetched the whole Taittirīya Āraṇyaka, which has the Gāyatrī in
 * it, and could only read it in slices at guessed lines; then it used every
 * step and answered nothing. Now it can find a phrase by its letters, and is
 * told when three steps are left, and its last step answers in words.
 */
import { describe, expect, it } from 'vitest';
import { Workspace, memoryLedger, runTurn, toolsFor } from '../index.js';
import { findLines, lettersKey } from '../tools/sources.js';
import { scripted, testHost } from './fixtures.js';

const PAGE = {
  id: 'w1', origin: 'https://sanskritdocuments.org/x', title: 'TA',
  lines: [
    'हरिः ॐ ॥ शं नो मित्रः शं वरुणः ।',
    'ॐ भूर्भुव॒स्सुवः॑ । तत्स॑वि॒तुर्वरे॑ण्यं॒',
    'भर्गो॑ दे॒वस्य॑ धीमहि । धियो॒ यो नः॑ प्रचो॒दया॑त् ॥',
    'Then something in English.',
  ],
};

describe('finding a passage', () => {
  it('by its letters: IAST or Devanāgarī, with or without accents, diacritics or spaces', () => {
    expect(findLines(PAGE, 'tat savitur vareṇyam')).toEqual([2]);
    expect(findLines(PAGE, 'tatsavitur varenyam')).toEqual([2]);
    expect(findLines(PAGE, 'भर्गो देवस्य धीमहि')).toEqual([3]);
    /* Across the line break, where a verse is split. */
    expect(findLines(PAGE, 'vareṇyaṁ bhargo devasya')).toEqual([2]);
    expect(findLines(PAGE, 'not in it at all')).toEqual([]);
    expect(lettersKey('Tat sa̱vi̍tur!')).toBe('tatsavitur');
  });

  it('as a tool, answering line numbers to read around', async () => {
    const ws = new Workspace();
    ws.keep(PAGE.origin, PAGE.title, PAGE.lines);
    const tool = toolsFor('deliver', testHost()).find((t) => t.spec.name === 'find_in_witness')!;
    expect(await tool.run({ witness: 'w1', phrase: 'dhiyo yo naḥ pracodayāt' }, { ws, host: testHost(), review: async () => '' }))
      .toMatch(/^3\| भर्गो/);
  });
});

describe('the step budget', () => {
  it('three steps before the end it is told to finish; the last step is offered no tools', async () => {
    const model = scripted(Array.from({ length: 8 }, () => ({ calls: [{ name: 'outline', args: {} }] })));
    const messages: Parameters<typeof runTurn>[0]['messages'] = [];
    await runTurn({
      model, price: { input: 0.3, cached: 0.006, output: 1.2 }, tools: toolsFor('deliver', testHost()), system: 's', messages,
      ctx: { ws: new Workspace(), host: testHost(), review: async () => '' }, ledger: memoryLedger(), limits: {}, session: 's', maxSteps: 6,
    }, 'go');
    const told = messages.filter((m) => m.role === 'user' && m.content.startsWith('(from the program: three steps'));
    expect(told).toHaveLength(1);
    expect(model.requests.map((r) => r.tools.length > 0)).toEqual([true, true, true, true, true, false]);
  });
});
