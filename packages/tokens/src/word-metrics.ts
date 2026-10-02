/**
 * HOW WORD LAYS A LINE OUT WITH HIS FACES — out of `word.ts` at the module
 * gate, which re-exports all of it.
 */

/**
 * THE VERTICAL METRICS OF HIS TWO FACES, as Word lays a line out with them —
 * ascent, descent and line gap, in ems, from the fonts' own tables. Arimo and
 * Tinos are metric-compatible with Arial and Times New Roman by design, so
 * these are both his faces' and ours.
 *
 * WHERE WORD PUTS THE TEXT IN ITS LINE, measured on his sādhanā against the
 * PDF Word printed from it: in an EXACT line the baseline is at four fifths of
 * the line, whatever the face (a comment on a mantra line and the mantra line
 * after it are exactly 24 pt apart); in an AUTOMATIC one the line gap is above
 * the ascent and the multiple's extra below the descent. CSS centres the text
 * in its line instead, and `wordScale` turns the difference into a shift.
 */
export const WORD_FACE_METRICS = {
  sans: { ascent: 1854 / 2048, descent: 434 / 2048, gap: 67 / 2048 },
  serif: { ascent: 1825 / 2048, descent: 443 / 2048, gap: 87 / 2048 },
  /**
   * MANGAL, which sets his daṇḍas, as WORD lays a line out with it — not read
   * from the font, which may not be shipped, but measured off his pages: a
   * heading or a head holding a daṇḍa sits 0.25 em lower than one without, and
   * its line runs 0.27 em deeper. Its ascent here includes its line gap.
   */
  mangal: { ascent: 1.17, descent: 0.49, gap: 0 },
} as const;

/** Where Word sets the baseline in an exactly spaced line, from its top. */
export const WORD_EXACT_BASELINE = 0.8;
