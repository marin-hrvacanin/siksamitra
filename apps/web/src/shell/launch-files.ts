/**
 * THE FILES THE DESKTOP APP WAS OPENED WITH — a double-click on a document,
 * "Open with", or a path on the command line.
 *
 * The Tauri side has offered them since it was written (`launch_files`, and
 * an `open-files` event when a second launch hands its files to the running
 * window — `src-tauri/src/lib.rs`), and nothing on this side ever asked: every
 * double-clicked document opened an empty one. Each file is opened exactly as
 * File → Import opens it (`openDocumentFile`), so a `.docx`, a `.smdoc` and a
 * `.vuchant` behave the same either way.
 */
import { useEffect, useRef } from 'react';
import type { ChantDoc } from '@siksamitra/format';
import { host } from './host.js';

interface OpenedFile { readonly path: string; readonly name: string }

export function useLaunchFiles(
  adopt: (doc: ChantDoc, name: string) => void,
  note: (text: string) => void,
): void {
  /* The latest of each, read when a file arrives: a second launch hands its
     files over long after the first render, and must be asked about with the
     document's state as it is then, not as it was at start. */
  const live = useRef({ adopt, note });
  live.current = { adopt, note };
  useEffect(() => {
    if (host.kind !== 'desktop') return undefined;
    let off: (() => void) | undefined;
    let gone = false;
    const open = async (f: OpenedFile): Promise<void> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const bytes = new Uint8Array(await invoke<number[]>('read_file', { path: f.path }));
        const { openDocumentFile } = await import('@siksamitra/interop');
        const opened = await openDocumentFile(bytes, f.name);
        if (gone) return;
        live.current.adopt(opened.doc, f.name);
        if (opened.note !== null) live.current.note(opened.note);
      } catch (e) {
        live.current.note(`${f.name}: ${e instanceof Error ? e.message : 'could not be opened'}`);
      }
    };
    void (async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');
      for (const f of await invoke<OpenedFile[]>('launch_files')) await open(f);
      const stop = await listen<OpenedFile[]>('open-files', (e) => { for (const f of e.payload) void open(f); });
      if (gone) stop(); else off = stop;
    })();
    return () => { gone = true; off?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once, at start: the launch has one set of files
  }, []);
}
