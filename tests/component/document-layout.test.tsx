/**
 * A DOCUMENT IS LAID OUT AS HIS FILES ARE — name, heading, source, verses.
 *
 * His single documents open with the text's name in Heading 2, then a
 * heading with its locus, then the verses; the Word export writes exactly
 * that (`word/body.ts`). The page drew no name at all and put a section's
 * source line after its last verse, so a PDF and the Word file of the same
 * document differed at the top of every section — and nothing tested the
 * order, so nothing said so. This does, at all three places that must agree:
 * the block list, the drawn page, and the editor's tree.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readChantFile } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import { readFileSync } from 'node:fs';
import { blockRefs } from '../../apps/web/src/views/blocks.js';
import { DocumentBlocks } from '../../apps/web/src/views/DocumentBlocks.js';
import { docBlocksOf } from '../../apps/web/src/editor/lexical/document.js';

const open = (f: string) => {
  const r = readChantFile(readFileSync(`corpus/chants/${f}.json`, 'utf8'));
  if (!r.ok) throw new Error(r.error);
  return openChantDoc(r.doc);
};

describe('the order of a document', () => {
  const doc = open('durga-suktam');
  const s1 = doc.sections[0]!;

  it('the block list: the name first, then each heading with its source under it, then the verses', () => {
    const ids = blockRefs(doc).map((b) => b.id);
    expect(ids[0]).toBe('n:doc');
    expect(ids.slice(1, 4)).toEqual([`h:${s1.id}`, `c:${s1.id}`, `v:${s1.id}:${s1.verses[0]!.id}`]);
    /* Never at the end of its section any more. */
    const second = doc.sections[1]!;
    expect(ids.indexOf(`c:${second.id}`)).toBe(ids.indexOf(`h:${second.id}`) + 1);
  });

  it('the drawn page: the name in his Heading 2 style, the source right under its heading', () => {
    const html = renderToStaticMarkup(<DocumentBlocks doc={doc} script="iast" />);
    const at = (needle: string): number => html.indexOf(needle);
    expect(at('class="doc__name"')).toBeGreaterThanOrEqual(0);
    expect(html).toContain(`>${doc.title}</h2>`);
    expect(at('class="doc__name"')).toBeLessThan(at('class="section__title"'));
    const heading = at(`data-block-id="h:${s1.id}"`);
    const source = at(`data-block-id="c:${s1.id}"`);
    const verse = at(`data-block-id="v:${s1.id}:${s1.verses[0]!.id}"`);
    expect(heading).toBeLessThan(source);
    expect(source).toBeLessThan(verse);
  });

  it('the editor’s tree: the same drawn blocks in the same order as the page’s list', () => {
    const drawn = docBlocksOf(doc).flatMap((b) => (b.t === 'drawn' ? [b.drawn.blockId] : []));
    const listed = blockRefs(doc).filter((b) => b.kind !== 'verse' && !/^[fi]:/.test(b.id)).map((b) => b.id);
    expect(drawn.filter((id) => /^(n:|h:|c:|p:)/.test(id))).toEqual(listed.filter((id) => /^(n:|h:|c:|p:)/.test(id)));
  });

  it('a document with no name draws none', () => {
    const nameless = { ...doc, title: '' };
    expect(blockRefs(nameless)[0]!.id).not.toBe('n:doc');
    expect(renderToStaticMarkup(<DocumentBlocks doc={nameless} script="iast" />)).not.toContain('doc__name');
  });
});
