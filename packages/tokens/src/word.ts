/**
 * The Veda Union Word document, measured — the values a page has to match to
 * be 1:1 with the owner's own `.docx` and the PDF printed from it.
 *
 * NOT A LOOKALIKE. Every number here was read out of
 * `tools/chant/templates/vu-word-template.docx`, which is built from
 * `Veda Union Youth Wing sAdhanA v1.0.1 IAST (1).docx` — his file, 845
 * paragraphs, 22 586 runs. Word stores sizes in HALF-POINTS, line spacing in
 * TWENTIETHS of a point, indents in TWIPS and border weights in EIGHTHS of a
 * point, so each is converted once, here, with the raw value beside it.
 *
 * THIS IS THE ONE SOURCE. `packages/interop/src/word-styles.ts` reads the
 * colours from here rather than repeating them, and the `word` document theme
 * is generated from the same table — so the exporter, the importer and the
 * on-screen page cannot drift apart. That is what makes "1:1" a test rather
 * than an opinion.
 *
 * WHY THE FACES ARE SUBSTITUTES. Arial, Calibri and Times New Roman are not
 * redistributable, and a face requested and not found does not error — it
 * silently substitutes, and then the line breaks somewhere else. Arimo, Tinos
 * and Carlito are METRIC-COMPATIBLE with those three: same advance widths at
 * the same point size, so the same text occupies the same space and wraps in
 * the same place. That is the property 1:1 needs; identical outlines are not
 * available at any price.
 */

import { fromEighths, fromHalfPoints } from './word-units.js';

export { fromEighths, fromHalfPoints, fromTwips } from './word-units.js';

export * from './word-paragraphs.js';
import { WORD_AUTO_LEADING } from './word-paragraphs.js';




/**
 * The mark palette, and the two border weights.
 *
 * These are the character styles of his file, so a holding on screen is the
 * same green at the same weight as the one Word prints. The two holding
 * weights are the ONLY difference between a short and a long box — 0.25 pt
 * against 1.5 pt — which is why they are recorded to the eighth of a point.
 */
/**
 * THE FAMILY A MARK IS SET IN, and why it is a name and not a face slot.
 *
 * A mark's family is a measured property of HIS vocabulary, exactly as its
 * colour is: `Svara` is URW Palladio ITU and bold in every one of his files
 * and in the template in this repository, while the paragraph it sits in is
 * Arial. The accents are deliberately set in another face.
 *
 * This was missing entirely — `ink()` wrote a colour and a size and no
 * `<w:rFonts>` at all — so every svara in every document we exported inherited
 * Arial from `Translit`. That is the owner's report, word for word: "the
 * Svaras are rendered in a different font than originally".
 *
 * A theme does not override it today, because `DocumentMode` has a colour per
 * mark and no face. When one wants to, it grows a slot, the same way the
 * colours did.
 */
const MARK_FACES = {
  /** What `Svara` and `VedicAnusvara` are set in. Not vendored: his file names
   *  it, so ours names it, and Word substitutes on a machine without it —
   *  which is exactly what happens when he opens his own file elsewhere. */
  palladio: 'URW Palladio ITU',
  /** `Virama`, which shares the svara's colour and size but not its face. */
  arial: 'Arial',
  /** Every daṇḍa of his, in every mantra line of all six reference documents:
   *  direct formatting on the run, `w:hint="cs"`. Arial has no daṇḍa, so
   *  without it Word falls back to whatever face it finds. */
  mangal: 'Mangal',
  /** `Long` — the Ṛgvedic overline. Measured off his template. */
  calibriLight: 'Calibri Light',
} as const;


export const WORD_MARKS = {
  /** `Holding` — `w:bdr w:sz="2"`. */
  holdShort: { color: '538135', weight: fromEighths(2) },
  /** `2Holding` — `w:bdr w:sz="12"`. */
  /* 1 pt, `w:sz="8"`, in all three of his documents measured (the Lalitā
     v9.3.1, the Śivopāsana v2, the Kanakadhārā v1.3). The template this was
     first read from says 12; his documents are what a page must look like. */
  holdLong: { color: '538135', weight: fromEighths(8) },
  /** `Svara` — URW Palladio ITU, BOLD, 18 pt, #943634. All four measured. */
  svara: { color: '943634', size: fromHalfPoints(36), face: MARK_FACES.palladio, bold: true },
  /** `Virama` — the svara's colour and size, Arial, and not bold. */
  virama: { color: '943634', size: fromHalfPoints(36), face: MARK_FACES.arial },
  /** `Anusvara` — the letter actually recited. No face of its own. */
  change: { color: '0070C0', italic: true },
  /** `VedicAnusvara` — the same colour, set in Palladio. */
  vedicChange: { color: '0070C0', italic: true, face: MARK_FACES.palladio },
  /** `Pause` — the LONG pause, one red bar. The short one is one bar in the
   *  `Anusvara` blue: colour is length (the owner, 2026-10-01). */
  pause: { color: 'C00000', italic: true },
  /** A daṇḍa — no style, only a face. See `MARK_FACES.mangal`. */
  danda: { face: MARK_FACES.mangal },
  /** `Long` — the dīrgha overline (unresolved, 00 §5.1). */
  dirgha: { color: '4472C4', size: fromHalfPoints(36), face: MARK_FACES.calibriLight },
  /** `Comment` — a source note under a section. Times New Roman in his file. */
  comment: { color: '808080', size: fromHalfPoints(22), italic: true },
  /**
   * `Reference` — OURS, and it replaces two of his that had no home.
   *
   * THE QUESTION THE OWNER ASKED. His template carries `Name` and `Nma`, both
   * of them "a little superscripted number in texts like LS where we want to
   * have shlokas, but within the shlokas we are counting something... so
   * barely visible little info next to the word" — one for the recitation
   * text and one for the translation. His own reading of that: "it seems a
   * bit ridiculous to have a separate style for every single use case,
   * right?... we can just add our own (more general) style, such as
   * `reference`".
   *
   * He is right, and the format already agreed with him: `sup` is one
   * marking, "a superscript after the range", and one marking wants one
   * style. So this is that style, `Name` and `Nma` are both READ as it, and
   * nothing writes either of them again.
   *
   * IT LOOKS LIKE HIS RAISED AID: the substitution blue, italic, raised. It
   * was the theme's grey, chosen on the premise that a `sup` is a counting
   * number — and in his files it almost never is. Measured over the six
   * reference documents: every `sup` but a handful is a READING AID (`ṁ^u`,
   * `ḥ^f`, `jñ^g`), and he writes every one of those as `Anusvara` with
   * `w:vertAlign="superscript"` — blue, italic, raised. So re-marking one of
   * his lines turned 712 of his raised letters grey. His `Name` and `Nma` are
   * that blue as well. One look for one marking, and it is his.
   *
   * NO SIZE OF ITS OWN. `w:vertAlign="superscript"` already scales a run to
   * about two thirds, which is what his raised aids are; his `Nma` also asks
   * for 6 pt, which superscripted is smaller than the paper can print.
   */
  /** The theme's `change` ink, which is `Anusvara`'s — see `char-styles.ts`. */
  reference: { ink: 'change', italic: true, superscript: true },
} as const;

/**
 * The page.
 *
 * The template carries no `sectPr` in `document.xml`, so Word applies the
 * document defaults — and those are NOT one inch. Measured off his own PDF
 * (`Veda Union sAdhanA v9.1.4 IAST.pdf`, A4 595 x 842 pt): every mantra line
 * that starts at the margin starts at x = 70.9 pt, which is 25 mm. An inch
 * would be 72. It matters because the text column is what a line has to fit
 * in, so a 1.1 pt error per side moves where a long pāda wraps — and
 * `packages/layout` had 25 mm all along, so the two disagreed.
 */
/*
 * HOW WIDE A MANTRA LINE MAY RUN BEFORE IT IS DIVIDED, as a share of the
 * column a hanging line has (454 pt). His own lines run close to it when they
 * fit — his bhū sūktam 1's second line is 434 pt — so a line that fits is his
 * and stays; one that would wrap is divided EVENLY where it is written
 * (`fitLine`, `packages/layout`), never filled and left with a stub: his
 * ruling, 2026-10-02, "no need to fill the entire line". The share below one
 * leaves room for what the text does not carry and the page draws — the
 * holding boxes' borders, the raised reading aids.
 */
export const MANTRA_LINE_FILL = 0.97;

export { MANTRA_ADVANCE, MANTRA_ADVANCE_FALLBACK } from './mantra-widths.js';

export const WORD_PAGE = {
  size: 'a4',
  /** 25 mm, as his PDF measures — `1417` twips, Word's own default. */
  marginPt: 1417 / 20,
  /** A4's width in points, as Word writes it (`w:pgSz w:w="11906"` twips). */
  widthPt: 11906 / 20,
  /**
   * The text column the screen themes' fluid type is measured against, in
   * points: A4 less 25 mm each side. His files' own sheet is narrower at the
   * right (`PAGE_SIZES.a4` in the layout package, 9 mm) — this is a reference
   * width for type on a screen, not the page's margins.
   *
   * Here because it is what a document line actually has to fit in, and the
   * screen themes' fluid mantra size is expressed against it — the line reaches
   * its full reading size at a full page's column and gives up size below that,
   * rather than at whatever width a card in the platform's reader happened to
   * be.
   */
  contentPt: 11906 / 20 - 2 * (1417 / 20),
  /** Calibri 11 pt, `w:sz="22"` in `docDefaults`. */
  bodySize: fromHalfPoints(22),
  /** `w:line="259" w:lineRule="auto"` — 1.08 lines. One definition, above. */
  bodyLeading: WORD_AUTO_LEADING,
} as const;

/** A Word colour (`538135`) as CSS (`#538135`). */
export const wordColor = (hex: string): string => `#${hex.toLowerCase()}`;

/**
 * The face each Word family is stood in for by, metric-compatible.
 *
 * Arimo, Tinos and Carlito are the Croscore faces: same advance widths as
 * Arial, Times New Roman and Calibri at the same point size, and OFL, so they
 * can travel inside the installer. The full CSS stacks are in `fonts.ts`, and
 * they name his original FIRST — `fonts/`, licensed by him, where the page is
 * printed — so there the page is literally his, and elsewhere metrically so.
 */
export const WORD_SUBSTITUTES = {
  sans: { of: 'Arial', use: 'Arimo' },
  serif: { of: 'Times New Roman', use: 'Tinos' },
  ui: { of: 'Calibri', use: 'Carlito' },
} as const;

/* His `Title`, his `Normal` line, and his running head: `word-furniture.ts`. */
export * from './word-furniture.js';
export * from './word-metrics.js';

/* The ribbon's own values and Devanāgarī's are files of their own (this one
   was over the 400-line limit); re-exported, so every import stays `tokens/word`. */
export * from './word-ribbon.js';
export * from './word-devanagari.js';
