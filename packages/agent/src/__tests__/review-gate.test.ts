/**
 * A SECOND READER, WHOSE WORD COUNTS — `deliver` waits for the review, and
 * for an answer to what it found.
 *
 * A real run's reviewer found eight faults in a stotra — a name from another
 * edition, two variants inside verses, a saṅkalpa no one asked for — and the
 * agent sent the PDF anyway (2026-10-02): the review was advice, and the check
 * the only gate.
 */
import { describe, expect, it } from 'vitest';
import { REVIEWS, Workspace, toolsFor, type Host } from '../index.js';
import { PURUSHA_PAGE, testHost } from './fixtures.js';

const build = {
  title: 'puruṣa sūktam', source: 'taittiriya', locus: 'taittirīya āraṇyaka 3.12',
  sections: [{ witness: 'w1', lines: '5-8' }],
};

function bench(answers: string[]) {
  const host: Host & { delivered: unknown[] } = testHost();
  const tasks: string[] = [];
  const ws = new Workspace();
  ws.keep('https://sanskritdocuments.org/doc_veda/purusha.html', 'Purusha Suktam', PURUSHA_PAGE.split('\n'));
  const ctx = { ws, host, review: async (task: string) => { tasks.push(task); return answers.shift() ?? 'VERDICT: clean'; } };
  const call = (name: string, args: Record<string, unknown> = {}) => toolsFor('deliver', host).find((t) => t.spec.name === name)!.run(args, ctx);
  return { ws, host, tasks, call };
}

describe('the review is binding', () => {
  it('no review, no file', async () => {
    const b = bench([]);
    await b.call('build_document', build);
    expect(await b.call('deliver')).toMatch(/^not delivered — a document built here is read by a second reader first: run review/);
    expect(b.host.delivered).toHaveLength(0);
  });

  it('a review that found something, and nothing changed since: no file — then changed, read again, and sent', async () => {
    const b = bench(['s-1-v2: the second verse is not the edition’s.\nVERDICT: 1 problem(s)', 'Compared with a second witness.\nVERDICT: clean']);
    await b.call('build_document', { ...build, sections: [{ verses: [{ witness: 'w1', at: '5-6' }, { witness: 'w1', at: '7-8' }] }] });
    await b.call('review', { focus: 'the Taittirīya puruṣa sūktam' });
    expect(await b.call('deliver')).toMatch(/^not delivered — the review found problems and nothing has changed since/);
    await b.call('remove_verse', { verse: 's-1-v2' });
    expect(await b.call('deliver')).toMatch(/^not delivered — the document changed after the last review: run review again/);
    await b.call('review', { focus: 'the first verse, the second taken out' });
    expect(await b.call('deliver')).toMatch(/^delivered puruṣa sūktam\.pdf/);
  });

  it('a title set after a clean review is no change to what it read', async () => {
    const b = bench(['VERDICT: clean']);
    await b.call('build_document', build);
    await b.call('review', { focus: 'puruṣa sūktam' });
    await b.call('set_field', { path: 'title', value: 'puruṣa sūktam' });
    expect(await b.call('deliver')).toMatch(/^delivered/);
  });

  it(`after ${REVIEWS} readings the file goes, and what is still open is said to the person`, async () => {
    const b = bench(Array.from({ length: REVIEWS }, (_, i) => `s-1-v1: the locus is wrong (${i}).\nVERDICT: 1 problem(s)`));
    await b.call('build_document', build);
    for (let i = 0; i < REVIEWS; i += 1) await b.call('review', { focus: `reading ${i + 1}` });
    const said = await b.call('deliver');
    expect(said).toMatch(/^delivered puruṣa sūktam\.pdf/);
    expect(said).toMatch(/the last review still raises what follows — tell the person/);
    expect(said).toContain(`the locus is wrong (${REVIEWS - 1})`);
  });

  it('his own text, opened from the library, goes as it is', async () => {
    const b = bench([]);
    await b.call('build_document', build);
    b.ws.open(b.ws.need(), 'author');
    expect(await b.call('deliver')).toMatch(/^delivered/);
    expect(b.tasks).toHaveLength(0);
  });

  it('the reviewer is handed the page as it will print, and what the check finds', async () => {
    const b = bench([]);
    await b.call('build_document', build);
    await b.call('review', { focus: 'the Taittirīya puruṣa sūktam, first two verses' });
    expect(b.tasks[0]).toMatch(/^What the person asked for, and what to look at hardest: the Taittirīya puruṣa sūktam/);
    expect(b.tasks[0]).toContain('The document as it will print:\n“puruṣa sūktam”');
    expect(b.tasks[0]).toMatch(/The check finds nothing\.|The check finds:/);
    expect(b.tasks[0]).toContain('Built from:\ns-1 ← w1 lines 5-8');
  });
});
