/**
 * THE ON-SCREEN IAST KEYBOARD.
 *
 * v1's `dialog-iast.html`, recreated: the varṇamālā in eight groups by place
 * of articulation, every key showing the F9 letter that types it, and the tip
 * at the foot saying the leader exists at all. The arrangement, the groups and
 * the characters are `@siksamitra/ui`'s `iast.ts` — transcribed from his file,
 * not redesigned — and `IastKeys` draws them, as it does in the Word add-in.
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
import { IastKeys, Popover, RibbonButton } from '@siksamitra/ui';

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
          <IastKeys insert={insert} />
          <p className="iast__tip">
            Press F9 and then a letter to insert one without opening this.
          </p>
        </div>
      </Popover>
    </div>
  );
}
