/**
 * SETTINGS — the one thing the add-in shows in Word's side panel, and only
 * when the Settings button on the tab is pressed.
 *
 * Every action is on the tab. What is here is what needs room to be read, and
 * is set once rather than pressed: the register (with what each one is), the
 * stages the rules run, the styles this document has, and the keyboard
 * shortcuts. All of it is kept in the document (`word/settings.ts`), so it
 * travels with the file.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { CHANT_PROFILE_KEYS, CHANT_PROFILE_NOTES } from '@siksamitra/format';
import type { ChantProfileKey, Stage } from '@siksamitra/format';
import { CONVENTIONS, STAGES, resolveProfile, type ConventionId } from '@siksamitra/engine';
import { officeChord } from '@siksamitra/ui';
import { COMMANDS, LEADER_COMMANDS } from '../commands-table.js';
import { ADDIN_VERSION, GUIDE_URL } from '../version.js';
import { addStyles, documentStyles, type DocStyles } from '../word/client.js';
import { convertDocument } from '../word/convert.js';
import { recordConventions, recordStages, recordedConventions, recordedStages } from '../word/settings.js';
import { registerHere, setRegisterHere } from '../word/register.js';
import { useMode } from './useMode.js';
import { InsertDocument } from './InsertDocument.js';

/**
 * THE FIVE STAGES, in plain words rather than the engine's identifiers.
 * `change` does not mean "change" — it means a letter the rules REPLACED.
 */
export const STAGE_LABEL: Readonly<Record<Stage, string>> = {
  sandhi: 'Sandhi',
  change: 'Substitutions (ṁ and ḥ replaced)',
  holdings: 'Holdings',
  svara: 'Accents',
  aids: 'Reading aids and pauses',
};

export function Settings(): ReactNode {
  const mode = useMode();
  const [register, setRegister] = useState<ChantProfileKey>('taittiriya');
  const [inPart, setInPart] = useState(false);
  const [stages, setStages] = useState<ReadonlySet<Stage>>(recordedStages);
  const [chosen, setChosen] = useState<Partial<Record<ConventionId, boolean>>>(recordedConventions);
  const [styles, setStyles] = useState<DocStyles | null>(null);
  const [busy, setBusy] = useState(false);

  const readStyles = (): void => { void documentStyles().then(setStyles, () => setStyles(null)); };
  /* Which register marks the text at the caret: its part's, or that of the lines outside every part. */
  const readHere = (): void => {
    void registerHere().then((h) => { setInPart(h.inPart); setRegister(h.register ?? 'taittiriya'); }, () => undefined);
  };
  useEffect(readStyles, []);
  useEffect(readHere, []);
  useEffect(() => {
    if (typeof Office === 'undefined') return undefined;
    Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, readHere);
    return () => { Office.context.document.removeHandlerAsync(Office.EventType.DocumentSelectionChanged, { handler: readHere }); };
  }, []);
  /* The panel can stay open while the document changes under it. */
  useEffect(() => {
    if (typeof Office === 'undefined') return undefined;
    const again = (): void => {
      readHere();
      setStages(recordedStages());
      setChosen(recordedConventions());
    };
    Office.addin?.onVisibilityModeChanged?.(() => { again(); readStyles(); });
    return undefined;
  }, []);

  const choose = (k: ChantProfileKey): void => { setRegister(k); void setRegisterHere(k); };
  const toggle = (s: Stage): void => {
    const next = new Set(stages);
    if (next.has(s)) next.delete(s); else next.add(s);
    setStages(next);
    void recordStages(next);
  };
  /* On unless switched: what the register does by itself, then what this
     document has chosen. */
  const defaults = resolveProfile([{ preset: register }]);
  const isOn = (id: ConventionId): boolean =>
    chosen[id] ?? CONVENTIONS.find((c) => c.id === id)!.isOn(defaults);
  const flip = (id: ConventionId): void => {
    const next = { ...chosen, [id]: !isOn(id) };
    setChosen(next);
    void recordConventions(next);
  };
  const put = async (): Promise<void> => {
    setBusy(true);
    try {
      await addStyles(false);
      /* His older names are taken into the clean ones — the same look. */
      if ((styles?.older.length ?? 0) > 0) await convertDocument();
    } finally { setBusy(false); readStyles(); }
  };

  return (
    <div className="set" data-chrome="palladio" data-mode={mode} data-density="compact">
      <section className="set__box">
        <h2 className="set__h">Register {inPart ? '— this part' : '— lines outside every part'}</h2>
        <p className="set__note">
          {inPart
            ? 'The caret is in a part with rules of its own. What you choose here marks this part only.'
            : 'The caret is in no part. What you choose here marks the lines outside every part; to give some lines a śākhā of their own, select them and choose it from the tab’s Register menu.'}
          {' '}Choosing one here re-marks nothing: press Re-apply rules on the tab, or choose from the tab’s
          Register menu, which offers to.
        </p>
        <div role="radiogroup" aria-label="Register" className="set__regs">
          {CHANT_PROFILE_KEYS.map((k) => (
            <label key={k} className="set__reg" data-on={k === register ? 'yes' : undefined}>
              <input type="radio" name="register" checked={k === register} onChange={() => choose(k)} />
              <span>
                <strong>{CHANT_PROFILE_NOTES[k].name}</strong>
                <span className="set__where">{CHANT_PROFILE_NOTES[k].where}</span>
                <span className="set__what">{CHANT_PROFILE_NOTES[k].what}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="set__box">
        <h2 className="set__h">What the rules mark</h2>
        <p className="set__note">Re-apply rules runs only the stages ticked here.</p>
        <fieldset className="set__stages">
          <legend className="set__sr">Stages</legend>
          {STAGES.map((s) => (
            <label key={s}>
              <input type="checkbox" checked={stages.has(s)} onChange={() => toggle(s)} />
              {STAGE_LABEL[s]}
            </label>
          ))}
        </fieldset>
      </section>

      <section className="set__box">
        <h2 className="set__h">Conventions</h2>
        <p className="set__note">How the text is marked where marked texts differ. Kept in the file; Re-apply rules uses them.</p>
        <fieldset className="set__conv">
          <legend className="set__sr">Conventions</legend>
          {CONVENTIONS.map((c) => (
            <label key={c.id} className="set__convrow">
              <input type="checkbox" checked={isOn(c.id)} onChange={() => flip(c.id)} />
              <span>
                <strong>{c.label}</strong>
                <span className="set__eg"><span className="set__typed">{c.example.typed}</span> → <span className="set__marked">{c.example.marked}</span></span>
                <span className="set__what">{c.note}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="set__box">
        <h2 className="set__h">Styles in this document</h2>
        {styles !== null && styles.older.length > 0 && (
          <p className="set__note">
            This document uses the older style names ({styles.older.join(', ')}). Import styles takes it into the
            clean ones — Mantra, Translation, Holding · Short and the rest — and it looks exactly as it does now.
          </p>
        )}
        {styles === null
          ? <p className="set__note">Reading the document…</p>
          : styles.missing.length === 0 && styles.older.length === 0
            ? <p className="set__note">All {styles.total} śikṣāmitra styles are here.</p>
            : (
              <>
                {styles.missing.length > 0 && (
                  <p className="set__note">
                    {styles.total - styles.missing.length} of {styles.total} are here. A marking adds the style it
                    needs by itself; Import styles brings them all in at once. Missing: {styles.missing.join(', ')}.
                  </p>
                )}
                <button type="button" className="set__btn" disabled={busy} onClick={() => { void put(); }}>
                  Import styles
                </button>
              </>
            )}
      </section>

      <InsertDocument />

      <section className="set__box">
        <h2 className="set__h">Keyboard shortcuts</h2>
        <table className="set__keys">
          <tbody>
            {COMMANDS.filter((c) => c.key !== undefined).map((c) => (
              <tr key={c.id}><td><kbd>{officeChord(c.key!)}</kbd></td><td>{c.label}</td></tr>
            ))}
          </tbody>
        </table>
        <h3 className="set__h3">Typing IAST</h3>
        <p className="set__note">Alt and a letter types its long or dotted form; Shift gives the other half.</p>
        <table className="set__keys set__keys--grid">
          <tbody>
            {LEADER_COMMANDS.map((c) => (
              <tr key={c.id}><td><kbd>{officeChord(c.key!)}</kbd></td><td className="set__ch">{typeof c.does === 'object' && 'insert' in c.does ? c.does.insert : ''}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="set__note">
          Where one of these is also Word’s own, Word asks once which you mean.
        </p>
      </section>

      <footer className="set__foot">
        <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer">What the marks mean</a>
        <span>v{ADDIN_VERSION}</span>
      </footer>
    </div>
  );
}
