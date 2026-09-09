/**
 * Word's units, and the two conversions everything here shares.
 *
 * Split out of `styles.ts` at the 400-line module gate so the paragraph
 * stylesheet and the character stylesheet can both read them without one
 * importing the other.
 *
 *   `w:sz`      HALF-points        16 pt -> 32
 *   `w:line`    TWENTIETHS of a pt 24 pt -> 480
 *   `w:ind`     TWIPS              14.2 pt -> 284
 *   `w:bdr sz`  EIGHTHS of a pt    0.75 pt -> 6
 */

/** 1 rem is 12 pt — the identity `document-type.ts` is written in. */
export const PT_PER_REM = 12;
export const halfPoints = (rem: number): number => Math.round(rem * PT_PER_REM * 2);
export const twips = (rem: number): number => Math.round(rem * PT_PER_REM * 20);
export const eighths = (pt: number): number => Math.round(pt * 8);
/** A CSS reference pixel is 1/96 in and a point is 1/72 in. */
export const PT_PER_PX = 72 / 96;

/** `#7f7f7f` as Word writes it. */
export function wordHex(css: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(css.trim());
  if (m === null) throw new Error(`cannot write "${css}" as a Word colour`);
  return m[1]!.toUpperCase();
}

export const channels = (hex: string): [number, number, number] => {
  const h = wordHex(hex);
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
};

/**
 * The four face slots a theme resolves to, as Word family names.
 *
 * Written out rather than inferred from `familiesOf`, so this module does not
 * have to import the one that imports it.
 */
export interface Families {
  readonly text: string;
  readonly display: string;
  readonly serif: string;
  readonly ui: string;
}
