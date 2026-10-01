/**
 * RULES — which śākhā marks the text here, what the rules mark, and the
 * switches where marked texts differ.
 *
 * Choosing a register here is the ribbon's Register menu, pressed: the same
 * command (`run`), so a selection outside every part becomes a part of its
 * own and is re-marked, and a part is re-marked by its new register — each
 * after asking, in the panel. What is kept in the document (the stages, the
 * switches) is `word/settings.ts`'s, as before.
 */
import { useState, type ReactNode } from 'react';
import { CHANT_PROFILE_KEYS, CHANT_PROFILE_NOTES, type ChantProfileKey, type Stage } from '@siksamitra/format';
import { CONVENTIONS, STAGES, resolveProfile, type ConventionId } from '@siksamitra/engine';
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

export function RulesTab({ here, busy, press }: { here: Here; busy: boolean; press: (c: Command) => void }): ReactNode {
  const [stages, setStages] = useState<ReadonlySet<Stage>>(recordedStages);
  const [chosen, setChosen] = useState<Partial<Record<ConventionId, boolean>>>(recordedConventions);
  const register: ChantProfileKey = here.register?.register ?? 'taittiriya';
  const inPart = here.register?.inPart === true;
  const selected = here.at !== null && (here.at.from !== here.at.to || here.at.lines.length > 1);

  const toggle = (s: Stage): void => {
    const next = new Set(stages);
    if (next.has(s)) next.delete(s); else next.add(s);
    setStages(next);
    void recordStages(next);
  };
  /* On unless switched: what the register does by itself, then what this
     document has chosen. */
  const defaults = resolveProfile([{ preset: register }]);
  const isOn = (id: ConventionId): boolean => chosen[id] ?? CONVENTIONS.find((c) => c.id === id)!.isOn(defaults);
  const flip = (id: ConventionId): void => {
    const next = { ...chosen, [id]: !isOn(id) };
    setChosen(next);
    void recordConventions(next);
  };

  return (
    <>
      <section className="pnl-group">
        <h3 className="pnl-h">Register {inPart ? '· this part' : selected ? '· the selected lines' : '· lines outside every part'}</h3>
        <p className="pnl-quiet">
          {selected && !inPart
            ? 'Choose one to make the selected lines a part of their own, marked by its rules.'
            : inPart ? 'The caret is in a part with rules of its own: choosing one re-marks this part.'
              : 'Choosing one re-marks the lines outside every part. Select lines first to give them a register of their own.'}
        </p>
        <div className="pnl-cards" role="radiogroup" aria-label="Register">
          {CHANT_PROFILE_KEYS.map((k) => (
            <button
              type="button"
              key={k}
              role="radio"
              aria-checked={k === register}
              className="pnl-reg"
              disabled={busy}
              onClick={() => press(byId(`reg-${k}`))}
            >
              <span className="pnl-reg__name">{CHANT_PROFILE_NOTES[k].name}</span>
              <span className="pnl-reg__where">{CHANT_PROFILE_NOTES[k].where}</span>
            </button>
          ))}
        </div>
        <div className="pnl-wrap">
          <button type="button" className="pnl-btn pnl-btn--small" disabled={busy || !selected} onClick={() => press(byId('part-new'))}
            title={byId('part-new').tip}>New part from the selection</button>
          <button type="button" className="pnl-btn pnl-btn--small" disabled={busy || !inPart} onClick={() => press(byId('part-dissolve'))}
            title={byId('part-dissolve').tip}>Dissolve this part</button>
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
          {CONVENTIONS.map((c) => (
            <label key={c.id} className="pnl-switch pnl-switch--long">
              <input type="checkbox" checked={isOn(c.id)} onChange={() => flip(c.id)} />
              <span>
                <strong>{c.label}</strong>
                <span className="pnl-eg"><span className="pnl-typed">{c.example.typed}</span> → <span>{c.example.marked}</span></span>
                <span className="pnl-quiet">{c.note}</span>
              </span>
            </label>
          ))}
        </div>
      </section>
    </>
  );
}
