/**
 * A document and a style, out the other end as one `.docx`.
 *
 * The thin half. Everything that decides what the file CONTAINS is
 * `packages/interop/src/word/`, which the window calls too; this is only the
 * part a command answers differently, which for Word is nothing at all — there
 * are no stylesheets to read off disk and no font files to inline, because a
 * `.docx` names its faces and the machine that opens it supplies them.
 *
 * It is here rather than inlined into the gate so that the gate, the CLI and
 * any later caller build the file the same way. `page.mjs` is its sibling.
 */
import { exportWord } from '@siksamitra/interop';
import { exportStyle, styleStacks } from '@siksamitra/tokens/export-styles';
import { parseChantSelect, sliceChantDoc } from '@siksamitra/format';
import { ENGINE } from './page.mjs';

/**
 * Build one.
 *
 * `select` slices the document BEFORE it is embedded, exactly as the page
 * exporter does: what you see in Word is what you can open again, so a file
 * showing one verse must not carry the whole chant.
 */
export function buildWord(doc, options = {}) {
  const style = exportStyle(options.style ?? 'veda-union');
  const selection = options.select === undefined ? null : parseChantSelect(options.select);
  if (options.select !== undefined && selection === null) {
    throw new Error(`cannot read the selection "${options.select}"`);
  }
  const shown = sliceChantDoc(doc, selection);
  const { text, ui } = styleStacks(style);
  return exportWord({
    doc: shown,
    style,
    textStack: text,
    uiStack: ui,
    engine: options.engine ?? ENGINE,
    slug: options.slug ?? `${doc.id ?? 'document'}.docx`,
    script: options.script ?? doc.primaryScript ?? 'iast',
    ...(options.assets === undefined ? {} : { assets: options.assets }),
    ...(options.select === undefined ? {} : { select: options.select }),
    ...(options.savedAt === undefined ? {} : { savedAt: options.savedAt }),
    ...(options.fallback === undefined ? {} : { fallback: options.fallback }),
  }).then((bytes) => ({ bytes, style, doc: shown }));
}
