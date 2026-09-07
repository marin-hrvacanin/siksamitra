/**
 * How a document names the profile that produced its marks.
 *
 * This lives in `format`, not in `engine`, and that placement is the whole
 * boundary in miniature. A document must be able to SAY which register it
 * belongs to — that is provenance, and provenance is format data. A consumer
 * that only renders (vedaunion.org) reads the name and never the rules.
 *
 * The patch is left generic on purpose. Its shape is the engine's `Profile`,
 * and typing it concretely here would drag the entire rule model into the one
 * package the platform is allowed to depend on. The engine re-exports a
 * specialised alias, so authoring code keeps full type safety and the platform
 * keeps a dependency it can actually afford.
 */

/** The registers the corpus actually uses. Document-level vocabulary. */
export type ChantProfileKey =
  | 'taittiriya'
  | 'rigveda'
  | 'sukla-yajurveda'
  | 'smarta'
  | 'prose';

/** What a profile reference looks like in a document (01 §2.1). */
export interface ChantProfileRef<Patch = Record<string, unknown>> {
  preset?: ChantProfileKey;
  patch?: Patch;
}

/**
 * WHAT EACH REGISTER IS, in words, for the people choosing between them.
 *
 * The rules differ by SOURCE — a Taittirīya text and a purāṇic stotra are
 * marked differently, and always were — and until now the program knew that
 * and never said it: five registers existed in the engine and nothing in the
 * interface named one, so a document was silently derived under whichever the
 * author of its file had happened to write down.
 *
 * These descriptions live beside the keys rather than in the editor because
 * they are DOCUMENT vocabulary: a reader (vedaunion.org) that renders a chant
 * and never derives one still has to be able to say which register produced
 * the marks it is showing.
 *
 * `where` names the texts, not the theory. Somebody choosing here is holding a
 * page and asking "which of these is what I have", and the answer that helps is
 * the list of things they might be holding.
 */
export interface ChantProfileNote {
  /** What it is called, as a person would say it. */
  readonly name: string;
  /** The texts this register covers. */
  readonly where: string;
  /** What the rules actually do differently. One sentence, no jargon. */
  readonly what: string;
}

export const CHANT_PROFILE_NOTES: Readonly<Record<ChantProfileKey, ChantProfileNote>> =
  Object.freeze({
    taittiriya: {
      name: 'Taittirīya',
      where: 'Kṛṣṇa Yajurveda — Puruṣa Sūktam, Śrī Rudram, Mantra Puṣpam, Viṣṇu Sūktam',
      what: 'Accents are taken from the source as written, and an anusvāra before '
        + 'a sibilant or h is shown as gṁ / gm.',
    },
    rigveda: {
      name: 'Ṛgveda',
      where: 'Ṛgvedic sūktas — Durgā Sūktam, Śrī Sūktam, Bhāgya Sūktam',
      what: 'Accents are taken from the source as written, and the anusvāra keeps '
        + 'its own form rather than becoming a g-form.',
    },
    'sukla-yajurveda': {
      name: 'Śukla Yajurveda',
      where: 'Vājasaneyi texts — Rudrāṣṭādhyāyī and the Mādhyandina recension',
      what: 'As Taittirīya, including the g-forms, over the Śukla recension’s '
        + 'own accentuation.',
    },
    smarta: {
      name: 'Smārta / purāṇic',
      where: 'Stotras, aṣṭakas, āgamic and purāṇic verse — Lalitā, Viṣṇu Sahasranāma',
      what: 'No accents are read from the source; the metre supplies them, the '
        + 'anusvāra is left as it is, and no semivowel aids are added.',
    },
    prose: {
      name: 'Prose',
      where: 'Saṅkalpa, nāmāvalīs, offerings and instructions',
      what: 'No accents at all, and the only pause is the one after a bīja.',
    },
  });

/** The registers, in the order they are offered. Taittirīya first: it is the default. */
export const CHANT_PROFILE_KEYS: readonly ChantProfileKey[] = Object.freeze([
  'taittiriya', 'rigveda', 'sukla-yajurveda', 'smarta', 'prose',
]);
