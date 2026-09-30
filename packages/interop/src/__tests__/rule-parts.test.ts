/**
 * A part's tag round-trips, refuses what is not ours, and is versioned —
 * it lives in people's files. And the content control it is written as is one
 * the paragraph reader finds around every paragraph inside it.
 */
import { describe, expect, it } from 'vitest';
import { CHANT_PROFILE_KEYS } from '@siksamitra/format';
import { partOf, partTag, partTitle, partXml } from '../word/rule-parts.js';
import { readParagraphs } from '../docx-read.js';

describe('a part tag', () => {
  it('round-trips every register', () => {
    for (const register of CHANT_PROFILE_KEYS) expect(partOf(partTag({ register }))).toEqual({ register });
  });
  it('is versioned', () => {
    expect(partTag({ register: 'rigveda' })).toBe('siksamitra:part:v1:rigveda');
  });
  it('is not ours when it is somebody else’s, empty, or names no register', () => {
    for (const t of [undefined, null, '', 'MyControl', 'siksamitra:part:v1:', 'siksamitra:part:v1:nonsense',
      'siksamitra:part:v2:rigveda']) expect(partOf(t)).toBeNull();
  });
  it('titles the part with the register’s own name', () => {
    expect(partTitle({ register: 'taittiriya' })).toContain('Taittirīya');
  });
  it('is written as a content control the reader finds around its paragraphs', () => {
    const para = (t: string): string => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;
    const xml = `<w:body>${para('before')}${partXml(para('one') + para('two'), { register: 'rigveda' }, 7)}${para('after')}</w:body>`;
    expect(readParagraphs(xml).map((p) => [p.runs[0]?.text, partOf(p.sdt)?.register ?? null])).toEqual([
      ['before', null], ['one', 'rigveda'], ['two', 'rigveda'], ['after', null],
    ]);
    expect(xml).toContain('<w:alias w:val="Ṛgveda — śikṣāmitra"/>');
  });
});
