/**
 * THE SRAGDHARĀ'S SVARAS, AS HIS PAGES PLACE THEM.
 *
 * The plan was read off two of his files that agree pāda for pāda — the
 * Lalitā sahasranāma v9.3.1's dhyāna and the Rudram v1.622's. Each case below
 * is a pāda of his as he marked it; the expectation is READ out of his marks
 * (which syllable carries which), and the line the rules mark is the same pāda
 * with his marks taken off. Nothing here is written down twice.
 */
import { describe, expect, it } from 'vitest';
import { STAGES, rerun, resolveProfile } from '../index.js';

const UDATTA_FREE = /[̱̍̎]/gu;
const VOWEL = /(?:ai|au|[aāiīuūṛṝḷḹeo])/gu;
/** Which vowel (counting from 1) carries which svara, in a line of his. */
function placed(line: string): string[] {
  const out: string[] = [];
  let n = 0;
  /* Composed, so a long vowel is one letter and its svara the marks after it. */
  for (const m of line.normalize('NFC').matchAll(/(?:ai|au|[aāiīuūṛṝḷḹeo])(\p{M}*)/gu)) {
    n += 1;
    if (m[1]!.includes('̱')) out.push(`${n}̱`);
    if (m[1]!.includes('̍')) out.push(`${n}̍`);
  }
  return out;
}

const profile = resolveProfile([{ preset: 'smarta' }, { patch: { svara: { meter: 'sragdhara' } } }]);
const marked = (plain: string): string[] => {
  const out = rerun({ text: plain, marks: [] }, { stages: STAGES, mode: 'keep-hand', profile, from: 0, to: plain.length });
  const at: string[] = [];
  const vowels = [...out.text.normalize('NFC').matchAll(VOWEL)];
  for (const m of out.marks) {
    if (m.k !== 'svara') continue;
    const k = vowels.findIndex((v) => v.index! >= m.from) + 1;
    at.push(`${k}${m.v === 'anudatta' ? '̱' : '̍'}`);
  }
  return at;
};

/* His four pādas, a line each, as each file has them (his pause bars taken out). */
const HIS: Record<string, string[]> = {
  'lalitā v9.3.1': [
    'dhyā̱ye̱t padmā-sana sthāṁ vikasita vadanāṁ pa̱dma pa̱trā-ya̍tā-kṣī̱ṁ',
    'he̱mā-bhām pīta vastrāṁ kara kalita lasad dhe̱ma pa̱dmāṁ varā̍-ṅgīm',
    'sa̱rvā̱-laṅkāra yuktāṁ satatama-bhaya dāṁ bha̱kta na̱mrām bha̍vānī̱ṁ',
    'śrī̱ vidyāṁ śānta mūrtiṁ sakala sura nutāṁ sa̱rva sa̱mpat pradā̍trīm',
  ],
  'rudram v1.622': [
    'bra̱hmā̱ṇḍa vyāpta dehā bhasita himarucā bhā̱samā̱nā bhu̍jaṅgai̱ḥ',
    'ka̱ṇṭhe kālāḥ kapardāḥ kalita śaśikalāś ca̱ṇḍa ko̱daṇḍa ha̍stāḥ',
    'trya̱kṣā̱ rudrākṣa mālāḥ prakaṭita vibhavāś śā̱mbhavā̱ mūrti̍ bhedā̱ḥ',
    'ru̱drāś śrī rudra sūkta prakaṭita vibhavā na̱ḥ praya̱cchantu sau̍khyam',
  ],
};

describe('a sragdharā verse, a pāda a line', () => {
  for (const [file, padas] of Object.entries(HIS)) {
    it(`is marked as his ${file} marks it, pāda for pāda`, () => {
      const plain = padas.map((p) => p.normalize('NFD').replace(UDATTA_FREE, '').normalize('NFC'));
      const got = marked(plain.join('\n'));
      const want = padas.flatMap((p, i) => placed(p).map((x) => `${i}:${x}`));
      /* The rules count across the verse; his are counted a pāda at a time. */
      const offsets = plain.map((p) => [...p.matchAll(VOWEL)].length);
      const local = got.map((x) => {
        let k = Number.parseInt(x, 10); const mark = x.replace(/^\d+/u, '');
        let i = 0;
        while (k > offsets[i]!) { k -= offsets[i]!; i += 1; }
        return `${i}:${k}${mark}`;
      });
      expect(local).toEqual(want);
    });
  }
});
