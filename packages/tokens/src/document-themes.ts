/**
 * Document themes — how the PAGE looks.
 *
 * The second of the two axes. This one is the paper: its ground, its ink, its
 * face, its leading, its measure, and the colours of the marks. It is
 * independent of the chrome theme, so a dim shell around a bright page — or the
 * reverse — is a setting rather than a compromise.
 *
 * THE MARK COLOURS LIVE HERE, and that placement is deliberate. A holding box,
 * a svara stroke and a change-style letter belong to the document, not to the
 * tool: they have to be legible against THIS paper, and they have to stay
 * separable from each other. Putting them on the chrome axis would mean
 * switching the shell could make a svara vanish.
 *
 * Adding a theme is one entry. Nothing names a theme anywhere else.
 *
 * One theme is GENERATED rather than chosen: `word`, the Veda Union Word
 * document, whose every value is read from `word.ts`. See `wordTheme` below.
 */
import { WORD_MARKS, WORD_PARAGRAPHS, wordColor } from './word.js';
import { TEXT_FACES, WORD_FACES } from './fonts.js';
import { screenScale, wordScale, type DocTypeScale } from './document-type.js';


export interface DocumentMode {
  /** The paper. */
  readonly bg: string;
  readonly ink: string;
  /** Rules and hairlines on the page — a verse divider, a table line. */
  readonly line: string;
  /** Section headings and the document title. */
  readonly heading: string;
  /** Verse numbers, folios: present but not read. */
  readonly quiet: string;
  /* ── the marks ──────────────────────────────────────────────────────── */
  readonly hold: string;
  readonly holdLong: string;
  readonly svara: string;
  readonly change: string;
  readonly pauseShort: string;
  readonly pauseLong: string;
  /** Free text the reciter supplied, and the placeholder standing for it. */
  readonly fill: string;
  /**
   * The register a translation is set in: present, quieter than the mantra,
   * not as faint as a folio. Optional — the generator mixes one from the ink
   * and the paper when a theme does not name it, so a theme only states it
   * when the mix is wrong for that paper.
   */
  readonly soft?: string;
}

export interface DocumentTheme {
  readonly id: string;
  readonly name: string;
  readonly note: string;
  /** The text face, by role name — resolved in `fonts.ts`. */
  readonly face: 'gentium' | 'garamond' | 'sourceSerif' | 'crimson' | 'wordSans';
  /** Line height. A marked verse needs more than prose: the marks sit outside
   *  the line box, and a tight leading collides them with the line above. */
  readonly leading: number;
  /** Reading size, in rem at zoom 1. */
  readonly size: number;
  /**
   * Which TYPE SCALE this theme's elements are sized by.
   *
   * `screen` is the designed scale in `document-type.ts`, derived from `size`
   * and `leading`, with a mantra line that tracks its column. `word` is his
   * `.docx`, measured — fixed point sizes, a hanging indent, and no bold
   * anywhere. A theme states which it is; nothing else decides.
   */
  readonly scale: 'screen' | 'word';
  /**
   * Where a verse's number is printed.
   *
   * `inline` means the DOCUMENT prints it, inside the line, between daṇḍas —
   * which is what his file does, and why the page must not also put one in the
   * gutter. Rendering both was the second-most visible way our page was not
   * his: every verse carried its number twice.
   */
  readonly numbers: 'gutter' | 'inline';
  /**
   * The other faces, for a page set in more than one family.
   *
   * Each is optional and each falls back to the reading face (`ui` falls back
   * to the interface face), so a theme states only what it actually differs
   * in: his document needs Times for a translation and Calibri for a heading;
   * vedaunion.org needs its display face for headings and nothing else.
   */
  readonly faces?: {
    readonly display?: string;
    readonly serif?: string;
    readonly ui?: string;
  };
  readonly light: DocumentMode;
  readonly dark: DocumentMode;
}

/**
 * The Veda Union Word document, on screen.
 *
 * Every value comes from `word.ts`, which read them out of his own `.docx` —
 * nothing here is chosen. That is the point: this theme exists so that what
 * the author sees while editing is what the exported Word file and the PDF
 * printed from it will show, down to the green of a holding box and the 24 pt
 * leading of a mantra line.
 *
 * It has no dark mode of its own. A printed page is not dark, and a "dark VU
 * Word document" would be a different document — so the dark mode is the same
 * page, and the appearance menu says so.
 */
const wordTheme = (): DocumentTheme => {
  const line = WORD_PARAGRAPHS.find((p) => p.role === 'verse-line')!;
  const section = WORD_PARAGRAPHS.find((p) => p.role === 'section')!;
  const mode: DocumentMode = {
    // Word's page is white and its default text is black; `Translit` sets no
    // colour, so the mantra line is the document's own ink.
    bg: '#ffffff',
    ink: '#000000',
    line: '#d9d9d9',
    heading: wordColor(section.color ?? '7f7f7f'),
    quiet: wordColor(WORD_MARKS.comment.color),
    hold: wordColor(WORD_MARKS.holdShort.color),
    holdLong: wordColor(WORD_MARKS.holdLong.color),
    svara: wordColor(WORD_MARKS.svara.color),
    change: wordColor(WORD_MARKS.change.color),
    pauseShort: wordColor(WORD_MARKS.pause.color),
    pauseLong: wordColor(WORD_MARKS.pause.color),
    fill: wordColor(WORD_MARKS.comment.color),
  };
  return {
    id: 'word',
    name: 'Veda Union · Word',
    note: 'His own Word document, measured: Arial 16pt on 24pt exact leading, '
        + 'his holding green, his svara red. What the .docx and the PDF show.',
    face: 'wordSans',
    // His file sets a translation in Times italic and a heading in Calibri —
    // three families on one page, so the theme has to name the other two.
    faces: { serif: WORD_FACES.serif, ui: WORD_FACES.ui },
    scale: 'word',
    numbers: 'inline',
    // `w:line="480" w:lineRule="exact"` over `w:sz="32"`: 24pt on 16pt.
    leading: (line.leading ?? line.size) / line.size,
    // 16pt against the 16px root — the ratio Word's point size becomes on a
    // screen at zoom 1, so a page at 100% is a page at 100%.
    size: line.size / 12,
    light: mode,
    dark: mode,
  };
};

/**
 * A theme's type scale, resolved.
 *
 * ONE place decides, so the stylesheet, the generator and the fidelity gate all
 * read the same numbers. A theme names its scale; this turns that name into
 * metrics.
 */
export function typeScaleOf(theme: DocumentTheme): DocTypeScale {
  return theme.scale === 'word' ? wordScale() : screenScale(theme.size, theme.leading);
}

export const DOCUMENT_THEMES: readonly DocumentTheme[] = [
  {
    id: 'plain',
    name: 'Plain',
    note: 'White paper, black ink, Gentium. What a printed page looks like, and '
        + 'what the PDF will be.',
    face: 'gentium',
    leading: 1.95,
    size: 1,
    scale: 'screen',
    numbers: 'gutter',
    light: {
      bg: '#ffffff', ink: '#1b1b1f', line: '#e8e8ec',
      heading: '#1b1b1f', quiet: '#9898a0',
      hold: '#10b981', holdLong: '#ef4444', svara: '#c2410c', change: '#2563eb',
      pauseShort: '#2563eb', pauseLong: '#c2410c', fill: '#5c5c66',
    },
    dark: {
      bg: '#1c1c1f', ink: '#e8e8ec', line: '#2a2a2e',
      heading: '#e8e8ec', quiet: '#666670',
      hold: '#34d399', holdLong: '#f87171', svara: '#fb923c', change: '#7dd3fc',
      pauseShort: '#7dd3fc', pauseLong: '#fb923c', fill: '#a0a0a8',
    },
  },
  {
    id: 'warm',
    name: 'Warm',
    note: 'Off-white and dark brown, Crimson Pro, open leading. Easiest for a '
        + 'long sitting; the ground takes the glare off.',
    face: 'crimson',
    leading: 2.15,
    size: 1.05,
    scale: 'screen',
    numbers: 'gutter',
    light: {
      bg: '#fdfcf9', ink: '#26241f', line: '#ece8e0',
      heading: '#8a4a14', quiet: '#a29c92',
      hold: '#3d7a52', holdLong: '#a8442f', svara: '#c8781f', change: '#3f6f8f',
      pauseShort: '#3f6f8f', pauseLong: '#c8781f', fill: '#6b665d',
    },
    dark: {
      bg: '#211f1c', ink: '#ece8e1', line: '#2c2a26',
      heading: '#e2a44f', quiet: '#736e67',
      hold: '#6bbd83', holdLong: '#e08069', svara: '#e6a44f', change: '#82aecb',
      pauseShort: '#82aecb', pauseLong: '#e6a44f', fill: '#a8a29a',
    },
  },
  {
    id: 'manuscript',
    name: 'Manuscript',
    note: 'Ivory and umber, EB Garamond. The most bookish; wants the largest '
        + 'leading because Garamond sets small.',
    face: 'garamond',
    leading: 2.25,
    size: 1.1,
    scale: 'screen',
    numbers: 'gutter',
    light: {
      bg: '#fdfbf6', ink: '#241d14', line: '#e5dfd2',
      heading: '#8a4522', quiet: '#95897a',
      hold: '#3f7d4e', holdLong: '#a63a2f', svara: '#b4531c', change: '#2f6690',
      pauseShort: '#2f6690', pauseLong: '#b4531c', fill: '#5f5445',
    },
    dark: {
      bg: '#221d17', ink: '#efe8db', line: '#332c23',
      heading: '#d98b5a', quiet: '#7b7263',
      hold: '#6cbf7e', holdLong: '#e0705f', svara: '#f0a057', change: '#7fb6d9',
      pauseShort: '#7fb6d9', pauseLong: '#f0a057', fill: '#b3a894',
    },
  },
  {
    id: 'screen',
    name: 'Screen',
    note: 'Source Serif 4 at a tighter leading — built for screens, so more '
        + 'text fits without becoming hard to read.',
    face: 'sourceSerif',
    leading: 1.85,
    size: 1,
    scale: 'screen',
    numbers: 'gutter',
    light: {
      bg: '#ffffff', ink: '#131b23', line: '#e4e9ee',
      heading: '#0f766e', quiet: '#8a99a8',
      hold: '#0f766e', holdLong: '#b91c1c', svara: '#b45309', change: '#1d4ed8',
      pauseShort: '#1d4ed8', pauseLong: '#b45309', fill: '#4a5a69',
    },
    dark: {
      bg: '#161d23', ink: '#e8eff5', line: '#242d35',
      heading: '#2dd4bf', quiet: '#6b7c8a',
      hold: '#2dd4bf', holdLong: '#f87171', svara: '#fbbf24', change: '#60a5fa',
      pauseShort: '#60a5fa', pauseLong: '#fbbf24', fill: '#9fb0be',
    },
  },
  {
    id: 'high-contrast',
    name: 'High contrast',
    note: 'Maximum separation between ink, paper and every mark. For proofing, '
        + 'for poor light, and for anyone who needs it.',
    face: 'gentium',
    leading: 2.05,
    size: 1.05,
    scale: 'screen',
    numbers: 'gutter',
    light: {
      bg: '#ffffff', ink: '#000000', line: '#c8c8c8',
      heading: '#000000', quiet: '#5a5a5a',
      hold: '#006b3c', holdLong: '#a30000', svara: '#8a3500', change: '#00308f',
      pauseShort: '#00308f', pauseLong: '#8a3500', fill: '#3a3a3a',
    },
    dark: {
      bg: '#000000', ink: '#ffffff', line: '#454545',
      heading: '#ffffff', quiet: '#a8a8a8',
      hold: '#4ade80', holdLong: '#ff8080', svara: '#ffb347', change: '#8ab4ff',
      pauseShort: '#8ab4ff', pauseLong: '#ffb347', fill: '#d0d0d0',
    },
  },
  wordTheme(),
  /**
   * vedaunion.org, as the site actually sets a chant.
   *
   * The third view mode is "the platform's appearance", and until now that
   * mode pinned the `warm` theme — a lookalike. These are the site's own
   * values, carried over from the platform's token file: its vellum ground,
   * its violet-black ink, 1.15rem on 2.05, and Cormorant Garamond for a
   * heading over Gentium text. They lived in a dead `THEMES['vu-web']` patch
   * that nothing read, under token names that now collide with this axis —
   * which is exactly how a "preview of the site" drifts from the site.
   *
   * Its mark colours are the platform's, not this program's: a holding on
   * vedaunion.org is #4e7a3f, and a preview that recoloured it would be a
   * preview of nothing.
   */
  {
    id: 'vu-web',
    name: 'Veda Union · web',
    note: 'How vedaunion.org sets a chant: warm vellum, violet-black ink, '
        + 'Cormorant headings over Gentium, open leading. Its own values, not a lookalike.',
    face: 'gentium',
    faces: { display: TEXT_FACES.garamond },
    leading: 2.05,
    size: 1.15,
    scale: 'screen',
    numbers: 'gutter',
    light: {
      bg: '#faf7f0', ink: '#2a1b47', line: '#d5cfc1',
      heading: '#2a1b47', quiet: '#9a8fa8', soft: '#3a2862',
      hold: '#4e7a3f', holdLong: '#b23a2e', svara: '#b23a2e', change: '#3d6fb4',
      pauseShort: '#3d6fb4', pauseLong: '#b23a2e', fill: '#6b5c7e',
    },
    /* The site's own dark mode, from the same file. */
    dark: {
      bg: '#171226', ink: '#ece7f6', line: '#362c4e',
      heading: '#ece7f6', quiet: '#988cb2', soft: '#d3cae6',
      hold: '#86c06f', holdLong: '#f0836f', svara: '#f0836f', change: '#86a9e6',
      pauseShort: '#86a9e6', pauseLong: '#f0836f', fill: '#a89dc2',
    },
  },
];

export const DEFAULT_DOCUMENT = 'plain';

export function documentTheme(id: string): DocumentTheme {
  const found = DOCUMENT_THEMES.find((t) => t.id === id);
  if (found === undefined) {
    throw new Error(
      `unknown document theme "${id}" — one of ${DOCUMENT_THEMES.map((t) => t.id).join(', ')}`,
    );
  }
  return found;
}
