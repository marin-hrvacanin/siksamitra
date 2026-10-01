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
import { READABLE_PROFILE_KEYS, type ChantProfileKey, type Stage } from '@siksamitra/format';
import { CONVENTIONS, STAGES, type ConventionId } from '@siksamitra/engine';
import { REGISTER_SETTING } from '@siksamitra/interop';

const KEY = REGISTER_SETTING;

export function recordedRegister(): ChantProfileKey | null {
  try {
    const v: unknown = Office.context.document.settings.get(KEY);
    return typeof v === 'string' && (READABLE_PROFILE_KEYS as readonly string[]).includes(v)
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

const STAGES_KEY = 'siksamitra.stages';

/** The rule stages this document runs — all of them unless Settings says otherwise. */
export function recordedStages(): ReadonlySet<Stage> {
  try {
    const v: unknown = Office.context.document.settings.get(STAGES_KEY);
    if (Array.isArray(v)) return new Set(STAGES.filter((s) => v.includes(s)));
  } catch { /* Not readable: every stage. */ }
  return new Set(STAGES);
}

export async function recordStages(stages: ReadonlySet<Stage>): Promise<void> {
  try {
    const s = Office.context.document.settings;
    s.set(STAGES_KEY, STAGES.filter((x) => stages.has(x)));
    await new Promise<void>((done) => { s.saveAsync(() => done()); });
  } catch {
    /* Not recorded; the next run uses every stage. */
  }
}

const CONVENTIONS_KEY = 'siksamitra.conventions';

/**
 * The conventions this document is marked with — only the ones a person has
 * switched; the rest are the register's own. See `CONVENTIONS` in the engine.
 */
export function recordedConventions(): Partial<Record<ConventionId, boolean>> {
  try {
    const v: unknown = Office.context.document.settings.get(CONVENTIONS_KEY);
    if (typeof v !== 'object' || v === null) return {};
    const out: Partial<Record<ConventionId, boolean>> = {};
    for (const c of CONVENTIONS) {
      const on = (v as Record<string, unknown>)[c.id];
      if (typeof on === 'boolean') out[c.id] = on;
    }
    return out;
  } catch {
    return {};
  }
}

const MARKED_WITH_KEY = 'siksamitra.conventions.markedWith';

/**
 * THE CONVENTIONS THE TEXT WAS LAST MARKED WITH — not the ones chosen now.
 *
 * Word keeps no record of whether a mark was the rules' or a person's, so a
 * re-run tells the rules' marks by what the rules WOULD have made, and undoes
 * those. Asked of the conventions chosen NOW, it did not recognise what the
 * old ones had made: measured in real Word, the visarga marked as a change
 * before `k` survived switching that convention off, taken for a person's.
 * `null` until the first run, or the first change of the conventions.
 */
export function recordedMarkedWith(): Partial<Record<ConventionId, boolean>> | null {
  try {
    const v: unknown = Office.context.document.settings.get(MARKED_WITH_KEY);
    if (typeof v !== 'object' || v === null) return null;
    const out: Partial<Record<ConventionId, boolean>> = {};
    for (const c of CONVENTIONS) {
      const on = (v as Record<string, unknown>)[c.id];
      if (typeof on === 'boolean') out[c.id] = on;
    }
    return out;
  } catch {
    return null;
  }
}

/** Record that the text is now marked with `used`. */
export async function recordMarkedWith(used: Partial<Record<ConventionId, boolean>>): Promise<void> {
  try {
    const s = Office.context.document.settings;
    s.set(MARKED_WITH_KEY, used);
    await new Promise<void>((done) => { s.saveAsync(() => done()); });
  } catch {
    /* Not recorded; the next run takes the text as marked with the conventions chosen. */
  }
}

export async function recordConventions(chosen: Partial<Record<ConventionId, boolean>>): Promise<void> {
  try {
    const s = Office.context.document.settings;
    /* The first change: what the text was marked with is what was chosen until now. */
    if (recordedMarkedWith() === null) s.set(MARKED_WITH_KEY, recordedConventions());
    s.set(CONVENTIONS_KEY, chosen);
    await new Promise<void>((done) => { s.saveAsync(() => done()); });
  } catch {
    /* Not recorded; the next run uses the register's own. */
  }
}
