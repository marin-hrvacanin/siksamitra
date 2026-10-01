/**
 * TAKING ONE OF HIS DOCUMENTS INTO THE CLEAN STYLES — the same look.
 *
 * The owner's ruling (2026-09-30): a hand-authored document in his older ids
 * (`Translit`, `Prijevod`, `Holding`, `2Holding`, `Long`) is not kept in them;
 * it is converted, and "visually there is literally 0 difference". That is
 * what `model/package.ts` makes true — the clean style takes his definition —
 * and this is the conversion itself, run by Import styles:
 *
 *   1. every paragraph that uses one of his ids is written again: a mantra line
 *      through the writer, its letters, marks and notes as they were; any other
 *      paragraph — a translation, a heading with a `Comment` run in it — as its
 *      own OOXML, renamed;
 *   2. a paragraph a rewrite would lose something of (a picture, a field,
 *      hidden text — `blockedIn`) is left as it is, and said;
 *   3. then every style of his that nothing uses any more is removed from the
 *      document, so its Styles pane shows the clean vocabulary alone.
 *
 * Addressed by index across two reads, exactly as the whole-document re-mark is
 * (`client.ts`), and refusing the same way if Word's count and ours disagree.
 */
import {
  VOCABULARY, inTheWay, legacyStylesIn, lineNotes, mergeRuns, paragraphXml, readParagraphs, scriptOfLine,
} from '@siksamitra/interop';
import { documentPartOf } from '../model/opc.js';
import { decodeRuns, isVerseParagraph } from '../model/paragraph.js';
import { blockedIn, lineXml } from '../model/line-xml.js';
import { bodyShape, markIsHidden, wordIndexOf } from '../model/paragraph-index.js';
import { styleSheetFor } from '../model/sheet.js';
import { stylesPartOf } from '../model/package.js';
import { learn, packageOf } from './client.js';
import { lineTargets } from './line-target.js';

/** What a conversion did. */
export interface Converted {
  /** Paragraphs written again in the clean styles. */
  written: number;
  /** Paragraphs left as they were, and why. */
  kept: string[];
  /** His style names removed, nothing using them any more. */
  removed: string[];
}

const CHUNK = 40;

export async function convertDocument(): Promise<Converted> {
  return Word.run(async (context) => {
    const body = context.document.body;
    const ooxml = body.getOoxml();
    const items = body.paragraphs;
    items.load('items');
    await context.sync();
    learn(ooxml.value);
    const part = documentPartOf(ooxml.value);
    const all = readParagraphs(part, ooxml.value);
    const raw = paragraphXml(part);
    const at = wordIndexOf(bodyShape(raw), items.items.length);
    if (at === undefined) {
      throw new Error(`the document changed while it was being read — ${all.length} paragraphs became `
        + `${items.items.length}. Nothing was converted. Try again.`);
    }
    const out: Converted = { written: 0, kept: [], removed: [] };
    const writes: { index: number; xml: string; style: string | null }[] = [];
    all.forEach((p, i) => {
      const xml = raw[i] ?? '';
      if (legacyStylesIn(xml).length === 0) return;
      const runs = mergeRuns(p.runs);
      if (isVerseParagraph(p)) {
        const script = scriptOfLine(runs.filter((r) => r.hidden !== true).map((r) => r.text).join(''));
        const blocked = blockedIn(xml, runs, script);
        if (blocked.length > 0) { out.kept.push(`paragraph ${i + 1}: ${blocked.join(' and ')}`); return; }
        writes.push({ index: i, style: p.pStyle, xml: lineXml({ tm: decodeRuns(runs, script), style: p.pStyle, script, notes: lineNotes(runs).notes }) });
        return;
      }
      const inTheWayOf = inTheWay(xml);
      if (inTheWayOf.length > 0 || markIsHidden(xml)) {
        out.kept.push(`paragraph ${i + 1}: ${inTheWayOf.length > 0 ? inTheWayOf.join(' and ') : 'it is hidden'}`);
        return;
      }
      writes.push({ index: i, xml, style: p.pStyle });
    });
    const going = writes.flatMap((w) => {
      const index = at(w.index);
      const p = index === null ? undefined : items.items[index];
      if (p === undefined) { out.kept.push(`paragraph ${w.index + 1}: next to hidden text`); return []; }
      return [{ w, p }];
    });
    /* Into the part's own content where the line IS the part (`line-target.ts`). */
    const targets = await lineTargets(going.map((g) => g.p));
    for (let k = 0; k < going.length; k += CHUNK) {
      for (const [j, { w, p: target }] of going.slice(k, k + CHUNK).entries()) {
        targets[k + j]!.insertOoxml(packageOf(w.xml, styleSheetFor(w.xml)), Word.InsertLocation.replace);
        /* THE PARAGRAPH'S OWN STYLE, set by name: replacing a paragraph's
           CONTENT keeps its paragraph mark, and the mark is where the style
           is — measured in Word, the line came back in its runs' clean
           styles and still `Translit`. */
        const clean = VOCABULARY.find((e) => e.legacy === w.style && e.legacy !== e.clean);
        if (clean !== undefined) target.style = clean.name;
        out.written += 1;
      }
      await context.sync();
    }

    /* His styles nothing uses any more go: the Styles pane is the clean
       vocabulary's. One still in use — a paragraph kept above — stays. */
    const after = body.getOoxml();
    await context.sync();
    const used = new Set(legacyStylesIn(documentPartOf(after.value)));
    const styles = stylesPartOf(after.value);
    if (Office.context.requirements.isSetSupported('WordApi', '1.5')) {
      for (const id of legacyStylesIn(styles)) {
        if (used.has(id)) continue;
        const name = new RegExp(`w:styleId="${id}"[^>]*>\\s*<w:name w:val="([^"]+)"`).exec(styles)?.[1] ?? id;
        const style = context.document.getStyles().getByNameOrNullObject(name);
        style.load('isNullObject,builtIn');
        await context.sync();
        if (style.isNullObject || style.builtIn) continue;
        style.delete();
        out.removed.push(name);
      }
      await context.sync();
    }
    return out;
  });
}
