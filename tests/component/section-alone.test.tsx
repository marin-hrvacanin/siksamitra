/**
 * A SECTION OF A BOOK, OPENED ALONE, IS DRAWN AS A TEXT OF ITS OWN.
 *
 * Asked for the gāyatrī, the bot opened it out of his sādhanā — a book — and
 * the PDF's first two pages were the sādhanā's title page and its contents:
 * "I asked just for gayatri! Why those 2 pages?" (2026-10-02). Drawn by the
 * one renderer the views and every export share.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ChantDoc } from '@siksamitra/format';
import { documentOf, sectionDoc } from '@siksamitra/agent';
import { DocumentBlocks } from '../../apps/web/src/views/DocumentBlocks.js';

const parts = documentOf({
  title: 'sādhanā',
  sections: [
    { title: 'gaṇapati dhyānam', verses: [{ lines: ['śuklāmbaradharaṁ viṣṇuṁ śaśivarṇaṁ caturbhujam ।', 'prasannavadanaṁ dhyāyet sarvavighnopaśāntaye ॥'], numbered: false }] },
    { title: 'gāyatrī mantra', cite: 'ṛgvedasaṁhitā 3.62.10.', verses: [{ lines: ['tat savitur vareṇyaṁ bhargo devasya dhīmahi ।', 'dhiyo yo naḥ pracodayāt ॥'], numbered: false }] },
  ],
});
const book: ChantDoc = {
  ...parts,
  title: 'Veda Union sādhanā',
  book: true,
  cover: { lines: ['Veda Union', 'sādhanā'] },
  contents: { title: 'Viṣayānukramaṇikā - Table of Contents' },
  sections: parts.sections.map((s) => ({ ...s, part: '॥ prastāvanā ॥' })),
};
const drawn = (doc: ChantDoc): string => renderToStaticMarkup(<DocumentBlocks doc={doc} script="iast" />);

describe('a section of a book, opened alone', () => {
  const gayatri = book.sections[1]!.id;
  const html = drawn(sectionDoc(book, gayatri));

  it('the book is drawn with its title page and contents', () => {
    expect(drawn(book)).toContain('doc__cover');
    expect(drawn(book)).toContain('doc__contents');
  });

  it('the section has neither, nor the part it stood in', () => {
    expect(html).not.toContain('doc__cover');
    expect(html).not.toContain('doc__contents');
    expect(html).not.toContain('prastāvanā');
    expect(html).not.toContain('Veda Union');
  });

  it('its heading is its name, said once, with its source line under it', () => {
    expect(html).toMatch(/<h2 class="doc__name"[^>]*>gāyatrī mantra<\/h2>/);
    expect(html.match(/gāyatrī mantra/g)).toHaveLength(1);
    expect(html).toContain('ṛgvedasaṁhitā 3.62.10.');
  });
});
