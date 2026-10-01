/**
 * A LINE, DRAWN AS THE APP DRAWS IT — in the panel, with the letters a button
 * would mark lit.
 *
 * The render package's token renderer, the one the desktop app's three views
 * and its exports use, so a holding in the panel is the holding on the app's
 * page. Nothing here decides how a mark looks.
 */
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import type { ChantToken, TextAndMarks } from '@siksamitra/format';
import { CANDRA, encodeMarks } from '@siksamitra/format';
import { hydrateVerse, type ScriptKey } from '@siksamitra/engine';
import { renderToken, unitsBefore } from '@siksamitra/render';

/** Where each letter of the tokens begins in the text — the order `data-u` counts in. */
function unitStarts(tokens: readonly ChantToken[]): number[] {
  const out: number[] = [];
  let at = 0;
  const walk = (stream: readonly ChantToken[]): void => {
    for (const t of stream) {
      if (t.t === 'syl') {
        for (const u of t.units) { out.push(at); at += u.c.length + (u.candra === true ? CANDRA.length : 0); }
      } else if (t.t === 'slot') walk(t.tokens);
      else if (t.t === 'danda' || t.t === 'num' || t.t === 'text') at += t.s.length;
      else if (t.t !== 'pause') at += 1;
    }
  };
  walk(tokens);
  return out;
}

export function Drawn(
  { tm, script = 'iast', target, size = 'line' }: {
    tm: TextAndMarks;
    script?: ScriptKey;
    /** The letters a button would mark, `[from, to)` in the text. */
    target?: readonly [number, number] | null;
    /** A whole line, or the small sample on a tile. */
    size?: 'line' | 'tile';
  },
): ReactNode {
  const tokens = useMemo(
    () => hydrateVerse({ id: 'panel', tokens: [], text: tm.text, marks: encodeMarks([...tm.marks]) } as never).tokens,
    [tm],
  );
  const starts = useMemo(() => unitStarts(tokens), [tokens]);
  const host = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = host.current;
    if (el === null) return;
    for (const u of el.querySelectorAll<HTMLElement>('[data-u]')) {
      const first = Number(u.dataset.u);
      const count = Number(u.dataset.un ?? '1');
      const from = starts[first] ?? Infinity;
      const to = starts[first + count] ?? tm.text.length;
      const lit = target != null && target[0] < to && from < Math.max(target[1], target[0] + 1);
      u.classList.toggle('is-target', lit);
    }
  }, [target, starts, tm.text.length]);

  const ctx = { script, showMarks: true, fontStack: 'var(--doc-verse-face)', addressable: true };
  return (
    <div className={`pnl-doc pnl-doc--${size} doc chant-marks`} data-doc="word">
      <div className="pada" ref={host}>
        {tokens.map((t, i) => renderToken(t, i, ctx, unitsBefore(tokens, i)))}
      </div>
    </div>
  );
}
