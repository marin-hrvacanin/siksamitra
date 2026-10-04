/**
 * A VERSE'S METRE, AS HIS NOTE NAMES IT — every spelling below is one his own
 * files use (his Lalitā, Rudram, sādhanā, Kanakadhārā, Devī Māhātmyam).
 */
import { describe, expect, it } from 'vitest';
import { fitMantraLine, meterOfNote, yatiCuts } from '../meters.js';
import { documentOf } from '../build.js';

describe('the metre his note names', () => {
  it('is the plan of that metre', () => {
    expect(meterOfNote('(sragdharā chandaḥ, 21 syllables per pāda, yatiḥ at 7th, 14th, and 21th)')).toBe('sragdhara');
    expect(meterOfNote('(śārdūlavikrīḍitaṁ chandaḥ, 19 syllables per pāda, yatiḥ after the 12th, and 19th)')).toBe('sardulavikridita');
    expect(meterOfNote('(anuṣṭup chandaḥ, 8 syllables per pāda, no yatis/pauses, 5th usually laghu, 6th usually guru)')).toBe('anustubh');
    expect(meterOfNote('(puṣpitāgrā chandaḥ, ardhasamavṛtta: 12 syllables in odd padas)')).toBe('pushpitagra');
  });
  it('is no plan at all for a metre none of his files marks — never another metre’s', () => {
    expect(meterOfNote('(mandākrāntā chandaḥ, 17 syllables per pāda)')).toBeNull();
    expect(meterOfNote('(vasantatilakā chandaḥ, 14 syllables per pāda, yatiḥ after 14th, and also 8th but not for chanting)')).toBeNull();
    expect(meterOfNote('(aupacchandasikam/upodgatā/mālabhāriṇī/vasantamālikā chandaḥ)')).toBeNull();
  });
  it('and nothing when the note names none, or names a Vedic metre outside brackets', () => {
    expect(meterOfNote('Also in maitrāyaṇī saṁhitā 1.7.1.1')).toBeUndefined();
    expect(meterOfNote('ṚV 3.62.10. - gāthino viśvāmitraḥ ṛṣiḥ, savitā devatā, gāyatrī chandaḥ')).toBeUndefined();
    expect(meterOfNote(undefined)).toBeUndefined();
  });
});

describe('a built stotra', () => {
  it('plans each verse by the metre its note names, over the document’s', () => {
    const doc = documentOf({
      title: 'x', source: 'smarta', sections: [{ title: 'dhyānāni', verses: [
        { lines: ['śrī rāma rāma rāmeti rame rāme manorame ।', 'sahasra nāma tat tulyaṁ rāma nāma varānane ॥'], note: '(anuṣṭup chandaḥ, 8 syllables per pāda)' },
        { lines: ['kṣīrodanvat pradeśe śuci maṇi vilasat saikate mauktikānāṁ'], note: '(sragdharā chandaḥ, 21 syllables per pāda, yatiḥ at 7th, 14th, and 21th)' },
        { lines: ['megha śyāmaṁ pīta kauśeya vāsaṁ'], note: '(śālinī chandaḥ, 11 syllables per pāda)' },
        { lines: ['oṁ namo bhagavate vāsudevāya ॥'] },
      ] }],
    } as never);
    const meters = doc.sections[0]!.verses.map((v) => (v.profile?.patch as { svara?: { meter?: unknown } } | undefined)?.svara?.meter);
    expect(meters).toEqual(['anustubh', 'sragdhara', null, undefined]);
  });
});

describe('a long pāda of a classical metre', () => {
  const SRAG = '(sragdharā chandaḥ, 21 syllables per pāda, yatiḥ at 7th, 14th, and 21th)';
  it('may be divided at its yatis — after the 7th and the 14th syllable', () => {
    /* mālā kḷptā-sana sthaḥ (7) | sphaṭika maṇi nibhair (14) | mauktikair maṇḍitā-ṅgaḥ (21) */
    expect(yatiCuts('mālā kḷptā-sana sthaḥ sphaṭika maṇi nibhair mauktikair maṇḍitā-ṅgaḥ ।', SRAG)).toEqual([3, 6, 8]);
  });
  it('counts on across two pādas on one line, and not the oṁ before them', () => {
    expect(yatiCuts('oṁ dhyāyet padmāsana sthāṁ vikasita vadanāṁ padma patrāyatākṣīṁ hemābhāṁ', SRAG)).toEqual([4, 6, 8]);
  });
  it('and nowhere for a śloka, or a note that names no metre', () => {
    expect(yatiCuts('yasya smaraṇa mātreṇa janma saṁsāra bandhanāt ।', '(anuṣṭup chandaḥ, 8 syllables per pāda)')).toEqual([]);
    expect(yatiCuts('mālā kḷptā-sana sthaḥ', undefined)).toEqual([]);
  });
});

describe('a mantra line too wide for the column', () => {
  const letters = { widthOf: (t: string): number => [...t.normalize('NFC')].length, limit: 40 };
  it('of names, is divided only after a name — never between the members of one', () => {
    const parts = fitMantraLine('ūrdhva gaḥ⁹⁵⁴ sat pathā-cāraḥ⁹⁵⁵ prāṇa daḥ⁹⁵⁶ praṇavaḥ⁹⁵⁷ paṇaḥ⁹⁵⁸ ॥', undefined, letters);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts.slice(0, -1)) expect(p).toMatch(/[⁰¹²³⁴⁵⁶⁷⁸⁹]$/u);
  });
  it('is measured with the aids and the bars the rules will draw, which the letters do not say', () => {
    /* 36 letters in a column of 37: fits as letters, and not with two jᵍña aids and the hiatus bar of `akṣara | eva`. */
    const line = 'yajña bhṛd yajña kṛd akṣara eva ca ॥';
    const narrow = { ...letters, limit: 37 };
    expect(narrow.widthOf(line)).toBeLessThanOrEqual(narrow.limit);
    expect(fitMantraLine(line, undefined, narrow).length).toBeGreaterThan(1);
  });
  it('of a classical metre, at its yatis, and with no bar left in the letters', () => {
    const parts = fitMantraLine('mālā kḷptā-sana sthaḥ sphaṭika maṇi nibhair mauktikair maṇḍitā-ṅgaḥ ।', '(sragdharā chandaḥ, 21 syllables per pāda)', letters);
    expect(parts.join(' ')).toBe('mālā kḷptā-sana sthaḥ sphaṭika maṇi nibhair mauktikair maṇḍitā-ṅgaḥ ।');
    expect(parts.map((p) => p.split(' ').at(-1))).toEqual(expect.arrayContaining(['sthaḥ']));
  });
});
