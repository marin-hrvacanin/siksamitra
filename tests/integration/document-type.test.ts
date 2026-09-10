/**
 * The document's type scale — the values, and the file they came from.
 *
 * Three claims, and they are deliberately separate:
 *
 *   1. the measured scale IS his `.docx`, converted once (points to rem);
 *   2. the designed scale is a scale — ordered, complete, and derived from the
 *      theme's own reading size rather than invented per theme;
 *   3. the GENERATED stylesheet carries every value, for every theme, so
 *      nothing can resolve to nothing.
 *
 * Claim 3 is the one that catches the failure this whole scale exists to fix.
 * A missing custom property does not error: the declaration is dropped and the
 * element renders with whatever it inherited — invisible rather than wrong, so
 * it survives review. `tools/doc-fidelity.mjs` then measures the rendered page
 * in a browser, which is the only place "1:1" can actually be checked.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_THEMES, typeScaleOf,
} from '@siksamitra/tokens/document-themes';
import {
  DOC_ROLES, ROLE_OF_ELEMENT, screenScale, wordScale, type DocRole,
} from '@siksamitra/tokens/document-type';
import { WORD_PARAGRAPHS, WORD_PAGE } from '@siksamitra/tokens/word';

const CSS = readFileSync('packages/tokens/generated/tokens.css', 'utf8');

/** Points to rem, the one conversion: 1rem = 16px = 12pt. */
const rem = (points: number): number => Number((points / 12).toFixed(4));

describe('the measured scale is his file', () => {
  const scale = wordScale();

  it('every role comes from the paragraph style it names', () => {
    // The mapping, spelled out — so a re-pointed role fails here rather than
    // quietly rendering a step heading at a chant's size.
    const from: Record<DocRole, string> = {
      title: 'Heading1',
      part: 'Heading2',
      section: 'Heading3',
      step: 'Heading4',
      verse: 'Translit',
      translation: 'Prijevod',
      body: 'Normal',
      comment: 'Comment',
      head: 'Header',
    };
    for (const role of DOC_ROLES) {
      const style = WORD_PARAGRAPHS.find((m) => m.style === from[role]);
      expect(style, `${role} ← ${from[role]}`).toBeDefined();
      expect(scale[role].size, `${role} size`).toBe(rem(style!.size));
      expect(scale[role].indent, `${role} indent`).toBe(rem(style!.indent));
      expect(scale[role].hanging, `${role} hanging`).toBe(rem(style!.hanging));
      expect(scale[role].right, `${role} right`).toBe(rem(style!.right));
      expect(scale[role].after, `${role} after`).toBe(rem(style!.after));
      expect(scale[role].italic, `${role} italic`).toBe(style!.italic === true);
      expect(scale[role].bold, `${role} bold`).toBe(false);
    }
  });

  it('the mantra line is 16pt on an exact 24, hanging out to the margin', () => {
    expect(scale.verse.size).toBe(rem(16));
    expect(scale.verse.leading).toBe(1.5);
    // 14.2pt in, 14.2pt out: the first line sits AT the margin.
    expect(scale.verse.indent).toBe(rem(14.2));
    expect(scale.verse.hanging).toBe(rem(14.2));
    expect(scale.verse.indent - scale.verse.hanging).toBe(0);
    // And it is allowed 13.8pt of the right margin rather than wrapping.
    expect(scale.verse.right).toBeLessThan(0);
  });

  it('an automatic leading is the FONT\'s, not a number we chose', () => {
    // `w:lineRule="auto"`. Reading it as an exact 12pt set every translation
    // line 0.6pt tight against his PDF, which measures 11 on 12.6.
    expect(scale.translation.leading).toBe('normal');
    expect(scale.body.leading).toBe('normal');
    for (const role of DOC_ROLES) {
      const style = WORD_PARAGRAPHS.find((m) => m.role === (role === 'verse' ? 'verse-line' : role));
      if (style?.leading == null) expect(scale[role].leading, role).toBe('normal');
      else expect(scale[role].leading, role).toBeTypeOf('number');
    }
  });

  it('nothing in it is fluid — a page is 210mm wide whatever the window is', () => {
    for (const role of DOC_ROLES) expect(scale[role].floor, role).toBeNull();
  });

  it('its greys are his greys, and its faces are the substitutes', () => {
    expect(scale.step.color).toBe('#7f7f7f');
    expect(scale.translation.color).toBe('#808080');
    expect(scale.comment.color).toBe('#808080');
    // Heading2/Translit set no colour, so they are the document's own ink.
    expect(scale.verse.color).toBe('var(--doc-ink)');
    expect(scale.verse.face).toBe('text');
    expect(scale.translation.face).toBe('serif');
    expect(scale.step.face).toBe('ui');
  });

  it('the page is A4 with 25mm margins, as his PDF measures', () => {
    // Not one inch. Every line that starts at the margin in his PDF starts at
    // x = 70.9pt, and the layout package had 25mm all along.
    expect(WORD_PAGE.marginPt).toBeCloseTo(70.85, 2);
    expect(WORD_PAGE.widthPt).toBeCloseTo(595.3, 1);
    expect(WORD_PAGE.contentPt).toBeCloseTo(453.6, 1);
  });
});

describe('the designed scale is a scale', () => {
  it('every level is above the one below it', () => {
    const s = screenScale(1, 1.9);
    const order: DocRole[] = ['title', 'part', 'section', 'step'];
    for (let i = 1; i < order.length; i += 1) {
      expect(s[order[i]!].size, `${order[i]} < ${order[i - 1]}`)
        .toBeLessThan(s[order[i - 1]!].size);
    }
    // A heading outranks the prose under it.
    expect(s.step.size).toBeGreaterThan(s.translation.size);
    expect(s.translation.size).toBeGreaterThan(s.comment.size);
  });

  it('it follows the theme s reading size, rather than being fixed', () => {
    const small = screenScale(1, 1.9);
    const large = screenScale(1.2, 1.9);
    for (const role of DOC_ROLES) {
      expect(large[role].size / small[role].size, role).toBeCloseTo(1.2, 4);
    }
  });

  it('only the mantra line is fluid, and its floor is below its size', () => {
    const s = screenScale(1, 1.9);
    for (const role of DOC_ROLES) {
      if (role === 'verse') continue;
      expect(s[role].floor, role).toBeNull();
    }
    expect(s.verse.floor).not.toBeNull();
    expect(s.verse.floor!).toBeLessThan(s.verse.size);
  });

  it('no level is bold — the grey and the space carry the hierarchy', () => {
    const s = screenScale(1, 1.9);
    for (const role of DOC_ROLES) expect(s[role].bold, role).toBe(false);
  });
});

describe('every theme carries the whole scale', () => {
  it('each theme resolves every role, with no gaps', () => {
    for (const theme of DOCUMENT_THEMES) {
      const scale = typeScaleOf(theme);
      for (const role of DOC_ROLES) {
        const m = scale[role];
        expect(m, `${theme.id}.${role}`).toBeDefined();
        expect(m.size, `${theme.id}.${role} size`).toBeGreaterThan(0);
        expect(m.color, `${theme.id}.${role} colour`).toMatch(/^(#|var\()/);
        expect(m.face, `${theme.id}.${role} face`).toMatch(/^(text|display|serif|ui)$/);
      }
    }
  });

  it('a theme states where a verse number is printed', () => {
    for (const theme of DOCUMENT_THEMES) {
      expect(theme.numbers, theme.id).toMatch(/^(gutter|inline)$/);
      expect(theme.scale, theme.id).toMatch(/^(screen|word)$/);
    }
    // His document prints it in the line, between daṇḍas. One number, not two.
    expect(DOCUMENT_THEMES.find((t) => t.scale === 'word')!.numbers).toBe('inline');
  });

  /**
   * THE ONE THAT CATCHES THE SILENT FAILURE.
   *
   * A `var(--doc-verse-size)` that names nothing is not an error: the whole
   * declaration is dropped and the element keeps what it inherited. So every
   * property of every role must be present in every theme's block, and the
   * check is over the generated file rather than over the source it came from.
   */
  it('the generated stylesheet declares every property of every role', () => {
    const props = ['size', 'lead', 'after', 'indent', 'hanging', 'right', 'face', 'style', 'weight', 'color'];
    const missing: string[] = [];
    for (const theme of DOCUMENT_THEMES) {
      const block = new RegExp(`\\[data-doc="${theme.id}"\\] \\{([^}]*)\\}`).exec(CSS);
      if (block === null) { missing.push(`${theme.id}: no type block`); continue; }
      for (const role of DOC_ROLES) {
        for (const prop of props) {
          if (!block[1]!.includes(`--doc-${role}-${prop}:`)) {
            missing.push(`${theme.id}: --doc-${role}-${prop}`);
          }
        }
      }
      for (const one of ['--doc-number-display:', '--doc-gutter:']) {
        if (!block[1]!.includes(one)) missing.push(`${theme.id}: ${one}`);
      }
    }
    expect(missing).toEqual([]);
  });

  /*
   * ZOOM IS NOT IN THESE LENGTHS, AND THIS IS WHERE THAT IS HELD.
   *
   * This check used to require the opposite — `--doc-verse-indent:
   * calc(0.8875rem * var(--doc-zoom))` — with the note that "a `rem` that
   * forgot the multiplier would make zoom move the paper and not the type".
   * The multiplier was there and zoom moved the paper and not the type
   * anyway: these declarations land on `:root` and on `[data-doc="…"]`, and a
   * custom property's `var()` is substituted where it is DECLARED, so every
   * one of them computed once against the root's zoom of 1. MEASURED in the
   * running program at 100 % and at 250 %, in all three views: the mantra line
   * 25.92 px both times, the translation 16 px, the heading 20.48 px, the
   * marks unchanged.
   *
   * Zoom is now the browser's `zoom` property, one declaration per sheet in
   * `canvas.css`, and a multiplier here would square it.
   */
  it('no length multiplies by the zoom, because the browser does the zooming', () => {
    const multiplied = [...CSS.matchAll(/--doc-[a-z-]+: [^;]*var\(--doc-zoom\)[^;]*;/g)]
      .map((m) => m[0]);
    expect(multiplied).toEqual([]);
  });

  it('and the sheets hand it to the browser instead', () => {
    /*
     * The other half, and without it the check above passes on a build where
     * zoom does nothing whatsoever. Read out of the stylesheet that draws the
     * three sheets, so it is the shipped declaration rather than a claim.
     */
    const canvas = readFileSync('apps/web/src/styles/canvas.css', 'utf8');
    const rule = /\.flow__column,\s*\.web__column,\s*\.page \{[^}]*zoom: var\(--doc-zoom\);/;
    expect(canvas).toMatch(rule);
    /* And the variable it reads has a default, or an unzoomed subtree — the
       measuring probe, an export, a test's fragment — resolves `zoom` to
       nothing. */
    expect(CSS).toContain('--doc-zoom: 1;');
  });

  it('a face role always resolves to a face', () => {
    /*
     * `display` falls back to the reading face, `ui` to the interface face, so
     * a theme that names neither still resolves every element — the failure
     * this guards is a role added to the scale and forgotten in the
     * generator's `face()`, which renders as no font-family at all.
     */
    const emitted = /--doc-[a-z]+-face: ([^;]+);/g;
    const faces = [...CSS.matchAll(emitted)].map((m) => m[1]!.trim());
    expect(faces.length).toBeGreaterThan(DOC_ROLES.length);
    for (const face of faces) expect(face).not.toBe('');
  });

  it('the stylesheet names a role for each document element', () => {
    /*
     * The mapping is data, so the CSS can be checked against it.
     *
     * TWO STYLESHEETS, because a document element is styled wherever the ONE
     * component that draws it lives: `document.css` sets the text of the page,
     * and `figure.css` sets a picture — the render package owns that component
     * so that a picture is the same picture in the editor, the reader and
     * every export. A caption is a document element whose role is `comment`
     * exactly as a source note's is, and reading only the first file said it
     * was unstyled.
     */
    const css = readFileSync('apps/web/src/styles/document.css', 'utf8')
      + readFileSync('packages/render/src/figure.css', 'utf8');
    for (const [element, role] of Object.entries(ROLE_OF_ELEMENT)) {
      if (element === 'page__head') continue; // the paged view's furniture.
      expect(css, `${element} → ${role}`).toContain(`.${element}`);
      expect(css, `${element} → ${role}`).toContain(`var(--doc-${role}-size)`);
    }
  });
});
