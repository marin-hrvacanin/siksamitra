/**
 * CHANGING WHICH RULES GOVERN A DOCUMENT.
 *
 * The rules are not one set. A Taittirīya text and a purāṇic stotra are marked
 * differently — different accent registers, a different anusvāra, different
 * aids — and the engine has always known that: five registers, chosen by a
 * field in the file. Nothing in the editor ever named one, so a document was
 * derived under whichever register its file happened to carry, and there was
 * no way to look at a chant and ask which.
 *
 * This is that command. It sets the register on the document or on one
 * section, and then RE-DERIVES everything the change reaches, because a
 * register is not a label: it is the thing that decided every mark on the
 * page, and leaving the old marks under a new name would be a lie in the
 * document itself.
 *
 * THREE THINGS IT DOES NOT DO.
 *
 *   - It never touches a transcribed verse. A verse with no source layer was
 *     marked by hand and its marks are the record; re-deriving it is rule zero
 *     and is refused everywhere else in this package too.
 *   - It never discards a hand-placed mark. Overrides are addressed to letters
 *     in the source, and the source does not change here, so every one of them
 *     survives and is re-applied over the new derivation.
 *   - It is one undo step. Ctrl+Z puts back both the register and every mark
 *     it changed — which is why `Snapshot` carries the document's profile.
 */
import type { ChantDoc, ChantProfileKey, ChantProfileRef, ChantSection } from '@siksamitra/format';
import { CHANT_PROFILE_NOTES } from '@siksamitra/format';
import { rederive } from './sync.js';
import { record, snapshot, type History } from './history.js';
import type { VerseReport } from './derive-verse.js';

export interface ProfileChange {
  k: 'profile';
  /** The whole document, or one section of it. */
  scope: 'document' | 'section';
  /** Required for `section`, ignored for `document`. */
  sectionId?: string;
  /** The register to move to, or `null` to stop naming one here. */
  preset: ChantProfileKey | null;
}

/** What a section's register resolves to, following the document's when it names none. */
export const registerOf = (
  doc: Pick<ChantDoc, 'profile'>,
  section?: Pick<ChantSection, 'profile'>,
): ChantProfileKey | null =>
  section?.profile?.preset ?? doc.profile?.preset ?? null;

/** A profile reference with a new preset, keeping any patch the document carried. */
function withPreset(
  was: ChantProfileRef | undefined,
  preset: ChantProfileKey | null,
): ChantProfileRef | undefined {
  /*
   * A PATCH SURVIVES THE PRESET. A document may carry both — a register plus
   * a handful of rules turned off for this text — and those exceptions are
   * the author's own decisions about this document, not part of the register
   * they are layered on. Dropping them here would silently undo work.
   */
  const patch = was?.patch;
  if (preset === null) return patch === undefined ? undefined : { patch };
  return patch === undefined ? { preset } : { preset, patch };
}

export interface ProfileResult {
  doc: ChantDoc;
  reports: VerseReport[];
  refusals: string[];
  history: History;
  /** Said in the status bar: what changed and how much moved. */
  note: string;
}

export function setProfile(
  doc: ChantDoc,
  history: History,
  command: ProfileChange,
): ProfileResult | null {
  const target = command.scope === 'section'
    ? doc.sections.find((s) => s.id === command.sectionId)
    : undefined;
  if (command.scope === 'section' && target === undefined) return null;

  const scoped = target === undefined ? doc.sections : [target];
  const before = snapshot(doc, scoped.map((s) => s.id), null);

  /* The new register goes on FIRST: `rederive` reads it off the document. */
  let next: ChantDoc = command.scope === 'document'
    ? { ...doc, profile: withPreset(doc.profile, command.preset) }
    : {
      ...doc,
      sections: doc.sections.map((s) => (s.id === target?.id
        ? { ...s, profile: withPreset(s.profile, command.preset) }
        : s)),
    };
  if (command.scope === 'document' && next.profile === undefined) delete next.profile;

  const overrides = next.overrides ?? [];
  const reports: VerseReport[] = [];
  const refusals: string[] = [];
  const sections = next.sections.map((section) => {
    if (target !== undefined && section.id !== target.id) return section;
    /* Only what CAN be derived: a transcribed verse has no source to derive
       from, and its marks are the record. Rule zero, here as everywhere. */
    const derivable = new Set(
      section.verses.filter((v) => v.src !== undefined).map((v) => v.id),
    );
    if (derivable.size === 0) return section;
    const done = rederive(next, section, derivable, overrides);
    reports.push(...done.reports);
    refusals.push(...done.refusals);
    return done.section;
  });
  next = { ...next, sections };

  const transcribed = scoped.reduce(
    (n, s) => n + s.verses.filter((v) => v.src === undefined).length,
    0,
  );
  const where = target === undefined ? 'the document' : `"${target.title ?? target.id}"`;
  /* Its NAME, not its key: `sukla-yajurveda` is what the file says and
     ‚Śukla Yajurveda’ is what a person says. */
  const named = command.preset === null
    ? 'no register of its own'
    : CHANT_PROFILE_NOTES[command.preset].name;
  const kept = transcribed === 0
    ? ''
    : ` ${transcribed} verse${transcribed === 1 ? '' : 's'} copied from a marked `
      + `source ${transcribed === 1 ? 'was' : 'were'} left as ${transcribed === 1 ? 'it is' : 'they are'}.`;

  return {
    doc: next,
    reports,
    refusals,
    note: `${where} now follows ${named}; ${reports.length} verse`
      + `${reports.length === 1 ? '' : 's'} re-derived.${kept}`,
    history: record(history, {
      before,
      after: snapshot(next, scoped.map((s) => s.id), null),
    }),
  };
}
