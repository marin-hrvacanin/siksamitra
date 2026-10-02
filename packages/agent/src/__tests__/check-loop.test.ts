/**
 * THE CHECK FINDS WHAT IS WRONG, AND THE LOOP KEEPS ITS PROMISES.
 *
 * The check is asked about documents made wrong on purpose — a verse retyped,
 * an edit not re-marked, a Vedic text with no accents — and delivery is
 * refused for each. The loop is asked to survive a tool that fails and a model
 * that calls a tool that does not exist, and to stop at its limits.
 */
import { describe, expect, it } from 'vitest';
import {
  OverBudget, Session, Workspace, blocksOf, checkDocument, compact, lineRange, memoryLedger, runTurn, toolsFor,
} from '../index.js';
import { PURUSHA_PAGE, scripted, testHost } from './fixtures.js';

const PRICE = { input: 0.28, cached: 0.028, output: 0.42 };
const tool = (name: string) => toolsFor('deliver', testHost()).find((t) => t.spec.name === name)!;

async function built(page = PURUSHA_PAGE, source = 'taittiriya'): Promise<{ ws: Workspace; ctx: Parameters<ReturnType<typeof tool>['run']>[1] }> {
  const ws = new Workspace();
  const host = testHost();
  const ctx = { ws, host, review: async () => '' };
  ws.keep('https://x', 'page', page.split('\n'));
  await tool('build_document').run({ title: 'Puruṣa Sūktam', source, sections: [{ title: 'Puruṣa Sūktam', witness: 'w1', lines: '5-8' }] }, ctx);
  return { ws, ctx };
}

describe('the check', () => {
  it('a document built from its page and marked by the rules is OK', async () => {
    const { ws } = await built();
    expect(checkDocument(ws)).toEqual([]);
  });

  it('a verse retyped differs from its source — and is found, even marked again', async () => {
    const { ws, ctx } = await built();
    await tool('replace_text').run({ verse: 's-1-v2', text: 'puruṣa evedaṁ sarvam yad bhūtaṁ yac ca bhavyam' }, ctx);
    expect(checkDocument(ws).map((f) => f.what).join('\n')).toMatch(/not what the rules make|differs from w1/);
    await tool('auto_mark').run({}, ctx);
    const found = checkDocument(ws);
    expect(found).toEqual([expect.objectContaining({ severity: 'error', where: 's-1-v2', what: expect.stringMatching(/^differs from w1/) })]);
    /* Said EXACTLY where: a check that printed the first ninety letters of
       each side, which agreed, sent a real run round its build eleven times. */
    expect(found[0]!.what).toMatch(/^differs from w1, verse 2, (?:line \d+|its lines): has "[^"]+" where the source has "[^"]+"$/);
    /* And nothing is delivered from it. */
    expect(await tool('deliver').run({}, ctx)).toMatch(/^not delivered/);
  });

  it('a Vedic text from an unaccented page is said to need an accented one', async () => {
    const plain = PURUSHA_PAGE.replace(/[॒॑᳚]/gu, '');
    const { ws } = await built(plain);
    expect(checkDocument(ws)).toEqual([expect.objectContaining({ severity: 'warn', what: expect.stringMatching(/no svaras/) })]);
  });

  it('switching the source re-marks it, and undoes what the old one made', async () => {
    const { ws, ctx } = await built(PURUSHA_PAGE, 'smarta');
    await tool('set_source').run({ source: 'taittiriya' }, ctx);
    const direct = await built(PURUSHA_PAGE, 'taittiriya');
    expect(ws.need().sections[0]!.verses.map((v) => v.tokens)).toEqual(direct.ws.need().sections[0]!.verses.map((v) => v.tokens));
    expect(checkDocument(ws)).toEqual([]);
  });
});

describe('an author\'s text', () => {
  it('opened from the library is delivered as it is: the check does not ask the rules, and re-marking is refused unasked', async () => {
    /* A verified text whose marks are NOT what the rules make — one holding moved by its author. */
    const { ws: made } = await built();
    const doc = made.need();
    const host = testHost({ id: 'purusha', title: 'Puruṣa Sūktam', load: () => ({ doc, kind: 'verified' }) });
    const ws = new Workspace();
    const ctx = { ws, host, review: async () => '' };
    const open = toolsFor('deliver', host).find((t) => t.spec.name === 'open_text')!;
    expect(await open.run({ id: 'purusha' }, ctx)).toMatch(/its marks are its author's/);
    expect(ws.origin).toBe('author');
    expect(checkDocument(ws)).toEqual([]);
    await expect(tool('auto_mark').run({}, ctx)).rejects.toThrow(/author/);
    await expect(tool('set_source').run({ source: 'rigveda' }, ctx)).rejects.toThrow(/author/);
    /* Asked for, it is done. */
    await expect(tool('auto_mark').run({ asked: true }, ctx)).resolves.toBeTypeOf('string');
    /* And the origin survives a saved session. */
    const s = new Session({ id: 'a', mode: 'deliver', model: scripted([]), price: PRICE, host, ledger: memoryLedger(), limits: {} });
    s.ws.open(doc, 'author');
    expect(new Session({ id: 'a', mode: 'deliver', model: scripted([]), price: PRICE, host, ledger: memoryLedger(), limits: {} }, JSON.parse(JSON.stringify(s.save()))).ws.origin).toBe('author');
  });
});

describe('reading a page', () => {
  it('says where the Indic text is, so only those lines are read', () => {
    expect(blocksOf(PURUSHA_PAGE.split('\n'))).toEqual([
      { from: 4, to: 8, script: 'Devanāgarī', start: 'पुरुषसूक्तम्' },
    ]);
  });
  it('a line range is 1-based and inclusive, and refused outside the page', () => {
    expect(lineRange('5-8', 10)).toEqual([5, 8]);
    expect(lineRange('7', 10)).toEqual([7, 7]);
    expect(() => lineRange('9-12', 10)).toThrow(/outside/);
    expect(() => lineRange('x', 10)).toThrow(/not a line range/);
  });
});

describe('the loop', () => {
  it('a failing tool and a tool that does not exist are answered, and the turn goes on', async () => {
    const model = scripted([
      { calls: [{ name: 'outline', args: {} }, { name: 'make_coffee', args: {} }] },
      { say: 'nothing is open yet' },
    ]);
    const s = new Session({ id: 's', mode: 'deliver', model, price: PRICE, host: testHost(), ledger: memoryLedger(), limits: {} });
    const done = await s.ask('what is open?');
    expect(done.text).toBe('nothing is open yet');
    const tools = s.conversation.filter((m) => m.role === 'tool').map((m) => (m as { content: string }).content);
    expect(tools).toEqual([expect.stringMatching(/^error: no document is open/), 'error: there is no tool "make_coffee"']);
  });

  it('over the global limit, no call is made at all', async () => {
    const model = scripted([{ say: 'never' }]);
    const ledger = memoryLedger();
    await ledger.record({ at: '', session: 'other', model: 'm', usage: { input: 0, cached: 0, output: 0 }, cost: 10 });
    const s = new Session({ id: 's', mode: 'deliver', model, price: PRICE, host: testHost(), ledger, limits: { global: 10 } });
    await expect(s.ask('hello')).rejects.toThrow(OverBudget);
    expect(model.requests).toHaveLength(0);
  });

  it('stops at its step limit and says so', async () => {
    const model = scripted(Array.from({ length: 5 }, () => ({ calls: [{ name: 'outline', args: {} }] })));
    const done = await runTurn({
      model, price: PRICE, tools: toolsFor('deliver', testHost()), system: 's', messages: [],
      ctx: { ws: new Workspace(), host: testHost(), review: async () => '' }, ledger: memoryLedger(), limits: {}, session: 's', maxSteps: 3,
    }, 'loop');
    expect(done.steps).toBe(3);
    expect(done.text).toMatch(/^Stopped after 3 steps/);
  });
});

describe('a session, kept and restored', () => {
  it('comes back with its document, its witnesses and what each section was built from', async () => {
    const model = scripted([
      { calls: [{ name: 'fetch_page', args: { url: 'https://x' } }] },
      { calls: [{ name: 'build_document', args: { title: 'Puruṣa Sūktam', source: 'taittiriya', sections: [{ title: 'Puruṣa Sūktam', witness: 'w1', lines: '5-8' }] } }] },
      { say: 'built' },
    ]);
    const opts = { id: 's', mode: 'deliver' as const, model, price: PRICE, host: testHost(), ledger: memoryLedger(), limits: {} };
    const a = new Session(opts);
    await a.ask('build it');
    const saved = JSON.parse(JSON.stringify(a.save()));
    const b = new Session(opts, saved);
    expect(b.ws.need().sections[0]!.verses.map((v) => v.tokens)).toEqual(a.ws.need().sections[0]!.verses.map((v) => v.tokens));
    expect(checkDocument(b.ws)).toEqual([]);
    expect(b.conversation).toEqual(a.conversation);
  });

  it('a long conversation keeps every word of the person’s and drops only old tool answers', () => {
    const long = 'x'.repeat(1000);
    const messages = [
      { role: 'user' as const, content: 'one' },
      { role: 'tool' as const, toolCallId: 'a', content: long },
      { role: 'user' as const, content: 'two' },
      { role: 'tool' as const, toolCallId: 'b', content: long },
      { role: 'user' as const, content: 'three' },
      { role: 'tool' as const, toolCallId: 'c', content: long },
    ];
    const out = compact(messages, 1500);
    expect(out.filter((m) => m.role === 'user').map((m) => m.content)).toEqual(['one', 'two', 'three']);
    expect(out.map((m) => (m.role === 'tool' ? m.content.length : 0))).toEqual([0, expect.any(Number), 0, 1000, 0, 1000]);
    expect((out[1] as { content: string }).content).toMatch(/left out/);
    expect(compact(messages, 1_000_000)).toEqual(messages);
  });
});
