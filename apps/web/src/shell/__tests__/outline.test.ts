/**
 * The navigation panel's tree.
 *
 * What this has to get right is not the shape of a tree — it is that the tree
 * POINTS AT REAL BLOCKS. An outline entry whose target does not exist is a row
 * that does nothing when clicked, and that is the failure mode of every
 * hand-maintained navigator: it drifts from the document and nobody notices
 * until they need it.
 *
 * So every id here is compared against `blockRefs` — the same list the
 * renderer draws and the paginator measures.
 */
import { describe, expect, it } from 'vitest';
import type { ChantDoc, ChantSection, ChantVerse } from '@siksamitra/format';
import { outlineOf } from '../NavPanel.js';
import { blockRefs } from '../../views/blocks.js';

const verse = (id: string, n?: string): ChantVerse => ({
  id,
  ...(n === undefined ? {} : { n }),
  /* A syllable carries its letters: marks live on units, not on syllables. */
  tokens: [{ t: 'syl', iast: 'a', deva: 'अ', tel: 'అ', tam: 'அ', units: [{ c: 'a' }] }],
  src: { lines: ['a'] },
});

const section = (
  id: string, title: string | undefined, verses: ChantVerse[], part?: string,
): ChantSection => ({
  id,
  ...(title === undefined ? {} : { title }),
  ...(part === undefined ? {} : { part }),
  verses,
  items: verses.map((v) => ({ t: 'verse', ...v })),
});

const doc = (sections: ChantSection[]): ChantDoc => ({
  title: 'test',
  titleForms: { iast: 'test' },
  sections,
});

describe('a document with no parts', () => {
  const d = doc([
    section('s1', 'Durgā Sūktam', [verse('v1', '1'), verse('v2', '2')]),
    section('s2', 'Durgā Gāyatrī', [verse('v3')]),
  ]);
  const tree = outlineOf(d);

  it('puts the sections at the top, not one empty part around them', () => {
    expect(tree.map((n) => n.kind)).toEqual(['section', 'section']);
    expect(tree.map((n) => n.label)).toEqual(['Durgā Sūktam', 'Durgā Gāyatrī']);
  });

  it('lists a section s verses under it', () => {
    expect(tree[0]!.children.map((c) => c.label)).toEqual(['1', '2']);
    expect(tree[0]!.children.every((c) => c.kind === 'verse')).toBe(true);
  });

  it('numbers a verse that has no number of its own by its position', () => {
    // Never a blank row: an entry you cannot see is an entry you cannot aim at.
    expect(tree[1]!.children.map((c) => c.label)).toEqual(['1']);
  });
});

describe('a document with parts', () => {
  const d = doc([
    section('s1', 'Prāṇāyāma', [verse('v1')], 'Preparatory steps'),
    section('s2', 'Saṅkalpa', [verse('v2')], 'Preparatory steps'),
    section('s3', 'Gandha', [verse('v3')], 'The sixteen upacāras'),
  ]);
  const tree = outlineOf(d);

  it('groups the sections under the part they belong to', () => {
    expect(tree.map((n) => n.kind)).toEqual(['part', 'part']);
    expect(tree.map((n) => n.label)).toEqual(['Preparatory steps', 'The sixteen upacāras']);
    expect(tree[0]!.children.map((c) => c.label)).toEqual(['Prāṇāyāma', 'Saṅkalpa']);
    expect(tree[1]!.children.map((c) => c.label)).toEqual(['Gandha']);
  });

  it('names a part once, where it changes', () => {
    // Two sections share a part; the part is one row, not two.
    expect(tree.filter((n) => n.label === 'Preparatory steps')).toHaveLength(1);
  });
});

describe('every row points at a block that exists', () => {
  const d = doc([
    section('s1', 'A', [verse('v1', '1'), verse('v2', '2')], 'Part one'),
    section('s2', undefined, [verse('v3')]),
    section('s3', 'C', [verse('v4', '4')], 'Part two'),
  ]);

  const flatten = (nodes: readonly { blockId: string; children: readonly unknown[] }[]): string[] =>
    nodes.flatMap((n) => [
      n.blockId,
      ...flatten(n.children as readonly { blockId: string; children: readonly unknown[] }[]),
    ]);

  it('and the blocks are the renderer s own', () => {
    const targets = flatten(outlineOf(d) as never);
    const real = new Set(blockRefs(d).map((b) => b.id));
    expect(targets.length).toBeGreaterThan(5);
    for (const t of targets) expect(real, `outline points at ${t}`).toContain(t);
  });

  it('an untitled section points at its first verse rather than at nothing', () => {
    const untitled = outlineOf(d).find((n) => n.label === '(untitled)');
    expect(untitled).toBeDefined();
    expect(untitled!.blockId).toBe('v:s2:v3');
  });
});

describe('an empty document', () => {
  it('is an empty tree, not a crash', () => {
    expect(outlineOf(doc([]))).toEqual([]);
  });

  it('a section with no verses still has a row', () => {
    const tree = outlineOf(doc([section('s1', 'Empty step', [])]));
    expect(tree).toHaveLength(1);
    expect(tree[0]!.children).toEqual([]);
  });
});
