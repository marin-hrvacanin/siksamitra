/**
 * A KAMPA, DRAWN — its digit and both marks after its vowel, in the line's own
 * script, and never as a svara's stroke. One renderer: the app's three views,
 * the reader, the add-in's panel, print and every export draw it so.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ChantToken } from '@siksamitra/format';
import { mark } from '@siksamitra/engine';
import { renderSyl } from '../../packages/render/src/render/marks.js';

type Syl = Extract<ChantToken, { t: 'syl' }>;
const B = String.fromCodePoint(0x0331);
const A = String.fromCodePoint(0x030d);
const vo = (): Syl => {
  const s = mark('bravo').find((t): t is Syl => t.t === 'syl' && t.iast === 'vo')!;
  s.units[s.units.length - 1]!.svara = 'dirgha-kampa';
  return s;
};
const drawn = (sc: 'iast' | 'deva', showMarks = true): string =>
  renderToStaticMarkup(<>{renderSyl(vo(), sc, 0, { showMarks } as never)}</>);

describe('a kampa on the page', () => {
  it('in IAST: 3̱̍ after its vowel, as its own sign', () => {
    expect(drawn('iast')).toContain(`<span class="kampa" aria-hidden="true">3${B}${A}</span>`);
  });
  it('in Devanāgarī: the script’s digit, ३̱̍', () => {
    expect(drawn('deva')).toContain(`<span class="kampa" aria-hidden="true">३${B}${A}</span>`);
  });
  it('never as a svara’s stroke', () => {
    expect(drawn('iast')).not.toContain('sv-dirgha-kampa');
    expect(drawn('deva')).not.toContain('sv-dirgha-kampa');
  });
  it('and not at all with the marks hidden', () => {
    expect(drawn('iast', false)).not.toContain('kampa');
  });
});
