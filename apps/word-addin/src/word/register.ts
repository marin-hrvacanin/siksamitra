/**
 * WHICH REGISTER MARKS THE TEXT AT THE CARET — and choosing another.
 *
 * "Here" is the part the caret is in (`word/rule-parts.ts` in interop), or the document
 * outside every part. The Register menu on the tab and the Settings panel
 * both go through these two functions, so they cannot disagree about what a
 * choice applies to.
 */
import type { ChantProfileKey } from '@siksamitra/format';
import { partHere, setPartHere } from './parts.js';
import { recordRegister, recordedRegister } from './settings.js';

export interface RegisterHere {
  /** Is the caret in a part with rules of its own? */
  inPart: boolean;
  /** What marks the text here — `null` when the document records nothing. */
  register: ChantProfileKey | null;
}

export async function registerHere(): Promise<RegisterHere> {
  const part = await partHere();
  return part === null ? { inPart: false, register: recordedRegister() } : { inPart: true, register: part.register };
}

/** Record `register` for here. Answers what was recorded before, to be undone. */
export async function setRegisterHere(register: ChantProfileKey): Promise<RegisterHere> {
  const before = await registerHere();
  if (before.inPart) await setPartHere({ register });
  else await recordRegister(register);
  return before;
}
