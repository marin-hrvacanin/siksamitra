/**
 * A VERSE'S METRE, AS HIS NOTE NAMES IT.
 *
 * His dhyānas say their metre in the note above them — "(sragdharā chandaḥ,
 * 21 syllables per pāda, yatiḥ at 7th, 14th, and 21th)" — and a smārta text's
 * svaras are planned by metre. Read a document at a time, every verse was
 * planned as an anuṣṭubh, so a stotra's sragdharā and mandākrāntā dhyānas went
 * unmarked, or worse, a line of the right length scanned as the wrong metre
 * (his Viṣṇu sahasranāma, 2026-10-04). The note is his own statement of what
 * the verse is, so it decides.
 *
 * A metre he names that has no plan yet — none of his files marks one — gives
 * `null`: no plan, rather than another metre's. One the note does not name
 * gives `undefined`: the document's own metre stands.
 */
import { withVerses, type ChantDoc, type ChantMeterKey } from '@siksamitra/format';
import { YATI } from '@siksamitra/engine';
import { fitLineAt, piecesOf, type LineFit } from '@siksamitra/layout';
import { syllablesOf } from './lines.js';
import { versesOfFlow, type Outline } from './build.js';

/** His spellings of a metre's name, as his notes write them, and its plan. */
const METRES: readonly (readonly [RegExp, ChantMeterKey | null])[] = [
  [/^anuṣṭu[pb]h?$/u, 'anustubh'],
  [/^śārdūlavikrīḍita[ṁm]?$/u, 'sardulavikridita'],
  [/^sragdharā$/u, 'sragdhara'],
  [/^triṣṭu[pb]h?$/u, 'tristubh'],
  [/^puṣpitāgrā$/u, 'pushpitagra'],
  [/^(?:upajāti|indravajrā|upendravajrā)$/u, 'upajati'],
  [/^śālinī$/u, 'salini'],
  [/^vasantatilakā$/u, 'vasantatilaka'],
  [/^(?:vaṁśastha|indravaṁśā)$/u, 'vamsastha'],
  [/^rucirā$/u, 'rucira'],
  [/^pṛthvī$/u, 'prthvi'],
  [/^mandākrāntā$/u, 'mandakranta'],
  /* Named in his files, and no plan read off them yet. */
  [/^(?:mālinī|śikhariṇī|rathoddhatā|dodhaka[ṁm]?|aupacchandasika[ṁm]?)$/u, null],
];

/** A pāda's syllables, by the metre's plan: what a line must reach to be one. */
const PADA: Partial<Record<ChantMeterKey, number>> = {
  anustubh: 8, sardulavikridita: 19, sragdhara: 21, tristubh: 11, pushpitagra: 12,
  upajati: 11, salini: 11, vasantatilaka: 14, vamsastha: 12, rucira: 13, prthvi: 17, mandakranta: 17,
};

/** The metre a note declares — `null` for one with no plan, `undefined` for none named. */
export function meterOfNote(note: string | undefined): ChantMeterKey | null | undefined {
  const named = /\(\s*([^\s,()]+)\s+chandaḥ/u.exec(note ?? '');
  if (named === null) return undefined;
  const name = named[1]!.normalize('NFC').split('/')[0]!;
  for (const [re, key] of METRES) if (re.test(name)) return key;
  return undefined;
}

/**
 * Each verse whose note names its metre, planned by that metre (`meters.ts`):
 * its own profile, over the document's. Matched verse for verse, section for
 * section — a section whose verses do not line up is left as it is.
 */
export function withNotedMetres(doc: ChantDoc, o: Outline): ChantDoc {
  let touched = false;
  const sections = doc.sections.map((s, i) => {
    const given = o.sections[i];
    if (given === undefined) return s;
    const outline = [...versesOfFlow(given.flow ?? []), ...given.verses];
    if (outline.length !== s.verses.length) return s;
    /* HIS NOTE STANDS ONCE, AT THE HEAD OF ITS VERSES: the verses after it,
       until the next, are in its metre — a line too short to be a pāda of it
       (`oṁ namo bhagavate vāsudevāya`) is no verse of that metre. */
    let current: ChantMeterKey | null | undefined;
    const verses = s.verses.map((v, k) => {
      const noted = meterOfNote(outline[k]!.note);
      if (noted !== undefined) current = noted;
      const pada = current == null ? 0 : (PADA[current] ?? 0);
      const long = outline[k]!.lines.some((l) => syllablesOf(l.replace(/^\s*oṁ\s+/u, '')) >= pada);
      const meter = noted !== undefined ? noted : long ? current : undefined;
      if (meter === undefined) return v;
      touched = true;
      return { ...v, profile: { ...(v.profile ?? {}), patch: { ...(v.profile?.patch ?? {}), svara: { meter } } } };
    });
    return withVerses(s, verses);
  });
  return touched ? { ...doc, sections } : doc;
}

/**
 * Where a line of a classical metre may be divided: after the words that end
 * on a yati — or a pāda's end — of the metre its note names (`YATI`), counted
 * in `piecesOf`'s words, as `fitLineAt` takes them. None for a metre with no
 * yatis, or a note that names none.
 */
export function yatiCuts(line: string, note: string | undefined): number[] {
  const meter = meterOfNote(note);
  const plan = meter == null ? undefined : YATI[meter];
  if (plan === undefined) return [];
  const cuts: number[] = [];
  let count = 0;
  piecesOf(line).forEach((word, i) => {
    /* A leading oṁ stands outside the metre. */
    if (i === 0 && /^oṁ$/u.test(word.normalize('NFC').replace(/\p{M}/gu, ''))) return;
    count += syllablesOf(word);
    const inPada = ((count - 1) % plan.pada) + 1;
    if (count > 0 && (plan.after.includes(inPada) || inPada === plan.pada)) cuts.push(i + 1);
  });
  return cuts;
}

/** A name's number, raised, at the end of a word: where a line of names may break. */
const NAME_ENDS = /[⁰¹²³⁴⁵⁶⁷⁸⁹]+[।॥]*$/u;
const VOWEL_END = /(?:ai|au|[aāiīuūṛṝḷḹeo])$/u;
const VOWEL_START = /^(?:ai|au|[aāiīuūṛṝḷḹeo])/u;
const bare = (w: string): string => w.normalize('NFC').replace(/[\p{M}⁰¹²³⁴⁵⁶⁷⁸⁹।॥'-]/gu, '');

/**
 * A MANTRA LINE, DIVIDED WHERE HIS PAGE MAY DIVIDE IT, at the width it will
 * print at.
 *
 * Where: a line of names only after a name — never inside one, between the
 * members a word-split name is written in (`prāṇa / daḥ⁹⁵⁶`); a classical
 * metre's pāda at its yatis (`yatiCuts`); anything else at any word.
 *
 * The width: the letters, and what the rules will draw that the letters do
 * not say — the raised aid over a jñ and over an anusvāra (`jᵍña`, `ṁᵘ`),
 * the bar of a hiatus (`akṣara | eva`) and of a yati. Measured without them,
 * a line his column did not hold was set as if it did, and Word wrapped its
 * daṇḍa onto a line of its own (verse 105, 2026-10-04).
 */
export function fitMantraLine(line: string, note: string | undefined, fit: LineFit): string[] {
  const pieces = piecesOf(line);
  const names = pieces.flatMap((p, i) => (NAME_ENDS.test(p) ? [i + 1] : []));
  const yati = yatiCuts(line, note);
  const cuts = names.length > 0 ? names : yati;
  /* The yati's bar, as a sign after its word, so the measure counts it; taken off again after. */
  const barred = yati.length === 0 ? line
    : pieces.map((p, i) => (yati.includes(i + 1) && i + 1 < pieces.length ? `${p} |` : p)).join(' ');
  const raised = fit.widthOf('⁰');
  const bar = fit.widthOf(' |');
  const measured: LineFit = {
    limit: fit.limit,
    widthOf: (t) => {
      const words = t.split(' ').filter((w) => w !== '');
      let hiatus = 0;
      for (let i = 1; i < words.length; i += 1) {
        if (VOWEL_END.test(bare(words[i - 1]!)) && VOWEL_START.test(bare(words[i]!))) hiatus += 1;
      }
      const aids = (t.match(/jñ|ṁ/gu) ?? []).length;
      return fit.widthOf(t) + aids * raised + hiatus * bar;
    },
  };
  const parts = cuts.length === 0 ? fitLineAt(barred, [], measured) : fitLineAt(barred, cuts, measured);
  return yati.length === 0 ? parts : parts.map((p) => p.replace(/ \|(?= |$)/gu, ''));
}
