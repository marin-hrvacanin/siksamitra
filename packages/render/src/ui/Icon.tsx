/* =============================================================================
   Icon — the ONE icon primitive for the whole platform.
   Iconoir (MIT), 24×24, drawn with `currentColor` and a single stroke weight
   taken from the `--icon-stroke` design token (see index.css @theme). Never
   hand-draw an <svg> in a page/component again — add the glyph here and use
   <Icon name="…" />. Size defaults to 1em so an icon matches its text.
   ============================================================================= */
import type { CSSProperties } from "react";

/* Paths are the raw Iconoir "regular" glyph bodies (everything inside <svg>). */
const PATHS = {
  // navigation / chrome
  search: '<path d="M17 17L21 21"/><path d="M3 11a8 8 0 1 0 16 0 8 8 0 0 0-16 0Z"/>',
  menu: '<path d="M3 5h18M3 12h18M3 19h18"/>',
  xmark: '<path d="M6.76 17.24 12 12m5.24-5.24L12 12m0 0L6.76 6.76M12 12l5.24 5.24"/>',
  "nav-left": '<path d="M15 6l-6 6 6 6"/>',
  "nav-right": '<path d="M9 6l6 6-6 6"/>',
  "arrow-right": '<path d="M3 12h18M21 12l-8.5-8.5M21 12l-8.5 8.5"/>',
  "arrow-up-right": '<path d="M6 18 18 6M8 6h10v10"/>',
  bell: '<path d="M18 8.4C18 6.7 17.4 5.1 16.2 3.9 15.1 2.7 13.6 2 12 2s-3.1.7-4.2 1.9C6.6 5.1 6 6.7 6 8.4 6 15.9 3 18 3 18h18s-3-2.1-3-9.6Z"/><path d="M13.7 21c-.2.3-.4.6-.7.7-.3.2-.6.3-1 .3s-.7-.1-1-.3c-.3-.1-.6-.4-.7-.7"/>',
  user: '<path d="M5 20v-1a7 7 0 0 1 14 0v1"/><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/>',
  settings: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.62 10.4 18.52 7.74 20 6l-2-2-1.74 1.48-2.7-1.11L12.94 2H10.98l-.63 2.4-2.65 1.12L6 4 4 6l1.45 1.79-1.08 2.66L2 11v2l2.4.66 1.12 2.64L4 18l2 2 1.79-1.46 2.6 1.07L11 22h2l.6-2.39 2.65-1.1L18 20l2-2-1.48-1.75 1.1-2.65L22 13v-2l-2.38-.6Z"/>',
  home: '<path d="M17 21H7a4 4 0 0 1-4-4v-6.3a4 4 0 0 1 1.93-3.42l5-3.03a4 4 0 0 1 4.14 0l5 3.03A4 4 0 0 1 21 10.7V17a4 4 0 0 1-4 4Z"/><path d="M9 17h6"/>',
  // content / library
  book: '<path d="M12 21V7a2 2 0 0 1 2-2h7.4a.6.6 0 0 1 .6.6V18.7"/><path d="M12 21V7a2 2 0 0 0-2-2H2.6a.6.6 0 0 0-.6.6V18.7"/><path d="M14 19h8M10 19H2"/><path d="M12 21a2 2 0 0 1 2-2M12 21a2 2 0 0 0-2-2"/>',
  "book-stack": '<path d="M5 19.5V5a2 2 0 0 1 2-2h11.4a.6.6 0 0 1 .6.6V21"/><path d="M9 7h6M6.5 15H19M6.5 18H19M6.5 21H19"/><path d="M6.5 18C5.5 18 5 17.3 5 16.5S5.5 15 6.5 15M6.5 21C5.5 21 5 20.3 5 19.5S5.5 18 6.5 18"/>',
  page: '<path d="M20 12V5.75a.6.6 0 0 0-.18-.42l-3.15-3.15A.6.6 0 0 0 16.25 2H4.6a.6.6 0 0 0-.6.6v18.8c0 .33.27.6.6.6H19.4a.6.6 0 0 0 .6-.6V12Z"/><path d="M8 10h8M8 6h4M8 14h6M8 18h6"/>',
  "page-star": '<path d="M20 12V5.75a.6.6 0 0 0-.18-.42l-3.15-3.15A.6.6 0 0 0 16.25 2H4.6a.6.6 0 0 0-.6.6v18.8c0 .33.27.6.6.6H11"/><path d="M8 10h8M8 6h4M8 14h3"/><path d="M16.3 17.11l.91-1.93c.12-.25.46-.25.58 0l.9 1.93 2.04.31c.26.04.36.38.17.57l-1.47 1.5.35 2.12c.04.27-.23.48-.47.36L17.5 20.96l-1.82 1.01c-.24.12-.5-.09-.47-.36l.35-2.12-1.47-1.5c-.19-.19-.09-.53.17-.57l2.04-.31Z"/>',
  quote: '<path d="M10 12H5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V12Zm0 0c0 2.5-1 4-4 5.5"/><path d="M20 12h-5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V12Zm0 0c0 2.5-1 4-4 5.5"/>',
  "graduation-cap": '<path d="M2.57 8.46 11.23 4.13a.6.6 0 0 1 .54 0l8.66 4.33a.6.6 0 0 1 0 1.07l-8.66 4.33a.6.6 0 0 1-.54 0L2.57 9.54a.6.6 0 0 1 0-1.07Z"/><path d="M22.5 13V9.5l-2-1"/><path d="M4.5 10.5v5.41a2 2 0 0 0 1.14 1.8l5 2.38a2 2 0 0 0 1.72 0l5-2.38a2 2 0 0 0 1.14-1.8V10.5"/>',
  // calendar / community / media
  calendar: '<path d="M15 4V2M15 4v2M15 4h-4.5M3 10v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9H3Z"/><path d="M3 10V6a2 2 0 0 1 2-2h2"/><path d="M7 2v4"/><path d="M21 10V6a2 2 0 0 0-2-2h-.5"/>',
  community: '<path d="M7 18v-1a5 5 0 0 1 10 0v1"/><path d="M1 18v-1a3 3 0 0 1 3-3"/><path d="M23 18v-1a3 3 0 0 0-3-3"/><path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M4 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M20 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>',
  play: '<path d="M6.9 4.53c-.4-.24-.9.05-.9.52v13.9c0 .46.5.75.9.51l11.72-6.94c.4-.24.4-.8 0-1.04L6.9 4.53Z"/>',
  pause: '<path d="M6 18.4V5.6c0-.33.27-.6.6-.6h2.8c.33 0 .6.27.6.6v12.8c0 .33-.27.6-.6.6H6.6c-.33 0-.6-.27-.6-.6Z"/><path d="M14 18.4V5.6c0-.33.27-.6.6-.6h2.8c.33 0 .6.27.6.6v12.8c0 .33-.27.6-.6.6h-2.8c-.33 0-.6-.27-.6-.6Z"/>',
  "sound-high": '<path d="M1 13.86v-3.72c0-1.1.9-2 2-2h2.9c.2 0 .39-.06.55-.17l6-3.95c.66-.44 1.55.04 1.55.83v14.28c0 .8-.9 1.28-1.55.84l-6-3.96a1 1 0 0 0-.55-.16H3c-1.1 0-2-.9-2-2Z"/><path d="M17.5 7.5s1.5 1.5 1.5 4-1.5 4-1.5 4"/><path d="M20.5 4.5s2.5 2.5 2.5 7-2.5 7-2.5 7"/>',
  // ornament / status
  flower: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M13 9s1-2 1-4-2-4-2-4-2 2-2 4 1 4 1 4"/><path d="M9 11s-2-1-4-1-4 2-4 2 2 2 4 2 4-1 4-1"/><path d="M13 15s1 2 1 4-2 4-2 4-2-2-2-4 1-4 1-4"/><path d="M15 11s2-1 4-1 4 2 4 2-2 2-4 2-4-1-4-1"/>',
  star: '<path d="M8.59 8.24 11.18 3a.9.9 0 0 1 1.63 0l2.6 5.24 5.8.84c.75.11 1.05 1.02.51 1.54l-4.2 4.07.99 5.75c.13.74-.65 1.3-1.32.95L12 18.68l-5.19 2.71c-.67.35-1.45-.21-1.32-.95l.99-5.75-4.2-4.07c-.54-.52-.24-1.43.51-1.54l5.8-.84Z"/>',
  heart: '<path d="M22 8.86c0 1.55-.6 3.03-1.65 4.13-2.44 2.53-4.81 5.17-7.34 7.6a1.4 1.4 0 0 1-2 0L3.65 13a6 6 0 0 1 0-8.26 5.6 5.6 0 0 1 8.08 0l.27.27.26-.27a5.6 5.6 0 0 1 8.09 0A6 6 0 0 1 22 8.86Z"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  plus: '<path d="M6 12h12M12 6v12"/>',
  edit: '<path d="M14.36 5.64 4 16v4h4L18.36 9.64M14.36 5.64l2.83-2.83 4 4-2.83 2.83M14.36 5.64l3.99 4"/>',
  trash: '<path d="M20 9l-.87 12.14a2 2 0 0 1-2 1.86H6.87a2 2 0 0 1-2-1.86L4 9M9.5 4h5M3 6h18M10 11v6M14 11v6"/>',
  // theme
  sun: '<path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"/><path d="M22 12h1M12 2V1M12 23v-1M20 20l-.87-.87M20 4l-.87.87M4 20l.87-.87M4 4l.87.87M2 12H1"/>',
  moon: '<path d="M3 11.5a8.5 8.5 0 0 0 16.28 3.5A8.5 8.5 0 0 1 8.5 4.72 8.5 8.5 0 0 0 3 11.5Z"/>',
  monitor: '<path d="M3 15V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M8 21h8M12 17v4"/>',
  sliders: '<path d="M2 7h12M2 17h6M22 7h-4M22 17H12"/><path d="M16 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM10 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name, size = "1em", className, title, strokeWidth,
}: {
  name: IconName;
  size?: number | string;
  className?: string;
  title?: string;
  /** rarely needed — defaults to the platform --icon-stroke token */
  strokeWidth?: number;
}) {
  const style: CSSProperties = strokeWidth ? { strokeWidth } : {};
  return (
    <svg
      className={["vu-icon", className].filter(Boolean).join(" ")}
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
      style={style} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}
      aria-label={title}
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${title}</title>` : "") + PATHS[name] }}
    />
  );
}
