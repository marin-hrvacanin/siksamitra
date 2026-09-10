/**
 * THE STYLE SHEET EVERY INSERTION CARRIES.
 *
 * Its own module, out of `word/client.ts`, because it talks to nothing: it is
 * a string built from the design tokens, and it is needed by the pane, by the
 * document-setup command, and by the gate that measures all of it against a
 * real Word — which has no `Word` global to import.
 *
 * `veda-union` is the owner's own document, and `stylesXml` is the `.docx`
 * exporter's own generator — so a box drawn by the add-in is the box the
 * exporter prints and the page shows, to the eighth of a point.
 *
 * WHY A `w:rStyle` CANNOT SIMPLY BE WRITTEN AND LEFT. ECMA-376 §17.7.4.4: a
 * run style naming a style the document has not got is IGNORED. No error, no
 * warning, no box — which is why the sheet travels with every insertion and
 * why `Add the styles` exists at all.
 */
import { stylesXml } from '@siksamitra/interop';
import type { ExportStyle } from '@siksamitra/tokens/export-styles';
import { documentThemeOf, exportStyle, styleStacks } from '@siksamitra/tokens/export-styles';

/** Built once: 8 kB of XML that does not depend on the paragraph. */
let sheet: string | null = null;

export function styleSheet(style: ExportStyle = exportStyle('veda-union')): string {
  if (sheet === null) {
    const stacks = styleStacks(style);
    sheet = stylesXml({
      theme: documentThemeOf(style),
      mode: style.mode,
      textStack: stacks.text,
      uiStack: stacks.ui,
    });
  }
  return sheet;
}
