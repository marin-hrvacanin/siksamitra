/**
 * WHAT A LINE DRAWS AROUND ITS SIGNS — a real document, drawn by the one
 * renderer the views, the reader and every export share.
 *
 * A verse of durgā sūktam ends `… ॥ 1॥`; the line must draw that ending as one
 * `.sign`, which the page stylesheet does not let a line break inside, so its
 * `1॥` can never be carried alone to the next line.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { readChantFile } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';
import { DocumentBlocks } from '../../apps/web/src/views/DocumentBlocks.js';

const read = readChantFile(readFileSync('corpus/chants/durga-suktam.json', 'utf8'));
if (!read.ok) throw new Error(read.error);
const doc = openChantDoc(read.doc);
const html = renderToStaticMarkup(<DocumentBlocks doc={doc} script="iast" />);
const text = (h: string): string => h.replace(/<[^>]+>/g, '');

describe('a verse’s ending, drawn', () => {
  const signs = [...html.matchAll(/<span class="sign">([\s\S]*?)<\/span><\/span>|<span class="sign">([\s\S]*?)<\/span>(?=<span class="sp">|<\/div>)/g)]
    .map((m) => text(m[0]));

  it('every ॥ of the page is inside a sign', () => {
    const outside = text(html.replace(/<span class="sign">[\s\S]*?<\/span>(?=<span class="(?:sp|syl|u)|<\/div>)/g, ''));
    expect(signs.length).toBeGreaterThan(0);
    expect(outside).not.toContain('॥');
  });

  it('and a verse’s number is in the same sign as the daṇḍas on either side of it', () => {
    const numbered = signs.filter((s) => /\d/.test(s));
    expect(numbered.length).toBeGreaterThan(0);
    for (const s of numbered) expect(s, s).toMatch(/॥\s*\d+\s*॥/);
  });

  it('and a space right before a sign is inside it, so the sign stays with its word', () => {
    expect(signs.some((s) => s.startsWith(' '))).toBe(true);
    expect(html).not.toMatch(/<span class="sp">[^<]*<\/span><span class="sign">/);
  });
});
