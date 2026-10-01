/**
 * THE PAUSES IN A WORD FILE ARE HIS COLOURS — long red, short blue.
 *
 * The owner's ruling (2026-10-01): one bar each, the colour says the length.
 * The writer puts a long pause (and a bar) in `Pause` and a short one in the
 * change style; `Pause` was defined with the SHORT pause's colour, so every
 * long pause in an exported file came out blue where his are red — and the
 * Word gate was what said so. Read out of the file itself, not the tokens.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { readChantFile } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import { exportStyle, styleStacks } from '@siksamitra/tokens/export-styles';
import { WORD_MARKS } from '@siksamitra/tokens/word';
import { exportWord } from '../word/export.js';

async function exported(): Promise<{ styles: string; body: string }> {
  const read = readChantFile(readFileSync('corpus/chants/durga-suktam.json', 'utf8'));
  if (!read.ok) throw new Error(read.error);
  const style = exportStyle('veda-union');
  const stacks = styleStacks(style);
  const bytes = await exportWord({
    doc: openChantDoc(read.doc), style, textStack: stacks.text, uiStack: stacks.ui,
    engine: 'test', slug: 'durga.docx', script: 'iast',
  });
  const zip = unzipSync(bytes);
  return { styles: strFromU8(zip['word/styles.xml']!), body: strFromU8(zip['word/document.xml']!) };
}

const colourOf = (styles: string, id: string): string | undefined =>
  new RegExp(`w:styleId="${id}"[\\s\\S]*?<w:color w:val="([0-9A-Fa-f]{6})"`).exec(styles)?.[1]?.toUpperCase();

describe('pause colours in a Word file', () => {
  it('Pause — the long pause and the bar — is his red; the change style the short one is in is his blue', async () => {
    const { styles, body } = await exported();
    expect(colourOf(styles, 'Pause')).toBe(WORD_MARKS.pause.color.toUpperCase());
    expect(colourOf(styles, 'Anusvara')).toBe(WORD_MARKS.change.color.toUpperCase());
    /* And the document uses them so: there are pauses in Pause and pauses in the change style. */
    const pauses = [...body.matchAll(/<w:r>(?:(?!<\/w:r>)[\s\S])*?<w:rStyle w:val="([A-Za-z0-9]+)"\/>(?:(?!<\/w:r>)[\s\S])*?<w:t[^>]*>\|<\/w:t>/g)].map((m) => m[1]);
    expect(pauses).toContain('Pause');
    expect(pauses.some((s) => s !== 'Pause')).toBe(true);
  });
});
