/**
 * MARK — the line under the caret, drawn, and every mark at one press.
 *
 * What a person needs while correcting a text is to SEE what is on it, and
 * the ribbon cannot show anything: its buttons do not even light up. So the
 * line is drawn here as the app draws it, the letters a press would mark are
 * lit, the marks already on them are named, and each button shows the mark it
 * places and is pressed when the whole selection already has it — Word's own
 * rule for Bold, from the same `selectionAcross` the press acts on.
 */
import { useState, type ReactNode } from 'react';
import { CHANT_PROFILE_NOTES } from '@siksamitra/format';
import { letterBefore, selectionAcross, type Span } from '@siksamitra/edit';
import { getScript } from '@siksamitra/engine';
import { officeChord } from '@siksamitra/ui';
import { COMMANDS, type Command } from '../../commands-table.js';
import { run } from '../../runtime.js';
import type { Here } from './useHere.js';
import { Drawn } from './Drawn.js';
import { STATE_KEY, markName, tileSample } from './samples.js';

const byId = (id: string): Command => COMMANDS.find((c) => c.id === id)!;

const GROUPS: readonly { title: string; ids: readonly string[] }[] = [
  { title: 'Holding', ids: ['hold-short', 'hold-long'] },
  { title: 'Svara', ids: ['svara-anudatta', 'svara-svarita', 'svara-dirgha'] },
  { title: 'Signs', ids: ['change-anusvara', 'change-visarga', 'candrabindu', 'svarabhakti', 'pause-short', 'pause-long'] },
];
const CLEAR = ['hold-clear', 'clear-svara', 'clear-change', 'clear-signs', 'clear-all'];

/** The letters a press would mark: the selection, or the letter before the caret. */
function targetOf(here: Here): readonly [number, number] | null {
  const at = here.at;
  if (at === null) return null;
  if (at.from !== at.to || at.lines.length > 1) return [at.from, at.to];
  return letterBefore(at.tm.text, at.from);
}

export function MarkTab({ here, busy, press }: {
  here: Here;
  busy: boolean;
  press: (c: Command) => void;
}): ReactNode {
  const at = here.at;
  const target = targetOf(here);
  const spans: Span[] = at === null ? [] : (at.lines.length > 1
    ? at.lines.map((l) => ({ tm: l.tm, from: l.from, to: l.to }))
    : target === null ? [] : [{ tm: at.tm, from: target[0], to: target[1] }]);
  const state = spans.length === 0 ? {} : selectionAcross(spans);
  const on = at === null || target === null ? [] : at.tm.marks
    .filter((m) => m.from < Math.max(target[1], target[0] + 1) && target[0] < Math.max(m.to, m.from + 1))
    .map((m) => markName(m.k, m.v))
    .filter((n): n is string => n !== null);
  const register = here.register?.register ?? null;

  return (
    <>
      <section className="pnl-card pnl-here" aria-label="Where the caret is">
        {at === null ? (
          <p className="pnl-quiet">{here.why ?? 'Put the caret in a mantra line, or select some letters.'}</p>
        ) : (
          <>
            <div className="pnl-chips">
              {register !== null && (
                <span className="pnl-chip pnl-chip--accent">
                  {CHANT_PROFILE_NOTES[register].name}{here.register?.inPart === true ? ' · this part' : ''}
                </span>
              )}
              <span className="pnl-chip">{getScript(at.script)?.name ?? at.script}</span>
              {at.lines.length > 1 && <span className="pnl-chip">{at.lines.length} lines</span>}
            </div>
            <Drawn tm={at.tm} script={at.script} target={target} />
            <p className="pnl-quiet">
              {on.length === 0
                ? (target === null ? 'Nothing before the caret to mark.' : 'No marks on these letters.')
                : `On these letters: ${[...new Set(on)].join(' · ')}`}
            </p>
          </>
        )}
      </section>

      <section className="pnl-row">
        <button type="button" className="pnl-btn pnl-btn--main" disabled={busy} onClick={() => press(byId('reapply'))}
          title={byId('reapply').tip}>
          Auto-mark{at !== null && (at.from !== at.to || at.lines.length > 1) ? ' the selection' : ''}
        </button>
        <button type="button" className="pnl-btn" disabled={busy} onClick={() => press(byId('reapply-mine-out'))}
          title={byId('reapply-mine-out').tip}>
          Afresh
        </button>
      </section>

      {GROUPS.map((g) => (
        <section className="pnl-group" key={g.title}>
          <h3 className="pnl-h">{g.title}</h3>
          <div className="pnl-tiles">
            {g.ids.map((id) => {
              const c = byId(id);
              const key = STATE_KEY[id];
              const pressed = key !== undefined && state[key] === 'all';
              const sample = tileSample(id);
              return (
                <button
                  type="button"
                  key={id}
                  className="pnl-tile"
                  aria-pressed={key === undefined ? undefined : pressed}
                  disabled={busy}
                  title={c.key === undefined ? c.tip : `${c.tip} (${officeChord(c.key)})`}
                  onClick={() => press(c)}
                >
                  {sample !== undefined && <Drawn tm={sample} size="tile" />}
                  <span className="pnl-tile__label">{c.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <section className="pnl-group">
        <h3 className="pnl-h">Clear</h3>
        <div className="pnl-wrap">
          {CLEAR.map((id) => {
            const c = byId(id);
            return (
              <button type="button" key={id} className="pnl-btn pnl-btn--small" disabled={busy}
                title={c.tip} onClick={() => press(c)}>
                {c.label.replace(/^Clear /, '')}
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

/** Run a command and read the caret again — the line under it has changed. */
export function usePress(here: Here): { busy: boolean; press: (c: Command) => void } {
  const [busy, setBusy] = useState(false);
  const press = (c: Command): void => {
    setBusy(true);
    void run(c).finally(() => { setBusy(false); here.refresh(); });
  };
  return { busy, press };
}
