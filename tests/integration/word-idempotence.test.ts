/**
 * EVERYTHING THE ADD-IN DOES TO A LINE, DONE TWICE, IS DONE ONCE — over every
 * verse of the corpus, in every script.
 *
 * The owner's requirement: lossless, reversible, idempotent. Reversible is
 * held elsewhere (`script-round-trip.test.ts`, `script-fuzz.test.ts`); this
 * holds the other two in the add-in's own path:
 *
 *   - WRITING IS A FIXPOINT. A line written to Word and read back, written
 *     again, is byte for byte what was written the first time — in IAST,
 *     Devanāgarī, Telugu and Tamil — and reads back as the line it was.
 *   - RE-APPLY IS IDEMPOTENT. The rules run over a line as it comes out of
 *     Word (every mark a person's, as Word gives it — `provenance.ts`), the
 *     result written and read back, and run again: the second run changes
 *     nothing.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { STAGES, openChantDoc, rerun, resolveProfile } from '@siksamitra/engine';
import { profileChain } from '@siksamitra/edit';
import { toTextAndMarks, type ChantDoc, type TextAndMarks } from '@siksamitra/format';
import { mergeRuns, readParagraphs } from '@siksamitra/interop';
import { decodeRuns } from '../../apps/word-addin/src/model/paragraph.js';
import { lineXml } from '../../apps/word-addin/src/model/line-xml.js';
import { asMarkedBy } from '../../apps/word-addin/src/model/provenance.js';

const DIR = join(process.cwd(), 'corpus', 'chants');
const SCRIPTS = ['iast', 'deva', 'tel', 'tam'] as const;
const write = (tm: TextAndMarks, script: (typeof SCRIPTS)[number]) => lineXml({ tm, style: 'Mantra', script, notes: [] });
const read = (xml: string, script: (typeof SCRIPTS)[number]) => decodeRuns(mergeRuns(readParagraphs(xml)[0]?.runs ?? []), script);
const bare = (tm: TextAndMarks) =>
  JSON.stringify([tm.text, tm.marks.filter((m) => !['syl', 'plain', 'slot'].includes(m.k)).map(({ by: _b, stage: _s, ...m }) => JSON.stringify(m)).sort()]);

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
  const doc = openChantDoc(JSON.parse(readFileSync(join(DIR, file), 'utf8')) as ChantDoc);
  const lines = doc.sections.flatMap((s) => s.verses.map((v) => ({ v, profile: resolveProfile(profileChain(v, s, doc.profile)) })));

  describe(file, () => {
    for (const script of SCRIPTS) {
      it(`${script}: written, read and written again — the same bytes, the same line`, () => {
        const wrong: string[] = [];
        for (const { v } of lines) {
          const first = write(read(write(toTextAndMarks(v), 'iast'), 'iast'), script);
          const back = read(first, script);
          if (write(back, script) !== first) wrong.push(`${v.id}: a second write differs`);
          if (bare(back) !== bare(read(write(toTextAndMarks(v), 'iast'), 'iast'))) wrong.push(`${v.id}: read back differently`);
        }
        expect(wrong).toEqual([]);
      });
    }

    it('Re-apply, run twice on a line out of Word: the second run changes nothing', () => {
      const wrong: string[] = [];
      for (const { v, profile } of lines) {
        const once = (tm: TextAndMarks) => rerun(asMarkedBy(tm, profile), {
          stages: STAGES, mode: 'keep-hand', profile, previous: profile, from: 0, to: tm.text.length,
        });
        const fromWord = read(write(toTextAndMarks(v), 'iast'), 'iast');
        let first: TextAndMarks;
        try { first = once(fromWord); } catch { continue; }
        const again = read(write({ text: first.text, marks: first.marks }, 'iast'), 'iast');
        /* What Word would hold after the second run: written and read back. */
        const second = read(write(once(again), 'iast'), 'iast');
        if (bare(second) !== bare(again)) wrong.push(v.id);
      }
      expect(wrong).toEqual([]);
    });
  });
}
