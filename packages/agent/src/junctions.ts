/**
 * HIS JUNCTIONS — how his page writes two words a source runs together.
 *
 * Where a word's last consonant takes the next word's first vowel, he joins
 * them and sets a hyphen after that vowel: `agnima̍-nnā̱dama̱-nnādyā̱`,
 * `pṛśni̍ra-kramī̱da-sa̍nan`, `puna̍rū̱-rjā`, `yonī̱rā-pṛ̍ṇasvā`. Every hyphen in
 * his corpus — 312 of 312 — has a vowel before it and a consonant after. And
 * he types the words as words: a last m before a consonant is the anusvāra
 * (`antari̍kṣaṁ mahi̱tvā`, which the rules draw as the m it becomes), and so is
 * a ṅ or ñ before its own class (`ā'yaṁ gauḥ`, `pi̱tara̍ṁ ca`); a sibilant a
 * visarga became before the same sibilant is the visarga (`mahi̱ṣaḥ suva̍ḥ`,
 * `śānti̱ḥ śānti̱ḥ`). A source writes all of these as said — vignanam's
 * `मा॒तर॒-म्पुनः॑`, `महि॒ष-स्सुवः॑` — so the model, giving his word breaks,
 * writes the words apart (`agnim annādam`) and the program writes the rest:
 * the model placed the hyphens by hand, and wrongly (2026-10-02).
 *
 * What is the model's, and stays so: WHERE the words part. His `pāna̱t
 * ya̍ntaś` and `devya-dite` are both a semivowel's junction, set two ways.
 */
const MARKS = /\p{M}+$/u;
const VOWEL_AT_START = /^(?:ai|au|[aāiīuūṛṝḷḹeo])\p{M}*/u;
/** A consonant a word can end in and join the next word's vowel with — not the anusvāra or the visarga. */
const JOINS = /[kgṅcjñṭḍṇtdnpbmyrlvśṣs]$/u;
const CONSONANT_AT_START = /^[kgṅcjñṭḍṇtdnpbmyrlvśṣsh]/u;
/** A name's number, raised, at the end of a word (`build.ts`, his Lalitā). */
const NAME_NUMBER_AT_END = /[⁰¹²³⁴⁵⁶⁷⁸⁹]+$/u;

const base = (w: string): string => w.replace(MARKS, '');

/** A word as he types it, before the word that follows it. */
function typed(numbered: string, next: string): string {
  const sup = NAME_NUMBER_AT_END.exec(numbered)?.[0] ?? '';
  if (sup !== '') return `${typed(numbered.slice(0, -sup.length), next)}${sup}`;
  const word = numbered;
  const b = base(word);
  const marks = word.slice(b.length);
  const n = next.normalize('NFC');
  if (/m$/u.test(b) && CONSONANT_AT_START.test(n)) return `${b.slice(0, -1)}ṁ${marks}`;
  if (/ṅ$/u.test(b) && /^[kg]/u.test(n)) return `${b.slice(0, -1)}ṁ${marks}`;
  if (/ñ$/u.test(b) && /^[cj]/u.test(n)) return `${b.slice(0, -1)}ṁ${marks}`;
  const s = /([śṣs])$/u.exec(b);
  if (s !== null && n.startsWith(s[1]!)) return `${b.slice(0, -1)}ḥ${marks}`;
  return word;
}

/**
 * A last n doubled for a vowel that is not there — before a daṇḍa, or at the
 * end of the line — is one n, as his page has it: the source's `स॒माभ॑रन्न्`
 * is his `sa̱mābha̍ran ॥ 6॥` (the bot's PDF had `samābharann`, 2026-10-02).
 */
function atAPause(word: string, next: string | undefined): string {
  if (next !== undefined && !/^[।॥|]/u.test(next)) return word;
  const b = base(word);
  const m = /([ṅṇn])\1$/u.exec(b);
  return m === null ? word : `${b.slice(0, -1)}${word.slice(b.length)}`;
}

/** A line with his junctions: his spelling of each word, and his hyphens where they join. */
export function hisJunctions(line: string): string {
  const words = line.normalize('NFC').split(/ +/u).filter((w) => w !== '');
  const spelt = words.map((w, i) => atAPause(i + 1 < words.length ? typed(w, words[i + 1]!) : w, words[i + 1]));
  const out: string[] = [];
  let cur = spelt[0] ?? '';
  for (let i = 1; i < spelt.length; i += 1) {
    const next = spelt[i]!;
    const vowel = VOWEL_AT_START.exec(next);
    /* A name's raised number stays with the letters it counts: his Lalitā's
       `mūlaprakṛtira³⁹⁷-vyaktā` — the number after the vowel the next name
       lent, before the hyphen. */
    const sup = NAME_NUMBER_AT_END.exec(cur)?.[0] ?? '';
    const bare = cur.slice(0, cur.length - sup.length);
    if (vowel !== null && JOINS.test(base(bare))) {
      const rest = next.slice(vowel[0].length);
      /* A word that is its vowel alone (`ā`) joins on to the word after it. */
      if (rest === '' && i + 1 < spelt.length) { cur = `${bare}${vowel[0]}${sup}-${spelt[i + 1]!}`; i += 1; }
      else cur = rest === '' ? `${bare}${vowel[0]}${sup}` : `${bare}${vowel[0]}${sup}-${rest}`;
      continue;
    }
    out.push(cur);
    cur = next;
  }
  if (cur !== '') out.push(cur);
  return out.join(' ');
}
