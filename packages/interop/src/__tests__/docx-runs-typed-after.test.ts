/**
 * TEXT TYPED AFTER A MARK, IN THE MARK'S STYLE, IS STILL TEXT.
 *
 * Word gives whatever is typed next the character style of the letter before
 * it, the way bold carries on. So after the Word add-in places a svarita, a
 * pause or a virāma tick, the next letters a person types arrive IN THAT
 * STYLE — `m̍ ile` as one Svara run, `| agne` as one Pause run. The reader
 * skipped the space in the first and dropped every letter in the second, and
 * the add-in writes a line back after every press: typing `agnim ile`, then
 * pressing Short, left `agnimile` in the person's document. Found by typing in
 * a real Word.
 */
import { describe, expect, it } from 'vitest';
import { tokensFromRuns } from '../docx.js';
import { blank, cells, run, unitsOf } from './runs-helpers.js';

const SVARITA = '̍';
const read = (...runs: Parameters<typeof tokensFromRuns>[0]) => tokensFromRuns(runs, blank(), 'p');

describe('in the accent style', () => {
  it('keeps the space and the letters, and the accent still lands on the m', () => {
    const t = read(run('agnim'), run(`${SVARITA} ile`, 'Svara'));
    expect(cells(t)).toBe('[a][gnim]␣[i][le]');
    expect(unitsOf(t).find((u) => u.c === 'm')?.svara).toBe('svarita');
  });
  it('the control: the accent alone reads as before', () => {
    const t = read(run('agnim'), run(SVARITA, 'Svara'), run(' ile'));
    expect(cells(t)).toBe('[a][gnim]␣[i][le]');
  });
});

describe('in the pause style', () => {
  it('keeps the letters typed after the bar', () => {
    const t = read(run('oṁ '), run('| agne', 'Pause'));
    expect(cells(t)).toContain('<pause>');
    expect(cells(t)).toContain('[a][gne]');
  });
  it('the control: a bar alone is still only a pause', () => {
    expect(cells(read(run('oṁ '), run('|', 'Pause')))).toBe('[oṁ]␣<pause>');
  });
});

describe('in the virāma style', () => {
  it('keeps the letters typed after the tick', () => {
    const t = read(run('vāk'), run('ˎ ca', 'Virama'));
    expect(unitsOf(t).map((u) => u.c).join('')).toContain('ca');
  });
});
