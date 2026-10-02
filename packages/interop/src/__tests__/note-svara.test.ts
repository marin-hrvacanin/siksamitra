/**
 * A SVARA INSIDE HIS NOTE IS THE NOTE'S — `p.b. sūryā̍d (with svarita)`.
 *
 * His sūryopaniṣat quotes another reading with its accent, the accent in his
 * `Svara` style inside the comment. Read as a svara of the line, it split the
 * note in two and made a syllable of an accent alone.
 */
import { describe, expect, it } from 'vitest';
import { buildDocument, reportFor, wordRun } from '../index.js';

describe('a note on a mantra line that quotes an accented reading', () => {
  it('is one note, its svara in it, and no syllable of its own', () => {
    const paragraphs = [
      { pStyle: 'Heading2', runs: [wordRun('sūryopaniṣat')] },
      { pStyle: 'Translit', runs: [
        wordRun('sūryā'), wordRun('̎', 'Svara'), wordRun('d parjanyo ॥ 4॥ '),
        wordRun('p.b. sūryā', 'Comment'), wordRun('̍', 'Svara'), wordRun('d (with svarita)', 'Comment'),
      ] },
    ];
    const doc = buildDocument(paragraphs as never, { fallbackTitle: 's', report: reportFor('docx', 0, paragraphs as never) });
    const tokens = doc.sections[0]!.verses[0]!.tokens;
    expect(tokens.filter((t) => t.t === 'text').map((t) => (t as { s: string }).s)).toEqual(['p.b. sūryā̍d (with svarita)']);
    expect(tokens.some((t) => t.t === 'syl' && t.iast === '̍')).toBe(false);
    /* The line's own svara is still the line's. */
    expect(tokens.some((t) => t.t === 'syl' && t.units.some((u) => u.svara === 'dirgha-svarita'))).toBe(true);
  });
});
