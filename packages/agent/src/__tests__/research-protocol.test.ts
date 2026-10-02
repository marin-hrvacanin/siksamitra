/**
 * RESEARCH AS A SCHOLAR DOES — what each page is, the whole edition read for
 * one passage, and his guides at hand.
 *
 * The manyu sūktam he was sent (2026-10-02) was compared against two pages of
 * machine-written commentary, as if they were sources, and a whole saṁhitā had
 * been refused as "too large to be a witness". Its lines here are those pages'.
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { Workspace, toolsFor, type Host } from '../index.js';
import { kindOfPage, passageOf } from '../pages.js';

const COMMENTARY = [
  'Rig Veda 10.83.1',
  'Certainly. Let’s explore Rig Veda Book 10, Hymn 83, Verse 1, honoring its sacredness and distilling its wisdom for today.',
  'Key Deities, Concepts, and Symbolism:',
  'In essence: the hymn calls upon the force of Manyu.',
];

describe('what kind of page a witness is', () => {
  it('machine-written commentary is said to be no source at all, wherever it is', () => {
    expect(kindOfPage('https://example.org/rigveda-10-83', COMMENTARY)).toBe('commentary');
  });
  it('a scholarly edition, a collection of transcriptions, a devotional compilation', () => {
    const text = ['यस्ते᳚ म॒न्योऽवि॑धद्वज्र सायक॒ सह॒ ओजः॑ ।'];
    expect(kindOfPage('https://titus.uni-frankfurt.de/texte/etcs/ind/aind/ved/rv/mt/rv.htm', text)).toBe('edition');
    expect(kindOfPage('https://gretil.sub.uni-goettingen.de/gretil/1_sanskr/1_veda/1_sam/1_rv/rvh1-10u.htm', text)).toBe('edition');
    expect(kindOfPage('https://sanskritdocuments.org/doc_veda/manyusUktam.html', text)).toBe('collection');
    expect(kindOfPage('https://vignanam.org/devanagari/manyu-suktam.html', text)).toBe('compilation');
  });
});

describe('a whole edition, read for one passage', () => {
  const EDITION = [
    ...Array.from({ length: 5000 }, (_, i) => `line ${i + 1} of another hymn`),
    'यस्ते᳚ म॒न्योऽवि॑धद्वज्र सायक॒ सह॒ ओजः॑ पुष्यति॒ विश्व॑मानु॒षक् ।',
    ...Array.from({ length: 5000 }, (_, i) => `line ${i + 5002} after it`),
  ];
  it('keeps the lines around the passage, found by its first words in any script', () => {
    for (const find of ['yas te manyo', 'यस्ते मन्यो']) {
      const p = passageOf(EDITION, find)!;
      expect(p.total).toBe(10001);
      expect(p.from).toBe(4981);
      expect(p.lines).toContain(EDITION[5000]);
      expect(p.lines.length).toBeLessThan(400);
    }
  });
  it('and finds nothing that is not there', () => {
    expect(passageOf(EDITION, 'bhūmir bhūmnā')).toBeNull();
  });
  it('fetch_page asks the host for the whole edition, keeps only the passage, and says what the page is', async () => {
    const asked: unknown[] = [];
    const host: Host = {
      research: { search: async () => [], fetch: async (url, opts) => { asked.push(opts); return { title: 'Rgveda', text: EDITION.join('\n') }; } },
    };
    const ws = new Workspace();
    const fetch = toolsFor('deliver', host).find((t) => t.spec.name === 'fetch_page')!;
    const said = await fetch.run({ url: 'https://titus.uni-frankfurt.de/texte/etcs/ind/aind/ved/rv/mt/rv.htm', find: 'yas te manyo' }, { ws, host, review: async () => '' });
    expect(asked).toEqual([{ large: true }]);
    expect(said).toMatch(/the passage around "yas te manyo", lines 4981-\d+ of its 10001/);
    expect(said).toMatch(/a scholarly edition: a base text, and its numbering is the locus to cite/);
    expect(ws.witnesses.get('w1')!.lines.length).toBeLessThan(400);
  });
});

describe('his authoring guides', () => {
  const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
  const host: Host = { guides: async (file) => readFileSync(join(ROOT, 'docs', 'authoring', file), 'utf8') };
  const read = (args: Record<string, unknown>) => toolsFor('deliver', host).find((t) => t.spec.name === 'read_guide')!
    .run(args, { ws: new Workspace(), host, review: async () => '' });

  it('are offered to a host that has them, and to no other', () => {
    expect(toolsFor('deliver', host).some((t) => t.spec.name === 'read_guide')).toBe(true);
    expect(toolsFor('deliver', {}).some((t) => t.spec.name === 'read_guide')).toBe(false);
  });
  it('a section by its number — the protected readings, the rules read first', async () => {
    expect(await read({ guide: 'chants', section: '5G' })).toMatch(/Protected readings[\s\S]*do not "correct" these/);
    expect(await read({ guide: 'chants', section: '0' })).toMatch(/Translations come from the owner's source document/);
  });
  it('its headings, and the passages that say a word', async () => {
    expect(await read({ guide: 'chants' })).toMatch(/One recension, faithfully/);
    expect(await read({ guide: 'chants', find: 'VERBATIM' })).toMatch(/AUTHORING-CHANTS\.md \d+:/);
  });
});
