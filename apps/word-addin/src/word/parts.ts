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
import { asPart } from '../model/part-package.js';
import { documentPartOf } from '../model/opc.js';

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
 * Refused if ANY of them is in a part already: parts do not nest. It asked
 * about the first paragraph only, so a selection beginning outside and
 * reaching into a part put a part inside a part.
 */
export async function makePart(rules: PartRules): Promise<'made' | 'inside'> {
  return Word.run(async (context) => {
    const paragraphs = context.document.getSelection().paragraphs;
    paragraphs.load('items');
    await context.sync();
    const around = paragraphs.items.map((p) => {
      const cc = p.parentContentControlOrNullObject;
      cc.load('isNullObject,tag');
      return cc;
    });
    await context.sync();
    if (around.some((cc) => !cc.isNullObject && partOf(cc.tag) !== null)) return 'inside';
    const range = paragraphs.getFirst().getRange('Whole').expandTo(paragraphs.getLast().getRange('Whole'));
    const cc = range.insertContentControl();
    cc.tag = partTag(rules);
    cc.title = partTitle(rules);
    /* NO FRAME. A part is a stretch of lines with a register of its own, and
       Word draws a content control's frame and title whenever the caret is in
       it — the owner: "what is that outline? It looks confusing." The part is
       still there and still travels with its lines; the panel says which
       register marks the text at the caret. */
    cc.appearance = Word.ContentControlAppearance.hidden;
    try {
      await context.sync();
      return 'made';
    } catch (e) {
      if ((e as { code?: string }).code !== 'GeneralException') throw e;
    }
    /* REFUSED — as Word refuses it whenever another document is open
       (`model/part-package.ts`). The paragraphs' own XML, inside a part. */
    return madeInXml(rules, paragraphs.items.length);
  });
}

/** The selection's paragraphs made a part by putting them back inside one. */
async function madeInXml(rules: PartRules, count: number): Promise<'made'> {
  return Word.run(async (context) => {
    const paragraphs = context.document.getSelection().paragraphs;
    const body = context.document.body.paragraphs;
    paragraphs.load('items');
    body.load('items');
    await context.sync();
    const before = body.items.length;
    const range = paragraphs.getFirst().getRange('Whole').expandTo(paragraphs.getLast().getRange('Whole'));
    const xml = range.getOoxml();
    await context.sync();
    /* Word's package of a range has an empty paragraph after the range's own;
       put back, it would be one the person never had. Counted, not guessed. */
    const own = paragraphXmlCount(xml.value);
    range.insertOoxml(asPart(xml.value, partTag(rules), partTitle(rules), own > count), Word.InsertLocation.replace);
    await context.sync();
    const after = context.document.body.paragraphs;
    after.load('items');
    await context.sync();
    if (after.items.length !== before) {
      throw new Error(`making the part changed the document's paragraphs (${before} became ${after.items.length}) — undo with Ctrl+Z`);
    }
    return 'made' as const;
  });
}

const paragraphXmlCount = (pkg: string): number => (documentPartOf(pkg).match(/<w:p[\s>/]/g) ?? []).length;

/** Undo a part: its lines stay, and the rules of the lines outside every part apply to them again. */
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
