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
import { WORD_MARKS } from '@siksamitra/tokens/word';
import type { ChantSvara } from '@siksamitra/format';

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
  | 'name'
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
    id: '2Holding', role: 'hold-long', border: { sz: 12, color: '538135' }, seen: 997,
    note: 'a thicker box — 1.5pt. Weight is the ONLY difference from Holding.',
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
    id: '2HoldingChange', role: 'hold-long-change', border: { sz: 12, color: '538135' },
    color: '0070C0', italic: true, seen: 0,
    note: 'a thick box round a letter that is also a substitution',
  },
  {
    id: 'VedicAnusvara', role: 'gum', color: WORD_MARKS.change.color, italic: true, seen: 64,
    note: 'base m + candra, the following g-run becomes the reading aid',
  },
  {
    id: 'Pause', role: 'pause', color: WORD_MARKS.pause.color, italic: true, seen: 119,
    note: 'ONE style for both lengths — the glyph count decides: | short, || long',
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
  { id: 'Name', role: 'name', color: '0070C0', seen: 0, note: 'UNRESOLVED (00 §5.1)' },
  { id: 'Nma', role: 'name', color: '0070C0', sz: 12, italic: true, seen: 0, note: 'UNRESOLVED' },
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
  { id: 'Prijevod', role: 'translation', seen: 197, note: 'Croatian for "translation"' },
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
  ...(['TOCHeading', 'TOC2', 'TOC3', 'Header', 'Footer', 'BalloonText', 'Revision'] as const)
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

/** The character style a held letter takes, given what else is on it. */
export function holdingStyle(hold: 'short' | 'long', change: boolean): string {
  const base = hold === 'long' ? '2Holding' : 'Holding';
  return change ? `${base}Change` : base;
}

/** The two marks a combined holding style carries. */
export const HOLD_CHANGE_ROLES: ReadonlySet<WordMarkRole> = new Set<WordMarkRole>([
  'hold-short-change', 'hold-long-change',
]);

/** The combining marks a `Svara` run carries, and what they mean. */
export const SVARA_BY_CHAR: ReadonlyMap<string, ChantSvara> = new Map([
  ['̍', 'svarita'],
  ['̎', 'dirgha-svarita'],
  ['̱', 'anudatta'],
]);

export const SVARA_CHAR: ReadonlyMap<ChantSvara, string> = new Map(
  [...SVARA_BY_CHAR.entries()].map(([c, m]) => [m, c]),
);

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
