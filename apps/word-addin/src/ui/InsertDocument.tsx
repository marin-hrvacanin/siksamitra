/**
 * BRING IN A DOCUMENT FROM THE APP — the app's Import, at the caret in Word.
 *
 * Whatever the app opens: its own `.smdoc`, a chant package, a Word file it
 * exported (the document rides inside it), or its HTML page. Read and written
 * by the app's own code (`word/insert-doc.ts`); the result is said in the
 * pane, as the rest of Settings says things.
 */
import { useRef, useState, type ReactNode } from 'react';
import { OPENABLE } from '@siksamitra/interop';
import { insertDocument } from '../word/insert-doc.js';

export function InsertDocument(): ReactNode {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const bring = async (file: File): Promise<void> => {
    setBusy(true);
    setSaid(null);
    try {
      const done = await insertDocument(new Uint8Array(await file.arrayBuffer()), file.name);
      setSaid([
        `“${done.title || file.name}” is in the document, after the line the caret was in: ${done.verses} verse(s).`,
        done.pictures > 0 ? `${done.pictures} picture(s) are marked where they go — insert them from Word’s Insert tab.` : '',
        done.note ?? '',
      ].filter((x) => x !== '').join(' '));
    } catch (e) {
      setSaid(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (input.current !== null) input.current.value = '';
    }
  };

  return (
    <section className="set__box">
      <h2 className="set__h">Bring in a document from the app</h2>
      <p className="set__note">
        A śikṣāmitra document ({OPENABLE.join(', ')}) goes in after the line the caret is in, marked exactly as it is
        in the app. A part of another śākhā comes in as a part.
      </p>
      <input
        ref={input}
        type="file"
        accept={OPENABLE.join(',')}
        hidden
        onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f !== undefined) void bring(f); }}
      />
      <button type="button" className="set__btn" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Bringing it in…' : 'Choose a document…'}
      </button>
      {said !== null && <p className="set__note" role="status">{said}</p>}
    </section>
  );
}
