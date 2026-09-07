/**
 * Reading pādas out of a document, and writing a mapping back in.
 *
 * Plus the WAV reader, which is here rather than in its own file because
 * everything it exists for is "the command line can open a recording" — and
 * the failures worth catching are the ones that produce a file that decodes
 * without complaint and sounds like noise.
 */
import { describe, expect, it } from 'vitest';
import type { ChantDoc, ChantSection, ChantToken } from '@siksamitra/format';
import { checkMapping, padasOf, writeMapping } from '../document.js';
import { decodeWav } from '../wav.js';
import type { MappedPada } from '../map.js';

const syl = (iast: string): ChantToken => ({ t: 'syl', iast } as ChantToken);
const br = { t: 'br' } as ChantToken;
const sp = { t: 'sp' } as ChantToken;

const section = (verses: { id: string; tokens: ChantToken[] }[]): ChantSection =>
  ({ id: 's1', title: 's1', verses: verses.map((v) => ({ ...v })) } as ChantSection);

const doc = (s: ChantSection): ChantDoc =>
  ({ title: 't', titleForms: { iast: 't' }, sections: [s], version: 4 } as ChantDoc);

describe('the pādas a mapping has to cover', () => {
  it('counts syllables, not characters — a pāda’s share is its metre', () => {
    const out = padasOf(section([
      { id: 'v-1', tokens: [syl('ā'), sp, syl('gnī'), br, syl('mī'), sp, syl('ḷe'), sp, syl('pu')] },
    ]));
    expect(out).toEqual([
      { verseId: 'v-1', line: 0, weight: 2 },
      { verseId: 'v-1', line: 1, weight: 3 },
    ]);
  });

  it('treats a verse with no line break as one pāda', () => {
    expect(padasOf(section([{ id: 'v-1', tokens: [syl('a'), syl('b')] }])))
      .toEqual([{ verseId: 'v-1', line: 0, weight: 2 }]);
  });

  it('skips a line with nothing chanted in it rather than giving it time', () => {
    /* A heading or an instruction standing between pādas has no syllables, and
       a share of the recording in which nobody speaks is a silent segment the
       reader would light up. */
    const out = padasOf(section([
      { id: 'v-1', tokens: [syl('a'), br, br, syl('b')] },
    ]));
    expect(out).toEqual([
      { verseId: 'v-1', line: 0, weight: 1 },
      { verseId: 'v-1', line: 2, weight: 1 },
    ]);
  });

  it('counts the syllables inside a variable slot — they are chanted too', () => {
    const slot = { t: 'slot', name: 'deity', tokens: [syl('du'), syl('rgā')] } as ChantToken;
    expect(padasOf(section([{ id: 'v-1', tokens: [syl('oṁ'), slot] }])))
      .toEqual([{ verseId: 'v-1', line: 0, weight: 3 }]);
  });
});

describe('writing a mapping into a document', () => {
  const mapped: MappedPada[] = [
    { verseId: 'v-1', line: 0, start: 0, end: 4, from: 'breath' },
    { verseId: 'v-1', line: 1, start: 4, end: 9, from: 'breath' },
    { verseId: 'v-2', line: 0, start: 9, end: 15, from: 'even' },
  ];
  const base = doc(section([
    { id: 'v-1', tokens: [syl('a'), br, syl('b')] },
    { id: 'v-2', tokens: [syl('c')] },
  ]));

  it('puts every pāda under its verse, in the shape the reader already plays', () => {
    const out = writeMapping(base, 'durga.mp3', mapped);
    expect(out.recording?.byVerse['v-1']).toEqual({
      file: 'durga.mp3',
      lines: [{ start: 0, end: 4 }, { start: 4, end: 9 }],
    });
    expect(out.recording?.byVerse['v-2']?.lines).toHaveLength(1);
  });

  it('does not touch the document it was given', () => {
    const before = JSON.stringify(base);
    writeMapping(base, 'durga.mp3', mapped);
    expect(JSON.stringify(base)).toBe(before);
  });

  it('leaves verses the mapping does not cover exactly as they were', () => {
    /* Re-mapping one step of a manual must not wipe the other twelve. */
    const withOld: ChantDoc = {
      ...base,
      recording: { byVerse: { 'v-9': { file: 'other.mp3', lines: [{ start: 1, end: 2 }] } } },
    };
    const out = writeMapping(withOld, 'durga.mp3', mapped);
    expect(out.recording?.byVerse['v-9']).toEqual({
      file: 'other.mp3', lines: [{ start: 1, end: 2 }],
    });
  });
});

describe('checking a mapping that was edited by hand', () => {
  const base = doc(section([
    { id: 'v-1', tokens: [syl('a'), br, syl('b')] },
    { id: 'v-2', tokens: [syl('c')] },
  ]));
  const withRows = (byVerse: Record<string, unknown>): ChantDoc =>
    ({ ...base, recording: { byVerse } } as ChantDoc);

  it('passes a mapping it wrote itself', () => {
    const out = writeMapping(base, 'a.mp3', [
      { verseId: 'v-1', line: 0, start: 0, end: 4, from: 'breath' },
      { verseId: 'v-1', line: 1, start: 4, end: 9, from: 'breath' },
      { verseId: 'v-2', line: 0, start: 9, end: 15, from: 'even' },
    ]);
    expect(checkMapping(out)).toEqual([]);
  });

  it('catches a pāda that runs backwards', () => {
    const bad = withRows({ 'v-1': { file: 'a.mp3', lines: [{ start: 9, end: 4 }] } });
    expect(checkMapping(bad)[0]?.why).toContain('before it starts');
  });

  it('catches two pādas that overlap', () => {
    const bad = withRows({
      'v-1': { file: 'a.mp3', lines: [{ start: 0, end: 6 }, { start: 4, end: 9 }] },
    });
    expect(checkMapping(bad)[0]?.why).toContain('before pāda 1 has finished');
  });

  it('catches a verse whose audio starts before the one before it has finished', () => {
    const bad = withRows({
      'v-1': { file: 'a.mp3', lines: [{ start: 0, end: 9 }] },
      'v-2': { file: 'a.mp3', lines: [{ start: 5, end: 12 }] },
    });
    expect(checkMapping(bad).map((p) => p.verseId)).toContain('v-2');
  });

  it('allows two verses to overlap when they are different files', () => {
    /* Per-verse clips each start at zero. Only one take of the whole chant has
       a shared timeline to be out of order on. */
    const fine = withRows({
      'v-1': { file: 'one.mp3', lines: [{ start: 0, end: 9 }] },
      'v-2': { file: 'two.mp3', lines: [{ start: 0, end: 7 }] },
    });
    expect(checkMapping(fine)).toEqual([]);
  });

  it('catches a row for a verse the document does not have, and one with no file', () => {
    expect(checkMapping(withRows({ 'v-99': { file: 'a.mp3' } }))[0]?.why).toContain('no such verse');
    expect(checkMapping(withRows({ 'v-1': { file: '' } }))[0]?.why).toContain('no audio file');
  });
});

/* ── the WAV reader ─────────────────────────────────────────────────────── */

/** A minimal 16-bit PCM WAV, optionally with a junk chunk before the data. */
function wav(samples: number[], rate = 8000, extraChunk = false): Uint8Array {
  const body = samples.length * 2;
  const junk = extraChunk ? 8 + 10 : 0;   /* odd size, so the pad byte matters */
  const bytes = new Uint8Array(44 + junk + body);
  const view = new DataView(bytes.buffer);
  const put = (at: number, s: string): void => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(at + i, s.charCodeAt(i));
  };
  put(0, 'RIFF'); view.setUint32(4, 36 + junk + body, true); put(8, 'WAVE');
  put(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  let at = 36;
  if (extraChunk) {
    put(at, 'LIST'); view.setUint32(at + 4, 9, true);
    for (let i = 0; i < 9; i += 1) view.setUint8(at + 8 + i, 0x41);
    at += 8 + 10;
  }
  put(at, 'data'); view.setUint32(at + 4, body, true);
  for (const [i, s] of samples.entries()) view.setInt16(at + 8 + i * 2, s, true);
  return bytes;
}

describe('reading a WAV', () => {
  it('reads the samples, the rate and the duration', () => {
    const out = decodeWav(wav([0, 16384, -16384, 0], 4));
    expect(out.rate).toBe(4);
    expect(out.duration).toBe(1);
    expect(out.pcm[1]).toBeCloseTo(0.5, 3);
    expect(out.pcm[2]).toBeCloseTo(-0.5, 3);
  });

  it('walks the chunks instead of trusting the 44-byte header', () => {
    /* A recorder that writes a LIST chunk before `data` used to have ten bytes
       of its own metadata decoded as audio — which sounds exactly like a
       recording that begins with a burst of noise, and put a false boundary at
       the top of every mapping. */
    const out = decodeWav(wav([0, 16384, -16384, 0], 4, true));
    expect(out.duration).toBe(1);
    expect(out.pcm[0]).toBe(0);
    expect(out.pcm[1]).toBeCloseTo(0.5, 3);
  });

  it('refuses what it cannot read, by name', () => {
    expect(() => decodeWav(new Uint8Array(8))).toThrow(/RIFF/);
    const mp3ish = wav([0, 0], 4);
    new DataView(mp3ish.buffer).setUint16(20, 85, true);   /* MPEG layer 3 */
    expect(() => decodeWav(mp3ish)).toThrow(/compressed/);
  });
});
