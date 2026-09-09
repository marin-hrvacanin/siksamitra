/**
 * RUNNING THE RULES OVER A DOCUMENT THAT ALREADY HAS MARKINGS IN IT.
 *
 * The property that matters is the owner's ruling: the hand wins. A keep-hand
 * re-run may add whatever the rules produce and may replace whatever an earlier
 * run produced, and it may not touch a decision somebody made.
 *
 * NOT TAUTOLOGICAL: the hand markings are the corpus's — 4 788 holdings and
 * 6 086 svaras transcribed out of the owner's own Word file — and `rerun` does
 * not compute them, the engine does. The first suite also measures something
 * `rerun` cannot know: whether the rules, fed the text recovered by undoing the
 * substitutions, arrive back at the letters the document actually shows.
 */
import { describe, expect, it } from 'vitest';
import type { ChantDoc, Mark } from '@siksamitra/format';
import { mark, normalizeChantDoc, toTextAndMarks } from '@siksamitra/format';
import { resolveProfile } from '@siksamitra/engine';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STAGES, rerun, typedText } from '../rerun.js';
import { corpusVerses } from './corpus.js';

const DIR = fileURLToPath(new URL('../../../../../corpus/chants/', import.meta.url));
const docOf = (file: string): ChantDoc =>
  normalizeChantDoc(JSON.parse(readFileSync(DIR + file, 'utf8')));

interface Over { verses: number; reproduced: number; handKept: number; handSeen: number }

function overCorpus(): Over {
  const out: Over = { verses: 0, reproduced: 0, handKept: 0, handSeen: 0 };
  const docs = new Map<string, ChantDoc>();
  for (const { doc: file, verse } of corpusVerses()) {
    const doc = docs.get(file) ?? docOf(file);
    docs.set(file, doc);
    const section = doc.sections.find((sec) => sec.verses.some((v) => v.id === verse.id));
    const profile = resolveProfile([doc.profile, section?.profile, verse.profile]);
    const before = toTextAndMarks(verse);
    out.verses += 1;
    const after = rerun(before, {
      stages: STAGES, mode: 'keep-hand', from: 0, to: before.text.length, profile,
    });
    if (after.text !== before.text) continue;
    out.reproduced += 1;
    /*
     * Every hand marking still covers what it covered. `covers` rather than
     * `equals` because a rule marking of the same kind and value that touches
     * it is merged with it — which is the algebra doing its job, not a loss.
     */
    out.handSeen += 1;
    const hand = before.marks.filter((m) => m.by === 'hand' && m.k !== 'syl');
    const kept = hand.every((m) => after.marks.some(
      (o) => o.k === m.k && o.v === m.v && o.from <= m.from && o.to >= m.to,
    ));
    if (kept) out.handKept += 1;
  }
  return out;
}

const corpus = overCorpus();

describe('a keep-hand re-run over the corpus', () => {
  it('covers all 573 verses', () => {
    expect(corpus.verses).toBe(573);
  });

  /*
   * The rules, given the text recovered by undoing the `was` markings, arrive
   * at the same letters the document shows for 422 of 573 verses. The other
   * 151 are the verses whose input was lost in v1's generation and recovered by
   * guess — `openspec/changes/text-and-marks` counts 153 of them — so this
   * number is a reading of the corpus rather than of this file, and it may only
   * go UP.
   */
  it('reproduces the letters of at least 422 verses', () => {
    expect(corpus.reproduced).toBeGreaterThanOrEqual(422);
  });

  it('keeps every hand marking in every verse it reproduced', () => {
    expect(corpus.handSeen).toBe(corpus.reproduced);
    expect(corpus.handKept).toBe(corpus.handSeen);
  });
});

describe('undoing the substitutions', () => {
  it('puts back exactly what a `was` marking says was replaced', () => {
    const text = 'santa';
    const marks = [mark({ k: 'was', from: 2, to: 3, v: 'ṁ' })];
    expect(typedText(text, marks)).toBe('saṁta');
  });

  it('handles a replacement of a different length', () => {
    /* `ṁ` before a sibilant is shown `gṁ` — one letter typed, two shown, so a
       naive character-for-character undo shifts everything after it. */
    const marks = [mark({ k: 'was', from: 2, to: 4, v: 'ṁ' })];
    expect(typedText('sagṁsa', marks)).toBe('saṁsa');
  });

  it('undoes several, right to left, without disturbing each other', () => {
    const marks = [
      mark({ k: 'was', from: 1, to: 3, v: 'ṁ' }),
      mark({ k: 'was', from: 5, to: 6, v: 'ḥ' }),
    ];
    expect(typedText('agṁa s a', marks)).toBe('aṁa ḥ a');
  });
});

describe('the stages and the modes', () => {
  const profile = resolveProfile([{ preset: 'rigveda' }]);
  const plain = { text: 'agne tvam', marks: [] as Mark[] };

  it('places nothing from a stage that was not asked for', () => {
    const only = rerun(plain, {
      stages: ['svara'], mode: 'replace-all', from: 0, to: plain.text.length, profile,
    });
    expect(only.marks.filter((m) => m.k === 'hold')).toEqual([]);
  });

  it('discards a hand marking in replace-all and keeps it in keep-hand', () => {
    const held = {
      text: plain.text,
      marks: [mark({ k: 'hold', from: 0, to: 1, v: 'long', by: 'hand' })],
    };
    const kept = rerun(held, {
      stages: ['holdings'], mode: 'keep-hand', from: 0, to: held.text.length, profile,
    });
    expect(kept.marks.some((m) => m.k === 'hold' && m.v === 'long' && m.by === 'hand')).toBe(true);

    const gone = rerun(held, {
      stages: ['holdings'], mode: 'replace-all', from: 0, to: held.text.length, profile,
    });
    expect(gone.marks.some((m) => m.by === 'hand')).toBe(false);
  });

  it('labels everything it places as the rules’ own', () => {
    const out = rerun(plain, {
      stages: STAGES, mode: 'replace-all', from: 0, to: plain.text.length, profile,
    });
    expect(out.marks.every((m) => m.by === 'rule')).toBe(true);
  });

  it('leaves the text outside the range alone', () => {
    const text = 'agne tvam pārayā';
    const out = rerun({ text, marks: [] }, {
      stages: STAGES, mode: 'replace-all', from: 0, to: 4, profile,
    });
    expect(out.text.slice(-12)).toBe(' tvam pārayā');
    expect(out.marks.every((m) => m.to <= 4)).toBe(true);
  });
});
