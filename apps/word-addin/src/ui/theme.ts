/**
 * WHICH MODE THE PANE IS IN — Word's, not the browser's.
 *
 * The pane is a web page inside Word, and a web page's `prefers-color-scheme`
 * is the OPERATING SYSTEM's setting. Word has its own: a dark Word on a light
 * Windows is common, and the pane used to be light inside it. So Word is asked
 * first. `Office.context.officeTheme` is the host's own palette — measured in
 * Word on the web: `bodyBackgroundColor: #1B1A19` in dark mode — and its body
 * background's luminance decides. Only a host that does not report a theme
 * falls back to the media query.
 *
 * WHY IT IS POLLED. `OfficeThemeChanged` is documented for Outlook only; no
 * Word host promises the event. Reading four colours every two seconds costs
 * nothing, and a pane that follows a theme switch without being reopened is
 * the requirement (spec: "The theme changes while the pane is open").
 */

export type Mode = 'light' | 'dark';

/** The part of `Office.context.officeTheme` this reads. */
export interface HostTheme {
  bodyBackgroundColor?: string;
}

/** Relative luminance of `#rrggbb` (WCAG), or null for anything else. */
export function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (m === null) return null;
  const n = Number.parseInt(m[1]!, 16);
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255)
    + 0.0722 * channel(n & 255);
}

/**
 * The mode: from Word's body colour when Word reports one, otherwise from the
 * system preference. A background is dark when white text on it would read
 * better than black — the WCAG crossover, luminance ≈ 0.179.
 */
export function modeOf(host: HostTheme | null | undefined, systemDark: boolean): Mode {
  const l = host?.bodyBackgroundColor === undefined ? null : luminance(host.bodyBackgroundColor);
  if (l === null) return systemDark ? 'dark' : 'light';
  return l < 0.179 ? 'dark' : 'light';
}

/** How often the host's theme is re-read. */
export const THEME_POLL_MS = 2000;
