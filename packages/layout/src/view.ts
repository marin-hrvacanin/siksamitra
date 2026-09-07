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
  web: {
    kind: 'web',
    label: 'Web',
    purpose: 'As it will read on vedaunion.org.',
    paginated: false,
    pinnedTheme: 'vu-web',
    // Read-only: it is a preview of somewhere else. Editing here would invite
    // the author to tune the text to a presentation they do not control.
    editable: false,
  },
};

export const DEFAULT_VIEW: ViewKind = 'flow';

export function viewMode(kind: ViewKind): ViewMode {
  return VIEW_MODES[kind];
}

/**
 * The theme to render in: the mode's pin, else the reader's choice.
 *
 * One place, so no surface has to remember that `web` is special.
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
