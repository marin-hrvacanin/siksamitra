/**
 * PAGE n OF THE SHEET — what both hosts' `look` cut a photograph to.
 *
 * The arithmetic only; that the cut is a page of the paper, in the window and
 * in the bot alike, is `npm run check:look`, in a real browser.
 */
import { describe, expect, it } from 'vitest';
import { pageSlice } from '../index.js';

/* A4 at the CSS inch: 297 mm is 1122.5 px. */
const A4 = 1122.5;

describe('pageSlice', () => {
  it('cuts the sheet at the paper’s height', () => {
    expect(pageSlice(3000, A4, 1)).toEqual({ page: 1, pages: 3, y: 0, height: A4 });
    expect(pageSlice(3000, A4, 2)).toEqual({ page: 2, pages: 3, y: A4, height: A4 });
  });
  it('and the last page is as long as what is on it — nothing drawn that the sheet does not have', () => {
    const last = pageSlice(3000, A4, 3);
    expect(last.y).toBe(2 * A4);
    expect(last.height).toBeCloseTo(3000 - 2 * A4);
  });
  it('a page past the end is the last page, and one before the first is the first', () => {
    expect(pageSlice(3000, A4, 99).page).toBe(3);
    expect(pageSlice(3000, A4, 0).page).toBe(1);
    expect(pageSlice(3000, A4, -4).page).toBe(1);
  });
  it('a page that is not a number is the first', () => {
    expect(pageSlice(3000, A4, Number.NaN).page).toBe(1);
    expect(pageSlice(3000, A4, 1.6).page).toBe(2);
  });
  it('a sheet shorter than a page is one page, as tall as it is', () => {
    expect(pageSlice(400, A4, 1)).toEqual({ page: 1, pages: 1, y: 0, height: 400 });
  });
  it('a sheet of exactly two pages is two, not three', () => {
    expect(pageSlice(2 * A4, A4, 5)).toEqual({ page: 2, pages: 2, y: A4, height: A4 });
  });
});
