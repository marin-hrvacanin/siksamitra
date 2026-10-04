/**
 * THE YATI'S PAUSE, WHERE HIS PAGES DRAW IT.
 *
 * Each case is a line of his with its bars; the expectation is READ from his
 * bars (after which word each stands), and the rules are given the same line
 * with the bars taken out. His sragdharā lines (Lalitā v9.3.1, Rudram v1.622)
 * and his śārdūlavikrīḍita (Lalitā v9.3.1's first dhyāna), two pādas a line.
 */
import { describe, expect, it } from 'vitest';
import { lex, resolveProfile, type MeterKey } from '../index.js';

/** The words a bar follows, in a line of his: `a b | c` → ['b']. */
const barsAfter = (line: string): string[] => {
  const words = line.split(/\s+/u).filter((w) => w !== '');
  return words.flatMap((w, i) => (words[i + 1] === '|' ? [w] : []));
};
const plain = (line: string): string => line.replace(/\s\|\s/gu, ' ').replace(/\s+/gu, ' ').trim();

/** The words the rules put a pause after. */
function pausedAfter(line: string, meter: MeterKey): string[] {
  const profile = resolveProfile([{ preset: 'smarta' }, { patch: { svara: { meter } } }]);
  const { elems } = lex([line], profile);
  const out: string[] = [];
  elems.forEach((e, i) => {
    if (e.kind !== 'vpause') return;
    const before = elems.slice(0, i).filter((x) => x.kind === 'letter');
    const w = before.at(-1)!.word;
    out.push(before.filter((x) => x.word === w).map((x) => x.ch).join(''));
  });
  return out;
}

const HIS: [string, MeterKey, string][] = [
  ['lalitā, sragdharā', 'sragdhara', 'dhyāyet padmāsana sthāṁ | vikasita vadanāṁ | padma patrāyatākṣīṁ | hemābhāṁ pīta vastrāṁ | kara kalita lasad | dhema padmāṁ varāṅgīm'],
  ['lalitā, sragdharā', 'sragdhara', 'sarvālaṅkāra yuktāṁ | satatamabhaya dāṁ | bhakta namrām bhavānīṁ | śrī vidyāṁ śānta mūrtiṁ | sakala sura nutāṁ | sarva sampat pradātrīm'],
  ['rudram, sragdharā', 'sragdhara', 'tryakṣā rudrākṣa mālāḥ | prakaṭita vibhavāś | śāmbhavā mūrti bhedāḥ | rudrāś śrī rudra sūkta | prakaṭita vibhavā | naḥ prayacchantu saukhyam'],
  ['lalitā, śārdūlavikrīḍita', 'sardulavikridita', 'sindūrāruṇa vigrahān trinayanām | māṇikya mauli sphurat | tārā nāyaka śekharāṁ smita mukhīm | āpīna vakṣoruhām'],
];

describe('a yati', () => {
  for (const [file, meter, line] of HIS) {
    it(`is paused where his ${file} pauses it`, () => {
      expect(pausedAfter(plain(line), meter)).toEqual(barsAfter(line));
    });
  }
  it('falls only where a word ends — none is drawn inside a word', () => {
    expect(pausedAfter('dhyāyetpadmāsanasthāṁvikasitavadanāṁpadmapatrāyatākṣīṁ', 'sragdhara')).toEqual([]);
  });
  it('is drawn for no metre his files do not show, and not when switched off', () => {
    expect(pausedAfter(plain(HIS[0]![2]), 'anustubh')).toEqual([]);
    const off = resolveProfile([{ preset: 'smarta' }, { patch: { svara: { meter: 'sragdhara' }, pauses: { yati: false } } }]);
    expect(lex([plain(HIS[0]![2])], off).elems.some((e) => e.kind === 'vpause')).toBe(false);
  });
});

describe('a yati at a line the page divided', () => {
  it('keeps its bar, at the end of the line', () => {
    const profile = resolveProfile([{ preset: 'smarta' }, { patch: { svara: { meter: 'sragdhara' } } }]);
    const { elems } = lex(['mālā kḷptāsana sthaḥ sphaṭika maṇi nibhair', 'mauktikair maṇḍitāṅgaḥ'], profile);
    const bars = elems.flatMap((e, i) => (e.kind === 'vpause' ? [elems[i + 1]?.kind ?? 'end'] : []));
    /* after sthaḥ (7), before sphaṭika; after nibhair (14), at the line's end. */
    expect(bars).toEqual(['letter', 'br']);
  });
  it('but a pāda that simply ends its line takes none there', () => {
    const profile = resolveProfile([{ preset: 'smarta' }, { patch: { svara: { meter: 'sragdhara' } } }]);
    const { elems } = lex(['mālā kḷptāsana sthaḥ sphaṭika maṇi nibhair mauktikair maṇḍitāṅgaḥ', 'śubhrair abhrair adabhrair'], profile);
    /* After sthaḥ and nibhair; none at maṇḍitāṅgaḥ, the pāda's end at its line's end; śubhrair abhrair adabhrair ends the verse. */
    expect(elems.filter((e) => e.kind === 'vpause')).toHaveLength(2);
  });
});
