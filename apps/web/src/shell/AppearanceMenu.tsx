/**
 * The appearance picker: chrome, page, mode.
 *
 * A popover rather than a settings page, because it is a thing people try
 * repeatedly and compare — a full-page trip loses the document you were judging
 * it against.
 *
 * Each theme is listed with one line of what it is FOR. A list of names alone
 * makes someone click all six to find out; the note is the difference between
 * choosing and guessing.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Appearance } from '../state/useAppearance.js';

function Group(
  { label, choices, value, onPick }: {
    label: string;
    choices: readonly { id: string; name: string; note: string }[];
    value: string;
    onPick: (id: string) => void;
  },
): ReactNode {
  return (
    <div className="ap__grp">
      <p className="ap__lbl">{label}</p>
      {choices.map((c) => (
        <button
          type="button"
          key={c.id}
          className={c.id === value ? 'ap__opt is-on' : 'ap__opt'}
          aria-pressed={c.id === value}
          onClick={() => onPick(c.id)}
        >
          <span className="ap__name">{c.name}</span>
          <span className="ap__note">{c.note}</span>
        </button>
      ))}
    </div>
  );
}

export function AppearanceMenu({ look }: { look: Appearance }): ReactNode {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape. Both, because a popover that only
  // closes one way is a popover people learn to distrust.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (box.current !== null && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="ap" ref={box}>
      <button
        type="button"
        className={open ? 'tb__b is-on' : 'tb__b'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        title="Appearance — chrome, page and mode"
      >
        Appearance
      </button>

      {open && (
        <div className="ap__pop" role="dialog" aria-label="Appearance">
          <Group
            label="Instrument"
            choices={look.chromeChoices}
            value={look.chrome}
            onPick={look.setChrome}
          />
          <Group
            label="Page"
            choices={look.documentChoices}
            value={look.document}
            onPick={look.setDocument}
          />
          <Group
            label="Density"
            choices={look.densityChoices}
            value={look.density}
            onPick={look.setDensity}
          />
          <div className="ap__grp">
            <p className="ap__lbl">Mode</p>
            <div className="seg">
              {(['light', 'dark'] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  className={look.mode === m ? 'seg__b is-on' : 'seg__b'}
                  aria-pressed={look.mode === m}
                  onClick={() => look.setMode(m)}
                >
                  {m === 'light' ? 'Light' : 'Dark'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
