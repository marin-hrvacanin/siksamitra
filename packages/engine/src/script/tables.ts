/**
 * The phoneme table — one row per sound, one column per script.
 *
 * Adopted from Śikṣāmitra's `transliteration-tables.js`, which already encodes
 * the owner's own choices, and verified against the shipped corpus.
 *
 * WHICH SCRIPTS ARE VERIFIED. The owner has confirmed that the DEVANĀGARĪ and
 * TELUGU forms in the shipped chants are trustworthy and the TAMIL forms are
 * NOT — they have never been reviewed. So the parity gate runs on Devanāgarī
 * and Telugu only (31 762 assertions), and the Tamil column follows
 * Śikṣāmitra's table on principle rather than being fitted to unverified
 * output. Two things the shipped Tamil does that are visibly artifacts, not
 * choices, and are therefore NOT copied: it writes the vocalic `ṛ` as `ரு`
 * plus an ASCII apostrophe, and it renders the avagraha as the DEVANĀGARĪ `ऽ`
 * — a Devanāgarī glyph sitting inside Tamil text.
 *
 * `tamApprox` is the nearest Tamil letter for a sound Tamil has no character
 * for. Tamil does not distinguish aspiration or voicing in its native
 * orthography, so `kh`, `g`, `gh` all render as `க`. That is correct Tamil and
 * it is also LOSSY, which is what the lossless layer in `./lossless.ts` exists
 * to solve.
 *
 * See specs/chant-editor/02-ENGINE.md §13.
 */
import type { ChantScriptKey } from '@siksamitra/format';

/** The scripts a document can carry. `itrans` is interop-only, never stored. */
export type ScriptKey = ChantScriptKey;
export type AnyScriptKey = ScriptKey | 'itrans';

export type PhonemeType = 'vowel' | 'consonant' | 'special';

export interface Phoneme {
  iast: string;
  deva: string;
  tel: string;
  /** `null` = Tamil has no character for this sound; use `tamApprox`. */
  tam: string | null;
  tamApprox?: string;
  itrans: string;
  type: PhonemeType;
  /** For consonants: the varga, used by the on-screen keyboard's layout. */
  varga?: 'ka' | 'ca' | 'ta-retroflex' | 'ta-dental' | 'pa' | 'misc' | 'sibilant';
  label?: string;
}

export const PHONEMES: readonly Phoneme[] = [
  // ── vowels ────────────────────────────────────────────────────────────────
  { iast: 'a', deva: 'अ', tel: 'అ', tam: 'அ', itrans: 'a', type: 'vowel' },
  { iast: 'ā', deva: 'आ', tel: 'ఆ', tam: 'ஆ', itrans: 'aa', type: 'vowel' },
  { iast: 'i', deva: 'इ', tel: 'ఇ', tam: 'இ', itrans: 'i', type: 'vowel' },
  { iast: 'ī', deva: 'ई', tel: 'ఈ', tam: 'ஈ', itrans: 'ii', type: 'vowel' },
  { iast: 'u', deva: 'उ', tel: 'ఉ', tam: 'உ', itrans: 'u', type: 'vowel' },
  { iast: 'ū', deva: 'ऊ', tel: 'ఊ', tam: 'ஊ', itrans: 'uu', type: 'vowel' },
  // Tamil has no vocalic-r/l letter. `tamApprox` is Śikṣāmitra's own choice.
  // UNVERIFIED — see the file header.
  { iast: 'ṛ', deva: 'ऋ', tel: 'ఋ', tam: null, tamApprox: 'ரு', itrans: 'R^i', type: 'vowel' },
  { iast: 'ṝ', deva: 'ॠ', tel: 'ౠ', tam: null, tamApprox: 'ரூ', itrans: 'R^I', type: 'vowel' },
  { iast: 'ḷ', deva: 'ऌ', tel: 'ఌ', tam: null, tamApprox: 'லு', itrans: 'L^i', type: 'vowel' },
  { iast: 'ḹ', deva: 'ॡ', tel: 'ౡ', tam: null, tamApprox: 'லூ', itrans: 'L^I', type: 'vowel' },
  { iast: 'e', deva: 'ए', tel: 'ఏ', tam: 'ஏ', itrans: 'e', type: 'vowel' },
  { iast: 'ai', deva: 'ऐ', tel: 'ఐ', tam: 'ஐ', itrans: 'ai', type: 'vowel' },
  { iast: 'o', deva: 'ओ', tel: 'ఓ', tam: 'ஓ', itrans: 'o', type: 'vowel' },
  { iast: 'au', deva: 'औ', tel: 'ఔ', tam: 'ஔ', itrans: 'au', type: 'vowel' },

  // ── ka-varga (velars) ─────────────────────────────────────────────────────
  { iast: 'k', deva: 'क', tel: 'క', tam: 'க', itrans: 'k', type: 'consonant', varga: 'ka' },
  { iast: 'kh', deva: 'ख', tel: 'ఖ', tam: null, tamApprox: 'க', itrans: 'kh', type: 'consonant', varga: 'ka' },
  { iast: 'g', deva: 'ग', tel: 'గ', tam: null, tamApprox: 'க', itrans: 'g', type: 'consonant', varga: 'ka' },
  { iast: 'gh', deva: 'घ', tel: 'ఘ', tam: null, tamApprox: 'க', itrans: 'gh', type: 'consonant', varga: 'ka' },
  { iast: 'ṅ', deva: 'ङ', tel: 'ఙ', tam: 'ங', itrans: 'N^', type: 'consonant', varga: 'ka' },

  // ── ca-varga (palatals) ───────────────────────────────────────────────────
  { iast: 'c', deva: 'च', tel: 'చ', tam: 'ச', itrans: 'ch', type: 'consonant', varga: 'ca' },
  { iast: 'ch', deva: 'छ', tel: 'ఛ', tam: null, tamApprox: 'ச', itrans: 'Ch', type: 'consonant', varga: 'ca' },
  { iast: 'j', deva: 'ज', tel: 'జ', tam: 'ஜ', itrans: 'j', type: 'consonant', varga: 'ca' },
  { iast: 'jh', deva: 'झ', tel: 'ఝ', tam: null, tamApprox: 'ஜ', itrans: 'jh', type: 'consonant', varga: 'ca' },
  { iast: 'ñ', deva: 'ञ', tel: 'ఞ', tam: 'ஞ', itrans: '~n', type: 'consonant', varga: 'ca' },

  // ── ṭa-varga (retroflexes) ────────────────────────────────────────────────
  { iast: 'ṭ', deva: 'ट', tel: 'ట', tam: 'ட', itrans: 'T', type: 'consonant', varga: 'ta-retroflex' },
  { iast: 'ṭh', deva: 'ठ', tel: 'ఠ', tam: null, tamApprox: 'ட', itrans: 'Th', type: 'consonant', varga: 'ta-retroflex' },
  { iast: 'ḍ', deva: 'ड', tel: 'డ', tam: null, tamApprox: 'ட', itrans: 'D', type: 'consonant', varga: 'ta-retroflex' },
  { iast: 'ḍh', deva: 'ढ', tel: 'ఢ', tam: null, tamApprox: 'ட', itrans: 'Dh', type: 'consonant', varga: 'ta-retroflex' },
  { iast: 'ṇ', deva: 'ण', tel: 'ణ', tam: 'ண', itrans: 'N', type: 'consonant', varga: 'ta-retroflex' },

  // ── ta-varga (dentals) ────────────────────────────────────────────────────
  { iast: 't', deva: 'त', tel: 'త', tam: 'த', itrans: 't', type: 'consonant', varga: 'ta-dental' },
  { iast: 'th', deva: 'थ', tel: 'థ', tam: null, tamApprox: 'த', itrans: 'th', type: 'consonant', varga: 'ta-dental' },
  { iast: 'd', deva: 'द', tel: 'ద', tam: null, tamApprox: 'த', itrans: 'd', type: 'consonant', varga: 'ta-dental' },
  { iast: 'dh', deva: 'ध', tel: 'ధ', tam: null, tamApprox: 'த', itrans: 'dh', type: 'consonant', varga: 'ta-dental' },
  { iast: 'n', deva: 'न', tel: 'న', tam: 'ந', itrans: 'n', type: 'consonant', varga: 'ta-dental' },

  // ── pa-varga (labials) ────────────────────────────────────────────────────
  { iast: 'p', deva: 'प', tel: 'ప', tam: 'ப', itrans: 'p', type: 'consonant', varga: 'pa' },
  { iast: 'ph', deva: 'फ', tel: 'ఫ', tam: null, tamApprox: 'ப', itrans: 'ph', type: 'consonant', varga: 'pa' },
  { iast: 'b', deva: 'ब', tel: 'బ', tam: null, tamApprox: 'ப', itrans: 'b', type: 'consonant', varga: 'pa' },
  { iast: 'bh', deva: 'भ', tel: 'భ', tam: null, tamApprox: 'ப', itrans: 'bh', type: 'consonant', varga: 'pa' },
  { iast: 'm', deva: 'म', tel: 'మ', tam: 'ம', itrans: 'm', type: 'consonant', varga: 'pa' },

  // ── semivowels, sibilants, aspirate, retroflex lateral ────────────────────
  { iast: 'y', deva: 'य', tel: 'య', tam: 'ய', itrans: 'y', type: 'consonant', varga: 'misc' },
  { iast: 'r', deva: 'र', tel: 'ర', tam: 'ர', itrans: 'r', type: 'consonant', varga: 'misc' },
  { iast: 'l', deva: 'ल', tel: 'ల', tam: 'ல', itrans: 'l', type: 'consonant', varga: 'misc' },
  { iast: 'v', deva: 'व', tel: 'వ', tam: 'வ', itrans: 'v', type: 'consonant', varga: 'misc' },
  { iast: 'ś', deva: 'श', tel: 'శ', tam: 'ஶ', itrans: 'sh', type: 'consonant', varga: 'sibilant' },
  { iast: 'ṣ', deva: 'ष', tel: 'ష', tam: 'ஷ', itrans: 'Sh', type: 'consonant', varga: 'sibilant' },
  { iast: 's', deva: 'स', tel: 'స', tam: 'ஸ', itrans: 's', type: 'consonant', varga: 'sibilant' },
  { iast: 'h', deva: 'ह', tel: 'హ', tam: 'ஹ', itrans: 'h', type: 'consonant', varga: 'misc' },
  { iast: 'ḻ', deva: 'ळ', tel: 'ళ', tam: 'ழ', itrans: 'lh', type: 'consonant', varga: 'misc' },

  // ── special / suprasegmental ──────────────────────────────────────────────
  // Anusvāra in Tamil: the shipped forms write `ம்` (m + virāma), Śikṣāmitra's
  // table writes `ஂ` (U+0B82). Both are attested practice in Tamil Sanskrit and
  // the shipped data is UNVERIFIED, so this follows Śikṣāmitra — the owner's own
  // table — pending his ruling. The coda builder appends no virāma to a sign.
  { iast: 'ṁ', deva: 'ं', tel: 'ం', tam: 'ஂ', itrans: 'M', type: 'special', label: 'anusvāra' },
  { iast: 'ḥ', deva: 'ः', tel: 'ః', tam: 'ஃ', itrans: 'H', type: 'special', label: 'visarga' },
  // Tamil has no avagraha. The shipped Tamil borrows the DEVANĀGARĪ sign
  // (`'si` → `ऽஸி`), which is a pipeline artifact rather than a choice — a
  // Devanāgarī glyph inside Tamil text. Left `null` pending the owner's ruling.
  { iast: "'", deva: 'ऽ', tel: 'ఽ', tam: null, itrans: '.a', type: 'special', label: 'avagraha' },
  { iast: '।', deva: '।', tel: '।', tam: '।', itrans: '|', type: 'special', label: 'daṇḍa' },
  { iast: '॥', deva: '॥', tel: '॥', tam: '॥', itrans: '||', type: 'special', label: 'double daṇḍa' },
];

/** Mātrās — a consonant takes the vowel SIGN, not the independent form. */
export interface VowelSign {
  iast: string;
  deva: string;
  tel: string;
  tam: string | null;
  itrans: string;
}

export const VOWEL_SIGNS: readonly VowelSign[] = [
  // The inherent `a` takes no sign at all.
  { iast: 'a', deva: '', tel: '', tam: '', itrans: 'a' },
  { iast: 'ā', deva: 'ा', tel: 'ా', tam: 'ா', itrans: 'aa' },
  { iast: 'i', deva: 'ि', tel: 'ి', tam: 'ி', itrans: 'i' },
  { iast: 'ī', deva: 'ी', tel: 'ీ', tam: 'ீ', itrans: 'ii' },
  { iast: 'u', deva: 'ु', tel: 'ు', tam: 'ு', itrans: 'u' },
  { iast: 'ū', deva: 'ू', tel: 'ూ', tam: 'ூ', itrans: 'uu' },
  // `tam: null` means "this script has no mātrā": the akṣara builder then
  // closes the onset with a virāma and writes the letter's own approximation.
  { iast: 'ṛ', deva: 'ृ', tel: 'ృ', tam: null, itrans: 'R^i' },
  { iast: 'ṝ', deva: 'ॄ', tel: 'ౄ', tam: null, itrans: 'R^I' },
  { iast: 'ḷ', deva: 'ॢ', tel: 'ౢ', tam: null, itrans: 'L^i' },
  { iast: 'ḹ', deva: 'ॣ', tel: 'ౣ', tam: null, itrans: 'L^I' },
  { iast: 'e', deva: 'े', tel: 'ే', tam: 'ே', itrans: 'e' },
  { iast: 'ai', deva: 'ै', tel: 'ై', tam: 'ை', itrans: 'ai' },
  { iast: 'o', deva: 'ो', tel: 'ో', tam: 'ோ', itrans: 'o' },
  { iast: 'au', deva: 'ौ', tel: 'ౌ', tam: 'ௌ', itrans: 'au' },
];

/** The virāma (halanta) — suppresses a consonant's inherent `a`. */
export const VIRAMA: Readonly<Record<AnyScriptKey, string>> = {
  iast: '',
  deva: '्',
  tel: '్',
  tam: '்',
  itrans: '',
};

/**
 * The praṇava. Devanāgarī and Tamil have a dedicated ligature; Telugu does not
 * and takes the ordinary independent vowel + anusvāra, which is what the corpus
 * stores (`ఓం`, 187 occurrences).
 */
export const PRANAVA_FORMS: Readonly<Record<ScriptKey, string>> = {
  iast: 'oṁ',
  deva: 'ॐ',
  tel: 'ఓం',
  tam: 'ௐ',
};

/**
 * The accent marks. Same codepoint in every script, because they are DATA in
 * this system and are drawn by the renderer, never emitted as glyphs.
 */
export const ACCENT_MARKS: readonly string[] = ['̱', '̍', '̎', '̐'];

/** Fast lookups. */
export const BY_IAST: ReadonlyMap<string, Phoneme> = new Map(
  PHONEMES.map((p) => [p.iast, p]),
);
export const SIGN_BY_IAST: ReadonlyMap<string, VowelSign> = new Map(
  VOWEL_SIGNS.map((s) => [s.iast, s]),
);

/** The letter for a phoneme in a script, falling back to the Tamil
 *  approximation when Tamil has no character of its own. */
export function letterFor(p: Phoneme, script: AnyScriptKey): string | null {
  if (script === 'iast') return p.iast;
  if (script === 'itrans') return p.itrans;
  if (script === 'tam') return p.tam ?? p.tamApprox ?? null;
  return p[script];
}

/** The vowel sign for a script; `null` when the script has none. */
export function signFor(s: VowelSign, script: AnyScriptKey): string | null {
  if (script === 'iast') return s.iast;
  if (script === 'itrans') return s.itrans;
  if (script === 'tam') return s.tam;
  return s[script];
}
