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

import { useRef, useState, type ReactNode } from 'react';
import type { Appearance } from '../state/useAppearance.js';
import { RibbonButton } from './RibbonButton.js';
import { Popover } from '../ui/Popover.js';

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
  const anchor = useRef<HTMLDivElement>(null);

  return (
    <div className="ap" ref={anchor}>
      <RibbonButton
        icon="appearance"
        label="Appearance"
        size="lg"
        title="Appearance — the instrument, the page, and the mode"
        pressed={open}
        onClick={() => setOpen((o) => !o)}
      />

      {/*
        PORTALLED, because the ribbon clips. `.rbn__body` has `overflow:
        hidden` so a group that does not fit cannot spill across the row — and
        that clip applied to this menu too, leaving nine tenths of it below the
        ribbon's edge and unreachable. See `ui/Popover.tsx`.
      */}
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} label="Appearance">
        <div className="ap__pop">
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

            {/*
              BACK TO THE DEFAULTS. Six instruments, seven pages, three
              densities and two modes is 252 combinations, and a person who
              has tried a dozen of them needs a way back to the one the
              program shipped with — without knowing which of the four axes
              they changed.
            */}
            <button
              type="button"
              className="ap__reset"
              onClick={look.reset}
              title="Back to the appearance the program starts with"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      </Popover>
    </div>
  );
}
