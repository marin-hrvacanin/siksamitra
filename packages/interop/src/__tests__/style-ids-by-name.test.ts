/**
 * OUR STYLES, WHATEVER ID WORD GAVE THEM — known by name.
 *
 * Measured in real Word: a write into one of his documents made our `Anusvāra`
 * a second style beside his `Anusvara`, with an id of Word's own: `Anusvra`.
 * Read by id, its short pause was a plain `|` and its replaced anusvāra lost
 * what it replaced.
 */
import { describe, expect, it } from 'vitest';
import { builtInStyleIds, mergeRuns, readParagraphs } from '../index.js';

const STYLES = '<w:styles>'
  + '<w:style w:type="character" w:customStyle="1" w:styleId="Anusvra"><w:name w:val="Anusvāra"/></w:style>'
  + '<w:style w:type="character" w:customStyle="1" w:styleId="Virma"><w:name w:val="Virāma"/></w:style>'
  + '<w:style w:type="character" w:customStyle="1" w:styleId="HoldingShort1"><w:name w:val="Holding · Short"/></w:style>'
  + '<w:style w:type="character" w:customStyle="1" w:styleId="Mine"><w:name w:val="Something of his own"/></w:style>'
  + '</w:styles>';
const R = (t: string, s: string) => `<w:r><w:rPr><w:rStyle w:val="${s}"/></w:rPr><w:t xml:space="preserve">${t}</w:t></w:r>`;
const P = `<w:p>${R('|', 'Anusvra')}${R('ˎ', 'Virma')}${R('k', 'HoldingShort1')}${R('x', 'Mine')}</w:p>`;

describe('a style of the vocabulary is known by its name', () => {
  const runs = mergeRuns(readParagraphs(P, STYLES)[0]!.runs);
  it('`Anusvra` named Anusvāra is the Anusvara style', () => expect(runs[0]!.rStyle).toBe('Anusvara'));
  it('`Virma` named Virāma is Virama', () => expect(runs[1]!.rStyle).toBe('Virama'));
  it('`HoldingShort1` named Holding · Short is the short holding', () => expect(runs[2]!.rStyle).toBe('Holding'));
  it('and a style of the person’s own passes through as itself', () => expect(runs[3]!.rStyle).toBe('Mine'));
  it('without a style table, ids are read as they are', () => {
    expect(mergeRuns(readParagraphs(P)[0]!.runs)[0]!.rStyle).toBe('Anusvra');
  });
});

describe('the table the add-in counts its styles by', () => {
  it('knows Word’s ids for ours — so an imported `Virāma` is never “missing”', () => {
    const t = builtInStyleIds(STYLES);
    expect(t.get('Anusvra')).toBe('Anusvara');
    expect(t.get('Virma')).toBe('Virama');
    expect(t.get('HoldingShort1')).toBe('HoldingShort');
    expect(t.has('Mine')).toBe(false);
  });
});
