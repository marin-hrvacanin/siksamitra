/**
 * WHAT IS IN THIS PICTURE? — asked once, when the picture goes in.
 *
 * Word does not ask, and this program does, and the difference is what the
 * documents are. A pūjā manual's drawing of a mudrā is not decoration beside an
 * instruction; for that step it IS the instruction, so a picture with no
 * alternative text is a step a blind reciter cannot perform. `figureFaults`
 * refuses one, and refusing at the end of a gesture that has already happened
 * is worse than asking at the start of it — so Insert stays disabled until
 * there is a description.
 *
 * A CAPTION IS NOT THE SAME THING and the dialog says so where it is asked.
 * The caption is shown to everyone and says what the picture is FOR; the
 * description says what is IN it, for somebody who cannot see it. Repeating one
 * as the other is reported by `figureFaults`, because a screen reader then
 * hears the same sentence twice and learns nothing.
 *
 * IT IS ALSO HOW A DESCRIPTION IS CORRECTED, which is not a convenience: a
 * required field that can never be edited is worse than an absent one, because
 * the first person in a hurry types a space and the picture is described as a
 * space forever. Word calls this Edit Alt Text; here it is the same dialog with
 * the fields already filled in.
 *
 * It reuses the guard's chrome — the same box, the same buttons — rather than
 * growing a second modal shell that would drift from it.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ReadImage } from '../editor/useFigures.js';

export function PictureDialog(
  { image, alt: was = '', caption: had = '', onCancel, onInsert }: {
    image: ReadImage;
    /** Filled in when a picture already in the document is being described. */
    alt?: string;
    caption?: string;
    onCancel: () => void;
    onInsert: (alt: string, caption: string) => void;
  },
): ReactNode {
  /* Which gesture this is, decided once from whether there is a description
     already. A dialog that changed its own title while somebody typed in it
     would be a dialog nobody trusts. */
  const [editing] = useState(was !== '');
  const [alt, setAlt] = useState(was);
  const [caption, setCaption] = useState(had);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    field.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      /* Stopped, not merely handled: Escape is also the editor's way out of
         write mode, and one press was answering this and dropping the author
         out of the mode behind it. Exactly the guard's problem. */
      e.stopPropagation();
      e.preventDefault();
      onCancel();
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [onCancel]);

  const ready = alt.trim() !== '';
  return (
    <div className="guard" role="presentation" onMouseDown={onCancel}>
      <div
        className="guard__box"
        role="dialog"
        aria-modal
        aria-labelledby="pic-q"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="guard__q" id="pic-q">{editing ? 'Describe the picture' : 'Add a picture'}</h2>

        <div className="pic__preview">
          {/* The alt is empty ON PURPOSE: this is the picture being described,
              so announcing a description it does not have yet would be
              announcing a lie. The size line beside it carries the facts. */}
          <img className="pic__thumb" src={image.src} alt="" />
          <p className="pic__facts">
            {image.name}
            <br />
            {image.width} × {image.height} px · {(image.bytes / 1024).toFixed(0)} kB
            <br />
            {/* SAID BEFORE IT HAPPENS. The bytes go into the document, so the
                file grows by about a third more than the picture weighs —
                base64 is four characters per three bytes. Not said when the
                picture is already in: the cost has been paid. */}
            <span className="pic__cost">
              {editing
                ? 'already in this document'
                : `adds about ${((image.bytes * 4) / 3 / 1024).toFixed(0)} kB to this document`}
            </span>
          </p>
        </div>

        <label className="pic__field">
          <span className="pic__label">What is in the picture?</span>
          <textarea
            ref={field}
            className="pic__input"
            rows={2}
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Two palms pressed together, fingers upward, in añjali."
          />
          <span className="pic__hint">
            Read aloud instead of the picture. Say what it shows, not what it is for.
          </span>
        </label>

        <label className="pic__field">
          <span className="pic__label">Caption <span className="pic__opt">optional</span></span>
          <input
            className="pic__input"
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Añjali mudrā"
          />
          <span className="pic__hint">Printed under the picture, for everyone.</span>
        </label>

        <div className="guard__acts">
          <span className="guard__gap" />
          <button type="button" className="guard__b" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="guard__b guard__b--go"
            disabled={!ready}
            onClick={() => onInsert(alt.trim(), caption.trim())}
          >
            {editing ? 'Save' : 'Insert'}
          </button>
        </div>
        {!ready && (
          <p className="guard__what">
            A picture with no description is a step somebody cannot follow.
          </p>
        )}
      </div>
    </div>
  );
}
