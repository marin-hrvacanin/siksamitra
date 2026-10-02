/**
 * HIS COLUMN, MEASURED IN HIS FACE — `fitLine` with Arial's real widths.
 *
 * His ruling (2026-10-02): lines "sometimes longer, sometimes shorter, but
 * more consistent, no need to fill the entire line", and never "||" at the end
 * of one line with "1||" on the next. Held two ways: none of HIS lines that
 * fit his page is touched, and the bot's nīla sūktam line that wrapped on him
 * comes out as even lines with its ending whole.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readChantFile } from '@siksamitra/format';
import { advanceWidth, fitLine, type LineFit } from '@siksamitra/layout';
import {
  MANTRA_ADVANCE, MANTRA_ADVANCE_FALLBACK, MANTRA_LINE_FILL, WORD_PAGE, WORD_PARAGRAPHS,
} from '@siksamitra/tokens/word';

const VERSE = WORD_PARAGRAPHS.find((p) => p.role === 'verse-line')!;
const COLUMN = WORD_PAGE.widthPt - 2 * WORD_PAGE.marginPt - VERSE.indent - VERSE.right;
const widthOf = advanceWidth(MANTRA_ADVANCE, MANTRA_ADVANCE_FALLBACK, VERSE.size);
const FIT: LineFit = { widthOf, limit: MANTRA_LINE_FILL * COLUMN };

const hisLines = (): string[] => readdirSync('corpus/chants').filter((f) => f.endsWith('.json')).flatMap((f) => {
  const r = readChantFile(readFileSync(`corpus/chants/${f}`, 'utf8'));
  if (!r.ok) return [];
  return r.doc.sections.flatMap((s) => ((s.items ?? s.verses ?? []) as Array<{ text?: unknown }>)
    .flatMap((it) => (typeof it.text === 'string' ? it.text.split('\n') : [])));
});

describe('the width of a line, in his face', () => {
  it('is Arial’s: his bhū sūktam 1’s second line is 434 pt of a 454 pt column', () => {
    expect(COLUMN).toBeCloseTo(453.6, 1);
    expect(widthOf("u̱pasthe̍ te devya-dite̱'gnima̍-nnā̱dama̱-nnādyā̱yā''da̍dhe ॥ 1॥")).toBeCloseTo(434.4, 0);
  });
});

describe('his own lines', () => {
  it('a line of his that fits his page is never divided', () => {
    const lines = hisLines();
    expect(lines.length).toBeGreaterThan(1000);
    const fits = lines.filter((l) => widthOf(l) <= FIT.limit);
    expect(fits.length / lines.length).toBeGreaterThan(0.97);
    for (const l of fits) expect(fitLine(l, FIT)).toEqual([l]);
  });
});

describe('a line too wide for his column — the nīla sūktam that wrapped', () => {
  const line = 'gṛ̱ṇā̱hi ghṛ̱tava̍tī savita̱rā-dhi̍patyaiḥ paya̍svatī̱ ranti̱rāśā̍ no astu dhru̱vā di̱śāṁ viṣṇu̍pa̱tnya-gho̍rā̱-sye-śā̍nā̱ saha̍so̱ yā ma̱notā̎ । bṛ̱haspati̍r māta̱riśvo̱-ta vā̱yus sa̍ndhuvā̱nā vātā̍ a̱bhi no̍ gṛṇantu ॥ 1॥';
  const out = fitLine(line, FIT);

  it('is divided into as few lines as fit, every one of them within the column', () => {
    // 1 393 pt, two half-verses of 895 and 495: three lines and two.
    expect(widthOf(line)).toBeGreaterThan(3 * FIT.limit);
    expect(out.length).toBe(5);
    for (const l of out) expect(widthOf(l)).toBeLessThanOrEqual(FIT.limit);
    expect(out.join(' ')).toBe(line);
  });

  it('a half-verse’s daṇḍa ends a line', () => {
    expect(out.some((l) => l.endsWith('ma̱notā̎ ।'))).toBe(true);
  });

  it('evenly — no stub: no line under half the longest, where filling leaves one', () => {
    const ws = out.map(widthOf);
    expect(Math.min(...ws) / Math.max(...ws)).toBeGreaterThan(0.5);
    /* What a page does by filling: as much as fits, then the rest. */
    const filled: string[] = [];
    for (const word of line.split(' ')) {
      const last = filled[filled.length - 1];
      if (last !== undefined && widthOf(`${last} ${word}`) <= FIT.limit) filled[filled.length - 1] = `${last} ${word}`;
      else filled.push(word);
    }
    const fw = filled.map(widthOf);
    expect(Math.min(...fw) / Math.max(...fw)).toBeLessThan(Math.min(...ws) / Math.max(...ws));
  });

  it('and its ending is whole, on the last line, with its word', () => {
    expect(out[out.length - 1]!.endsWith('gṛṇantu ॥ 1॥')).toBe(true);
    for (const l of out) expect(l).not.toMatch(/^[।॥0-9]/u);
  });
});
