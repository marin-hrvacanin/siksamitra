/**
 * WHICH REGISTER THIS DOCUMENT IS MARKED IN — kept in the document itself.
 *
 * A marked line does not say which register marked it, and re-marking it under
 * another has to undo what the old one made first: the Ṛgveda's overline and
 * lengthened svaritas, its anunāsika. So the register of the last run is
 * written into the document's own settings (`Office.context.document.settings`,
 * which travel with the file), read when the pane opens, and handed to the
 * rules as the one to undo. On a line that plainly shows the Ṛgveda's marks —
 * `showsLengthening` — the line's own evidence wins.
 *
 * Every call is guarded: a host without settings, or a read-only document, is
 * answered with "not recorded", never with a thrown error.
 */
import { CHANT_PROFILE_KEYS, type ChantProfileKey } from '@siksamitra/format';

const KEY = 'siksamitra.register';

export function recordedRegister(): ChantProfileKey | null {
  try {
    const v: unknown = Office.context.document.settings.get(KEY);
    return typeof v === 'string' && (CHANT_PROFILE_KEYS as readonly string[]).includes(v)
      ? v as ChantProfileKey : null;
  } catch {
    return null;
  }
}

export async function recordRegister(key: ChantProfileKey): Promise<void> {
  try {
    const s = Office.context.document.settings;
    s.set(KEY, key);
    await new Promise<void>((done) => { s.saveAsync(() => done()); });
  } catch {
    /* Not recorded; the next run asks the pane's choice instead. */
  }
}
