/**
 * THE PICTURE GROUP — Word's Insert ▸ Pictures and its Picture Format tab, in
 * one ribbon group.
 *
 * Word splits them because Word has a contextual tab that appears when a
 * picture is selected. This ribbon has no contextual tabs, and adding the
 * machinery for one so that four controls could hide would be a worse trade
 * than the one made here: the group is always present, Insert always works, and
 * the four controls that are ABOUT a picture are disabled until one is
 * selected — which is the same information without a tab that appears and
 * disappears under the cursor.
 *
 * WHAT IS NOT HERE, and each is refused with its reason in
 * `openspec/changes/document-images/design.md`: cropping, rotation, borders and
 * effects, brightness and contrast, and absolute positioning on the page. This
 * is an editor for recitation text; a picture in one is placed and sized, and
 * everything else is an image editor pretending.
 */
import { useRef, useState, type ReactNode } from 'react';
import {
  FIGURE_MEDIA_TYPES, figureBytes,
  type ChantFigureFlow, type ChantFigureSize,
} from '@siksamitra/format';
import { RibbonButton, RibbonStack } from './RibbonButton.js';
import { PictureDialog } from './PictureDialog.js';
import { readImageFile, type ReadImage } from '../editor/useFigures.js';
import type { Session } from '../editor/useSession.js';

/**
 * The five widths, each with the fraction of the column it is.
 *
 * The fraction is IN the label rather than in a tooltip, and short enough to
 * fit: "Medium — a half" was clipped to "Me" in a ribbon group at 1400 px,
 * which is a size list nobody can read. A `<select>` is as wide as its widest
 * option and the ribbon has no room to spare.
 */
const SIZES: readonly { id: ChantFigureSize; label: string }[] = [
  { id: 'thumb', label: 'Thumb' },
  { id: 'small', label: 'Small ¼' },
  { id: 'medium', label: 'Medium ½' },
  { id: 'large', label: 'Large ¾' },
  { id: 'full', label: 'Full' },
];

/** Word's wrap, as the three this program has. `aside` is a document's own
 *  choice and is not offered, because the margin rail it names does not
 *  exist yet and a control that draws `block` while saying `aside` lies. */
const FLOWS: readonly { id: ChantFigureFlow; label: string; hint: string }[] = [
  { id: 'start', label: 'Left', hint: 'Text beside it, on the right' },
  { id: 'block', label: 'Centre', hint: 'Its own line, centred' },
  { id: 'end', label: 'Right', hint: 'Text beside it, on the left' },
];

/* The label beside the control already says "Caption", so the options say only
   where it goes. */
const CAPTION_AT = [
  { id: 'below', label: 'Below' },
  { id: 'above', label: 'Above' },
  { id: 'beside', label: 'Beside' },
  { id: 'none', label: 'None' },
] as const;

export function PictureGroup(
  { session, onNote }: { session: Session; onNote: (note: string) => void },
): ReactNode {
  const { figures } = session;
  const fig = figures.figure;
  const picker = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ReadImage | null>(null);
  /* The dialog, reopened on a picture that is already in the document. Its own
     state rather than a flag on `pending`, so a description being corrected can
     never be mistaken for a file waiting to be inserted. */
  const [describing, setDescribing] = useState(false);
  /* Which gesture the picker was opened for. One `<input type=file>`, because
     two would be two things to keep in step and the browser only ever shows
     one at a time anyway. */
  const mode = useRef<'insert' | 'replace'>('insert');

  const choose = (which: 'insert' | 'replace'): void => {
    mode.current = which;
    /* Cleared first: choosing the same file twice fires no `change` event,
       so re-inserting a picture you had just removed did nothing at all. */
    if (picker.current !== null) picker.current.value = '';
    picker.current?.click();
  };

  const took = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return;
    const read = await readImageFile(file);
    if (typeof read === 'string') { onNote(read); return; }
    if (mode.current === 'replace') {
      figures.replace(read);
      onNote(`Replaced with ${read.name} — ${read.width} × ${read.height} px.`);
      return;
    }
    setPending(read);
  };

  return (
    <div className="rbg" role="group" aria-label="Picture">
      <input
        ref={picker}
        type="file"
        accept={FIGURE_MEDIA_TYPES.join(',')}
        hidden
        onChange={(e) => { void took(e.target.files?.[0]); }}
      />

      <RibbonButton
        icon="image"
        label="Picture"
        size="lg"
        title="Put a picture into this step, after the verse the caret is in"
        onClick={() => choose('insert')}
      />

      <RibbonStack>
        <RibbonButton
          icon="replace"
          label="Replace"
          title="Swap the bytes and keep the size, alignment, caption and description"
          disabled={fig === null}
          onClick={() => choose('replace')}
        />
        <RibbonButton
          icon="marks"
          label="Describe"
          title="What is in this picture, and what the caption says"
          disabled={fig === null}
          onClick={() => setDescribing(true)}
        />
        <RibbonButton
          icon="marks-clear"
          label="Delete"
          title="Take this picture out of the document"
          disabled={fig === null}
          onClick={() => {
            figures.remove();
            onNote('Picture removed. Ctrl+Z puts it back.');
          }}
        />
      </RibbonStack>

      <div className="rbg">
        <label className="rbf">
          <span className="rbf__l">Size</span>
          <select
            className="tb__sel"
            aria-label="Picture size"
            disabled={fig === null}
            value={fig?.size ?? 'medium'}
            onChange={(e) => figures.setSize(e.target.value as ChantFigureSize)}
          >
            {SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="rbf">
          <span className="rbf__l">Caption</span>
          <select
            className="tb__sel"
            aria-label="Where the caption goes"
            disabled={fig === null}
            value={fig?.captionAt ?? 'below'}
            onChange={(e) => figures.update({
              captionAt: e.target.value as 'below' | 'above' | 'beside' | 'none',
            })}
          >
            {CAPTION_AT.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
      </div>

      <RibbonStack>
        {FLOWS.map((f) => (
          <RibbonButton
            key={f.id}
            label={f.label}
            title={f.hint}
            disabled={fig === null}
            pressed={fig !== null && (fig.flow ?? 'block') === f.id}
            onClick={() => figures.setFlow(f.id)}
          />
        ))}
      </RibbonStack>

      {/*
        DESCRIBING ONE THAT IS ALREADY IN. The same dialog, given the figure's
        own bytes as the picture: they are in the document, so there is nothing
        to read off a disk.
      */}
      {describing && fig !== null && (
        <PictureDialog
          image={{
            src: fig.src,
            width: fig.width ?? 0,
            height: fig.height ?? 0,
            bytes: figureBytes(fig.src),
            name: fig.id,
          }}
          alt={fig.alt}
          caption={fig.caption?.en ?? ''}
          onCancel={() => setDescribing(false)}
          onInsert={(alt, caption) => {
            figures.update({
              alt,
              /* An empty caption is REMOVED, not stored as an empty string:
                 absent and empty mean the same to a reader and different things
                 to `canonicalJson`, so writing one would change the document's
                 hash for a change nobody made. */
              ...(caption === '' ? { caption: undefined } : { caption: { en: caption } }),
            });
            setDescribing(false);
          }}
        />
      )}

      {pending !== null && (
        <PictureDialog
          image={pending}
          onCancel={() => setPending(null)}
          onInsert={(alt, caption) => {
            figures.insert(pending, alt, caption);
            onNote(
              `Picture added — ${pending.width} × ${pending.height} px, about `
              + `${((pending.bytes * 4) / 3 / 1024).toFixed(0)} kB in the document.`,
            );
            setPending(null);
          }}
        />
      )}
    </div>
  );
}
