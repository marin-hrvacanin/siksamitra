/**
 * THE PACKAGE A LINE GOES INTO WORD IN — always the clean vocabulary.
 *
 * The owner's ruling (2026-09-30): every document is written in the clean
 * style names, and one of his hand-authored documents is taken into them,
 * looking exactly as it did. So the body is translated to the clean ids, and
 * the style sheet that travels with it carries HIS definitions under those ids
 * wherever his document has them (`hisStylesAsClean` in interop) — a line of
 * his, rewritten, draws as his line drew — and ours for a style he has not got.
 *
 * HIS CANDRABINDU, too, in a document that is his: every one of the 176 in his
 * reference files is U+F141 in his Palladio `VedicAnusvara`. Written the same
 * way wherever his document defines that style in that face; the portable
 * Unicode pair everywhere else.
 */
import { inVocabulary, withHisCandrabindu, withHisDefinitions } from '@siksamitra/interop';
import { flatPackage } from './opc.js';

/** Does this document set his `VedicAnusvara` in URW Palladio ITU? */
const drawsHisCandrabindu = (his: ReadonlyMap<string, string>): boolean =>
  /URW Palladio ITU/.test(his.get('VedicAnusvara') ?? '');

export function packageFor(body: string, sheet: string, his: ReadonlyMap<string, string>): string {
  const clean = inVocabulary(body, 'clean');
  return flatPackage(
    drawsHisCandrabindu(his) ? withHisCandrabindu(clean) : clean,
    withHisDefinitions(inVocabulary(sheet, 'clean'), his),
  );
}

/** The `word/styles.xml` part of a flat OPC package, or '' when it has none. */
export function stylesPartOf(pkg: string): string {
  return /<pkg:part pkg:name="\/word\/styles\.xml"[\s\S]*?<pkg:xmlData>([\s\S]*?)<\/pkg:xmlData>/.exec(pkg)?.[1] ?? '';
}
