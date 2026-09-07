/**
 * THE READER OBLIGATIONS — what every implementation of this format must agree
 * on, and what nothing checked.
 *
 * `docs/INTERCHANGE.md` names four of them: what the recited text of a verse
 * is, where its holdings are, which source a verse derives from, and whether
 * it is attested. Every other program that reads a `.smdoc` — the exporter,
 * the website, a future reader — has to answer those the same way, or two
 * programs disagree about what the document says while both claiming to be
 * conformant.
 *
 * This package had NO tests. The functions were exercised only through the
 * engine and the corpus gates, which means a change of behaviour here would
 * have shown up as a mysterious percentage moving in a gate, three packages
 * away from its cause.
 */
import { describe, expect, it } from 'vitest';
import type { ChantDoc, ChantSection, ChantToken, ChantVerse } from '../index.js';
import {
  holdingSpans, isAttested, normalizeChantDoc, recitationText, resolveSource,
  syllableCount, withVerses,
} from '../index.js';

/**
 * A syllable, with its letters as UNITS — which is where a mark lives.
 *
 * `hold` is per LETTER, not per syllable: that is the whole v2 correction, and
 * a test that put it on the syllable would be testing a format we do not have.
 */
const syl = (
  iast: string,
  units?: { c: string; hold?: 'short' | 'long'; hg?: number }[],
): ChantToken => ({
  t: 'syl',
  iast,
  deva: iast,
  tel: iast,
  tam: iast,
  units: units ?? [...iast].map((c) => ({ c })),
} as ChantToken);

const verse = (id: string, tokens: ChantToken[], over: Partial<ChantVerse> = {}): ChantVerse => ({
  id, tokens, ...over,
});

const doc = (sections: ChantSection[], over: Partial<ChantDoc> = {}): ChantDoc => ({
  title: 'test', titleForms: { iast: 'test' }, sections, ...over,
});

describe('the recited text of a verse', () => {
  it('is its syllables, its spaces and its daṇḍas, in order', () => {
    const tokens = [
      syl('ag'), syl('nim'), { t: 'sp' } as ChantToken, syl('ī'), syl('ḷe'),
      { t: 'sp' } as ChantToken, { t: 'danda', s: '॥' } as ChantToken,
    ];
    expect(recitationText(tokens, 'iast')).toBe('agnim īḷe ॥');
  });

  it('is per script, from the SAME tokens', () => {
    const tokens = [
      { ...syl('ag'), deva: 'अ' } as ChantToken,
      { ...syl('nim'), deva: 'ग्निम्' } as ChantToken,
    ];
    expect(recitationText(tokens, 'iast')).toBe('agnim');
    expect(recitationText(tokens, 'deva')).toBe('अग्निम्');
  });

  it('breaks at a line break, because a line is a breath', () => {
    const tokens = [syl('a'), { t: 'br' } as ChantToken, syl('b')];
    expect(recitationText(tokens, 'iast')).toContain('\n');
  });

  it('leaves a placeholder out — it is not recited', () => {
    /*
     * A placeholder stands where the reciter supplies their own words (their
     * name, their gotra). Reading it aloud as "«name»" would be wrong, so it
     * contributes nothing to the recited text.
     */
    const tokens = [
      syl('oṁ'), { t: 'sp' } as ChantToken,
      { t: 'text', s: '«name»', placeholder: true } as ChantToken,
    ];
    expect(recitationText(tokens, 'iast').trim()).toBe('oṁ');
  });
});

describe('where the holdings are', () => {
  it('is one span per box, over the letters it covers', () => {
    const tokens = [
      syl('ab', [{ c: 'a', hold: 'short' }, { c: 'b' }]),
      syl('cd', [{ c: 'c' }, { c: 'd', hold: 'long' }]),
    ];
    const spans = holdingSpans(tokens);
    expect(spans.map((x) => x.len)).toEqual(['short', 'long']);
    expect(spans.map((x) => x.letters)).toEqual(['a', 'd']);
  });

  it('joins adjacent letters of one GROUP into a single box', () => {
    /*
     * `hg` is the group id: two letters in one box are one holding, not two.
     * A reader that reported two would draw two boxes where his document has
     * one — the difference between a conjunct marked as one unit and as
     * several, and it is visible on the page.
     */
    const tokens = [syl('abc', [
      { c: 'a', hold: 'short', hg: 1 },
      { c: 'b', hold: 'short', hg: 1 },
      { c: 'c' },
    ])];
    const spans = holdingSpans(tokens);
    expect(spans).toHaveLength(1);
    expect(spans[0]!.letters).toBe('ab');
    /* The span is INCLUSIVE and zero-based: letters 0 and 1 of the verse. */
    expect(spans[0]!.from).toBe(0);
    expect(spans[0]!.to).toBe(1);
    expect(spans[0]!.group).toBe(1);
  });

  it('does NOT join two boxes that merely sit next to each other', () => {
    // Same `hold`, different group: two decisions, two boxes.
    const spans = holdingSpans([syl('ab', [
      { c: 'a', hold: 'short', hg: 1 }, { c: 'b', hold: 'short', hg: 2 },
    ])]);
    expect(spans).toHaveLength(2);
  });

  it('numbers letters across the whole verse, so a span is stable', () => {
    const spans = holdingSpans([
      syl('ab'), syl('cd', [{ c: 'c' }, { c: 'd', hold: 'short' }]),
    ]);
    expect(spans[0]!.from).toBe(3);
  });

  it('is empty for an unmarked verse, not undefined', () => {
    expect(holdingSpans([syl('a')])).toEqual([]);
  });
});

describe('where a verse s words come from', () => {
  const tokens = [syl('a')];

  it('is the verse s own locus when it states one', () => {
    const section: ChantSection = {
      id: 's1',
      source: 'Taittirīya Āraṇyaka 10.1',
      verses: [verse('v1', tokens, { source: 'Ṛgveda 10.90' })],
    };
    expect(resolveSource(
      doc([section], { source: 'the book' }), section, section.verses[0]!,
    )).toEqual({ source: 'Ṛgveda 10.90', from: 'verse' });
  });

  it('falls back to the section s, then the document s, then to none', () => {
    const withSection: ChantSection = {
      id: 's1', source: 'Taittirīya Āraṇyaka 10.2', verses: [verse('v1', tokens)],
    };
    expect(resolveSource(doc([withSection]), withSection, withSection.verses[0]!))
      .toEqual({ source: 'Taittirīya Āraṇyaka 10.2', from: 'section' });

    const bare: ChantSection = { id: 's2', verses: [verse('v2', tokens)] };
    expect(resolveSource(doc([bare], { source: 'the book' }), bare, bare.verses[0]!))
      .toEqual({ source: 'the book', from: 'document' });

    expect(resolveSource(doc([bare]), bare, bare.verses[0]!))
      .toEqual({ source: null, from: 'none' });
  });

  it('treats an empty string as saying nothing', () => {
    const section: ChantSection = { id: 's1', source: '', verses: [verse('v1', tokens)] };
    expect(resolveSource(doc([section]), section, section.verses[0]!).from).toBe('none');
  });
});

describe('whether a verse is attested', () => {
  it('is true exactly when it has no source layer', () => {
    /*
     * RULE ZERO. A verse with no `src` carries marks that were read off a
     * hand-marked page and exist nowhere else: they are evidence, not output,
     * and re-deriving them would destroy them. Every reader must agree on this
     * test, because it decides what may be edited.
     */
    expect(isAttested(verse('v1', [syl('a')]))).toBe(true);
    expect(isAttested(verse('v1', [syl('a')], { src: { lines: ['a'] } }))).toBe(false);
  });
});

describe('normalising a document', () => {
  it('fills a section s verses from its items, in their order', () => {
    const d = normalizeChantDoc(doc([{
      id: 's1',
      verses: [],
      items: [
        { t: 'verse', ...verse('v1', [syl('a')]) },
        { t: 'instruction', instruction: { text: { en: 'sip water' } } },
        { t: 'verse', ...verse('v2', [syl('b')]) },
      ],
    }]));
    expect(d.sections[0]!.verses.map((v) => v.id)).toEqual(['v1', 'v2']);
  });

  it('fills a section s title from its v2 label', () => {
    const d = normalizeChantDoc(doc([{ id: 's1', label: 'Śāntipāṭha', verses: [] }]));
    expect(d.sections[0]!.title).toBe('Śāntipāṭha');
  });

  it('is idempotent — normalising twice changes nothing', () => {
    const once = normalizeChantDoc(doc([{
      id: 's1', label: 'A', verses: [], items: [{ t: 'verse', ...verse('v1', [syl('a')]) }],
    }]));
    expect(normalizeChantDoc(once)).toEqual(once);
  });
});

describe('writing verses back into a section', () => {
  it('replaces BOTH the verses and the items they came from', () => {
    /*
     * The defect this exists to prevent: a composed section keeps its verses
     * in `items` as well, and `normalizeChantDoc` rebuilds `verses` from
     * those — so writing only `verses` discarded the author's edit on the next
     * load. It happened.
     */
    const section: ChantSection = {
      id: 's1',
      verses: [verse('v1', [syl('a')])],
      items: [{ t: 'verse', ...verse('v1', [syl('a')]) }],
    };
    const edited = withVerses(section, [verse('v1', [syl('CHANGED')])]);
    expect(recitationText(edited.verses[0]!.tokens, 'iast')).toBe('CHANGED');
    const item = edited.items!.find((i) => i.t === 'verse') as unknown as ChantVerse;
    expect(recitationText(item.tokens, 'iast')).toBe('CHANGED');
    // And it survives a normalise, which is what actually broke.
    const after = normalizeChantDoc(doc([edited]));
    expect(recitationText(after.sections[0]!.verses[0]!.tokens, 'iast')).toBe('CHANGED');
  });

  it('keeps a non-verse item where it was', () => {
    const section: ChantSection = {
      id: 's1',
      verses: [verse('v1', [syl('a')])],
      items: [
        { t: 'instruction', instruction: { text: { en: 'first' } } },
        { t: 'verse', ...verse('v1', [syl('a')]) },
      ],
    };
    const edited = withVerses(section, [verse('v1', [syl('b')])]);
    expect(edited.items![0]!.t).toBe('instruction');
  });
});

describe('counting syllables', () => {
  it('counts syllables and nothing else', () => {
    expect(syllableCount([
      syl('a'), { t: 'sp' } as ChantToken, syl('b'),
      { t: 'danda', s: '॥' } as ChantToken, { t: 'br' } as ChantToken,
    ])).toBe(2);
  });

  it('is zero for an empty verse', () => {
    expect(syllableCount([])).toBe(0);
  });
});
