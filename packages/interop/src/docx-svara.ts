/**
 * ONE RUN IN HIS `Svara` STYLE, READ — out of `docx-runs.ts` at the module
 * gate. What the run's characters are, said to the reader that called it:
 *
 *   - a KAMPA, `3̱̍`, is its digit and both marks, read whole — taken mark by
 *     mark it came back a svarita on a letter `3` (`kampaOf`);
 *   - otherwise each combining mark is the accent of the letter before it;
 *   - the virāma tick is a letter of its own, the middle dot a svarabhakti
 *     before the next letter;
 *   - and anything else typed in the accent's style is still text: Word gives
 *     whatever is typed after an accent the accent's style, so `m̍ ile` arrives
 *     as one Svara run. It used to skip the space, and a second press on the
 *     line wrote `m̍ile` back into the document.
 */
import type { ChantSvara } from '@siksamitra/format';
import { VIRAMA_TICK, kampaOf } from '@siksamitra/engine';
import { SVARA_BY_CHAR } from './word-styles.js';

/** What the reader does with each thing a Svara run holds. */
export interface SvaraRunReader {
  /** The accent of the letter before it — false when there is no letter. */
  readonly accent: (svara: ChantSvara) => boolean;
  readonly tick: () => void;
  readonly dot: () => void;
  readonly letter: (ch: string) => void;
}

export function readSvaraRun(text: string, to: SvaraRunReader): void {
  const kampa = kampaOf(text.trim());
  if (kampa !== undefined) { to.accent(kampa); return; }
  for (const ch of text) {
    const svara = SVARA_BY_CHAR.get(ch);
    if (svara !== undefined && to.accent(svara)) continue;
    if (svara !== undefined) to.letter(ch);
    else if (ch === VIRAMA_TICK) to.tick();
    else if (ch === '·') to.dot();
    else to.letter(ch);
  }
}
