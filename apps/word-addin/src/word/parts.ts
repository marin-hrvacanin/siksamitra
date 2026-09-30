/**
 * PARTS IN WORD — the content controls that give a region its own rules.
 * See `word/rule-parts.ts` in interop for what a part is and why it is a
 * content control.
 *
 * Only the INNERMOST content control around a paragraph is asked about: a
 * part is never nested in another of ours, and a control of somebody else's
 * around ours hides nothing, because Word reports the innermost first.
 */
import { partOf, partTag, partTitle, type PartRules } from '@siksamitra/interop';

/** The part the selection begins in, or `null`, with its control to act on. */
async function controlHere(context: Word.RequestContext): Promise<{ control: Word.ContentControl; rules: PartRules } | null> {
  const cc = context.document.getSelection().paragraphs.getFirst().parentContentControlOrNullObject;
  cc.load('isNullObject,tag');
  await context.sync();
  if (cc.isNullObject) return null;
  const rules = partOf(cc.tag);
  return rules === null ? null : { control: cc, rules };
}

/** The rules of the part the caret is in, or `null` outside every part. */
export async function partHere(): Promise<PartRules | null> {
  return Word.run(async (context) => (await controlHere(context))?.rules ?? null);
}

/**
 * Record these rules for the part the caret is in. `false` when the caret is
 * in no part — the caller then records them for the document instead.
 */
export async function setPartHere(rules: PartRules): Promise<boolean> {
  return Word.run(async (context) => {
    const here = await controlHere(context);
    if (here === null) return false;
    here.control.tag = partTag(rules);
    here.control.title = partTitle(rules);
    await context.sync();
    return true;
  });
}

/**
 * Make the paragraphs the selection touches one part, marked by these rules.
 * Refused inside a part already: parts do not nest.
 */
export async function makePart(rules: PartRules): Promise<'made' | 'inside'> {
  return Word.run(async (context) => {
    if ((await controlHere(context)) !== null) return 'inside';
    const paragraphs = context.document.getSelection().paragraphs;
    const range = paragraphs.getFirst().getRange('Whole').expandTo(paragraphs.getLast().getRange('Whole'));
    const cc = range.insertContentControl();
    cc.tag = partTag(rules);
    cc.title = partTitle(rules);
    cc.appearance = Word.ContentControlAppearance.boundingBox;
    await context.sync();
    return 'made';
  });
}

/** Undo a part: its lines stay, and the document's own rules apply to them again. */
export async function dissolvePartHere(): Promise<PartRules | null> {
  return Word.run(async (context) => {
    const here = await controlHere(context);
    if (here === null) return null;
    here.control.delete(true);
    await context.sync();
    return here.rules;
  });
}

/** Select the whole of the part the caret is in, to run the rules over it. */
export async function selectPartHere(): Promise<boolean> {
  return Word.run(async (context) => {
    const here = await controlHere(context);
    if (here === null) return false;
    here.control.getRange(Word.RangeLocation.content).select();
    await context.sync();
    return true;
  });
}
