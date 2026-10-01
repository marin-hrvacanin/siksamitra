/**
 * NOTHING THE PERSON TYPES NEXT TAKES OUR STYLE — kept by watching the line.
 *
 * After a mark is placed at the end of a word, the next letter a person types
 * takes that mark's character style: Word carries a character style on to the
 * letter typed after it, and Office.js has no way to reset a bare caret's
 * style (`model/typed-after.ts` has the measurement). So the line just written
 * is watched: when Word reports that paragraph changed (`onParagraphChanged`,
 * WordApi 1.6) by one insertion at the caret the add-in left, the line is
 * written once more with the inserted letters plain, the caret after them. The
 * letters typed after that follow a plain letter, and carry nothing.
 *
 * One line at a time, forgotten as soon as it is corrected or changed in any
 * other way. Where WordApi 1.6 is missing — an older Word — nothing is
 * watched, and typing is sticky as it always was there.
 */
import { mergeRuns, readParagraphs } from '@siksamitra/interop';
import type { LineNote } from '@siksamitra/interop';
import type { ScriptKey } from '@siksamitra/engine';
import { lineXml } from '../model/line-xml.js';
import { styleSheetFor } from '../model/sheet.js';
import { typedPlain, type Written } from '../model/typed-after.js';
import { CARET_BOOKMARK } from '../model/caret.js';
import { packageOf } from './client.js';
import { lineTargets } from './line-target.js';

interface Watched extends Written {
  id: string;
  style: string | null;
  script: ScriptKey;
  notes: readonly LineNote[];
}

let watched: Watched | null = null;
let listening = false;

const canWatch = (): boolean =>
  typeof Office !== 'undefined' && Office.context.requirements.isSetSupported('WordApi', '1.6');

/** Start listening for paragraph changes — once per runtime. */
async function listen(): Promise<void> {
  if (listening || !canWatch()) return;
  listening = true;
  await Word.run(async (context) => {
    context.document.onParagraphChanged.add(async (e) => {
      if (watched !== null && e.uniqueLocalIds.includes(watched.id)) await correct(watched);
    });
    await context.sync();
  });
}

/**
 * Watch the paragraph just written: `body` is what went in, `caretWord` where
 * the caret was left in Word's characters.
 */
export async function watchTyping(
  paragraph: Word.Paragraph,
  line: { tm: Written['tm']; style: string | null; script: ScriptKey; notes: readonly LineNote[] },
  body: string,
  caretWord: number,
): Promise<void> {
  if (!canWatch()) return;
  paragraph.load('uniqueLocalId,text');
  await paragraph.context.sync();
  const [read] = readParagraphs(body);
  watched = {
    id: paragraph.uniqueLocalId, wordText: paragraph.text, runs: mergeRuns(read?.runs ?? []), caretWord, ...line,
  };
  await listen();
}

/** The watched line, with what was typed after the mark made plain. */
async function correct(w: Watched): Promise<void> {
  await Word.run(async (context) => {
    const p = context.document.getParagraphByUniqueLocalId(w.id);
    p.load('text');
    await context.sync();
    /* THE WRITE'S OWN ECHO. Word reports the add-in's own write as a change
       too, a moment after it — measured, before anything was typed — and
       taking that for the typing stopped the watch before the first letter.
       A change that leaves the text as written is not typing: keep watching. */
    if (p.text === w.wordText) return;
    const fixed = typedPlain(w, p.text);
    /* Watched once: corrected now, or not the typing it was waiting for. */
    watched = null;
    if (fixed === null) return;
    const body = lineXml({ tm: fixed.tm, style: w.style, script: w.script, notes: w.notes, caret: { at: fixed.caret } });
    const [target] = await lineTargets([p]);
    target!.insertOoxml(packageOf(body, styleSheetFor(body)), Word.InsertLocation.replace);
    await context.sync();
    const mark = context.document.getBookmarkRangeOrNullObject(CARET_BOOKMARK);
    mark.load('isNullObject');
    await context.sync();
    if (!mark.isNullObject) {
      mark.select();
      context.document.deleteBookmark(CARET_BOOKMARK);
    } else {
      p.getRange(Word.RangeLocation.content).getRange('End').select();
    }
    await context.sync();
  });
}
