/**
 * What the guide shows each rule and each mark on.
 *
 * The TEXT is chosen here, because a rule needs a word it applies to; what
 * the rule DOES to it is never written here — the engine marks it when the
 * page is built (`build.tsx`) — and in the legend too: no example is marked by
 * hand with one mark alone, because a word drawn without the marks the rules
 * give it is a word drawn wrong (the owner: "in yajña the inserted g is
 * missing").
 */
import type { ChantProfileKey } from '@siksamitra/format';
import type { ConventionId } from '@siksamitra/engine';

export interface Example {
  text: string;
  register: ChantProfileKey;
  conventions?: Partial<Record<ConventionId, boolean>>;
  note?: string;
}

/** By rule id (`RULES`), and `convention:<id>` for a switch. */
export const EXAMPLES: Readonly<Record<string, Example>> = {
  holdings: { text: 'agnim īḻe purohitam yajñasya devam ṛtvijam', register: 'taittiriya',
    note: 'A thin box holds a consonant after a short vowel, a thick one after a long vowel; a cluster is held on the letter the rule names.' },
  'anusvara.homorganic': { text: 'saṁkalpa saṁcaya saṁtāpa saṁpūrṇa', register: 'taittiriya',
    note: 'Before a stop the anusvāra is recited as that stop’s own nasal, drawn in the change colour.' },
  'anusvara.before-vowel': { text: 'ahaṁ asmi tvaṁ eva', register: 'taittiriya' },
  'anusvara.gum': { text: 'saṁsthitā haṁsaḥ saṁśaya', register: 'taittiriya',
    note: 'Taittirīya: before a sibilant or h the anusvāra is the gum, with its reading aid.' },
  'anusvara.semivowel-aid': { text: 'saṁvatsara saṁyama saṁlagna', register: 'taittiriya' },
  visarga: { text: 'namaḥ śivāya rāmaḥ karoti devāḥ pibanti', register: 'taittiriya',
    note: 'The visarga takes the first of its seven contexts that matches.' },
  'svarabhakti.r-sibilant': { text: 'varṣa darśana arhati', register: 'taittiriya' },
  aids: { text: 'yajñasya jñānam vyāsam', register: 'taittiriya' },
  'sandhi.rigveda.anunasika': { text: 'devān agne', register: 'rigveda' },
  'convention:nasal-before-nasal': { text: 'puraṁ mahā śagmāṁ no', register: 'taittiriya' },
  'convention:visarga-before-velar': { text: 'devyaḥ krodha duḥkha', register: 'smarta' },
  'convention:puranic-svara': { text: 'yā devī sarvabhūteṣu śaktirūpeṇa saṁsthitā', register: 'smarta' },
  'convention:vy-aid': { text: 'bhavyam vāyavyān', register: 'taittiriya' },
};

/**
 * One entry of the legend: a word the rules mark with that mark — chosen so it
 * carries as few others as possible, and drawn with ALL the marks the rules
 * give it, never a hand-placed one alone — or a line out of his own marked
 * files, where only his hand can say it (a Vedic svara is never derived).
 */
export interface NotationEntry {
  id: string;
  name: string;
  what: string;
  /** How Word sets it, in his documents' words. */
  word: string;
  /** The colour token its chip is drawn in. */
  swatch: string;
  /** Marked by the rules of this register… */
  text?: string;
  register?: ChantProfileKey;
  /** …or a line of his own file, as he marked it. */
  his?: { file: string; verse: number };
}

export const NOTATION: readonly NotationEntry[] = [
  { id: 'hold-short', name: 'Short holding', word: 'Holding · thin green border', swatch: 'var(--color-hold)',
    what: 'Hold the consonant for the length of a short vowel. In Devanāgarī, his small green mark before the akṣara.',
    text: 'satyam', register: 'taittiriya' },
  { id: 'hold-long', name: 'Long holding', word: 'Holding · thick green border', swatch: 'var(--color-hold)',
    what: 'Hold it for the length of a long vowel. In Devanāgarī, his heavier green mark before the akṣara.',
    text: 'ātmā', register: 'taittiriya' },
  { id: 'svara', name: 'Anudātta and svarita', word: 'Svara · dark red', swatch: 'var(--color-svara)',
    what: 'The low tone, a bar under the letter, and the raised tone, a stroke over it — as he marked the Krimi Saṁhāraka Sūktam.',
    his: { file: 'krimi', verse: 0 } },
  { id: 'dirgha', name: 'Dīrgha svarita, and the Ṛgvedic overline', word: 'Svara · Long, blue', swatch: 'var(--color-svara)',
    what: 'The long raised tone, two strokes; in the Ṛgveda a short vowel’s svarita takes the overline, in his blue Long style — his Parjanya Sūktam.',
    his: { file: 'parjanya', verse: 3 } },
  { id: 'change', name: 'Anusvāra recited otherwise', word: 'Anusvara · blue', swatch: 'var(--color-change)',
    what: 'Before a stop the anusvāra is recited as that stop’s nasal: the letter recited, in blue, and the record of what was written.',
    text: 'saṁtāpa', register: 'taittiriya' },
  { id: 'visarga', name: 'Visarga recited otherwise', word: 'Anusvara · blue', swatch: 'var(--color-change)',
    what: 'The visarga before t is recited as s.', text: 'namaḥ te', register: 'taittiriya' },
  { id: 'gum', name: 'The Taittirīya gum', word: 'Anusvara · blue, with its aid', swatch: 'var(--color-change)',
    what: 'Before a sibilant or h the anusvāra is the gum, m̐, with the small g that says how it is recited.', text: 'haṁsa', register: 'taittiriya' },
  { id: 'aid', name: 'Reading aid', word: 'Reference · superscript', swatch: 'var(--color-change)',
    what: 'A small letter that says how a cluster is recited: the g inside jñ.', text: 'jñānam', register: 'taittiriya' },
  { id: 'sbhakti', name: 'Svarabhakti', word: 'Svara · a dot', swatch: 'var(--color-svara)',
    what: 'The vowel-glide between an r and the sibilant or h after it.', text: 'varṣa', register: 'taittiriya' },
  { id: 'pause-short', name: 'Short pause', word: 'one blue bar', swatch: 'var(--color-pause-short)',
    what: 'Two vowels meeting across a word, other than long-then-short, are held apart by a short pause.', text: 'sa eṣa', register: 'taittiriya' },
  { id: 'pause-long', name: 'Long pause', word: 'one red bar', swatch: 'var(--color-pause-long)',
    what: 'A long vowel meeting a short one across a word takes the long pause.', text: 'vāyur vā apām', register: 'taittiriya' },
  { id: 'pause-bija', name: 'The bīja’s pause', word: 'one blue bar', swatch: 'var(--color-pause-short)',
    what: 'After a bīja — oṁ, and the seed syllables — a short pause, whatever follows.', text: 'oṁ namaḥ', register: 'taittiriya' },
];
