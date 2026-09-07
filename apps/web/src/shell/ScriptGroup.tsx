/**
 * Which writing system the text is shown in.
 *
 * TWO IN THE RIBBON, THE REST BEHIND A LAUNCHER — Word's own arrangement, and
 * the right one here for the same reason: IAST and Devanāgarī are what this
 * work is done in, and four equal buttons made them look like four equal
 * choices while eating a quarter of the row.
 *
 * The others are one click away, in the little launcher at the corner of the
 * group — the dialog-launcher Word puts on a group that has more to say than
 * fits. A script that is not reviewed says so there, where the choice is made,
 * rather than in a tooltip nobody opens.
 */
import { useRef, useState, type ReactNode } from 'react';
import type { ChantScriptKey } from '@siksamitra/format';
import { Icon } from '../ui/Icon.js';
import { Popover } from '../ui/Popover.js';
import { RibbonButton, RibbonStack } from './RibbonButton.js';

interface Script {
  readonly k: ChantScriptKey;
  readonly label: string;
  readonly name: string;
  /** Said out loud where the choice is made, not hidden in a tooltip. */
  readonly caveat?: string;
}

/** The two the work is done in. */
const PRIMARY: readonly Script[] = [
  { k: 'iast', label: 'IAST', name: 'Roman transliteration' },
  { k: 'deva', label: 'देव', name: 'Devanāgarī' },
];

/** The rest. Kannada and the others are not implemented yet — see the engine's
 *  script registry; they will appear here when they exist. */
const MORE: readonly Script[] = [
  { k: 'tel', label: 'తెలు', name: 'Telugu' },
  { k: 'tam', label: 'தமி', name: 'Tamil', caveat: 'these forms are unreviewed' },
];

export function ScriptGroup(
  { value, onChange }: { value: ChantScriptKey; onChange: (k: ChantScriptKey) => void },
): ReactNode {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const other = MORE.find((s) => s.k === value);

  return (
    <div className="rbg" role="group" aria-label="Script">
      {/*
        ONE UNDER ANOTHER, not side by side. They are a LIST of alternatives —
        the same choice, made once — and a row of large buttons read as
        separate actions while taking three times the width.
      */}
      <RibbonStack>
        {PRIMARY.map((s) => (
          <RibbonButton
            key={s.k}
            label={s.label}
            title={s.name}
            pressed={value === s.k}
            onClick={() => onChange(s.k)}
          />
        ))}
        <button
          type="button"
          className={other === undefined ? 'rbl' : 'rbl is-on'}
          ref={anchor}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="More writing systems"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="rbl__l">{other === undefined ? 'More' : other.label}</span>
          <Icon name="chevron" size="sm" className="rbl__caret" />
        </button>
      </RibbonStack>

      <Popover
        anchor={anchor}
        open={open}
        onClose={() => setOpen(false)}
        label="Writing systems"
      >
        <div className="menu">
          <p className="menu__lbl">Writing system</p>
          {[...PRIMARY, ...MORE].map((s) => (
            <button
              type="button"
              key={s.k}
              className={value === s.k ? 'menu__opt is-on' : 'menu__opt'}
              aria-pressed={value === s.k}
              onClick={() => { onChange(s.k); setOpen(false); }}
            >
              <span className="menu__mark">{s.label}</span>
              <span className="menu__name">{s.name}</span>
              {s.caveat !== undefined && <span className="menu__note">{s.caveat}</span>}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  );
}
