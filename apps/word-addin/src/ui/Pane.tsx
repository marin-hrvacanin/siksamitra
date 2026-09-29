/**
 * THE PANE — built from the app's own ribbon, not a second design.
 *
 * Every control here is `@siksamitra/ui`: the same `RibbonButton`, the same
 * icon table, the same group frame (`grp`, `grp__body`, `grp__label`) and the
 * same tooltip layer as the app's ribbon, reading the same tokens under the
 * same `data-chrome` / `data-mode` / `data-density` attributes. What is the
 * pane's own is only the arrangement: a column, because a task pane is tall
 * and narrow where a ribbon is wide and short.
 *
 * Top to bottom, in the order the work happens:
 *   1. WHERE — what is selected, one line.
 *   2. THE MESSAGE — what the last action said; it stays until the next.
 *   3. THIS DOCUMENT — only when something needs doing (styles missing).
 *   4. THE MARKS — holding, svara, aids, as ribbon groups.
 *   5. THE RULES — folded until opened.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { CHANT_PROFILE_KEYS, CHANT_PROFILE_NOTES } from '@siksamitra/format';
import type { ChantProfileKey, Stage } from '@siksamitra/format';
import { STAGES } from '@siksamitra/engine';
import { RibbonButton, TooltipLayer, tipProps } from '@siksamitra/ui';
import { STYLE_MEANS } from '../model/setup.js';
import { ARM_MS } from './dom.js';
import { GROUPS, STAGE_LABEL, type Control } from './controls.js';
import { modeOf, THEME_POLL_MS, type Mode } from './theme.js';
import { usePane, type PaneModel } from './usePane.js';
import { ADDIN_VERSION, GUIDE_URL } from '../version.js';

/** Word's theme, followed live. */
function useMode(): Mode {
  const read = (): Mode => modeOf(
    typeof Office === 'undefined' ? null : Office.context?.officeTheme,
    matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const [mode, setMode] = useState<Mode>(read);
  useEffect(() => {
    const again = (): void => setMode(read());
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', again);
    const timer = window.setInterval(again, THEME_POLL_MS);
    return () => { mq.removeEventListener('change', again); window.clearInterval(timer); };
  }, []);
  return mode;
}

export function Pane(): ReactNode {
  const mode = useMode();
  const pane = usePane();

  /* Follow the caret. Without this the pane shows the selection it was opened
     with and every button acts on a range the reader has moved off. */
  useEffect(() => {
    if (typeof Office === 'undefined') return;
    Office.context.document.addHandlerAsync(
      Office.EventType.DocumentSelectionChanged,
      () => { void pane.refresh(); },
    );
  }, [pane.refresh]);

  return (
    <div className="pane" data-chrome="palladio" data-mode={mode} data-density="compact">
      <TooltipLayer />
      <Where pane={pane} />
      <Said pane={pane} />
      <ThisDocument pane={pane} />
      <div className="pane__groups">
        {GROUPS.map((g) => <MarkGroup key={g.title} title={g.title} controls={g.controls} pane={pane} />)}
      </div>
      <TheRules pane={pane} />
      <footer className="pane__foot">
        <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer">What the marks mean</a>
        <span>v{ADDIN_VERSION}</span>
      </footer>
    </div>
  );
}

function Where({ pane }: { pane: PaneModel }): ReactNode {
  const { at } = pane;
  if (at === null) {
    return <div className="where" data-state="none">Put the caret in a line of text.</div>;
  }
  const { tm, from, to, lines } = at;
  const many = lines.length > 1;
  const notes = lines.flatMap((l) => l.unresolved).filter((u) => u.advisory !== true);
  const lossy = lines.some((l) => l.unresolved.some((u) => u.lossy));
  const blocked = [...new Set(lines.flatMap((l) => l.blocked))];
  return (
    <div className="where" data-state={many ? 'lines' : from === to ? 'caret' : 'range'}
      data-lossy={lossy || blocked.length > 0 || undefined}>
      {many
        ? <span>Selected <strong>{lines.length} lines</strong></span>
        : from === to
          ? <span>The caret is at letter {from} of {tm.text.length}.</span>
          : <span>Selected <strong>{tm.text.slice(from, to)}</strong></span>}
      {lossy && (
        <p className="where__refuse">
          {many ? 'A line here' : 'This line'} carries text the reader cannot place. Marking it
          would delete that text, so the marking buttons are refused here.
        </p>
      )}
      {blocked.length > 0 && (
        <p className="where__refuse">
          {many ? 'A line here' : 'This line'} has {blocked.join(' and ')} on it. Rewriting it
          would lose that, so it is left alone.
        </p>
      )}
      {notes.length > 0 && (
        <ul className="where__notes">
          {notes.map((u, i) => <li key={i}>{u.what}: {u.raw}</li>)}
        </ul>
      )}
    </div>
  );
}

function Said({ pane }: { pane: PaneModel }): ReactNode {
  const { message } = pane;
  return (
    <div className="said" role="status" aria-live="polite" data-kind={message.kind}
      hidden={message.text === ''}>
      {message.text}
      {message.lines.length > 0 && <ul>{message.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </div>
  );
}

function ThisDocument({ pane }: { pane: PaneModel }): ReactNode {
  const { styles } = pane;
  if (styles === null || styles.missing.length === 0) return null;
  const none = styles.missing.length >= styles.total;
  return (
    <section className="doc-box" data-group="document" data-ready="false">
      <h2 className="doc-box__h">This document</h2>
      <p className="says">
        {none
          ? `This document has none of the ${styles.total} śikṣāmitra styles yet. `
            + 'Marking still works — every change brings the style it needs.'
          : `${styles.total - styles.missing.length} of ${styles.total} styles are in this document. Missing: `
            + styles.missing.map((id) => `${id} (${STYLE_MEANS[id] ?? '?'})`).join(', ') + '.'}
      </p>
      <div className="doc-box__do">
        <RibbonButton icon="check" label="Add the styles"
          title="Put every śikṣāmitra style into this document. Nothing visible changes."
          disabled={pane.busy} onClick={() => { void pane.putStyles(false); }} />
        <RibbonButton icon="document" label="Insert a specimen"
          title="A short block using every style, with its name beside it. Read it, then delete it."
          disabled={pane.busy} onClick={() => { void pane.putStyles(true); }} />
      </div>
    </section>
  );
}

function whyNot(control: Control, pane: PaneModel): string | undefined {
  if (pane.at === null) return 'Put the caret in a line of text first.';
  if (pane.at.lines.some((l) => l.unresolved.some((u) => u.lossy))) {
    return 'This line carries text the reader cannot place; writing it would delete that text.';
  }
  if (pane.at.lines.some((l) => l.blocked.length > 0)) {
    return 'A picture, a comment or a field is on this line; rewriting it would lose that.';
  }
  if (control.point !== true && pane.at.lines.every((l) => l.from === l.to)) {
    return 'Select at least one letter — this marks a range.';
  }
  return undefined;
}

function MarkGroup(
  { title, controls, pane }: { title: string; controls: readonly Control[]; pane: PaneModel },
): ReactNode {
  return (
    <section className="grp">
      <div className="grp__body">
        {controls.map((c) => {
          const why = whyNot(c, pane);
          const on = c.state === undefined || pane.state === null ? undefined
            : pane.state[c.state] === 'all';
          return (
            <RibbonButton key={c.label} icon={c.icon} label={c.label} size="lg"
              title={c.tip} why={why} disabled={why !== undefined || pane.busy}
              {...(on === undefined ? {} : { pressed: on })}
              onClick={() => { void pane.press(c); }} />
          );
        })}
      </div>
      <div className="grp__label">{title}</div>
    </section>
  );
}

function TheRules({ pane }: { pane: PaneModel }): ReactNode {
  const { rules, setRules } = pane;
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = window.setTimeout(() => setArmed(false), ARM_MS);
    return () => window.clearTimeout(t);
  }, [armed]);
  const toggle = (s: Stage): void => {
    const next = new Set(rules.stages);
    if (next.has(s)) next.delete(s); else next.add(s);
    setRules({ ...rules, stages: next });
  };
  const noSelection = pane.at === null ? 'Put the caret in a line of text first.' : undefined;
  return (
    <details className="rules">
      <summary {...tipProps('Re-apply the śikṣā rules to a line, a selection or the whole document.')}>
        The rules
      </summary>
      <label className="rules__row">
        <span>Register</span>
        <select className="tb__sel" value={rules.register}
          onChange={(e) => setRules({ ...rules, register: e.target.value as ChantProfileKey })}>
          {CHANT_PROFILE_KEYS.map((k) => (
            <option key={k} value={k} title={`${CHANT_PROFILE_NOTES[k].where}. ${CHANT_PROFILE_NOTES[k].what}`}>
              {CHANT_PROFILE_NOTES[k].name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="rules__stages">
        <legend>Stages</legend>
        {STAGES.map((s) => (
          <label key={s}>
            <input type="checkbox" checked={rules.stages.has(s)} onChange={() => toggle(s)} />
            {STAGE_LABEL[s] ?? s}
          </label>
        ))}
      </fieldset>
      <fieldset className="rules__mode">
        <legend>Markings placed by hand</legend>
        <label><input type="radio" name="sm-mode" checked={rules.mode === 'keep-hand'}
          onChange={() => setRules({ ...rules, mode: 'keep-hand' })} />Keep them</label>
        <label><input type="radio" name="sm-mode" checked={rules.mode === 'replace-all'}
          onChange={() => setRules({ ...rules, mode: 'replace-all' })} />Replace everything</label>
      </fieldset>
      <div className="rules__do">
        <RibbonButton icon="auto-keep" label="Run over the selection"
          title="The line the caret is in, or just the selected letters."
          why={noSelection} disabled={noSelection !== undefined || pane.busy}
          onClick={() => { void pane.runHere(); }} />
        <RibbonButton icon="auto-replace"
          label={armed ? 'Rewrite every mantra line?' : 'Run over the document'}
          title="Every mantra line in the document. Asks once before it writes."
          disabled={pane.busy}
          onClick={() => {
            if (!armed) { setArmed(true); return; }
            setArmed(false);
            void pane.runDocument();
          }} />
      </div>
    </details>
  );
}
