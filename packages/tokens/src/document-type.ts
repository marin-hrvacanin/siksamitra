/**
 * The document's TYPE SCALE — one metric per rendered element.
 *
 * WHY THIS EXISTS. The document themes declared a reading size and a leading,
 * and the page ignored both: `chant.css` set the mantra line to
 * `clamp(1.06rem, 3.1cqi, 1.62rem)` with `line-height: 1.95`, so switching to
 * the Veda Union Word theme changed the colours and nothing else. Measured in
 * a browser: the tokens said 16 pt on 24 pt and the page rendered 19.44 pt on
 * 37.9 pt. A theme that cannot move the type is not a document theme.
 *
 * So every value a document element needs is here, per role, and the
 * stylesheet reads them. Nothing about the page's type lives in CSS any more —
 * which is the standing rule (all design values in tokens), and the only way
 * "1:1 with his Word file" can be checked rather than asserted.
 *
 * TWO KINDS OF SCALE, and the difference is the point:
 *   - the screen themes get a DESIGNED scale, derived from the theme's own
 *     reading size, and their mantra line tracks the column it has to fit;
 *   - the `word` theme gets a MEASURED one, straight out of `WORD_PARAGRAPHS`,
 *     and its type is fixed in points because a page of A4 is not responsive.
 *
 * Units: rem, and `1rem = 16px = 12pt`, so a 16 pt line is `1.3333rem`. That
 * identity is what lets a measured point size become a screen size without a
 * second conversion factor to keep in step.
 */
import { WORD_PARAGRAPHS, wordColor } from './word.js';

/** A rem per point — `1rem = 16px = 12pt` at zoom 1. */
export const PT = 1 / 12;

/**
 * The elements a document is made of.
 *
 * The same vocabulary as `WordParagraphMetric.role`, because these ARE his
 * paragraph styles: renaming them here would mean a translation table, which
 * is a place for the two to drift. Which of OUR elements takes which role is
 * the one mapping that does exist, and it is written out below.
 */
export type DocRole =
  | 'title' | 'part' | 'section' | 'step'
  | 'verse' | 'translation' | 'body' | 'comment' | 'head';

export const DOC_ROLES: readonly DocRole[] = [
  'title', 'part', 'section', 'step',
  'verse', 'translation', 'body', 'comment', 'head',
];

/**
 * WHICH ROLE EACH OF OUR ELEMENTS TAKES — the mapping, stated once.
 *
 * His styles are levels in a BOOK of chants; ours are levels in one document,
 * and they line up one level down. Read off his own PDF: `śrīrudrapraśnaḥ`
 * (a whole chant) is 18 pt at a 19.85 pt indent — Heading3 — and
 * `prathamo'nuvākaḥ` and `śānti pāṭhaḥ` (steps inside it) are 16 pt at 28.35 pt
 * — Heading4. The running head above them carries the book part.
 *
 *   our document's name   → `part`     (Heading2, 22 pt)   — the book part
 *   our `section.part`    → `section`  (Heading3, 18 pt)   — a chant
 *   our `section.title`   → `step`     (Heading4, 16 pt)   — a step of it
 *   our verse lines       → `verse`    (Translit, 16/24)
 *   our translation       → `translation` (Prijevod, 11 pt italic)
 *   our instructions      → `body`     (Normal, 11 pt)
 *   our source notes      → `comment`  (Comment, 11 pt italic grey)
 *   a picture's caption   → `comment`  (Caption in Word, the same values)
 *   the paged running head→ `head`     (Header, 12 pt)
 *
 * `title` (Heading1, 24 pt) is a title page's heading and nothing renders it
 * yet. It is here because it is measured, and because a cover is next.
 */
export const ROLE_OF_ELEMENT = {
  'doc__name': 'part',
  'doc__part': 'section',
  'section__title': 'step',
  'pada': 'verse',
  'doc__translation': 'translation',
  'doc__instruction': 'body',
  'doc__source': 'comment',
  /* A caption is apparatus, exactly like a source note, and is set in the same
     role — see `figure.css`, which says so and takes its face from here. */
  'fig__cap': 'comment',
  'page__head': 'head',
} as const satisfies Readonly<Record<string, DocRole>>;

export interface RoleMetric {
  /** Size in rem at zoom 1. */
  readonly size: number;
  /**
   * The floor a fluid role may shrink to, in rem, or `null` for a fixed size.
   *
   * Only the mantra line is ever fluid, and only on a screen theme: a long
   * pāda must not wrap, so the line gives up type size before it gives up the
   * line. A print theme sets this `null` — an A4 page is 210 mm wide whatever
   * the window is doing.
   */
  readonly floor: number | null;
  /**
   * Line height, as a ratio of the size — or `'normal'`, the FONT's own.
   *
   * `'normal'` is not a shrug: it is what Word's `w:lineRule="auto"` means, and
   * only the font knows the number. Reading `w:line="240" w:lineRule="auto"` as
   * an exact 12 pt put every translation line 0.6 pt tight against his PDF,
   * where 11 pt Times sets on 12.6 — Times' own 1.15. Our substitute faces are
   * metric-compatible, so `normal` gives the same figure by the same route.
   */
  readonly leading: number | 'normal';
  /** Space after the block, in rem. */
  readonly after: number;
  /** Left indent, in rem. */
  readonly indent: number;
  /** First-line outdent, in rem — a hanging indent. */
  readonly hanging: number;
  /** Right indent, in rem. Negative lets the line into the margin. */
  readonly right: number;
  /**
   * Which face role this element is set in.
   *
   * `text` is the theme's reading face. `display` is the same unless the theme
   * names one — vedaunion.org sets its headings in Cormorant Garamond and its
   * text in Gentium, and that is a property of that page rather than of every
   * page. `serif` and `ui` are the other two families a facsimile needs: his
   * translations are Times italic and his headings Calibri.
   */
  readonly face: 'text' | 'display' | 'serif' | 'ui';
  readonly italic: boolean;
  readonly bold: boolean;
  /** A CSS colour, or a `var(--doc-*)` reference into the theme's own palette. */
  readonly color: string;
}

export type DocTypeScale = Readonly<Record<DocRole, RoleMetric>>;

/** Everything a role does not say. */
const BASE = {
  floor: null, after: 0, indent: 0, hanging: 0, right: 0,
  face: 'text', italic: false, bold: false, color: 'var(--doc-ink)',
} as const;

/**
 * The designed scale, for a theme that is a SCREEN rather than a page.
 *
 * Sized in multiples of the theme's own reading size, so a theme that wants a
 * bigger page moves everything together. The numbers are the ones the page
 * already had — the mantra at 1.62 of the reading size with a 0.654 floor is
 * `clamp(1.06rem, …, 1.62rem)` restated — so adopting this scale changed
 * nothing about how the screen themes look, which is how it could be adopted
 * without a redesign.
 *
 * The headings step down by roughly a fifth (2 / 1.75 / 1.45 / 1.28) rather
 * than taking the browser's bold `h2` default, and none of them is bold: the
 * grey and the space carry the hierarchy, and a bold heading over a marked
 * verse reads as two emphases competing. His document is not bold anywhere
 * either, which is a check on the judgement rather than its reason.
 */
export function screenScale(size: number, leading: number): DocTypeScale {
  const rem = (m: number): number => Number((size * m).toFixed(4));
  return {
    title: {
      ...BASE, face: 'display', size: rem(2), leading: 1.2, after: rem(0.7),
      color: 'var(--doc-heading)',
    },
    part: {
      ...BASE, face: 'display', size: rem(1.75), leading: 1.25, after: rem(0.55),
      color: 'var(--doc-heading)',
    },
    section: {
      ...BASE, face: 'display', size: rem(1.45), leading: 1.3, after: rem(0.45),
      color: 'var(--doc-heading)',
    },
    /* The level our own documents actually show — a step's own title. Sized so
       it reads as a heading over a 1.62 mantra without competing with it. */
    step: {
      ...BASE, face: 'display', size: rem(1.28), leading: 1.35, after: rem(0.4),
      color: 'var(--doc-heading)',
    },
    verse: {
      ...BASE, size: rem(1.62), floor: rem(1.06), leading, after: rem(0.9),
    },
    translation: {
      ...BASE, size: rem(1), leading: 1.55, after: rem(0.5),
      italic: true, color: 'var(--doc-soft)',
    },
    body: { ...BASE, size: rem(1), leading: 1.6, after: rem(0.5) },
    comment: {
      ...BASE, size: rem(0.72), leading: 1.5, after: rem(0.3),
      face: 'ui', italic: true, color: 'var(--doc-quiet)',
    },
    head: {
      ...BASE, size: rem(0.68), leading: 1.4, face: 'ui',
      color: 'var(--doc-quiet)',
    },
  };
}

/**
 * The measured scale: his own Word file, in points, converted once.
 *
 * `leading: null` in the table means Word's automatic spacing, and it becomes
 * `'normal'` — the font's own line height, which is exactly what Word computes
 * and what only the font can answer. Everything else is a direct reading:
 * sizes from `w:sz`, the hanging indent from `w:ind w:hanging`, the negative
 * right indent from `w:right`, and the greys from `w:color`.
 *
 * No role here is fluid, and none is bold — neither is true of his document.
 */
export function wordScale(): DocTypeScale {
  const role = (r: string): (typeof WORD_PARAGRAPHS)[number] => {
    const found = WORD_PARAGRAPHS.find((m) => m.role === r);
    if (found === undefined) throw new Error(`no measured Word style for role ${r}`);
    return found;
  };
  const metric = (r: DocRole): RoleMetric => {
    const m = role(r === 'verse' ? 'verse-line' : r);
    return {
      size: Number((m.size * PT).toFixed(4)),
      floor: null,
      leading: m.leading === null
        ? 'normal'
        : Number((m.leading / m.size).toFixed(4)),
      after: Number((m.after * PT).toFixed(4)),
      indent: Number((m.indent * PT).toFixed(4)),
      hanging: Number((m.hanging * PT).toFixed(4)),
      right: Number((m.right * PT).toFixed(4)),
      face: m.face === 'sans' ? 'text' : m.face,
      italic: m.italic === true,
      bold: m.bold === true,
      color: m.color === undefined ? 'var(--doc-ink)' : wordColor(m.color),
    };
  };
  return Object.fromEntries(DOC_ROLES.map((r) => [r, metric(r)])) as DocTypeScale;
}
