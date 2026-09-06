import type { ChantDoc, ChantSection, ChantToken, ChantVerse } from '@siksamitra/format';
import { SANKALPA_MARKS, SANKALPA_JOINS } from './sankalpa-marks.js';

/**
 * Saṅkalpa — the traditional ritual statement of intent recited (holding water)
 * before any observance. It locates the act precisely in TIME and PLACE, then
 * states the PURPOSE and the rite to be performed.
 *
 * It comes in THREE LEVELS, all built from the same fragments — each level a
 * superset of the one before it:
 *
 *   simple    [kartṛ resolve] · [devatā]-prīty-arthaṃ · [devatā]-[karma]ṃ kariṣye ||
 *   standard  + maṅgala · śubhe śobhane muhūrte · [deśa] · [kāla — the ten
 *               pañcāṅga coordinates, all locative] · evaṃ guṇa-viśeṣaṇa… ·
 *               [gotra / nāma] · [kāmanā]
 *   maha      + the cosmic-time preamble (ādya brahmaṇo dvitīya-parārdhe …)
 *
 * The time/place COORDINATES are computed server-side from the pañcāṅga (they
 * depend only on date + location). The fragment libraries below (tradition,
 * karma, kāmanā, devatā, place templates) are user-selectable and the composer
 * is pure, so the client recomposes instantly as options change. The `simple`
 * level needs no coordinates at all — which is why it can render offline, and
 * why it is the level the Pūjā Vidhi manual embeds at its preparatory step 3.
 *
 * OUTPUT. `composeSankalpa` returns a `ChantDoc` (shared/src/chant.ts) — the
 * same contract a static chant JSON satisfies — so the saṅkalpa is rendered by
 * the ONE chant reader, and looks identical to every other Veda Union text.
 * There is no second renderer and no runtime marking engine: every fragment's
 * marks are emitted offline by `tools/chant/emit.py` into `sankalpa-marks.ts`.
 *
 * All Sanskrit is given in IAST and Devanāgarī; both must always agree.
 */

/** Letter-level marks for one fragment (holdings + anusvāra/visarga; NO svara). */
export type MarkToken = ChantToken;

/** A term in both scripts, with its precomputed marks. */
export interface SankalpaTerm {
  iast: string;
  deva: string;
  /** Precomputed śikṣā marks (offline). Absent → the term renders unmarked. */
  marks?: MarkToken[];
  /** The key this term's marks were emitted under — how `lineTokens` finds the
   *  precomputed JOIN with the fragment next to it. NOT `Labelled.key`, which is
   *  the option id the UI uses. */
  markKey?: string;
}

/** Time/place coordinates for a day+location, each a ready locative phrase. */
export interface SankalpaCoordinates {
  date: string;
  placeName: string;
  /** Rough flag: location within the Indian subcontinent bounding box. */
  isIndia: boolean;
  /** "Viśvāvasu nāma saṃvatsare" */
  samvatsara: SankalpaTerm;
  /** "uttarāyaṇe" / "dakṣiṇāyane" */
  ayana: SankalpaTerm;
  /** "grīṣma-ṛtau" */
  ritu: SankalpaTerm;
  /** "jyeṣṭha-māse" (or "adhika-jyeṣṭha-māse") */
  masa: SankalpaTerm;
  /** "śukla-pakṣe" / "kṛṣṇa-pakṣe" */
  paksha: SankalpaTerm;
  /** "ekādaśyāṃ tithau" */
  tithi: SankalpaTerm;
  /** "bhānu-vāsare" */
  vara: SankalpaTerm;
  /** "rohiṇī-nakṣatre" */
  nakshatra: SankalpaTerm;
  /** "siddhi-yoge" */
  yoga: SankalpaTerm;
  /** "bava-karaṇe" */
  karana: SankalpaTerm;
}

// ─── Option vocabularies ────────────────────────────────────────────────────

/** How much of the saṅkalpa to say. Each level is a superset of the previous. */
export type SankalpaLevel = 'simple' | 'standard' | 'maha';

export const SANKALPA_LEVELS: { key: SankalpaLevel; label: string; blurb: string }[] = [
  { key: 'simple', label: 'Simple', blurb: 'The short form used in daily pūjā.' },
  { key: 'standard', label: 'Full', blurb: 'With the day’s pañcāṅga — place and time in the traditional order.' },
  { key: 'maha', label: 'Mahā-saṅkalpa', blurb: 'The full form plus the cosmic-time preamble.' },
];

export type SankalpaTradition = 'smarta' | 'vaishnava' | 'shaiva' | 'shakta';
export type SankalpaKarma =
  | 'puja' | 'japa' | 'homa' | 'vrata' | 'dana' | 'snana'
  | 'parayana' | 'archana' | 'abhisheka' | 'dhyana';
export type SankalpaKamana =
  | 'dharmic' | 'health' | 'peace' | 'knowledge' | 'obstacles'
  | 'prosperity' | 'progeny' | 'longevity' | 'liberation'
  | 'protection' | 'allbeings';
export type SankalpaDeity =
  | 'parameshvara' | 'ganesha' | 'shiva' | 'vishnu' | 'devi' | 'surya'
  | 'hanuman' | 'lakshmi' | 'sarasvati' | 'durga' | 'krishna' | 'rama'
  | 'subrahmanya' | 'dattatreya' | 'gayatri';

export const SANKALPA_LEVEL_KEYS: SankalpaLevel[] = ['simple', 'standard', 'maha'];
export const SANKALPA_TRADITION_KEYS: SankalpaTradition[] = ['smarta', 'vaishnava', 'shaiva', 'shakta'];
export const SANKALPA_KARMA_KEYS: SankalpaKarma[] = [
  'puja', 'japa', 'homa', 'vrata', 'dana', 'snana', 'parayana', 'archana', 'abhisheka', 'dhyana',
];
export const SANKALPA_KAMANA_KEYS: SankalpaKamana[] = [
  'dharmic', 'health', 'peace', 'knowledge', 'obstacles', 'prosperity',
  'progeny', 'longevity', 'liberation', 'protection', 'allbeings',
];
export const SANKALPA_DEITY_KEYS: SankalpaDeity[] = [
  'parameshvara', 'ganesha', 'shiva', 'vishnu', 'devi', 'surya', 'hanuman',
  'lakshmi', 'sarasvati', 'durga', 'krishna', 'rama', 'subrahmanya',
  'dattatreya', 'gayatri',
];

/** Preset gotras (the seven saptarṣi lineages, IAST). Kāśyapa is the
 *  traditional default for those who don't know theirs; Bhāradvāja is offered
 *  for disciples who inherit it through Sathya Sai Baba. Gotra is patrilineal
 *  (it can't be derived from a birth date); the astrological nakṣatra-based
 *  method is a non-standard fallback we deliberately don't auto-apply. */
export const GOTRA_PRESETS: { value: string; label: string; note?: string }[] = [
  { value: 'kāśyapa', label: 'Kāśyapa', note: 'default' },
  { value: 'bhāradvāja', label: 'Bhāradvāja', note: 'Sathya Sai Baba' },
  { value: 'atri', label: 'Atri' },
  { value: 'gautama', label: 'Gautama' },
  { value: 'jamadagni', label: 'Jamadagni' },
  { value: 'vasiṣṭha', label: 'Vasiṣṭha' },
  { value: 'viśvāmitra', label: 'Viśvāmitra' },
];
export const DEFAULT_GOTRA = 'kāśyapa';

interface Labelled extends SankalpaTerm { key: string; label: string }

/** Tradition: opening invocation (maṅgalācaraṇa) + an optional framing clause. */
export const TRADITIONS: Record<SankalpaTradition, {
  label: string; opening: SankalpaTerm; frame: SankalpaTerm;
}> = {
  smarta: {
    label: 'Smārta (general)',
    opening: { iast: 'śrī-gurubhyo namaḥ | hariḥ oṃ |', deva: 'श्रीगुरुभ्यो नमः । हरिः ॐ ।' },
    frame: { iast: '', deva: '' },
  },
  vaishnava: {
    label: 'Vaiṣṇava',
    opening: { iast: 'śrīmate nārāyaṇāya namaḥ |', deva: 'श्रीमते नारायणाय नमः ।' },
    frame: { iast: 'bhagavad-ājñayā bhagavat-kaiṅkarya-rūpaṃ', deva: 'भगवदाज्ञया भगवत्कैङ्कर्यरूपं' },
  },
  shaiva: {
    label: 'Śaiva',
    opening: { iast: 'śrī-gurubhyo namaḥ | oṃ namaḥ śivāya |', deva: 'श्रीगुरुभ्यो नमः । ॐ नमः शिवाय ।' },
    frame: { iast: '', deva: '' },
  },
  shakta: {
    label: 'Śākta',
    opening: { iast: 'oṃ aiṃ hrīṃ klīṃ |', deva: 'ॐ ऐं ह्रीं क्लीं ।' },
    frame: { iast: '', deva: '' },
  },
};

/**
 * Iṣṭa-devatā.
 *
 * `iast`/`deva` are the STEM used inside a compound (devatā-prīty-arthaṃ,
 * devatā-pūjāṃ). `acc` is the ACCUSATIVE singular, hand-authored per deity, for
 * the standalone `deva` slot in the pūjā mantras ("asmin bimbe śrī devaṁ
 * āvāhayāmi"). Declension is AUTHORED DATA here, never derived — see
 * docs/AUTHORING-SANKALPA.md §1.
 */
export const DEITIES: Record<SankalpaDeity, Labelled & { acc: SankalpaTerm }> = {
  parameshvara: { key: 'parameshvara', label: 'Parameśvara (the Supreme)', iast: 'parameśvara', deva: 'परमेश्वर', acc: { iast: 'parameśvaraṃ', deva: 'परमेश्वरं' } },
  ganesha: { key: 'ganesha', label: 'Gaṇeśa', iast: 'gaṇeśa', deva: 'गणेश', acc: { iast: 'gaṇeśaṃ', deva: 'गणेशं' } },
  shiva: { key: 'shiva', label: 'Śiva', iast: 'sāmba-sadāśiva', deva: 'साम्बसदाशिव', acc: { iast: 'sāmba-sadāśivaṃ', deva: 'साम्बसदाशिवं' } },
  vishnu: { key: 'vishnu', label: 'Viṣṇu', iast: 'viṣṇu', deva: 'विष्णु', acc: { iast: 'viṣṇuṃ', deva: 'विष्णुं' } },
  devi: { key: 'devi', label: 'Devī (the Goddess)', iast: 'jagad-ambā', deva: 'जगदम्बा', acc: { iast: 'jagad-ambāṃ', deva: 'जगदम्बां' } },
  surya: { key: 'surya', label: 'Sūrya', iast: 'sūrya', deva: 'सूर्य', acc: { iast: 'sūryaṃ', deva: 'सूर्यं' } },
  hanuman: { key: 'hanuman', label: 'Hanumān', iast: 'hanumat', deva: 'हनुमत्', acc: { iast: 'hanumantaṃ', deva: 'हनुमन्तं' } },
  lakshmi: { key: 'lakshmi', label: 'Lakṣmī', iast: 'mahā-lakṣmī', deva: 'महालक्ष्मी', acc: { iast: 'mahā-lakṣmīṃ', deva: 'महालक्ष्मीं' } },
  sarasvati: { key: 'sarasvati', label: 'Sarasvatī', iast: 'sarasvatī', deva: 'सरस्वती', acc: { iast: 'sarasvatīṃ', deva: 'सरस्वतीं' } },
  durga: { key: 'durga', label: 'Durgā', iast: 'durgā', deva: 'दुर्गा', acc: { iast: 'durgāṃ', deva: 'दुर्गां' } },
  krishna: { key: 'krishna', label: 'Kṛṣṇa', iast: 'kṛṣṇa', deva: 'कृष्ण', acc: { iast: 'kṛṣṇaṃ', deva: 'कृष्णं' } },
  rama: { key: 'rama', label: 'Rāma', iast: 'rāma', deva: 'राम', acc: { iast: 'rāmaṃ', deva: 'रामं' } },
  subrahmanya: { key: 'subrahmanya', label: 'Subrahmaṇya (Murugan)', iast: 'subrahmaṇya', deva: 'सुब्रह्मण्य', acc: { iast: 'subrahmaṇyaṃ', deva: 'सुब्रह्मण्यं' } },
  dattatreya: { key: 'dattatreya', label: 'Dattātreya', iast: 'dattātreya', deva: 'दत्तात्रेय', acc: { iast: 'dattātreyaṃ', deva: 'दत्तात्रेयं' } },
  gayatri: { key: 'gayatri', label: 'Gāyatrī', iast: 'gāyatrī', deva: 'गायत्री', acc: { iast: 'gāyatrīṃ', deva: 'गायत्रीं' } },
};

/** Karma: the rite, as the accusative object of kariṣye. */
export const KARMAS: Record<SankalpaKarma, Labelled> = {
  puja: { key: 'puja', label: 'Pūjā (worship)', iast: 'pūjāṃ', deva: 'पूजां' },
  japa: { key: 'japa', label: 'Japa (recitation)', iast: 'japaṃ', deva: 'जपं' },
  homa: { key: 'homa', label: 'Homa (fire offering)', iast: 'homaṃ', deva: 'होमं' },
  vrata: { key: 'vrata', label: 'Vrata (vow / observance)', iast: 'vrataṃ', deva: 'व्रतं' },
  dana: { key: 'dana', label: 'Dāna (giving)', iast: 'dānaṃ', deva: 'दानं' },
  snana: { key: 'snana', label: 'Snāna (sacred bath)', iast: 'snānaṃ', deva: 'स्नानं' },
  parayana: { key: 'parayana', label: 'Pārāyaṇa (recital of a text)', iast: 'pārāyaṇaṃ', deva: 'पारायणं' },
  archana: { key: 'archana', label: 'Arcanā (name-offering)', iast: 'arcanāṃ', deva: 'अर्चनां' },
  abhisheka: { key: 'abhisheka', label: 'Abhiṣeka (sacred ablution)', iast: 'abhiṣekaṃ', deva: 'अभिषेकं' },
  dhyana: { key: 'dhyana', label: 'Dhyāna (meditation)', iast: 'dhyānaṃ', deva: 'ध्यानं' },
};

/** Kāmanā: the fruit sought, as a "...-arthaṃ" clause. */
export const KAMANAS: Record<SankalpaKamana, Labelled> = {
  dharmic: { key: 'dharmic', label: 'The four aims of life (default)', iast: 'dharmārtha-kāma-mokṣa-catur-vidha-phala-puruṣārtha-siddhy-arthaṃ', deva: 'धर्मार्थकाममोक्ष-चतुर्विध-फल-पुरुषार्थ-सिद्ध्यर्थं' },
  health: { key: 'health', label: 'Health (ārogya)', iast: 'ārogya-prāptyarthaṃ', deva: 'आरोग्य-प्राप्त्यर्थं' },
  peace: { key: 'peace', label: 'Peace of mind (śānti)', iast: 'sarva-śānti-prāptyarthaṃ', deva: 'सर्व-शान्ति-प्राप्त्यर्थं' },
  knowledge: { key: 'knowledge', label: 'Knowledge (vidyā)', iast: 'vidyā-prāptyarthaṃ', deva: 'विद्या-प्राप्त्यर्थं' },
  obstacles: { key: 'obstacles', label: 'Removal of obstacles', iast: 'sarva-vighna-nivṛtty-arthaṃ', deva: 'सर्व-विघ्न-निवृत्त्यर्थं' },
  prosperity: { key: 'prosperity', label: 'Prosperity (samṛddhi)', iast: 'dhana-dhānya-samṛddhy-arthaṃ', deva: 'धन-धान्य-समृद्ध्यर्थं' },
  progeny: { key: 'progeny', label: 'Progeny (santāna)', iast: 'santāna-prāptyarthaṃ', deva: 'सन्तान-प्राप्त्यर्थं' },
  longevity: { key: 'longevity', label: 'Long life & wellbeing', iast: 'āyur-ārogya-aiśvarya-abhivṛddhy-arthaṃ', deva: 'आयुरारोग्य-ऐश्वर्य-अभिवृद्ध्यर्थं' },
  liberation: { key: 'liberation', label: 'Liberation (mokṣa)', iast: 'ātma-jñāna-mokṣa-siddhy-arthaṃ', deva: 'आत्मज्ञान-मोक्ष-सिद्ध्यर्थं' },
  protection: { key: 'protection', label: 'Protection (rakṣā)', iast: 'sarvāriṣṭa-śānti-rakṣā-prāptyarthaṃ', deva: 'सर्वारिष्ट-शान्ति-रक्षा-प्राप्त्यर्थं' },
  allbeings: { key: 'allbeings', label: 'Welfare of all beings', iast: 'sarva-loka-kṣema-arthaṃ', deva: 'सर्व-लोक-क्षेमार्थं' },
};

// Fixed clauses shared by every saṅkalpa. Each carries precomputed śikṣā marks.
const MANGALA: SankalpaTerm = { iast: 'oṃ', deva: 'ॐ', marks: SANKALPA_MARKS.MANGALA };
const MUHURTA: SankalpaTerm = { iast: 'śubhe śobhane muhūrte', deva: 'शुभे शोभने मुहूर्ते', marks: SANKALPA_MARKS.MUHURTA };
const PREAMBLE: SankalpaTerm = {
  iast: 'ādya brahmaṇo dvitīya-parārdhe śrī-śveta-varāha-kalpe vaivasvata-manvantare aṣṭāviṃśatitame kali-yuge kali-prathama-caraṇe',
  deva: 'आद्य ब्रह्मणो द्वितीय-परार्धे श्रीश्वेतवराहकल्पे वैवस्वत-मन्वन्तरे अष्टाविंशतितमे कलियुगे कलि-प्रथम-चरणे',
  marks: SANKALPA_MARKS.PREAMBLE,
};
const BHARATA: SankalpaTerm = {
  iast: 'jambū-dvīpe bharata-varṣe bharata-khaṇḍe meroḥ dakṣiṇe pārśve',
  deva: 'जम्बूद्वीपे भरतवर्षे भरतखण्डे मेरोः दक्षिणे पार्श्वे',
  marks: SANKALPA_MARKS.BHARATA,
};
const EVAM: SankalpaTerm = {
  iast: 'evaṃ guṇa-viśeṣaṇa-viśiṣṭāyāṃ asyāṃ śubha-puṇya-tithau',
  deva: 'एवं गुण-विशेषण-विशिष्टायां अस्यां शुभ-पुण्य-तिथौ',
  marks: SANKALPA_MARKS.EVAM,
};
const RESOLVE_PRE: SankalpaTerm = {
  iast: 'mama upātta-samasta-durita-kṣaya-dvārā',
  deva: 'मम उपात्त-समस्त-दुरित-क्षय-द्वारा',
  marks: SANKALPA_MARKS.RESOLVE_PRE,
};
const KARISHYE: SankalpaTerm = { iast: 'kariṣye', deva: 'करिष्ये', marks: SANKALPA_MARKS.KARISHYE };

// Connective fragments split out of the composed compounds so each can carry its
// own śikṣā marks (each marked as a PIECE OF A LINE; the joins between them
// are precomputed — see lineTokens).
const SRI: SankalpaTerm = { iast: 'śrī', deva: 'श्री', marks: SANKALPA_MARKS.SRI };
const PRITY_ARTHAM: SankalpaTerm = { iast: 'prīty-arthaṃ', deva: 'प्रीत्यर्थं', marks: SANKALPA_MARKS.PRITY_ARTHAM };
const GOTROTPANNAH: SankalpaTerm = { iast: 'gotrotpannaḥ', deva: 'गोत्रोत्पन्नः', marks: SANKALPA_MARKS.GOTROTPANNAH };
const NAMA: SankalpaTerm = { iast: 'nāmā', deva: 'नामा', marks: SANKALPA_MARKS.NAMA };
const AHAM: SankalpaTerm = { iast: 'ahaṃ', deva: 'अहं', marks: SANKALPA_MARKS.AHAM };
const DANDA: SankalpaTerm = { iast: '||', deva: '॥', marks: [{ t: 'danda', s: '॥' }] };
const PLACE_PRE: SankalpaTerm = {
  iast: 'jambū-dvīpe asmin vartamāne vyāvahārike',
  deva: 'जम्बूद्वीपे अस्मिन् वर्तमाने व्यावहारिके',
  marks: SANKALPA_MARKS.PLACE_PRE,
};
const PLACE_POST: SankalpaTerm = { iast: 'iti prasiddhe deśe', deva: 'इति प्रसिद्धे देशे', marks: SANKALPA_MARKS.PLACE_POST };
const JAMBU: SankalpaTerm = { iast: 'jambū-dvīpe', deva: 'जम्बूद्वीपे', marks: SANKALPA_MARKS.JAMBU };

// Attach marks to the option vocabularies + tradition clauses (keyed the same
// way the offline generator emitted them).
for (const [k, v] of Object.entries(DEITIES)) {
  v.markKey = `deity:${k}`; v.marks = SANKALPA_MARKS[v.markKey];
  v.acc.markKey = `deity-acc:${k}`; v.acc.marks = SANKALPA_MARKS[v.acc.markKey];
}
for (const [k, v] of Object.entries(KARMAS)) { v.markKey = `karma:${k}`; v.marks = SANKALPA_MARKS[v.markKey]; }
for (const [k, v] of Object.entries(KAMANAS)) { v.markKey = `kamana:${k}`; v.marks = SANKALPA_MARKS[v.markKey]; }
for (const [k, t] of Object.entries(TRADITIONS)) {
  if (t.opening.iast) { t.opening.markKey = `trad:${k}:opening`; t.opening.marks = SANKALPA_MARKS[t.opening.markKey]; }
  if (t.frame.iast) { t.frame.markKey = `trad:${k}:frame`; t.frame.marks = SANKALPA_MARKS[t.frame.markKey]; }
}
// The fixed clauses, stamped with the key their marks were emitted under.
for (const [k, term] of Object.entries({
  MANGALA, MUHURTA, PREAMBLE, BHARATA, EVAM, RESOLVE_PRE, KARISHYE, SRI,
  PRITY_ARTHAM, GOTROTPANNAH, NAMA, AHAM, PLACE_PRE, PLACE_POST, JAMBU,
})) term.markKey = k;

/** The deity slot the pūjā mantras carry (`{t:'slot', name:'deity'}`). One
 *  document-level choice re-voices every mantra that names the deity. */
export const DEITY_SLOT = 'deity';

/** Tokens for the chosen deity in the accusative — what fills the `deity` slot
 *  in the pūjā mantras. Falls back to the fragment's own default when the
 *  offline table has no entry (it always should). */
export function deitySlotTokens(deity: SankalpaDeity): MarkToken[] | undefined {
  return DEITIES[deity]?.acc.marks;
}

export interface SankalpaOptions {
  /** How much of the saṅkalpa to say. */
  level: SankalpaLevel;
  tradition: SankalpaTradition;
  karma: SankalpaKarma;
  kamana: SankalpaKamana;
  deity: SankalpaDeity;
  /** 'bharata' = classical Jambūdvīpa/Bhāratavarṣa frame; 'adapted' = name the
   *  actual location (diaspora practice). */
  placeFrame: 'bharata' | 'adapted';
  /** Optional performer details. Free text — never marked. */
  gotra?: string;
  name?: string;
}

export const DEFAULT_SANKALPA_OPTIONS: SankalpaOptions = {
  level: 'standard',
  tradition: 'smarta',
  karma: 'puja',
  kamana: 'dharmic',
  // GAṆEŚA is the owner's default: the first worship, and the deity whose
  // eighteen names and stotram the pūjā manual actually carries. It was
  // `parameshvara`, which quietly gave every new reader the Śiva form of the
  // kṣamā prārthanā and the vibhūti step.
  deity: 'ganesha',
  placeFrame: 'adapted',
  // Traditional default for those who do not know their gotra (gotra is
  // patrilineal — it cannot be derived from a birth date).
  gotra: 'kāśyapa',
};

/** The composed saṅkalpa: the marked document the reader renders, plus flat
 *  text per script for the Copy button. */
export interface ComposedSankalpa {
  iast: string;
  deva: string;
  /** One entry per displayed line, in both scripts (copy preserves the lines). */
  lines: { iast: string; deva: string }[];
  /** The marked document — the same contract a chant JSON satisfies. */
  doc: ChantDoc;
}

// Normalise IAST for recitation: lower-case (Sanskrit has no capitals),
// anusvāra written ṁ (dot above), and members spaced rather than hyphenated.
const fixIast = (s: string): string =>
  s.toLowerCase().replace(/ṃ/g, 'ṁ').replace(/[-,]/g, ' ').replace(/\s+/g, ' ').trim();

/** A part of a line before assembly: a term (possibly marked), free text the
 *  reciter supplied, or a PLACEHOLDER standing where free text was not. */
type Part = { term: SankalpaTerm } | { fill: string } | { ph: string };
const T = (term: SankalpaTerm): Part => ({ term });
const F = (text: string): Part => ({ fill: text });
/** A visible slot marker — "(your name)". It shows the reciter that something
 *  belongs there and is never emitted as text (see `ChantText.placeholder`). */
const PH = (label: string): Part => ({ ph: label });

/** Tokens for one term. A term with marks contributes its precomputed marks; a
 *  term without them degrades to plain (unmarked) text rather than vanishing. */
function termTokens(term: SankalpaTerm): MarkToken[] {
  if (term.marks && term.marks.length) return term.marks;
  const iast = fixIast(term.iast);
  if (!iast) return [];
  return [{ t: 'text', s: iast, deva: term.deva }];
}

/** IAST vowels — only used to find where a syllable's onset ends. */
const VOWELS = new Set(['a', 'ā', 'i', 'ī', 'u', 'ū', 'ṛ', 'ṝ', 'ḷ', 'ḹ', 'e', 'ai', 'o', 'au']);

/**
 * The owner's rule: a verse/line-INITIAL cluster is never boxed (`tripādūrdhva`,
 * `brāhmaṇo`, `prīty-arthaṃ` when it opens a line). A fragment is marked as a
 * PIECE of a line — it can land anywhere — so the suppression is applied once,
 * here, to whichever fragment actually opens the rendered line.
 */
function dropInitialClusterBox(tokens: MarkToken[]): MarkToken[] {
  const i = tokens.findIndex((tk) => tk.t === 'syl');
  const tk = i < 0 ? undefined : tokens[i];
  if (!tk || tk.t !== 'syl') return tokens;
  const nucleus = tk.units.findIndex((u) => VOWELS.has(u.c));
  const onset = nucleus < 0 ? tk.units.length : nucleus;
  // a cluster is two or more consonants; a single onset consonant is never boxed
  if (onset < 2 || !tk.units.slice(0, onset).some((u) => u.hold)) return tokens;
  const units = tk.units.map((u, k) => {
    if (k >= onset || !u.hold) return u;
    const bare = { ...u };
    delete bare.hold;
    delete bare.hg;
    return bare;
  });
  const out = tokens.slice();
  out[i] = { ...tk, units };
  return out;
}

/** Assemble one line's tokens from its parts, separated by word spaces. */
function lineTokens(parts: Part[]): MarkToken[] {
  const pieces: { key?: string; toks: MarkToken[] }[] = [];
  for (const p of parts) {
    if ('ph' in p) {
      pieces.push({ toks: [{ t: 'text', s: p.ph, fill: true, placeholder: true }] });
    } else if ('fill' in p) {
      const s = p.fill.trim();
      if (!s) continue;
      pieces.push({ toks: [{ t: 'text', s, fill: true }] });
    } else {
      if (!p.term.iast.trim()) continue;
      const toks = termTokens(p.term);
      if (!toks.length) continue;
      pieces.push({ key: p.term.markKey, toks: toks.slice() });
    }
  }
  // Cross-fragment sandhi and the holding that straddles a join — precomputed
  // offline by tools/chant/emit.py, because a fragment marked on its own cannot
  // see past its own edges: `pūjāṃ` + `kariṣye` is recited `pūjāṅ kariṣye`,
  // with the box on the `k`. Patching is per PAIR and touches only the two
  // syllables either side of the join, so a chain of fragments composes.
  for (let i = 0; i + 1 < pieces.length; i++) {
    const a = pieces[i]!;
    const b = pieces[i + 1]!;
    if (!a.key || !b.key) continue;
    const join = SANKALPA_JOINS[`${a.key}|${b.key}`];
    if (!join) continue;
    if (join.l) {
      let k = -1;
      a.toks.forEach((t, n) => { if (t.t === 'syl') k = n; });
      if (k >= 0) a.toks[k] = join.l;
    }
    if (join.r) {
      const k = b.toks.findIndex((t) => t.t === 'syl');
      if (k >= 0) b.toks[k] = join.r;
    }
  }
  const out: MarkToken[] = [];
  for (const pc of pieces) {
    if (out.length) out.push({ t: 'sp' });
    out.push(...pc.toks);
  }
  return dropInitialClusterBox(out);
}

/** Flatten a token stream back to running text in one script (for Copy). */
export function tokensToText(tokens: MarkToken[], script: 'iast' | 'deva' | 'tel' | 'tam'): string {
  let out = '';
  for (const tk of tokens) {
    switch (tk.t) {
      case 'syl':
        out += script === 'iast' ? tk.iast : script === 'deva' ? tk.deva : tk[script] ?? tk.deva;
        break;
      case 'text':
        // A placeholder is a slot MARKER, not a word: it never reaches the
        // recitation, the clipboard, or an HTML snapshot.
        if (tk.placeholder) break;
        out += script === 'iast' ? tk.s : tk[script] ?? tk.s;
        break;
      case 'slot':
        out += tokensToText(tk.tokens, script);
        break;
      case 'sp': out += ' '; break;
      case 'br': out += ' '; break;
      case 'danda': out += script === 'iast' ? (tk.s === '॥' ? '||' : '|') : tk.s; break;
      case 'bar': out += '|'; break;
      case 'pause': out += tk.len === 'long' ? ' ‖ ' : ' | '; break;
      case 'num': out += tk.s; break;
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Parts for the deśa (place) line. */
function placeParts(coords: SankalpaCoordinates, frame: 'bharata' | 'adapted'): Part[] {
  if (frame === 'bharata' && coords.isIndia) return [T(BHARATA)];
  // Outside India but classical frame requested: keep Jambūdvīpa, omit Bharatakhaṇḍa.
  if (frame === 'bharata') return [T(JAMBU)];
  const place = (coords.placeName || 'asmin sthāne').trim();
  return [T(PLACE_PRE), F(place), T(PLACE_POST)];
}

/**
 * Compose the saṅkalpa from the day's coordinates + the user's options. Pure.
 *
 * `coords` may be null — the `simple` level needs no pañcāṅga, and a higher
 * level asked for before the coordinates have arrived degrades to `simple`
 * rather than rendering nothing.
 */
export function composeSankalpa(
  coords: SankalpaCoordinates | null | undefined,
  opts: SankalpaOptions,
): ComposedSankalpa {
  const trad = TRADITIONS[opts.tradition];
  const deity = DEITIES[opts.deity];
  const karma = KARMAS[opts.karma];
  const kamana = KAMANAS[opts.kamana];
  const level: SankalpaLevel = coords ? opts.level : 'simple';

  const lineParts: Part[][] = [];

  if (level !== 'simple') {
    if (trad.opening.iast) lineParts.push([T(trad.opening)]);
    lineParts.push([T(MANGALA), T(MUHURTA)]);
    if (level === 'maha') lineParts.push([T(PREAMBLE)]);
    lineParts.push(placeParts(coords!, opts.placeFrame));
    lineParts.push([T(coords!.samvatsara), T(coords!.ayana), T(coords!.ritu)]);
    lineParts.push([T(coords!.masa), T(coords!.paksha), T(coords!.tithi)]);
    lineParts.push([T(coords!.vara), T(coords!.nakshatra), T(coords!.yoga), T(coords!.karana)]);
    lineParts.push([T(EVAM)]);
    // The kartṛ line always stands, gotra and name filled or not. An unfilled
    // one shows its slot — "(your gotra)" under the same dotted underline the
    // supplied text wears — because a reader who is not told the slot is there
    // cannot know to fill it, and a link shared with the slots empty has to
    // arrive looking like an invitation rather than like a finished sentence.
    {
      const g = (opts.gotra || '').trim();
      const n = (opts.name || '').trim();
      const kartr: Part[] = [];
      kartr.push(g ? F(g) : PH('(your gotra)'), T(GOTROTPANNAH));
      kartr.push(n ? F(n) : PH('(your name)'), T(NAMA));
      kartr.push(T(AHAM));
      lineParts.push(kartr);
    }
  }

  // mama upātta-… śrī-[devatā]-prīty-arthaṃ
  lineParts.push([T(RESOLVE_PRE), T(SRI), T(deity), T(PRITY_ARTHAM)]);
  if (level !== 'simple') lineParts.push([T(kamana)]);
  // [frame] śrī-[devatā]-[karma] kariṣye ||
  const resolve: Part[] = [];
  if (level !== 'simple' && trad.frame.iast) resolve.push(T(trad.frame));
  resolve.push(T(SRI), T(deity), T(karma), T(KARISHYE), T(DANDA));
  lineParts.push(resolve);

  const verses: ChantVerse[] = [];
  const lines: { iast: string; deva: string }[] = [];
  lineParts.forEach((parts, i) => {
    const tokens = lineTokens(parts);
    if (!tokens.length) return;
    verses.push({ id: `sk-${i}`, tokens });
    lines.push({ iast: tokensToText(tokens, 'iast'), deva: tokensToText(tokens, 'deva') });
  });

  const section: ChantSection = { id: 'sankalpa', label: '', verses };
  const doc: ChantDoc = {
    title: 'Saṅkalpaḥ',
    titleForms: { iast: 'saṅkalpaḥ', devanagari: 'सङ्कल्पः', telugu: 'సఙ్కల్పః', tamil: 'ஸங்கல்பஃ' },
    sections: [section],
    // A composed module: nothing to play, and no per-word grammar table.
    features: { audio: false, grammar: false, translation: false },
    lineBreak: 'none',
  };

  return {
    iast: lines.map((l) => l.iast).join(' '),
    deva: lines.map((l) => l.deva).join(' '),
    lines,
    doc,
  };
}
