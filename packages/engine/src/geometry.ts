/**
 * Mark geometry — one home, three renderers (web CSS, the PDF writer, PPTX).
 *
 * THE FRAME IS CONSTANT, NOT INK-MEASURED.
 * `docs/MARKING-RULES.md` §2.4 specifies a box measured from each glyph's ink,
 * and `client/src/components/chant/holdBox.ts` implements that measurement —
 * but it was TRIED AND REVERTED. `chant.css` carries the decision:
 *
 *   "CONSTANT frame on purpose: every box on a line is the same height, so the
 *    marks keep a steady rhythm. Sizing per-glyph ink was tried and reverted —
 *    it made every box a different height, which the owner rejected on sight."
 *
 * So these are the SHIPPED constants. Do not "restore" the ink measurement: it
 * is a rejected design, not a regression. `holdBoxEm` below keeps the ink
 * arithmetic in one place in case the decision is ever revisited; nothing reads
 * it today.
 *
 * The one part of §2.4 that IS an unfixed defect is the stroke-weight unit: the
 * reader ships 1px / 1.7px, so at the largest font scale (--fs: 1.8) both
 * become a hairline and the only cue distinguishing a short from a long stop
 * disappears. `holdStroke` is therefore in em, with a 1px floor.
 *
 * See specs/chant-editor/02-ENGINE.md §10 and 06-SINGLE-SOURCE.md §3.2.
 */

export const MARK_GEOMETRY = {
  /**
   * The constant frame: padding INSIDE the box, in em. Asymmetric on purpose —
   * descenders need the extra .02em below.
   */
  holdPad: { top: 0.1, x: 0.07, bottom: 0.12 },
  /**
   * Space AROUND the box, in em, so a thin frame reads as a mark ON a letter
   * rather than as part of its neighbours. Equal for short and long: weight is
   * the only cue that distinguishes them.
   */
  holdMargin: 0.03,
  /**
   * Long vs short differ by STROKE WEIGHT ONLY — never size, never spacing.
   * Ratio 2.34, in em, with a px floor so a short box never fades below one
   * device pixel at the smallest sizes.
   */
  holdStroke: { short: 0.032, long: 0.075, minPx: 1 },
  /** Corner radius — a TOKEN reference, never a literal (06 §3.1). */
  holdRadius: 'var(--radius-sm)',
  /**
   * Svara strokes above the letter. Whole-pixel width renders crisply; a
   * fractional width (2.4px) antialiases differently per glyph position and
   * reads as "some thicker, some thinner".
   */
  svaraStroke: {
    widthPx: 3,
    height: 0.34,
    top: -0.36,
    /** Offset of each stroke of a dīrgha-svarita from centre, in px. */
    dirghaSepPx: 3.5,
    radiusPx: 1.5,
  },
  /** The anudātta rule below the letter. */
  anudattaRule: { thickness: 0.035, drop: 0.14 },
  /** The svarabhakti dot — always OUTSIDE the holding box. */
  sbhaktiDot: { r: 0.055, gap: 0.05 },
  /**
   * PowerPoint already shrinks a raised run to ~2/3, so the layout compensates
   * rather than the font size. Fitted against PowerPoint's own rendering.
   */
  supScale: 0.668,
} as const;

/** Ink metrics as a canvas `TextMetrics` reports them, normalised to em. */
export interface InkMetrics {
  /** Ink above the baseline. */
  inkTop: number;
  /** Ink below the baseline. */
  inkBot: number;
  /** Ink left of the origin. */
  inkLeft: number;
  /** Ink right of the origin. */
  inkRight: number;
  /** The advance width. */
  advance: number;
  /** Font ascent / descent, which locate the element's own content box. */
  fontAscent: number;
  fontDescent: number;
}

/** The four box edges, as offsets in em from the host element's content box. */
export interface HoldBoxEdges {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * The ink-measured box arithmetic — the REJECTED design, kept in one place.
 *
 * At `line-height: 1` the content box is 1 em tall, so the half-leading that
 * positions the baseline inside it is `(1 - (ascent + descent)) / 2`. Negative
 * offsets mean "outside the content box", which is the normal case.
 *
 * Not wired to any stylesheet. See the file header.
 */
export function holdBoxEm(m: InkMetrics, air = 0.1, airX = 0.07): HoldBoxEdges | null {
  if (!Number.isFinite(m.inkTop) || !Number.isFinite(m.inkBot)) return null;
  const fb = m.fontAscent + m.fontDescent;
  if (!(fb > 0)) return null;
  const half = (1 - fb) / 2;
  return {
    top: m.fontAscent + half - (m.inkTop + air),
    bottom: m.fontDescent + half - (m.inkBot + air),
    left: -(m.inkLeft + airX),
    right: m.advance - (m.inkRight + airX),
  };
}

/**
 * The holding stroke width for a CSS `box-shadow: inset`, as a CSS length that
 * respects the px floor. `max()` is supported everywhere the app runs.
 */
export function holdStrokeCss(kind: 'short' | 'long'): string {
  const em = MARK_GEOMETRY.holdStroke[kind];
  return `max(${MARK_GEOMETRY.holdStroke.minPx}px, ${em}em)`;
}
