/**
 * WHAT EACH MARKING BUTTON'S TILE SHOWS — a word with the mark on it, drawn
 * by the app's renderer, so a person sees what a press will look like.
 *
 * MARKED BY THE RULES, never by hand alone: a word drawn without the marks
 * the rules give it is a word drawn wrong — the owner, of a `yajña` shown
 * without its reading-aid g. So each sample is a word the Taittirīya rules
 * mark with the tile's mark and as little else as there is, and what they
 * give it is all drawn. A Vedic svara is never derived, so the svara tiles
 * put one on `deva`, which the rules leave otherwise bare.
 */
import type { TextAndMarks } from '@siksamitra/format';
import { mark, normalise } from '@siksamitra/format';
import { STAGES, rerun, resolveProfile } from '@siksamitra/engine';

function ruled(text: string): TextAndMarks {
  const profile = resolveProfile([{ preset: 'taittiriya' }]);
  return rerun({ text, marks: [] }, { stages: STAGES, mode: 'keep-hand', profile, previous: profile, from: 0, to: text.length });
}

function withSvara(text: string, at: number, v: 'anudatta' | 'svarita' | 'dirgha-svarita'): TextAndMarks {
  const tm = ruled(text);
  return { text: tm.text, marks: normalise([...tm.marks, mark({ k: 'svara', from: at, to: at + 1, v, by: 'hand' })]) };
}

let made: Readonly<Record<string, TextAndMarks>> | null = null;

/** Keyed by the command's id in `commands-table.ts`; built once, when first drawn. */
export function tileSample(id: string): TextAndMarks | undefined {
  made ??= {
    'hold-short': ruled('satyam'),
    'hold-long': ruled('ātmā'),
    'svara-anudatta': withSvara('deva', 1, 'anudatta'),
    'svara-svarita': withSvara('deva', 1, 'svarita'),
    'svara-dirgha': withSvara('devā', 3, 'dirgha-svarita'),
    'change-anusvara': ruled('saṁtāpa'),
    'change-visarga': ruled('namaḥ te'),
    candrabindu: ruled('sam̐'),
    svarabhakti: ruled('varṣa'),
    'pause-short': ruled('sa eṣa'),
    'pause-long': ruled('vā apām'),
  };
  return made[id];
}

/** The state key `selectionAcross` reports a command under. */
export const STATE_KEY: Readonly<Record<string, string>> = {
  'hold-short': 'hold-short',
  'hold-long': 'hold-long',
  'svara-anudatta': 'anudatta',
  'svara-svarita': 'svarita',
  'svara-dirgha': 'dirgha-svarita',
  'change-anusvara': 'change-anusvara',
  'change-visarga': 'change-visarga',
};

/** What a mark is called, in the line that says what is on the selection. */
export function markName(k: string, v: string | undefined): string | null {
  if (k === 'hold') return v === 'long' ? 'Long holding' : v === 'short' ? 'Short holding' : null;
  if (k === 'svara') return v === 'anudatta' ? 'Anudātta' : v === 'svarita' ? 'Svarita' : 'Dīrgha svarita';
  if (k === 'was') return `In place of ${v ?? ''}`;
  if (k === 'pause') return v === 'long' ? 'Long pause' : 'Short pause';
  if (k === 'sbhakti') return 'Svarabhakti';
  if (k === 'sup') return `Reading aid ${v ?? ''}`;
  return null;
}
