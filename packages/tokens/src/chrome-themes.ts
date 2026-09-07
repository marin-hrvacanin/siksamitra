/**
 * Chrome themes — how the INSTRUMENT looks.
 *
 * One of two independent axes. This one is the shell: the toolbar, the desk,
 * the panels, the status bar, the controls. The other axis is the DOCUMENT
 * (`document-themes.ts`) — the paper, its ink, its face, its leading.
 *
 * WHY TWO AXES. Asked for directly, and right on the merits: someone reading
 * for two hours wants a dim shell and a bright page; someone proofing for print
 * wants the reverse. Binding the two together forces a choice nobody should
 * have to make, and it is why "none of these is quite it" was the honest answer
 * to five fixed combinations. Six chrome themes and five document themes are
 * thirty combinations, and every one of them is a legal setting.
 *
 * Adding a theme is ONE ENTRY here. No component, no stylesheet, no conditional
 * anywhere names a theme — the generator emits a `[data-chrome="…"]` block per
 * entry and the app lists whatever it finds.
 *
 * Each theme declares both modes complete. A theme that only defined dark and
 * inherited light would be half a theme, and cascade order would decide what
 * the other half looked like.
 */

export interface ChromeMode {
  /** The window's ground — behind panels, around the desk. */
  readonly bg: string;
  /** A raised surface: toolbar, panel, dialog. */
  readonly raise: string;
  /** A sunk or pressed surface: an active control, a well. */
  readonly sunk: string;
  /** The desk a page sits on. Usually darker than `bg`. */
  readonly desk: string;
  readonly line: string;
  readonly lineSoft: string;
  readonly ink: string;
  readonly inkSoft: string;
  readonly inkMute: string;
  readonly accent: string;
  readonly accentHover: string;
  /** Text ON the accent. Contrast is checked by the theme gate. */
  readonly accentOn: string;
  readonly danger: string;
  /**
   * THE WINDOW'S TITLE BAR — its own colour, and the program's face.
   *
   * The bar we draw instead of the operating system's caption (see
   * `TitleBar.tsx`). A SURFACE, one step from the ribbon — not a brand banner:
   * the accent is for the thing being acted on, and a whole bar of it makes
   * every window in the program shout its own name. (It was a deep bronze
   * once. It was wrong.)
   *
   * `titleInk` is the text on it; the theme gate checks the contrast between
   * the two like any other pair.
   */
  readonly title: string;
  readonly titleInk: string;
}

export interface ChromeTheme {
  readonly id: string;
  readonly name: string;
  readonly note: string;
  /** Corner radius, in px. Small numbers; a tool is not a card. */
  readonly radius: number;
  /** Does a surface cast a shadow, or is it separated by a hairline alone? */
  readonly elevation: 'flat' | 'raised';
  /** The chrome face. A role name resolved in `fonts.ts`. */
  readonly face: 'inter' | 'plex' | 'sourceSans';
  /** Control height and text size, as a named step. */
  readonly scale: 'compact' | 'regular' | 'roomy';
  readonly light: ChromeMode;
  readonly dark: ChromeMode;
}

export const CHROME_THEMES: readonly ChromeTheme[] = [
  {
    id: 'shanta',
    name: 'Śānta',
    note: 'Warm, quiet, hairlines only. Saffron on the active thing and nowhere else.',
    radius: 4,
    elevation: 'flat',
    face: 'sourceSans',
    scale: 'roomy',
    light: {
      bg: '#f6f4f0', raise: '#fbfaf7', sunk: '#efece6', desk: '#eae6df',
      line: '#e4e0d8', lineSoft: '#eeebe4',
      ink: '#2f2c27', inkSoft: '#6b665d', inkMute: '#a29c92',
      accent: '#c8781f', accentHover: '#a86217', accentOn: '#fffdf9',
      danger: '#a8442f',
      title: '#eceae5', titleInk: '#2f2c27',
    },
    dark: {
      bg: '#1a1917', raise: '#211f1d', sunk: '#151412', desk: '#131211',
      line: '#2e2c28', lineSoft: '#252320',
      ink: '#eae6df', inkSoft: '#a8a29a', inkMute: '#736e67',
      accent: '#e2a44f', accentHover: '#f0bd6e', accentOn: '#1a1917',
      danger: '#e08069',
      title: '#191817', titleInk: '#e8e3d9',
    },
  },
  {
    id: 'palladio',
    name: 'Palladio',
    note: 'Neutral greys with a clean saffron. Dense, a lot on screen.',
    radius: 4,
    elevation: 'raised',
    face: 'plex',
    scale: 'compact',
    light: {
      bg: '#f2f2f5', raise: '#ffffff', sunk: '#e9e9ee', desk: '#e4e4e9',
      line: '#dddde1', lineSoft: '#e8e8ec',
      ink: '#1b1b1f', inkSoft: '#5c5c66', inkMute: '#9898a0',
      accent: '#bb7f2e', accentHover: '#a06a24', accentOn: '#ffffff',
      danger: '#c0392b',
      title: '#e6e6ea', titleInk: '#1b1b1f',
    },
    dark: {
      bg: '#111113', raise: '#1c1c1f', sunk: '#0c0c0e', desk: '#0a0a0b',
      line: '#333338', lineSoft: '#2a2a2e',
      ink: '#e8e8ec', inkSoft: '#a0a0a8', inkMute: '#666670',
      accent: '#dcab63', accentHover: '#e9bd7e', accentOn: '#1b1b1f',
      danger: '#f87171',
      title: '#161618', titleInk: '#e8e8ec',
    },
  },
  {
    id: 'shanta-cool',
    name: 'Śānta cool',
    note: 'Śānta\'s calm on a neutral grey ground. The saffron reads brighter here.',
    radius: 4,
    elevation: 'flat',
    face: 'sourceSans',
    scale: 'roomy',
    light: {
      bg: '#f1f2f4', raise: '#fafbfc', sunk: '#e7e9ec', desk: '#e4e6ea',
      line: '#dfe2e6', lineSoft: '#eaecef',
      ink: '#1d1f22', inkSoft: '#5b6068', inkMute: '#949aa2',
      accent: '#c8781f', accentHover: '#a86217', accentOn: '#ffffff',
      danger: '#b3402c',
      title: '#e9ebee', titleInk: '#1d1f22',
    },
    dark: {
      bg: '#16181a', raise: '#1d2022', sunk: '#111314', desk: '#101112',
      line: '#2b2e31', lineSoft: '#212426',
      ink: '#e7e9ec', inkSoft: '#a3a9b0', inkMute: '#6e747b',
      accent: '#e2a44f', accentHover: '#f0bd6e', accentOn: '#16181a',
      danger: '#e08069',
      title: '#171a1c', titleInk: '#e6e9ec',
    },
  },
  {
    id: 'bhurja',
    name: 'Bhūrja',
    note: 'Ivory and umber with a rust accent. Warm without being anyone else\'s warm.',
    radius: 3,
    elevation: 'raised',
    face: 'sourceSans',
    scale: 'regular',
    light: {
      bg: '#eeeae1', raise: '#f7f4ee', sunk: '#e4dfd3', desk: '#ddd6c8',
      line: '#d6cfc0', lineSoft: '#e2dccf',
      ink: '#2c2419', inkSoft: '#5f5445', inkMute: '#95897a',
      accent: '#a2542a', accentHover: '#8a4522', accentOn: '#fdfbf7',
      danger: '#a63a2f',
      title: '#ece5d9', titleInk: '#2c2419',
    },
    dark: {
      bg: '#1a1611', raise: '#241f18', sunk: '#12100c', desk: '#0e0c09',
      line: '#3a3227', lineSoft: '#2c261e',
      ink: '#ece5d8', inkSoft: '#b3a894', inkMute: '#7b7263',
      accent: '#d98b5a', accentHover: '#e8a273', accentOn: '#1a1611',
      danger: '#e0705f',
      title: '#1b1712', titleInk: '#efe4d6',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    note: 'Near-monochrome, one teal accent, sharp and flat. Gives the marks the most room.',
    radius: 2,
    elevation: 'flat',
    face: 'inter',
    scale: 'compact',
    light: {
      bg: '#eef1f4', raise: '#ffffff', sunk: '#e3e8ed', desk: '#dde3e9',
      line: '#d3dae1', lineSoft: '#e2e7ec',
      ink: '#16202a', inkSoft: '#4a5a69', inkMute: '#8a99a8',
      accent: '#0f766e', accentHover: '#0c5f59', accentOn: '#ffffff',
      danger: '#b91c1c',
      title: '#e6eaee', titleInk: '#16202a',
    },
    dark: {
      bg: '#0f1418', raise: '#171e24', sunk: '#0a0e11', desk: '#080b0d',
      line: '#2a343d', lineSoft: '#1f272e',
      ink: '#e6edf3', inkSoft: '#9fb0be', inkMute: '#6b7c8a',
      accent: '#2dd4bf', accentHover: '#5eead4', accentOn: '#0f1418',
      danger: '#f87171',
      title: '#121820', titleInk: '#dfe7ee',
    },
  },
  {
    id: 'nirnaya',
    name: 'Nirṇaya',
    note: 'Charcoal shell, saffron accent — the page is the only bright thing on screen.',
    radius: 6,
    elevation: 'raised',
    face: 'inter',
    scale: 'regular',
    light: {
      bg: '#2b2f36', raise: '#353a43', sunk: '#22262c', desk: '#1c1f24',
      line: '#454b55', lineSoft: '#3a4049',
      ink: '#eceef1', inkSoft: '#b3b9c2', inkMute: '#7d848e',
      accent: '#e8a33d', accentHover: '#f2b357', accentOn: '#22262c',
      danger: '#f08a7a',
      title: '#2b3038', titleInk: '#eceef1',
    },
    dark: {
      bg: '#15171b', raise: '#1e2126', sunk: '#0e1013', desk: '#090a0c',
      line: '#2e3238', lineSoft: '#24272c',
      ink: '#e7e9ec', inkSoft: '#a5abb4', inkMute: '#6e747d',
      accent: '#e8a33d', accentHover: '#f2b357', accentOn: '#15171b',
      danger: '#f87171',
      title: '#131619', titleInk: '#eceef1',
    },
  },
];

export const DEFAULT_CHROME = 'palladio';

export type ChromeThemeId = string;

export function chromeTheme(id: ChromeThemeId): ChromeTheme {
  const found = CHROME_THEMES.find((t) => t.id === id);
  if (found === undefined) {
    throw new Error(
      `unknown chrome theme "${id}" — one of ${CHROME_THEMES.map((t) => t.id).join(', ')}`,
    );
  }
  return found;
}
