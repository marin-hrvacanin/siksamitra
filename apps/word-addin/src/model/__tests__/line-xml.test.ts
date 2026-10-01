/**
 * ONE LINE AS THE ADD-IN WRITES IT, and what stops it being written.
 */
import { describe, expect, it } from 'vitest';
import { mergeRuns, readParagraphs, wordRun as run } from '@siksamitra/interop';
import { blockedIn, lineXml } from '../line-xml.js';
import { decodeRuns } from '../paragraph.js';
import { CARET_BOOKMARK } from '../caret.js';

const cells = (xml: string): string[] => mergeRuns(readParagraphs(xml).flatMap((p) => p.runs))
  .map((r) => `${r.rStyle ?? '-'}${r.superscript ? '^' : ''}:${r.text}`);

describe('lineXml', () => {
  const his = [run('agne । '), run('svarabhakti', 'Comment'), run('\nīḷe')];
  const tm = decodeRuns(his);
  const notes = [{ line: 0, lead: ' ', runs: [run('svarabhakti', 'Comment')] }];

  it('keeps the paragraph\'s own style', () => {
    expect(lineXml({ tm, style: 'Mantra', script: 'iast', notes: [] })).toContain('<w:pStyle w:val="Mantra"/>');
  });
  it('puts the note back at the end of its line', () => {
    expect(cells(lineXml({ tm, style: 'Translit', script: 'iast', notes }))).toEqual(['-:agne । ', 'Comment:svarabhakti', '-:\nīḷe']);
  });
  it('places the caret by the MODEL offset, before the notes go in', () => {
    const xml = lineXml({ tm, style: 'Translit', script: 'iast', notes, caret: { at: 6 } });
    const bookmark = xml.indexOf(`w:name="${CARET_BOOKMARK}"`);
    expect(bookmark).toBeGreaterThan(0);
    expect(bookmark).toBeLessThan(xml.indexOf('svarabhakti'));
  });
  it('a line with no notes is exactly the writer\'s line', () => {
    const plain = lineXml({ tm: decodeRuns([run('agne')]), style: 'Translit', script: 'iast', notes: [] });
    expect(cells(plain)).toEqual(['-:agne']);
  });
});

describe('decodeRuns — the whole paragraph at once', () => {
  it('keeps the tab that indents a pāda', () => {
    expect(decodeRuns([run('rujā |'), run(' \n\tcakrā')]).text).toContain('\n\tcakrā');
  });
  it('and the no-break space', () => {
    expect(decodeRuns([run('tat sa')]).text).toBe('tat sa');
  });
});

describe('blockedIn — what a rewrite would lose', () => {
  const P = (inner: string): string => `<w:p><w:pPr><w:pStyle w:val="Translit"/></w:pPr>${inner}</w:p>`;
  it('nothing, for an ordinary marked line', () => {
    expect(blockedIn(P('<w:r><w:t>agne</w:t></w:r>'), [run('agne')], 'iast')).toEqual([]);
  });
  it('nothing, for a note that ends the line — it is put back', () => {
    expect(blockedIn(P(''), [run('agne '), run('svarabhakti', 'Comment')], 'iast')).toEqual([]);
  });
  it('a note in the middle of the line', () => {
    expect(blockedIn(P(''), [run('agne '), run('(TS)', 'Comment'), run(' īḷe')], 'iast')).toEqual([expect.stringMatching(/note in the middle/)]);
  });
  it('hidden text in an IAST line — a rewrite would show it', () => {
    const hidden = { ...run('oṁ | aruṇāṅ'), hidden: true as const };
    expect(blockedIn(P(''), [hidden], 'iast')).toEqual([expect.stringMatching(/^hidden text/)]);
  });
  it('but not the hidden runs an Indic-script line carries of its own', () => {
    const hidden = { ...run('r'), hidden: true as const };
    expect(blockedIn(P(''), [run('धर्म'), hidden], 'deva')).toEqual([]);
  });
  it('and whatever inTheWay finds — a picture', () => {
    expect(blockedIn(P('<w:r><w:drawing/></w:r>'), [run('a')], 'iast')).toEqual([expect.stringMatching(/^a picture/)]);
  });
});
