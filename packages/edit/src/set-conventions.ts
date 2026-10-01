/**
 * THE CONVENTIONS, SWITCHED IN A DOCUMENT — the same four the Word add-in has.
 *
 * Where marked texts differ, the ruling is a switch (`CONVENTIONS` in the
 * engine): ṁ before a nasal takes that nasal, ḥ before k/kh marked as a
 * change, the raised u between v and y, the geminate's box on one letter or
 * both. The add-in has had them since the owner's rulings of 2026-09-30; the
 * app had none, so a document could be marked one way in Word and could not
 * be made to match in the app. Same registry, same patch.
 *
 * STORED AS THE PROFILE'S PATCH, beside the register — where a corpus
 * document already records the older conventions it was marked in — for the
 * sections without a register of their own, or for one section. Like the
 * register, switching one does not run the rules: it takes effect the next
 * time somebody presses Re-apply rules. One undo step.
 */
import type { ChantDoc, ChantProfileRef, ChantSection } from '@siksamitra/format';
import { CONVENTIONS, conventionsPatch, resolveProfile, type ConventionId } from '@siksamitra/engine';
import { record, snapshot, type History } from './history.js';
import type { ProfileResult } from './set-profile.js';

export interface ConventionsChange {
  k: 'conventions';
  /** The sections without a register of their own, or one section. */
  scope: 'document' | 'section';
  sectionId?: string;
  /** The switches to set; the others are left as they are. */
  chosen: Partial<Record<ConventionId, boolean>>;
}

type Patch = NonNullable<ChantProfileRef['patch']>;

/** Two patches, the second's fields over the first's, group by group. */
function merged(was: Patch | undefined, over: Patch): Patch {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [group, fields] of Object.entries({ ...(was ?? {}) })) out[group] = { ...(fields as Record<string, unknown>) };
  for (const [group, fields] of Object.entries(over)) out[group] = { ...(out[group] ?? {}), ...(fields as Record<string, unknown>) };
  return out as Patch;
}

/** Each convention's value where the caret is: the register's, as the patches leave it. */
export function conventionsOf(
  doc: Pick<ChantDoc, 'profile'>,
  section?: Pick<ChantSection, 'profile'>,
): Record<ConventionId, boolean> {
  const profile = resolveProfile([doc.profile, section?.profile]);
  return Object.fromEntries(CONVENTIONS.map((c) => [c.id, c.isOn(profile)])) as Record<ConventionId, boolean>;
}

export function setConventions(doc: ChantDoc, history: History, command: ConventionsChange): ProfileResult | null {
  const target = command.scope === 'section' ? doc.sections.find((s) => s.id === command.sectionId) : undefined;
  if (command.scope === 'section' && target === undefined) return null;
  const scoped = target === undefined ? doc.sections : [target];
  const before = snapshot(doc, scoped.map((s) => s.id), null);
  const patch = conventionsPatch(command.chosen) as Patch;
  const next: ChantDoc = target === undefined
    ? { ...doc, profile: { ...(doc.profile ?? {}), patch: merged(doc.profile?.patch, patch) } }
    : {
      ...doc,
      sections: doc.sections.map((s) => (s.id === target.id
        ? { ...s, profile: { ...(s.profile ?? {}), patch: merged(s.profile?.patch, patch) } }
        : s)),
    };
  const where = target === undefined ? 'The sections without a register of their own' : `“${target.title ?? target.id}”`;
  const said = CONVENTIONS.filter((c) => command.chosen[c.id] !== undefined)
    .map((c) => `${c.label}: ${command.chosen[c.id] === true ? 'on' : 'off'}`).join('; ');
  return {
    doc: next,
    reports: [],
    refusals: [],
    note: `${where} — ${said}. Nothing was re-marked — press Re-apply rules where you want it to take effect.`,
    history: record(history, { before, after: snapshot(next, scoped.map((s) => s.id), null) }),
  };
}
