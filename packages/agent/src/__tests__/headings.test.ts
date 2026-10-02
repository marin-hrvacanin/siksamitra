/**
 * HIS HEADINGS AND HIS SOURCE LINES — the nīla sūktam the bot delivered
 * (2026-10-02), refused at each of its three faults, and his own shapes let
 * through: "that last Śāntipāṭha makes no sense (and there is also
 * śāntimantraḥ … I don't see why it's there at all)".
 */
import { describe, expect, it } from 'vitest';
import { documentOf, headingFault, type Outline } from '../build.js';

const verse = { lines: ['gṛ̱ṇā̱hi ghṛ̱tava̍tī savita̱rā-dhi̍patyaiḥ ।', 'bṛ̱haspati̍r māta̱riśvo̱-ta vā̱yuḥ ॥'] };
const santi = { lines: ['oṁ śānti̱ś śānti̱ś śānti̍ḥ ॥'], numbered: false };

const NILA_AS_DELIVERED: Outline = {
  title: 'nīla sūktam', locus: 'taittirīya saṁhitā 4.4.12',
  sections: [{ title: 'Nīla Sūktam', verses: [verse] }, { title: 'Śāntipāṭha', cite: 'śāntimantraḥ', verses: [santi] }],
};

describe('what the bot delivered for nīla sūktam', () => {
  it('is refused: a heading in capitals', () => {
    expect(headingFault(NILA_AS_DELIVERED)).toMatch(/lower case/);
  });

  it('is refused: a section heading that repeats the title — and is told where the śānti goes', () => {
    const lower = { ...NILA_AS_DELIVERED, sections: [{ title: 'nīla sūktam', verses: [verse] }, { title: 'śāntipāṭhaḥ', verses: [santi] }] };
    expect(headingFault(lower)).toMatch(/repeats the title.*last verse of the last section/);
  });

  it('is refused: a source line that names no place', () => {
    const cited = { ...NILA_AS_DELIVERED, sections: [{ verses: [verse] }, { cite: 'śāntimantraḥ', verses: [santi] }] };
    expect(headingFault(cited)).toMatch(/is no source line/);
    expect(() => documentOf(cited)).toThrow(/is no source line/);
  });
});

describe('his own shape', () => {
  it('the śānti as the last verse, unnumbered, under no heading of its own: built', () => {
    const his: Outline = { title: 'nīla sūktam', locus: 'taittirīya saṁhitā 4.4.12', sections: [{ verses: [verse, santi] }] };
    expect(headingFault(his)).toBeUndefined();
    const doc = documentOf(his);
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0]!.title ?? '').toBe('');
  });

  it('a section of verses from elsewhere, with only its cite: built', () => {
    const his: Outline = {
      title: 'bhū sūktam', locus: 'taittirīya saṁhitā 1.5.3',
      sections: [{ verses: [verse] }, { cite: 'taittirīya brāhmaṇam 3.1.2.6', verses: [verse] }],
    };
    expect(headingFault(his)).toBeUndefined();
  });

  it('an English heading is his to write as he likes', () => {
    expect(headingFault({ title: 'nīla sūktam', sections: [{ title: 'Introduction', verses: [verse] }] })).toBeUndefined();
  });
});

describe('a remark under his subtitle', () => {
  const v = (s: string) => ({ lines: [`${s} ghṛ̱tava̍tī savita̱rā-dhi̍patyaiḥ ।`, 'paya̍svatī̱ ranti̱rāśā̍ no astu ॥'] });
  it('leaves every verse in the one section — it once left the first empty ("5 verse(s) given, 0 made")', () => {
    const doc = documentOf({
      title: 'nīla sūktam', subtitle: 'kṛṣṇa yajurvedīya', remark: 'The mantras to viṣṇupatnī.',
      locus: 'taittirīya saṁhitā 4.4.12', sections: [{ verses: [v('a'), v('b')] }],
    });
    expect(doc.sections.map((s) => s.verses.length)).toEqual([2]);
    expect(doc.sections[0]!.source).toBe('taittirīya saṁhitā 4.4.12');
  });
  it('and over a headed first section it is the text’s, above the heading', () => {
    const doc = documentOf({
      title: 'nīla sūktam', subtitle: 'kṛṣṇa yajurvedīya', remark: 'The mantras to viṣṇupatnī.',
      sections: [{ title: 'dhyānam', verses: [v('a')] }, { title: 'mantrāḥ', verses: [v('b')] }],
    });
    expect(doc.sections.filter((s) => s.verses.length > 0).map((s) => s.title)).toEqual(['dhyānam', 'mantrāḥ']);
  });
});
