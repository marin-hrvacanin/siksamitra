/**
 * THE SOURCE OF THE LINES — set for a selection, or for the whole document.
 *
 * Every mantra line has one source: the śākhā whose rules mark it. The lines
 * of the document's own source carry no record (`word/settings.ts` keeps which
 * that is); any other line sits, invisibly, in a control of ours tagged with
 * its source. This module is the one that changes that record, and it never
 * asks the person about controls: they select lines and choose a source.
 *
 * WHY THE XML, AND NOT WORD'S CONTROL CALLS. Taking a control apart and
 * making new ones is `getOoxml` and `insertOoxml` over the stretch the
 * selection reaches — the same two operations the add-in writes every line
 * with — because `insertContentControl` is refused by Word whenever another
 * document is open (`model/part-package.ts`).
 */
import type { ChantProfileKey } from '@siksamitra/format';
import { partOf } from '@siksamitra/interop';
import { bodyParagraphs, withSources } from '../model/sources-package.js';
import { recordRegister } from './settings.js';

/** Word's answers that say a paragraph is NOT in the selection. */
const OUTSIDE = new Set(['Before', 'After', 'AdjacentBefore', 'AdjacentAfter']);

/**
 * The selected lines take `source`; `document` is the document's own source,
 * which needs no record. The stretch rewritten reaches out to the whole of any
 * control of ours the selection starts or ends in, so a run the selection cuts
 * through is split and its other lines keep their source.
 */
export async function setSourceOfSelection(source: ChantProfileKey, document: ChantProfileKey): Promise<void> {
  await Word.run(async (context) => {
    const selection = context.document.getSelection();
    const paragraphs = selection.paragraphs;
    paragraphs.load('items');
    await context.sync();
    const first = paragraphs.items[0];
    const last = paragraphs.items[paragraphs.items.length - 1];
    if (first === undefined || last === undefined) return;
    const around = [first.parentContentControlOrNullObject, last.parentContentControlOrNullObject];
    for (const cc of around) cc.load('isNullObject,tag');
    await context.sync();
    const ours = (cc: Word.ContentControl): boolean => !cc.isNullObject && partOf(cc.tag) !== null;
    const start = ours(around[0]!) ? around[0]!.getRange('Whole') : first.getRange('Whole');
    const end = ours(around[1]!) ? around[1]!.getRange('Whole') : last.getRange('Whole');
    const stretch = start.expandTo(end);
    const inStretch = stretch.paragraphs;
    inStretch.load('items');
    const xml = stretch.getOoxml();
    const body = context.document.body.paragraphs;
    body.load('items');
    await context.sync();
    const where = inStretch.items.map((p) => p.getRange('Whole').compareLocationWith(selection));
    await context.sync();
    const chosen = where.map((w) => !OUTSIDE.has(w.value));
    const to = source === document ? null : source;
    const before = body.items.length;
    const own = bodyParagraphs(xml.value);
    const written = stretch.insertOoxml(withSources(
      xml.value,
      (old, paras) => (paras.some((i) => chosen[i] === true) ? to : old),
      own > inStretch.items.length,
    ), Word.InsertLocation.replace);
    const lines = written.paragraphs;
    lines.load('items');
    const after = context.document.body.paragraphs;
    after.load('items');
    await context.sync();
    if (after.items.length !== before) {
      throw new Error(`setting the source changed the document's paragraphs (${before} became ${after.items.length}) — undo with Ctrl+Z`);
    }
    /* The same lines selected again, whatever Word did with the selection:
       they are re-marked next, and the selection is how they are found. */
    const firstChosen = chosen.indexOf(true);
    const lastChosen = chosen.lastIndexOf(true);
    const a = lines.items[firstChosen];
    const b = lines.items[lastChosen];
    if (a !== undefined && b !== undefined) {
      a.getRange('Start').expandTo(b.getRange(Word.RangeLocation.content).getRange('End')).select();
      await context.sync();
    }
  });
}

/**
 * The whole document takes `source`: it is recorded as the document's own,
 * and every control of ours comes off, keeping its lines — so every line is
 * that source and none carries a record.
 */
export async function setSourceOfDocument(source: ChantProfileKey): Promise<void> {
  await recordRegister(source);
  await Word.run(async (context) => {
    const controls = context.document.contentControls;
    controls.load('items/tag');
    await context.sync();
    for (const cc of controls.items) if (partOf(cc.tag) !== null) cc.delete(true);
    await context.sync();
  });
}
