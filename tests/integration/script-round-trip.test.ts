/**
 * EVERY SCRIPT IS LOSSLESS, AND THEY ARE INTERCHANGEABLE — over the corpus.
 *
 * A verse written to Word in Devanāgarī, Telugu or Tamil and read back is the
 * SAME verse: every letter, every holding on its own consonant, every accent,
 * change, tick, colon, dot and raised aid (`word/script-runs.ts`). And as the
 * app's four scripts are one text drawn four ways, so are Word's: going
 * IAST → Devanāgarī → Telugu → Tamil → IAST gives back the IAST, and writing a
 * verse again from what was read writes the very same bytes.
 *
 * The expectation is always the IAST writer's own reading of the verse — the
 * truth the script side has to reach — never something computed from the
 * script output being checked.
 */
import { describe, expect, it } from 'vitest';
import type { ChantDoc, ChantToken, TextAndMarks } from '@siksamitra/format';
import { toTextAndMarks } from '@siksamitra/format';
import { documentXml } from '../../packages/interop/src/word/body.js';
import { readParagraphs } from '../../packages/interop/src/docx-read.js';
import { tokensFromRuns } from '../../packages/interop/src/docx.js';
import { blank } from '../../packages/interop/src/__tests__/runs-helpers.js';
import { corpusVerses } from '../helpers/corpus.js';

type Script = 'iast' | 'deva' | 'tel' | 'tam';
const doc = (tokens: ChantToken[]): ChantDoc =>
  ({ title: '', titleForms: {}, sections: [{ id: 's', verses: [{ id: 'v', tokens }] }] }) as unknown as ChantDoc;

const xmlOf = (tokens: ChantToken[], script: Script): string => documentXml(doc(tokens), '', undefined, script);

/** A verse written in `script` and read back, as tokens. */
function through(tokens: ChantToken[], script: Script): ChantToken[] {
  const paras = readParagraphs(xmlOf(tokens, script)).filter((p) => p.pStyle === 'Translit');
  const back: ChantToken[] = [];
  paras.forEach((p, i) => {
    if (i > 0) back.push({ t: 'br' });
    back.push(...tokensFromRuns(p.runs, blank(), `p${i}`, script));
  });
  return back;
}
const tm = (tokens: ChantToken[]): TextAndMarks => toTextAndMarks({ id: 'v', tokens } as never);
const canon = (x: TextAndMarks) => JSON.stringify([x.text, x.marks.map(({ by: _b, ...m }) => JSON.stringify(m)).sort()]);

const verses = corpusVerses().map((v) => v.verse.tokens ?? []);

describe('every script, through Word and back', () => {
  const iast = verses.map((t) => canon(tm(through(t, 'iast'))));

  it('has the whole corpus to measure', () => { expect(verses.length).toBe(573); });

  for (const script of ['deva', 'tel', 'tam'] as const) {
    it(`gives back every verse exactly — text and every mark — in ${script}`, () => {
      const differ = verses.filter((t, i) => canon(tm(through(t, script))) !== iast[i]).length;
      expect(differ).toBe(0);
    });

    it(`writes the same bytes again from what it read, in ${script}`, () => {
      const differ = verses.filter((t) => {
        const once = through(t, script);
        return xmlOf(once, script) !== xmlOf(through(once, script), script);
      }).length;
      expect(differ).toBe(0);
    });
  }

  it('goes IAST → Devanāgarī → Telugu → Tamil → IAST and arrives where it began', () => {
    const differ = verses.filter((t, i) => {
      const chained = through(through(through(through(t, 'deva'), 'tel'), 'tam'), 'iast');
      return canon(tm(chained)) !== iast[i];
    }).length;
    expect(differ).toBe(0);
  });
});

describe('what is never written visibly', () => {
  it('a Devanāgarī line SHOWS no IAST letter — what it cannot show is hidden text', () => {
    const stray = new Set<string>();
    for (const t of verses) {
      for (const p of readParagraphs(xmlOf(t, 'deva')).filter((q) => q.pStyle === 'Translit')) {
        for (const r of p.runs.filter((x) => x.hidden !== true)) for (const ch of r.text) if (/[a-zA-Zāīūṛṝḷḹṁḥṅñṭḍṇśṣ]/u.test(ch)) stray.add(ch);
      }
    }
    expect([...stray]).toEqual([]);
  });
});
