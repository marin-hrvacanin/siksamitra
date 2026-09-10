/**
 * THE ON-SCREEN IAST KEYBOARD.
 *
 * v1's `dialog-iast.html`, recreated: the varṇamālā in eight groups by place
 * of articulation, every key showing the F9 letter that types it, and the tip
 * at the foot saying the leader exists at all. The arrangement, the groups and
 * the characters are `editor/iast.ts`'s — transcribed from his file, not
 * redesigned — and this draws them.
 *
 * A POPOVER RATHER THAN A DIALOG, and the difference matters for this one. v1
 * opened a separate window: you could not see the word you were spelling while
 * you picked the letter for it. A popover hangs off the ribbon, the document
 * stays visible behind it, and `Popover` puts the keyboard back where it came
 * from when it closes — without which the editor goes deaf the moment anyone
 * opens a menu.
 *
 * IT STAYS OPEN. Someone typing `ṛtaṁ ṛtena` needs four of these in a row, and
 * a palette that closed on each pick would be four trips to the ribbon. The
 * caret does not move away, because the buttons never take the focus — see
 * `onMouseDown`.
 */
import { useRef, useState, type ReactNode } from 'react';
import { IAST_PALETTE, leaderFor } from '../editor/iast.js';
import { RibbonButton } from './RibbonButton.js';
import { Popover } from '../ui/Popover.js';

export function IastPalette(
  { insert, armed, enabled }: {
    /** Insert a character at the caret, as if it had been typed. */
    insert: (ch: string) => void;
    /** The F9 leader is waiting for its second key. */
    armed: boolean;
    enabled: boolean;
  },
): ReactNode {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);

  return (
    <div className="iast" ref={anchor}>
      <RibbonButton
        icon="script"
        label="IAST"
        size="lg"
        title="The IAST characters — or press F9 then a letter"
        pressed={open || armed}
        disabled={!enabled}
        onClick={() => setOpen((o) => !o)}
      />

      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} label="IAST characters">
        <div className="iast__pad">
          {IAST_PALETTE.map((group) => (
            <section className="iast__grp" key={group.group}>
              <h3 className="iast__lbl">{group.group}</h3>
              <div className="iast__keys">
                {group.keys.map((key) => {
                  const leader = leaderFor(key.ch);
                  const hint = [key.name, leader === undefined ? undefined : `F9 ${leader}`]
                    .filter((s) => s !== undefined).join(' · ');
                  return (
                    <button
                      type="button"
                      key={key.ch}
                      className="iast__key"
                      title={hint === '' ? key.ch : `${key.ch} — ${hint}`}
                      /*
                       * THE CARET MUST NOT MOVE. A button that takes the focus
                       * takes it from the document, and the insertion then has
                       * no caret to land at — which is the same fault the
                       * popover's own focus restoration exists for, one level
                       * down.
                       */
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insert(key.ch)}
                    >
                      <span className="iast__ch">{key.show ?? key.ch}</span>
                      {leader !== undefined && (
                        <span className="iast__f9" aria-hidden>{leader}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          <p className="iast__tip">
            Press F9 and then a letter to insert one without opening this.
          </p>
        </div>
      </Popover>
    </div>
  );
}
