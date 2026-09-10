/**
 * INSERT — putting a thing into the document.
 *
 * Word's Insert tab, and Word's division of labour: putting a picture in is
 * one thing and formatting the one you have selected is another, so they are
 * on different tabs. The formatting lives on a CONTEXTUAL tab that appears
 * when a picture is selected — see `PictureFormatGroup` and
 * `RibbonTab.contextual`.
 *
 * This used to be one group on Home whose four format controls sat disabled
 * until something was selected. The owner's reading of that: "after inserting
 * an image I cannot select it and the Picture section appears on Home. It
 * should have Insert and there audio and photo, and when the picture is
 * selected it should have the Picture tab at the top, like in MS Word."
 *
 * NO DIALOG BETWEEN CHOOSING A FILE AND SEEING IT. "By default it should only
 * insert the picture and then in the picture tab can you set these." A
 * description is wanted — these are liturgical manuals and a picture of a
 * mudrā is the whole instruction — but demanding one at the moment of
 * insertion produces descriptions written to dismiss a dialog. It is asked for
 * where the picture can be seen, and `sm validate` says which pictures still
 * lack one.
 */
import { useRef, type ReactNode } from 'react';
import { FIGURE_MEDIA_TYPES } from '@siksamitra/format';
import { RibbonButton } from './RibbonButton.js';
import { IastPalette } from './IastPalette.js';
import { readImageFile } from '../editor/useFigures.js';
import type { Session } from '../editor/useSession.js';
import type { Iast } from '../editor/useIast.js';

export function InsertGroup(
  { session, iast, onNote, onAudio }: {
    session: Session;
    /** The IAST leader and the palette's insertion — one path, see `useIast`. */
    iast: Iast;
    onNote: (note: string) => void;
    /** Open the Audio tab, which is where a recording is attached. */
    onAudio: () => void;
  },
): ReactNode {
  const { figures } = session;
  const picker = useRef<HTMLInputElement>(null);

  const took = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return;
    const read = await readImageFile(file);
    if (typeof read === 'string') { onNote(read); return; }
    /* Straight in, with no description yet, and SELECTED — so the contextual
       tab is already open on it and the next thing a person does is to the
       picture they just placed. */
    figures.insert(read, '');
    onNote(
      `Picture added — ${read.width} × ${read.height} px. `
      + 'Its name and description are on the Picture tab.',
    );
  };

  return (
    <div className="rbg" role="group" aria-label="Insert">
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
        onClick={() => {
          /* Cleared first: choosing the same file twice fires no `change`
             event, so re-inserting a picture you had just removed did
             nothing at all. */
          if (picker.current !== null) picker.current.value = '';
          picker.current?.click();
        }}
      />
      <RibbonButton
        icon="waveform"
        label="Audio"
        size="lg"
        title="Attach a recording to this document, and line it up with the text"
        onClick={onAudio}
      />
      {/*
        THE CHARACTERS THE KEYBOARD DOES NOT HAVE. On Insert because that is
        what it is — putting a thing into the document — and beside the picture
        and the recording for the same reason.
      */}
      <IastPalette insert={iast.insert} armed={iast.armed} enabled={session.editing} />
    </div>
  );
}
