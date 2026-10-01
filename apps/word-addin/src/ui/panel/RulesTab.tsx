/**
 * RULES — whose rules mark the text here, what the rules mark, and the
 * switches where marked texts differ.
 *
 * THE SOURCE. Every mantra line has one: the śākhā whose rules mark it. A
 * card pressed is the ribbon's Source menu, pressed — the same command
 * (`run`): the selected lines take that source and are re-marked by it, or,
 * with nothing selected, every line does, after asking. The cards light the
 * source of the lines here; a selection across lines of two sources lights
 * both. There is nothing else to manage — no part to make or undo.
 *
 * A SWITCH THAT CHANGES NOTHING HERE IS GREYED, saying where it applies
 * (`applies` in the engine's `CONVENTIONS`): the purāṇic svaras over a Vedic
 * line, whose svaras are the text's own. The switches are the document's,
 * kept by `word/settings.ts`, so a greyed one keeps its value for the lines
 * it does apply to.
 */
import { useState, type ReactNode } from 'react';
import { CHANT_PROFILE_KEYS, CHANT_PROFILE_NOTES, type ChantProfileKey, type Stage } from '@siksamitra/format';
import { CONVENTIONS, STAGES, conventionApplies, resolveProfile, type Convention, type ConventionId } from '@siksamitra/engine';
import { COMMANDS, type Command } from '../../commands-table.js';
import { recordConventions, recordStages, recordedConventions, recordedStages } from '../../word/settings.js';
import type { Here } from './useHere.js';

/** The five stages in plain words. `change` means a letter the rules REPLACED. */
export const STAGE_LABEL: Readonly<Record<Stage, string>> = {
  sandhi: 'Sandhi',
  change: 'Substitutions — ṁ and ḥ recited otherwise',
  holdings: 'Holdings',
  svara: 'Svaras',
  aids: 'Reading aids and pauses',
};

const byId = (id: string): Command => COMMANDS.find((c) => c.id === id)!;
const profileOf = (k: ChantProfileKey) => resolveProfile([{ preset: k }]);

/** What choosing a source will reach, in a few words. */
export function sourceScope(here: Here): string {
  const lines = here.at?.lines.filter((l) => l.isVerse).length ?? 0;
  const selected = here.at !== null && (here.at.from !== here.at.to || here.at.lines.length > 1);
  if (!selected) return 'every line';
  return lines <= 1 ? 'this line' : `these ${lines} lines`;
}

/** The sources here, named: "Ṛgveda", or "Ṛgveda and Taittirīya". */
export const sourcesName = (sources: readonly ChantProfileKey[]): string => {
  const names = sources.map((k) => CHANT_PROFILE_NOTES[k].name);
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

export function RulesTab({ here, busy, press }: { here: Here; busy: boolean; press: (c: Command) => void }): ReactNode {
  const [stages, setStages] = useState<ReadonlySet<Stage>>(recordedStages);
  const [chosen, setChosen] = useState<Partial<Record<ConventionId, boolean>>>(recordedConventions);
  const scope = sourceScope(here);

  const toggle = (s: Stage): void => {
    const next = new Set(stages);
    if (next.has(s)) next.delete(s); else next.add(s);
    setStages(next);
    void recordStages(next);
  };
  /* Does a switch do anything for the lines here — and if not, its value is
     the one it has where it does apply. */
  const appliesHere = (c: Convention): boolean => here.sources.some((k) => conventionApplies(c, profileOf(k)));
  const isOn = (c: Convention): boolean => {
    const v = chosen[c.id];
    if (v !== undefined) return v;
    const where = appliesHere(c) ? here.sources : CHANT_PROFILE_KEYS.filter((k) => conventionApplies(c, profileOf(k)));
    return c.isOn(profileOf(where.find((k) => conventionApplies(c, profileOf(k))) ?? here.own));
  };
  const flip = (c: Convention): void => {
    const next = { ...chosen, [c.id]: !isOn(c) };
    setChosen(next);
    void recordConventions(next);
  };

  return (
    <>
      <section className="pnl-group">
        <h3 className="pnl-h">Source · {scope}</h3>
        <p className="pnl-quiet">
          {scope === 'every line'
            ? 'Choose one to mark every line by its rules. Select lines first to give only them a source.'
            : here.sources.length > 1
              ? `The selected lines are ${sourcesName(here.sources)}. Choose one and they all take it.`
              : 'Choose one: the selected lines take it and are re-marked by it.'}
        </p>
        <div className="pnl-cards" role="radiogroup" aria-label="Source">
          {CHANT_PROFILE_KEYS.map((k) => (
            <button
              type="button"
              key={k}
              role="radio"
              aria-checked={here.sources.length === 1 && here.sources[0] === k}
              data-here={here.sources.includes(k) ? 'yes' : undefined}
              className="pnl-reg"
              disabled={busy}
              onClick={() => press(byId(`reg-${k}`))}
            >
              <span className="pnl-reg__name">{CHANT_PROFILE_NOTES[k].name}</span>
              <span className="pnl-reg__where">{CHANT_PROFILE_NOTES[k].where}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="pnl-group">
        <h3 className="pnl-h">What Auto-mark marks</h3>
        <div className="pnl-switches">
          {STAGES.map((s) => (
            <label key={s} className="pnl-switch">
              <input type="checkbox" checked={stages.has(s)} onChange={() => toggle(s)} />
              <span>{STAGE_LABEL[s]}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="pnl-group">
        <h3 className="pnl-h">Switches</h3>
        <p className="pnl-quiet">Where marked texts differ. Kept in the document; Auto-mark uses them.</p>
        <div className="pnl-switches">
          {CONVENTIONS.map((c) => {
            const live = appliesHere(c);
            return (
              <label key={c.id} className="pnl-switch pnl-switch--long" data-applies={live ? undefined : 'no'}>
                <input type="checkbox" checked={isOn(c)} disabled={!live} onChange={() => flip(c)} />
                <span>
                  <strong>{c.label}</strong>
                  <span className="pnl-eg"><span className="pnl-typed">{c.example.typed}</span> → <span>{c.example.marked}</span></span>
                  <span className="pnl-quiet">{live ? c.note : c.onlyFor}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>
    </>
  );
}
