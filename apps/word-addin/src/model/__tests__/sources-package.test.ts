/**
 * The record of which source each line is, rewritten — against packages
 * built here, so every case of "select lines, choose a source" is covered
 * without Word: into a stretch of another source, across two, back to the
 * document's own, and around a table and a control that are not ours.
 */
import { describe, expect, it } from 'vitest';
import { partOf } from '@siksamitra/interop';
import { bodyParagraphs, withSources } from '../sources-package.js';

const p = (t: string): string => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;
const ours = (register: string, inner: string): string =>
  `<w:sdt><w:sdtPr><w:alias w:val="x"/><w:tag w:val="siksamitra:part:v1:${register}"/></w:sdtPr><w:sdtContent>${inner}</w:sdtContent></w:sdt>`;
const pkg = (body: string): string =>
  `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`;

/** Each line's text and the source it ends up in, read back out of the rewritten XML. */
function linesOf(out: string): string[] {
  const body = /<w:body>([\s\S]*)<\/w:body>/.exec(out)![1]!;
  const lines: string[] = [];
  const re = /<w:sdt>[\s\S]*?<w:tag w:val="([^"]*)"\/>[\s\S]*?<w:sdtContent>([\s\S]*?)<\/w:sdtContent><\/w:sdt>|<w:p>[\s\S]*?<w:t>([^<]*)<\/w:t>[\s\S]*?<\/w:p>/g;
  for (let m = re.exec(body); m !== null; m = re.exec(body)) {
    if (m[1] !== undefined) {
      for (const t of m[2]!.match(/<w:t>([^<]*)<\/w:t>/g) ?? []) lines.push(`${t.replace(/<\/?w:t>/g, '')}:${partOf(m[1])?.register}`);
    } else lines.push(`${m[3]}:-`);
  }
  return lines;
}

/** Every line in `selected` (by its index) takes `to`; the rest keep theirs. */
const choose = (selected: number[], to: string | null) =>
  (old: string | null, paras: readonly number[]) => (paras.some((i) => selected.includes(i)) ? to : old) as never;

describe('choosing a source for selected lines', () => {
  it('lines of the document’s own become a run of the new source, and nothing else moves', () => {
    const out = withSources(pkg(p('a') + p('b') + p('c') + p('d')), choose([1, 2], 'rigveda'));
    expect(linesOf(out)).toEqual(['a:-', 'b:rigveda', 'c:rigveda', 'd:-']);
    expect(out).toContain('<w15:appearance w15:val="hidden"/>');
  });

  it('a line inside a run of another source splits it in three, each kept in its own', () => {
    const out = withSources(pkg(ours('rigveda', p('a') + p('b') + p('c'))), choose([1], 'smarta'));
    expect(linesOf(out)).toEqual(['a:rigveda', 'b:smarta', 'c:rigveda']);
  });

  it('a selection across two sources gives all of it the one chosen', () => {
    const out = withSources(pkg(ours('rigveda', p('a') + p('b')) + p('c') + ours('smarta', p('d'))), choose([1, 2, 3], 'taittiriya'));
    expect(linesOf(out)).toEqual(['a:rigveda', 'b:taittiriya', 'c:taittiriya', 'd:taittiriya']);
  });

  it('choosing the document’s own source takes the record off — no control is left', () => {
    const out = withSources(pkg(ours('rigveda', p('a') + p('b'))), choose([0, 1], null));
    expect(linesOf(out)).toEqual(['a:-', 'b:-']);
    expect(out).not.toContain('<w:sdt>');
  });

  it('and back again, in any direction, the lines are where they were', () => {
    const start = pkg(p('a') + p('b') + p('c'));
    const there = withSources(start, choose([1], 'rigveda'));
    const across = withSources(there, choose([1], 'smarta'));
    const back = withSources(across, choose([1], null));
    expect(linesOf(back)).toEqual(['a:-', 'b:-', 'c:-']);
    expect(bodyParagraphs(back)).toBe(bodyParagraphs(start));
  });

  it('a table and a control that is not ours are kept whole, and counted as their paragraphs', () => {
    const table = `<w:tbl><w:tr><w:tc>${p('t1')}</w:tc><w:tc>${p('t2')}</w:tc></w:tr></w:tbl>`;
    const theirs = `<w:sdt><w:sdtPr><w:tag w:val="someone-else"/></w:sdtPr><w:sdtContent>${p('x')}</w:sdtContent></w:sdt>`;
    const seen: number[][] = [];
    const out = withSources(pkg(p('a') + table + theirs + p('b')), (old, paras) => { seen.push([...paras]); return old as never; });
    expect(seen).toEqual([[0], [1, 2], [3], [4]]);
    expect(out).toContain(table);
    expect(out).toContain(theirs);
  });

  it('Word’s empty paragraph after a range is dropped when asked, never a line with text', () => {
    const out = withSources(pkg(p('a') + '<w:p/>'), (old) => old as never, true);
    expect(bodyParagraphs(out)).toBe(1);
    const kept = withSources(pkg(p('a') + p('b')), (old) => old as never, true);
    expect(bodyParagraphs(kept)).toBe(2);
  });
});
