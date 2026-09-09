/**
 * Does the stored form give back the marking that went in?
 *
 * The codec exists to make a document small, and every field it leaves out is
 * a field it is claiming to be derivable. A test that encoded and decoded a
 * marking it built itself would prove only that the two functions agree with
 * each other, so the corpus is the oracle here: every marking of all 573
 * verses goes out and comes back, and the check is against the marking as the
 * file itself carries, which the codec had no part in producing.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { STAGE_OF, mark, type Mark } from '../mark.js';
import { decodeMark, decodeMarks, encodeMark, encodeMarks } from '../mark-codec.js';
import { normalizeChantDoc } from '../chant-select.js';
import type { ChantDoc } from '../chant-structure.js';

const CORPUS = join(process.cwd(), 'corpus', 'chants');

describe('one marking', () => {
  it('comes back as it went in', () => {
    const m = mark({ k: 'hold', from: 3, to: 7, v: 'short' });
    expect(decodeMark(encodeMark(m))).toEqual(m);
  });

  it('keeps a point marking a point', () => {
    const m = mark({ k: 'pause', from: 9, to: 9, v: 'long' });
    const back = decodeMark(encodeMark(m));
    expect(back.from).toBe(9);
    expect(back.to).toBe(9);
  });

  it('keeps a rule-placed marking rule-placed, with no value', () => {
    const m = mark({ k: 'sbhakti', from: 2, to: 2, by: 'rule' });
    const back = decodeMark(encodeMark(m));
    expect(back.by).toBe('rule');
    expect(back.v).toBeUndefined();
  });

  it('keeps a rule-placed marking rule-placed, with a value', () => {
    const m = mark({ k: 'svara', from: 0, to: 1, v: 'anudatta', by: 'rule' });
    expect(decodeMark(encodeMark(m))).toEqual(m);
  });

  /* The two omissions, stated as the claims they are. */
  it('does not store the stage, because the kind decides it', () => {
    const t = encodeMark(mark({ k: 'svara', from: 0, to: 1, v: 'anudatta' }));
    expect(JSON.stringify(t)).not.toContain('svara",0,1,"anudatta","svara');
    expect(decodeMark(t).stage).toBe(STAGE_OF.svara);
  });

  it('does not store `by` when it is hand, which is the common case', () => {
    expect(encodeMark(mark({ k: 'hold', from: 0, to: 2, v: 'long' })))
      .toEqual(['hold', 0, 2, 'long']);
  });

  it('sorts, so two saves of one list are the same bytes', () => {
    const a: Mark[] = [
      mark({ k: 'svara', from: 5, to: 6, v: 'anudatta' }),
      mark({ k: 'hold', from: 1, to: 3, v: 'short' }),
    ];
    expect(JSON.stringify(encodeMarks(a)))
      .toBe(JSON.stringify(encodeMarks([...a].reverse())));
  });
});

describe('every marking in the corpus', () => {
  const files = readdirSync(CORPUS).filter((f) => f.endsWith('.json')).sort();

  it('there are documents to check', () => {
    expect(files.length).toBeGreaterThanOrEqual(11);
  });

  for (const file of files) {
    it(`${file} decodes and re-encodes to the same bytes`, () => {
      const doc = normalizeChantDoc(
        JSON.parse(readFileSync(join(CORPUS, file), 'utf8')) as ChantDoc,
      );
      let seen = 0;
      for (const section of doc.sections) {
        for (const verse of section.verses) {
          const stored = verse.marks ?? [];
          if (stored.length === 0) continue;
          seen += stored.length;
          /*
           * THE FILE IS THE ORACLE. These bytes were written by the migration
           * and are what the program will read for the life of the document;
           * a codec that cannot return them unchanged has lost something,
           * whatever it does with a marking the test built itself.
           */
          expect(JSON.stringify(encodeMarks(decodeMarks(stored))), `${file} ${verse.id}`)
            .toBe(JSON.stringify(stored));
        }
      }
      /* A document whose verses all had no markings would pass every
         assertion above without exercising anything. */
      expect(seen, `${file} carries no markings to check`).toBeGreaterThan(0);
    });
  }
});
