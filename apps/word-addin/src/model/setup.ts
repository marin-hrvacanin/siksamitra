/**
 * PREPARING A DOCUMENT — the thing a fresh Word file needs before any of the
 * buttons can do anything.
 *
 * A marking IS a style in Word. A holding is `w:rStyle="Holding"` and a
 * character border; a mantra line is `w:pStyle="Translit"` with 24 pt exact
 * leading over 16 pt. Every one of those names has to EXIST in the document,
 * and in a blank document none of them does.
 *
 * WHAT HAPPENED WITHOUT THIS. `insertOoxml` carries a `styles.xml` with each
 * insertion, so marking a word in a blank document did work — and left a
 * document whose Styles pane held one style, added by a machine, with no way
 * for a person to apply it themselves, restyle it, or see what else there was.
 * "Open Word, press Short" was the only way to discover the vocabulary.
 *
 * So: one button that puts the whole vocabulary in, and one that puts a
 * SPECIMEN in — a short block that uses every style with its name beside it,
 * which a person reads once and then deletes.
 *
 * THE LIST IS DERIVED, NEVER TYPED. `styleIds` reads the sheet
 * `@siksamitra/interop` generates, so a style added to `char-styles.ts`
 * appears here, in the specimen, and in what the pane reports as missing,
 * without anybody remembering to add it. A hand-written copy of that list is
 * a copy that goes stale, and the symptom would be a style the add-in writes
 * and the document has not got — which Word renders as no formatting at all,
 * silently. ECMA-376 §17.7.4.4: an `rStyle` naming a style that does not
 * exist is IGNORED.
 */
import { styledParagraph, styledRun } from '@siksamitra/interop';

/** A style the sheet declares, and what kind of style it is. */
export interface SheetStyle {
  readonly id: string;
  readonly kind: 'paragraph' | 'character';
}

/**
 * Every style a `styles.xml` declares, in the order it declares them.
 *
 * A regex over the sheet rather than a parse, because this runs in a task pane
 * over an 8 kB string that WE generated: the shape is `<w:style w:type="…"
 * w:customStyle="1" w:styleId="…">`, one line per style, and `DOMParser` on a
 * WordprocessingML namespace in a browser is more ceremony than the whole
 * function.
 */
export function styleIds(sheet: string): SheetStyle[] {
  const out: SheetStyle[] = [];
  const re = /<w:style\b([^>]*)>/g;
  for (const found of sheet.matchAll(re)) {
    const attrs = found[1] ?? '';
    const id = /w:styleId="([^"]+)"/.exec(attrs)?.[1];
    const type = /w:type="([^"]+)"/.exec(attrs)?.[1];
    if (id === undefined) continue;
    if (type !== 'paragraph' && type !== 'character') continue;
    out.push({ id, kind: type });
  }
  return out;
}

/**
 * The styles a document is MISSING, out of the ones the sheet defines.
 *
 * `pkg` is what `Body.getOoxml()` returns — a flat OPC package whose
 * `styles.xml` part lists what the document actually has. Compared by id
 * rather than by name because the id is what `w:rStyle` and `w:pStyle` name,
 * and a localised Word shows a different NAME for the same id.
 *
 * `Normal` is left out of the answer: every Word document has one, it is the
 * `docDefaults` this sheet also sets, and reporting it as missing would make
 * a prepared document look unprepared forever.
 */
export function missingStyles(pkg: string, sheet: string): string[] {
  const have = new Set(styleIds(pkg).map((s) => s.id));
  return styleIds(sheet)
    .map((s) => s.id)
    .filter((id) => id !== 'Normal' && !have.has(id))
    .filter((id, i, all) => all.indexOf(id) === i);
}

/**
 * What each style is FOR, in the pane's own words.
 *
 * The specimen prints these beside the style, so a person reading it once
 * learns the vocabulary. A style with no word for it falls back to its id and
 * `setup.test.ts` fails — which is the point: adding a style to the sheet
 * should make somebody write a sentence about it.
 */
export const STYLE_MEANS: Readonly<Record<string, string>> = {
  Translit: 'a mantra line',
  Heading1: 'the document’s title',
  Heading2: 'a part — a run of steps',
  Heading3: 'a section',
  Heading4: 'a direction, above the mantra',
  Prijevod: 'a translation',
  Caption: 'a picture’s caption',
  Header: 'the running head',
  Normal: 'ordinary prose',
  Holding: 'a short holding — a thin box',
  '2Holding': 'a long holding — a thick box',
  Svara: 'an accent mark',
  Virama: 'the virāma tick',
  Anusvara: 'a letter the rules replaced',
  VedicAnusvara: 'a Vedic nasal',
  Pause: 'a pause — one bar, or two',
  Comment: 'where the words come from',
  Reference: 'a raised reading aid',
  HoldingChange: 'boxed and replaced at once — short',
  '2HoldingChange': 'boxed and replaced at once — long',
};

/** What the specimen says at the top, so nobody wonders what it is. */
export const SPECIMEN_TITLE = 'śikṣāmitra styles';
export const SPECIMEN_NOTE =
  'Every style this add-in writes, once each. Read it, then delete this block — '
  + 'the styles stay in the document.';

/**
 * The specimen, as the `<w:p>` sequence to insert.
 *
 * `marked` is a real marked line, written by the real writer
 * (`paragraphsXml`), so the boxes and the accents in the specimen are the ones
 * the buttons produce rather than a drawing of them. Everything else is one
 * paragraph or one run per style, in the order the sheet declares them.
 *
 * WHY EVERY STYLE IS USED AND NOT MERELY DEFINED. Word merges the styles an
 * insertion USES; a definition for a style nothing references may be dropped.
 * Measured, in `tools/word-live.mjs`, against a real Word.
 */
export function specimenBody(sheet: string, marked: string): string {
  const styles = styleIds(sheet);
  const means = (id: string): string => STYLE_MEANS[id] ?? id;

  const out: string[] = [
    styledParagraph('Heading1', styledRun(SPECIMEN_TITLE, null)),
    styledParagraph(null, styledRun(SPECIMEN_NOTE, 'Comment')),
    marked,
  ];

  /* The paragraph styles, each as a paragraph OF that style — which is the
     only way to see what one does. `Translit` is skipped: the marked line
     above already is one, and a second would say less. */
  for (const style of styles) {
    if (style.kind !== 'paragraph') continue;
    if (style.id === 'Translit' || style.id === 'Heading1') continue;
    out.push(styledParagraph(style.id, styledRun(`${style.id} — ${means(style.id)}`, null)));
  }

  /*
   * The character styles, as a legend: the style's own name written IN it,
   * then what it means in ordinary type. One paragraph each, because a
   * character style on its own line is the only way to see a border weight —
   * two boxes side by side in one paragraph become one box, which is the same
   * ECMA-376 §17.3.2.4 border-group rule that makes a holding able to cross a
   * space.
   */
  for (const style of styles) {
    if (style.kind !== 'character') continue;
    out.push(styledParagraph(null,
      styledRun(style.id, style.id) + styledRun(`  ${means(style.id)}`, null)));
  }
  return out.join('');
}
