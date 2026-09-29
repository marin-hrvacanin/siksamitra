/**
 * A DOCUMENT THAT MIXES REGISTERS gets a source layer in every section.
 *
 * The sādhanā has Taittirīya anuvākas, Ṛgveda sūktas and smārta ślokas, each
 * with its own pause convention, and one parametrization for the whole file
 * re-derived 145 of its 512 verses. Each section is now fitted on its own and
 * records its parametrization only where it beats the document's.
 */
import { describe, expect, it } from 'vitest';
import { derive, resolveProfile } from '@siksamitra/engine';
import { normalizeChantDoc, type ChantDoc } from '@siksamitra/format';
import { attachSource } from '../../packages/cli/src/attach-src.js';

const WITH = { preset: 'taittiriya', patch: { pauses: { bija: true, hiatus: true } } } as const;
const WITHOUT = { preset: 'taittiriya', patch: { pauses: { bija: false, hiatus: true } } } as const;
const tokensUnder = (ref: object, line: string) =>
  derive({ lines: [line] }, resolveProfile([ref as never]), { trace: false }).tokens;

/** Two sections, each written by a different pause convention. */
function mixed(): ChantDoc {
  const lines = ['oṁ bhūr bhuvaḥ svaḥ ||', 'oṁ namaḥ śivāya ||', 'oṁ gaṁ gaṇapataye namaḥ ||'];
  return normalizeChantDoc({
    title: 'mixed',
    sections: [
      { id: 'a', title: 'with the bīja pause',
        verses: lines.map((l, i) => ({ id: `a-${i}`, n: String(i + 1), tokens: tokensUnder(WITH, l) })) },
      { id: 'b', title: 'without it',
        verses: lines.map((l, i) => ({ id: `b-${i}`, n: String(i + 1), tokens: tokensUnder(WITHOUT, l) })) },
    ],
  } as never);
}

describe('fitting each section on its own', () => {
  it('the two sections really differ — the premise', () => {
    const d = mixed();
    expect(JSON.stringify(d.sections[0]!.verses[0]!.tokens))
      .not.toBe(JSON.stringify(d.sections[1]!.verses[0]!.tokens));
  });

  it('every verse of both sections gains a source layer', () => {
    const { report, doc } = attachSource(mixed(), resolveProfile([{ preset: 'taittiriya' } as never]));
    expect(report.refused).toEqual([]);
    expect(report.attached).toBe(6);
    expect(doc.sections.flatMap((s) => s.verses).every((v) => v.src !== undefined)).toBe(true);
  });

  it('and the section that differs from the document records its own register', () => {
    const { doc } = attachSource(mixed(), resolveProfile([{ preset: 'taittiriya' } as never]));
    const own = doc.sections.map((s) => s.profile);
    /* Exactly one section needs its own; the other inherits the document's. */
    expect(own.filter((p) => p !== undefined)).toHaveLength(1);
    expect(doc.profile).toBeDefined();
  });

  it('re-deriving each verse under its recorded register reproduces it — the proof', () => {
    const { doc } = attachSource(mixed(), resolveProfile([{ preset: 'taittiriya' } as never]));
    for (const s of doc.sections) {
      const prof = resolveProfile([s.profile ?? doc.profile!] as never);
      for (const v of s.verses) {
        const again = derive(v.src!, prof, { trace: false }).tokens;
        expect(JSON.stringify(again), v.id).toBe(JSON.stringify(v.tokens));
      }
    }
  });

  it('a uniform document records NO section registers — the control', () => {
    const d = mixed();
    const uniform: ChantDoc = { ...d, sections: [d.sections[0]!] };
    const { doc } = attachSource(uniform, resolveProfile([{ preset: 'taittiriya' } as never]));
    expect(doc.sections.every((s) => s.profile === undefined)).toBe(true);
  });
});
