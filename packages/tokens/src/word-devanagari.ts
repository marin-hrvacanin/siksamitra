/**
 * HIS DEVANĀGARĪ — measured off his own file, not invented.
 *
 * `śrī_kanakadhārā_&_śiva_pañcākṣara_stotram_v1_3_Devanagari_joined.docx`
 * (the owner, 2026-10-01): 56 mantra paragraphs. In Devanāgarī a holding is
 * NOT a box round letters — a box round a conjunct falls apart on the page —
 * but a small raised green mark standing just before the akṣara whose
 * consonant is held: U+0342 for a short holding (206 in his file), U+034C for
 * a long one (129). Lined up verse by verse with his IAST Kanakadhārā, the
 * mark falls exactly where the IAST box does, before the cluster, and the
 * consonant inside it is the one the holding rule chooses.
 *
 * The accents are a run of their own after the akṣara, in his `Svara`; the
 * reading aids are visible, small raised Latin letters in his `Phonetic`.
 * Words are two spaces apart (220 of 220 word gaps), the IAST's hyphens are
 * not written (5 in the whole file), and the text is his document's default
 * face, Sanskrit 2003, at 16 pt on lines exactly 32 pt apart.
 */
export const WORD_DEVANAGARI = Object.freeze({
  /** The mantra paragraph: his `Devanagari` style over his document defaults. */
  paragraph: Object.freeze({
    style: 'Devanagari', face: 'Sanskrit 2003', size: 32, line: 640, indentLeft: 284, hanging: 284,
  }),
  /** His `Hold`: the mark before a held akṣara. */
  hold: Object.freeze({ style: 'Hold', face: 'Arial', color: '00B050', size: 22, raise: 12, short: '͂', long: '͌' }),
  /** His `Phonetic`: a reading aid, visible. */
  aid: Object.freeze({ style: 'Phonetic', color: '0070C0', size: 16, raise: 10 }),
  /** His `Svara` in Devanāgarī: the same face and ink as in IAST, 20 pt. */
  svara: Object.freeze({ size: 40 }),
  /** Spaces written for each space between words. */
  wordGap: 2,
});
