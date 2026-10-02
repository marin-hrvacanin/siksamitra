/**
 * HIS KAMPA THROUGH WORD — written as one `Svara` run in the kampa's own blue
 * (his śikṣā v5), and read back as the same svara: mark by mark it came back a
 * svarita on a letter `3`.
 */
import { describe, expect, it } from 'vitest';
import type { ChantDoc, ChantToken } from '@siksamitra/format';
import { mark } from '@siksamitra/engine';
import { WORD_MARKS } from '@siksamitra/tokens/word';
import { documentXml } from '../word/body.js';
import { withBodyEdits } from '../word/body-edits.js';

type Syl = Extract<ChantToken, { t: 'syl' }>;
const B = String.fromCodePoint(0x0331);
const A = String.fromCodePoint(0x030d);

function withKampa(): ChantDoc {
  const tokens = mark('ivānavabravo smākam');
  const vo = tokens.find((t): t is Syl => t.t === 'syl' && t.iast === 'vo')!;
  vo.units[vo.units.length - 1]!.svara = 'dirgha-kampa';
  return { title: 'k', titleForms: {}, sections: [{ id: 's1', title: 'One', verses: [{ id: 'a', tokens }] }] } as ChantDoc;
}
const kampaOn = (d: ChantDoc): string | undefined => d.sections[0]!.verses[0]!.tokens
  .flatMap((t) => (t.t === 'syl' ? t.units : [])).find((u) => u.svara === 'dirgha-kampa')?.c;

describe('a kampa in Word', () => {
  const d = withKampa();
  const xml = documentXml(d);

  it('is one Svara run, its digit and both marks, in his kampa blue at the line’s size', () => {
    const sz = Math.round(WORD_MARKS.kampa.size * 2);
    expect(xml).toContain(`<w:r><w:rPr><w:rStyle w:val="Svara"/><w:color w:val="${WORD_MARKS.kampa.color}"/>`
      + `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">3${B}${A}</w:t></w:r>`);
  });

  it('comes back as the same kampa on the same vowel — read back, nothing edited, in every script', () => {
    for (const script of ['iast', 'deva', 'tel', 'tam'] as const) {
      const back = withBodyEdits(d, documentXml(d, '', undefined, script), undefined, script);
      expect(back, script).toEqual({ doc: d, edited: 0, added: 0, removed: 0 });
    }
    expect(kampaOn(d)).toBe('o');
  });

  it('in his Devanāgarī, its digit is the script’s', () => {
    expect(documentXml(d, '', undefined, 'deva')).toContain(`३${B}${A}`);
  });
});
