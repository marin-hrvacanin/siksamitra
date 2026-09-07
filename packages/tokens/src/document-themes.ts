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
 */

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
}

export interface DocumentTheme {
  readonly id: string;
  readonly name: string;
  readonly note: string;
  /** The text face, by role name — resolved in `fonts.ts`. */
  readonly face: 'gentium' | 'garamond' | 'sourceSerif' | 'crimson';
  /** Line height. A marked verse needs more than prose: the marks sit outside
   *  the line box, and a tight leading collides them with the line above. */
  readonly leading: number;
  /** Reading size, in rem at zoom 1. */
  readonly size: number;
  readonly light: DocumentMode;
  readonly dark: DocumentMode;
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
