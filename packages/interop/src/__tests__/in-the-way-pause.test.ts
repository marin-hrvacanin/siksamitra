/**
 * THE UPRIGHT PAUSE IS THE ADD-IN'S OWN — not formatting of the person's.
 * Found in real Word: every line with a pause was refused once pauses were
 * written upright (`pauseRun`).
 */
import { describe, expect, it } from 'vitest';
import { inTheWay } from '../word/in-the-way.js';
import { pauseRun } from '../word/body-parts.js';

const P = (runs: string) => `<w:p>${runs}</w:p>`;
const R = (t: string, rPr = '') => `<w:r>${rPr === '' ? '' : `<w:rPr>${rPr}</w:rPr>`}<w:t xml:space="preserve">${t}</w:t></w:r>`;

describe('inTheWay and the upright pause', () => {
  it('a line with our upright pauses, short and long, may be written', () => {
    expect(inTheWay(P(R('namaste') + pauseRun('|', 'Anusvara') + R(' astu') + pauseRun('|', 'Pause')))).toEqual([]);
  });
  it('as Word gives it back, rsid and all', () => {
    expect(inTheWay(P('<w:r w:rsidR="00A1"><w:rPr><w:rStyle w:val="Pause"/><w:i w:val="0"/><w:iCs w:val="0"/></w:rPr><w:t>|</w:t></w:r>'))).toEqual([]);
  });
  it('but italic turned ON by a person is still theirs', () => {
    expect(inTheWay(P(R('|', '<w:rStyle w:val="Pause"/><w:i/>')))).not.toEqual([]);
  });
  it('and italic off on LETTERS is still theirs', () => {
    expect(inTheWay(P(R('agnim', '<w:rStyle w:val="Svara"/><w:i w:val="0"/>')))).not.toEqual([]);
  });
  it('and a colour on a pause bar is still theirs', () => {
    expect(inTheWay(P(R('|', '<w:rStyle w:val="Pause"/><w:i w:val="0"/><w:color w:val="FF0000"/>')))).not.toEqual([]);
  });
});
