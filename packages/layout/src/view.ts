/**
 * The three ways a document can be shown, as data.
 *
 * OWNER'S REQUIREMENT (2026-09-07): continuous scroll by default, switchable to
 * pages so the author sees exactly how it will export, plus a third that shows
 * it as vedaunion.org will — "invisible pages", both, interchangeable.
 *
 * They are three presentations of ONE renderer. That is what makes them
 * interchangeable rather than three lookalike implementations that drift: a
 * view mode chooses a container and a theme, and changes nothing about how a
 * mark is drawn. If a mode ever needed its own mark-drawing code, it would stop
 * being a view of the document and become a different document.
 *
 * What each mode is FOR, which is what decides its defaults:
 *
 *   flow   authoring. The measure column, no page furniture, nothing that moves
 *          while you type. The default because an author spends their day here.
 *   paged  proofing. What the exported .docx and PDF will look like, page for
 *          page, from the same page map the exporter uses.
 *   web    publishing. How the document will read on vedaunion.org, in the
 *          platform's own colours — a preview of the destination, so a
 *          contrast or spacing problem is found before it is published rather
 *          than after.
 */

export type ViewKind = 'flow' | 'paged' | 'web';

export interface ViewMode {
  readonly kind: ViewKind;
  readonly label: string;
  /** One line, for a tooltip or the status bar. */
  readonly purpose: string;
  /** Does this mode draw page boundaries and page furniture? */
  readonly paginated: boolean;
  /**
   * A theme this mode PINS, overriding the reader's own choice.
   *
   * Only `web` does, and it must: the point of that mode is to show the
   * platform's appearance, which is not a preference the author gets to
   * override without making the preview a preview of nothing.
   */
  readonly pinnedTheme?: string;
  /** May the author type in this mode? */
  readonly editable: boolean;
}

export const VIEW_MODES: Readonly<Record<ViewKind, ViewMode>> = {
  flow: {
    kind: 'flow',
    label: 'Flow',
    purpose: 'Continuous scroll, for writing.',
    paginated: false,
    editable: true,
  },
  paged: {
    kind: 'paged',
    label: 'Pages',
    purpose: 'Exactly as it will export, page for page.',
    paginated: true,
    // Editable on purpose. A proofing mode you cannot correct in makes you
    // switch back, lose your place, and hunt for the line you just saw.
    editable: true,
  },
  /**
   * WEB — the document with no page at all.
   *
   * Not "a preview of vedaunion.org": that is an APPEARANCE (the `vu-web`
   * document theme), and pinning it here meant switching view repainted the
   * page in someone else's colours, which is not what a view is for. A view
   * decides the SHAPE — here: no sheet, no margins, no page furniture, the
   * text filling the window as HTML does — and the appearance stays whatever
   * the author chose, including the site's own if they want it.
   */
  web: {
    kind: 'web',
    label: 'Web',
    purpose: 'No page: the text as a web page, filling the window.',
    paginated: false,
    // Editable like the others. There is nothing about a continuous column
    // that makes a correction less safe than in flow.
    editable: true,
  },
};

export const DEFAULT_VIEW: ViewKind = 'flow';

export function viewMode(kind: ViewKind): ViewMode {
  return VIEW_MODES[kind];
}

/**
 * The theme to render in.
 *
 * A view may pin one — none does today. It used to: the web view forced the
 * site's own theme, so choosing an appearance and then switching view threw
 * the choice away. The appearance is the author's; the view is the shape.
 */
export function themeFor(kind: ViewKind, preferred: string): string {
  return VIEW_MODES[kind].pinnedTheme ?? preferred;
}

/** Cycle order for the keyboard shortcut, in the order an author works. */
export const VIEW_CYCLE: readonly ViewKind[] = ['flow', 'paged', 'web'];

export function nextView(kind: ViewKind): ViewKind {
  const at = VIEW_CYCLE.indexOf(kind);
  return VIEW_CYCLE[(at + 1) % VIEW_CYCLE.length]!;
}
