/**
 * The Word contract — ONE table, used by both the importer and the exporter, so
 * the two cannot disagree.
 *
 * THE COLOURS COME FROM `@siksamitra/tokens/word`, which is where they were
 * recorded. They used to be typed here as well, and a palette written down
 * twice is a palette that will disagree with itself — the on-screen `word`
 * document theme is generated from the same table, so "1:1 with the Word
 * document" is a property of one value rather than a coincidence between two.
 *
 * Measured from the owner's own file, not invented:
 * `Veda Union Youth Wing sAdhanA v1.0.1 IAST (1).docx` — 845 paragraphs,
 * 22 586 runs, 10 embedded fonts. Every value below was read out of its
 * `word/styles.xml`.
 *
 * See specs/chant-editor/03-INTEROP.md §2.
 */
import { WORD_DEVANAGARI, WORD_MARKS } from '@siksamitra/tokens/word';
import type { ChantSvara } from '@siksamitra/format';
import { MARK_CHAR, PLAN_MARK, typedAs, VIS } from '@siksamitra/engine';

/** What a character style means in the chant model. */
export type WordMarkRole =
  | 'hold-short'
  | 'hold-long'
  | 'hold-short-change'
  | 'hold-long-change'
  | 'svara'
  | 'virama'
  | 'change'
  | 'gum'
  | 'pause'
  | 'comment'
  | 'dirgha'
  /**
   * A little superscripted number beside a word — a counting mark.
   *
   * WAS `name`, WHICH SAID NOTHING. His template carries `Name` and `Nma`,
   * both of them UNRESOLVED and used nowhere in the corpus, and the owner
   * explained what they are: "a style for little superscripted number in
   * texts like LS where we want to have shlokas, but within the shlokas we
   * are counting something... so barely visible little info next to the
   * word", one for the recitation text and one for the translation. And then
   * asked the right question: "it seems a bit ridiculous to have a separate
   * style for every single use case, right?"
   *
   * It does. The format already has ONE marking for it — `sup`, "a
   * superscript after the range" — so his two styles are read as this one
   * role and it lands on the preceding letter's `sup`. We write ONE style,
   * `Reference`. See `WORD_MARKS.reference`.
   */
  | 'reference'
  /**
   * HIS DEVANĀGARĪ HOLDING: not a box but a small mark BEFORE the held akṣara
   * — U+0342 short, U+034C long — in his `Hold` (`WORD_DEVANAGARI`).
   */
  | 'hold-mark'
  /** A reading aid written visibly, as his Devanāgarī does, in his `Phonetic`. */
  | 'aid'
  | 'ignore';

export interface WordCharStyle {
  /** The `w:rStyle` value. */
  id: string;
  role: WordMarkRole;
  /** `w:color`, as Word writes it: six hex digits, no `#`. */
  color?: string;
  /** `w:sz`, in half-points. */
  sz?: number;
  italic?: boolean;
  /** `w:bdr` for the holding styles: `sz` is in EIGHTHS of a point. */
  border?: { sz: number; color: string };
  /** Runs seen in the reference file — the count an import must reproduce. */
  seen?: number;
  note?: string;
}

/**
 * Every character style in his file. `ignore` styles are Word's own linked
 * character styles and carry no meaning of ours.
 */
export const WORD_CHAR_STYLES: readonly WordCharStyle[] = [
  {
    id: 'Holding', role: 'hold-short', border: { sz: 2, color: '538135' }, seen: 2415,
    note: 'a thin box — 0.25pt',
  },
  {
    id: '2Holding', role: 'hold-long', border: { sz: 8, color: '538135' }, seen: 997,
    note: 'a thicker box — 1pt in his current files (the old template said 1.5pt). Weight is the ONLY difference from Holding.',
  },
  {
    id: 'Svara', role: 'svara', color: '943634', sz: 36, seen: 4677,
    note: 'the run\'s combining characters ARE the accent',
  },
  {
    id: 'Virama', role: 'virama', color: '943634', sz: 36, seen: 68,
    note: 'the U+02CE tick — kept as text, a coda of the syllable it closes',
  },
  {
    id: 'Anusvara', role: 'change', color: '0070C0', italic: true, seen: 1115,
    note: 'the letter actually recited; superscript when w:vertAlign says so',
  },
  /*
   * THE VISARGA CHANGE, told from the anusvāra's by what the letter IS.
   *
   * His file writes both in `Anusvara`: a replaced visarga (`ś s r`) is blue
   * italic exactly like a replaced anusvāra (`ṅ ñ n m`). By the sandhi rules
   * the two never produce the same letter — measured over all 971 of the
   * corpus's substitutions, no overlap (`typedAs` in the engine) — so the
   * writer can name each one for what it is and a reader loses nothing: both
   * are a change. Ours; the same ink as his, so the page does not move.
   */
  {
    id: 'Visarga', role: 'change', color: '0070C0', italic: true, seen: 0,
    note: 'OURS — a letter recited in place of a visarga',
  },
  /*
   * A LETTER CAN BE BOTH BOXED AND SUBSTITUTED, and a run carries exactly one
   * character style. Measured over the corpus: one verse has a held letter that
   * is also recited as another, and it printed as a plain black box — the
   * substitution simply disappeared. Two more styles cost nothing and are the
   * only way one run can say both things. They are OURS, not his: his file has
   * no such letter, which is why the pairing was never noticed.
   */
  {
    id: 'HoldingChange', role: 'hold-short-change', border: { sz: 2, color: '538135' },
    color: '0070C0', italic: true, seen: 0,
    note: 'a thin box round a letter that is also a substitution',
  },
  {
    id: '2HoldingChange', role: 'hold-long-change', border: { sz: 8, color: '538135' },
    color: '0070C0', italic: true, seen: 0,
    note: 'a thick box round a letter that is also a substitution',
  },
  {
    id: 'VedicAnusvara', role: 'gum', color: WORD_MARKS.change.color, italic: true, seen: 64,
    note: 'base m + candra, the following g-run becomes the reading aid',
  },
  {
    id: 'Pause', role: 'pause', color: WORD_MARKS.pause.color, italic: true, seen: 119,
    note: 'a LONG pause: one bar in his red (a short one is one bar in his blue `Anusvara`)',
  },
  /* HIS DEVANĀGARĪ'S OWN TWO — `śrī_kanakadhārā_…_Devanagari_joined.docx`. */
  {
    id: 'Hold', role: 'hold-mark', color: WORD_DEVANAGARI.hold.color, sz: WORD_DEVANAGARI.hold.size, seen: 335,
    note: 'the mark before a held akṣara: U+0342 short, U+034C long',
  },
  {
    id: 'Phonetic', role: 'aid', color: WORD_DEVANAGARI.aid.color, sz: WORD_DEVANAGARI.aid.size, seen: 38,
    note: 'a reading aid, visible: small raised Latin letters',
  },
  {
    id: 'Comment',
    role: 'comment',
    color: WORD_MARKS.comment.color,
    sz: 22,
    italic: true,
    seen: 167,
  },
  {
    id: 'Long', role: 'dirgha', color: WORD_MARKS.dirgha.color, sz: 36, seen: 12,
    note: 'UNRESOLVED — almost certainly the dīrgha overline (00 §5.1)',
  },
  /*
   * HIS TWO, AND OURS, ALL READ AS ONE THING. `Name` is the marker in the
   * recitation text and `Nma` the same marker in a translation; both are his,
   * both are `seen: 0` — defined in the template and used nowhere — and both
   * are a little superscripted counting number. `Reference` is what we write.
   */
  { id: 'Name', role: 'reference', color: '0070C0', seen: 0, note: 'his, in the mantra' },
  {
    id: 'Nma', role: 'reference', color: '0070C0', sz: 12, italic: true, seen: 0,
    note: 'his, the same marker in a translation',
  },
  {
    id: 'Reference', role: 'reference', color: '808080', seen: 0,
    note: 'OURS — one style for the one `sup` marking, superscripted',
  },
  // Word's own linked character styles — no meaning of ours.
  ...(['DefaultParagraphFont', 'HeaderChar', 'FooterChar', 'Heading1Char', 'Heading2Char',
    'Heading3Char', 'Heading4Char', 'Hyperlink', 'TranslitChar', 'TOC2Char',
    'BalloonTextChar'] as const).map((id) => ({ id, role: 'ignore' as const })),
];

export const CHAR_STYLE_BY_ID: ReadonlyMap<string, WordCharStyle> = new Map(
  WORD_CHAR_STYLES.map((s) => [s.id, s]),
);

/** The role a `w:rStyle` carries, or `null` for plain text. */
export function roleOf(rStyle: string | null): WordMarkRole | null {
  if (rStyle === null) return null;
  const s = CHAR_STYLE_BY_ID.get(rStyle);
  if (s === undefined) return null;
  return s.role === 'ignore' ? null : s.role;
}

/** What a paragraph style means structurally. */
export type WordParaRole =
  /** The document's title: Word's `Title`, or `Heading1`. A second one is a part. */
  | 'title'
  | 'verse-line'
  | 'translation'
  | 'part'
  | 'section'
  | 'step'
  | 'insert'
  | 'caption'
  | 'prose'
  | 'drop';

export interface WordParaStyle {
  id: string;
  role: WordParaRole;
  seen?: number;
  note?: string;
}

export const WORD_PARA_STYLES: readonly WordParaStyle[] = [
  { id: 'Translit', role: 'verse-line', seen: 434, note: 'the mantra lines' },
  { id: 'Source', role: 'verse-line', note: "ours: a section's source line, his Translit in every measure" },
  { id: 'Devanagari', role: 'verse-line', seen: 56, note: 'his mantra lines in Devanāgarī' },
  { id: 'Prijevod', role: 'translation', seen: 197, note: 'Croatian for "translation"' },
  { id: 'Title', role: 'title' },
  { id: 'Heading1', role: 'title' },
  { id: 'Heading2', role: 'part', seen: 13 },
  { id: 'Heading3', role: 'section', seen: 23 },
  { id: 'Heading4', role: 'step', seen: 42 },
  { id: 'Insert', role: 'insert', seen: 12, note: 'UNRESOLVED — candidate: an instruction' },
  /* Word's own built-in, and what we write a picture's caption in. His file
     has none — it has no pictures — so `seen` is absent rather than 0. */
  { id: 'Caption', role: 'caption', note: "a picture's caption" },
  { id: 'Normal', role: 'prose' },
  { id: 'NormalWeb', role: 'prose' },
  // A table of contents is regenerable; running furniture is not content.
  ...(['TOCHeading', 'TOC1', 'TOC2', 'TOC3', 'TOC4', 'Header', 'Footer', 'BalloonText', 'Revision'] as const)
    .map((id) => ({ id, role: 'drop' as const })),
];

export const PARA_STYLE_BY_ID: ReadonlyMap<string, WordParaStyle> = new Map(
  WORD_PARA_STYLES.map((s) => [s.id, s]),
);

export function paraRoleOf(pStyle: string | null): WordParaRole {
  if (pStyle === null) return 'prose';
  return PARA_STYLE_BY_ID.get(pStyle)?.role ?? 'prose';
}

/**
 * The glyph a BAR is written with, inside the `Pause` style.
 *
 * Not `|`. A bar and a short pause were both written as one pipe in one style,
 * so a Word round trip turned every one of the corpus's 59 bars into a pause —
 * measured over all 573 verses. A broken bar is a different character in the
 * same style: the same colour and weight on the page, and unambiguous coming
 * back. His own files contain no bar, so nothing of his is affected.
 */
export const BAR_GLYPH = '¦';

/** U+0305, the Ṛgvedic overline: in the letter in the model, in `Long` in Word. */
export const OVERLINE = '̅';

/** The character style a held letter takes, given what else is on it. */
export function holdingStyle(hold: 'short' | 'long', change: boolean): string {
  const base = hold === 'long' ? '2Holding' : 'Holding';
  return change ? `${base}Change` : base;
}

/** The character style a replaced letter takes: `Visarga` when what was typed
 *  was a visarga, `Anusvara` otherwise — his own style for both, before. */
export function changeStyle(letters: string): 'Anusvara' | 'Visarga' {
  return typedAs(letters) === VIS ? 'Visarga' : 'Anusvara';
}

/** The two marks a combined holding style carries. */
export const HOLD_CHANGE_ROLES: ReadonlySet<WordMarkRole> = new Set<WordMarkRole>([
  'hold-short-change', 'hold-long-change',
]);

/** The combining marks a `Svara` run carries, and what they mean — the
 *  engine's one table (`PLAN_MARK`), under the names this contract uses. */
export const SVARA_BY_CHAR: ReadonlyMap<string, ChantSvara> = PLAN_MARK;
export const SVARA_CHAR: ReadonlyMap<ChantSvara, string> = MARK_CHAR;

/**
 * The svara as a character in an INDIC script — AS HIS DEVANĀGARĪ WRITES IT:
 * the same combining marks as his IAST (U+0331 the line below, U+030D the
 * stroke above, U+030E the double stroke), in his `Svara` — Palladio — after
 * the akṣara (`WORD_DEVANAGARI`). Unicode's own Vedic signs (U+0952, U+0951,
 * U+1CDA) are what the add-in wrote before it had his file; they are still
 * READ, so a line written then reads as it did.
 */
export const SCRIPT_SVARA_CHAR: ReadonlyMap<ChantSvara, string> = MARK_CHAR;
const VEDIC_SIGNS: ReadonlyMap<ChantSvara, string> = new Map<ChantSvara, string>([
  ['svarita', '॑'], ['anudatta', '॒'], ['dirgha-svarita', '᳚'],
]);
export const SCRIPT_SVARA_BY_CHAR: ReadonlyMap<string, ChantSvara> = new Map([
  ...[...VEDIC_SIGNS.entries()].map(([m, c]) => [c, m] as const),
  ...[...SCRIPT_SVARA_CHAR.entries()].map(([m, c]) => [c, m] as const),
]);

/** The counts the reference file carries — an import must reproduce them
 *  exactly (gate W2, specs/chant-editor/03-INTEROP.md §2.6). */
export const REFERENCE_COUNTS = {
  file: 'Veda Union Youth Wing sAdhanA v1.0.1 IAST (1).docx',
  /** Paragraphs with an open/close pair. His file also carries ONE
   *  self-closing `<w:p/>`, which the regex these counts were first taken with
   *  could not match — hence 845 here and 846 total. */
  paragraphsWithBody: 845,
  paragraphs: 846,
  runs: 22586,
  byStyle: {
    Holding: 2415, '2Holding': 997, Svara: 4677, Anusvara: 1115,
    Comment: 167, Pause: 119, Virama: 68, VedicAnusvara: 64, Long: 12,
    Hyperlink: 69, none: 12883,
  } as Readonly<Record<string, number>>,
  byPara: {
    Translit: 434, Prijevod: 197, Heading2: 13, Heading3: 23, Heading4: 42,
    Insert: 12, TOCHeading: 1, TOC2: 13, TOC3: 24, default: 86,
  } as Readonly<Record<string, number>>,
} as const;
