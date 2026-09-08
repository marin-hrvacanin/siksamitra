/**
 * The disk, as the shell is allowed to see it.
 *
 * The other half of the host seam in `host.ts`: that module owns the WINDOW's
 * differences between the desktop and a browser, this one owns the FILE's.
 * They are separate modules because they are used by different things at
 * different times — the title bar asks for the window on its first render, and
 * nothing asks for the disk until somebody presses a key — and because keeping
 * them together would put the file dialogs in the bundle every browser loads.
 *
 * THE SAME RULE APPLIES: nothing outside this file imports a Tauri API. A
 * component that did would be a component the browser build cannot render, and
 * the failure would be a blank window rather than a compile error.
 *
 * THREE HOSTS, AND THEY REALLY ARE DIFFERENT.
 *
 *   Desktop     a real path. Open, Save and Save As mean what they mean in
 *               every other program: the file the document came from is the
 *               file it goes back to, written atomically by the shell.
 *   Browser,    the File System Access API. `showSaveFilePicker` hands back a
 *   Chromium    handle that can be written to again, so Save is a real save.
 *               The handle lives in memory only — it is not serialisable and
 *               a page reload loses it, which is why `reopenable` exists.
 *   Browser,    `<input type=file>` in and a download out. Save cannot write
 *   Safari/FF   back to where the file came from, because the platform has no
 *               such power, so it behaves as Save As and says so. Pretending
 *               otherwise would be a Save button that silently does nothing.
 *
 * A `ref` is the opaque string everything else uses to name a document: an
 * absolute path on the desktop, a handle key in a browser. Only this module
 * knows which.
 */
import { host } from './host.js';

/** A document that was read off the disk. */
export interface OpenedDoc {
  readonly ref: string;
  /** The file's own name, with its extension. */
  readonly name: string;
  readonly text: string;
}

export interface FileAccess {
  /** Whether `write` can put bytes back where they came from. */
  writesInPlace: (ref: string) => boolean;
  /** Whether `read` can open it again without the person choosing it first. */
  reopenable: (ref: string) => boolean;
  /** Ask for a file, and read it. `null` if the dialog was dismissed. */
  pickOpen: () => Promise<OpenedDoc | null>;
  read: (ref: string) => Promise<OpenedDoc>;
  write: (ref: string, text: string) => Promise<void>;
  /** Ask where it goes, and write it there. `null` if dismissed. */
  pickSave: (
    suggestedName: string,
    text: string,
  ) => Promise<{ ref: string; name: string } | null>;
}

/** What a chant document is called, everywhere a dialog has to say so. */
const FILTER = { name: 'śikṣāmitra document', extensions: ['json'] };

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

/** The last segment of a path, whichever separator it was written with. */
const nameOf = (path: string): string => path.split(/[\\/]/).pop() ?? path;

/* ==========================================================================
   The desktop
   ========================================================================== */

/**
 * The shell's own commands, not `plugin-fs`.
 *
 * `read_file` and `write_file_atomic` already exist in `src-tauri/src/lib.rs`
 * and the write is atomic — a sibling temp file, `sync_all`, then rename.
 * `plugin-fs` writes in place, which truncates first, so an interruption
 * during a save of a 1.7 MB document leaves a truncated document and no
 * previous copy. The interruption people actually hit is closing the lid.
 */
function desktopAccess(): FileAccess {
  const invoked = async <T>(cmd: string, args: Record<string, unknown>): Promise<T> => {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(cmd, args);
  };
  /*
   * The dialogs are invoked directly rather than through
   * `@tauri-apps/plugin-dialog`, and the reason is which package this app
   * declares. `@tauri-apps/api` is a dependency of `apps/web`; the dialog
   * plugin is a dependency of `apps/desktop`, and importing it from here would
   * work only because npm hoists both into one `node_modules` — the kind of
   * dependency that resolves on this machine and not in a clean install. The
   * plugin's own `open`/`save` are these two calls and nothing else.
   */
  const dialog = <T>(which: 'open' | 'save', options: unknown): Promise<T> =>
    invoked<T>(`plugin:dialog|${which}`, { options });
  const readAt = async (path: string): Promise<OpenedDoc> => {
    /* `Vec<u8>` arrives as an array of numbers; the bytes are decoded here
       rather than in Rust so that a file which is not UTF-8 fails as a
       document problem and not as a Rust `String::from_utf8` panic. */
    const bytes = await invoked<number[]>('read_file', { path });
    return { ref: path, name: nameOf(path), text: decode(new Uint8Array(bytes)) };
  };
  return {
    writesInPlace: () => true,
    reopenable: () => true,
    pickOpen: async () => {
      const picked = await dialog<string | string[] | null>('open', {
        multiple: false, directory: false, filters: [FILTER],
      });
      if (typeof picked !== 'string') return null;
      return readAt(picked);
    },
    read: readAt,
    write: async (ref, text) => {
      await invoked<null>('write_file_atomic', {
        path: ref,
        bytes: [...encode(text)],
      });
    },
    pickSave: async (suggestedName, text) => {
      const path = await dialog<string | null>('save', {
        defaultPath: suggestedName, filters: [FILTER],
      });
      if (typeof path !== 'string') return null;
      await invoked<null>('write_file_atomic', { path, bytes: [...encode(text)] });
      return { ref: path, name: nameOf(path) };
    },
  };
}

/* ==========================================================================
   A browser
   ========================================================================== */

/** The File System Access API, narrowed to the two calls used here. TypeScript's
 *  DOM library carries `FileSystemFileHandle` but not the pickers. */
interface FilePickers {
  showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle>;
}

/** What the pickers are told a chant document is. */
const FSA_TYPES = [{
  description: FILTER.name,
  accept: { 'application/json': ['.json'] as string[] },
}];

/**
 * Ask through `<input type=file>` — the only way a browser without the File
 * System Access API can be handed a file.
 *
 * The input is created, clicked and thrown away rather than rendered, because
 * a hidden input in the tree is a control every component that wants a file
 * has to own a copy of; there were two already.
 *
 * IT CAN NEVER RESOLVE. A dismissed file dialog fires no event in Safari or
 * Firefox — there is no `cancel` event there — so this promise is left
 * pending, which is correct: nothing happened, and nothing should. The
 * alternative, a timeout that reports a cancellation, would report one for
 * anybody who took thirty seconds to find their document.
 */
function pickThroughInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

/** Hand the browser some bytes to save. */
function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  /* Revoked on the next turn, not immediately: revoking in the same task can
     cancel the download in WebKit before it has read the blob. */
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function browserAccess(): FileAccess {
  const pickers = window as unknown as FilePickers;
  /*
   * Handles, by the ref that stands for them.
   *
   * A `FileSystemFileHandle` is not a string and cannot be one — it is a live
   * capability the browser granted this page — so the ref is a counter and the
   * handle stays here. That is also exactly why a ref from a previous session
   * is not reopenable: a page reload empties this map, and the permission it
   * stood for is gone with it.
   */
  const handles = new Map<string, FileSystemFileHandle>();
  let next = 1;
  const keep = (handle: FileSystemFileHandle): string => {
    const ref = `handle:${next}:${handle.name}`;
    next += 1;
    handles.set(ref, handle);
    return ref;
  };
  const readHandle = async (ref: string, handle: FileSystemFileHandle): Promise<OpenedDoc> => ({
    ref,
    name: handle.name,
    text: await (await handle.getFile()).text(),
  });

  return {
    writesInPlace: (ref) => handles.has(ref),
    reopenable: (ref) => handles.has(ref),
    pickOpen: async () => {
      const pick = pickers.showOpenFilePicker;
      if (pick !== undefined) {
        let picked: FileSystemFileHandle[];
        try {
          picked = await pick({ multiple: false, types: FSA_TYPES });
        } catch {
          /* The only way this rejects in practice is the dismissal of the
             dialog, which the API reports as an `AbortError`. */
          return null;
        }
        const handle = picked[0];
        if (handle === undefined) return null;
        return readHandle(keep(handle), handle);
      }
      const file = await pickThroughInput();
      if (file === null) return null;
      /* No handle, so no ref that could ever be read again: the ref names the
         file for the recents list and `reopenable` will say no. */
      return { ref: `file:${file.name}`, name: file.name, text: await file.text() };
    },
    read: async (ref) => {
      const handle = handles.get(ref);
      if (handle === undefined) {
        throw new Error('a browser cannot reopen a file by name — choose it again');
      }
      return readHandle(ref, handle);
    },
    write: async (ref, text) => {
      const handle = handles.get(ref);
      if (handle === undefined) {
        /* Save with nowhere to write is a download of the same name, which is
           the whole of what this browser can do. The caller says so in the
           status bar rather than letting it look like a save. */
        download(nameOf(ref), text);
        return;
      }
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
    },
    pickSave: async (suggestedName, text) => {
      const pick = pickers.showSaveFilePicker;
      if (pick !== undefined) {
        let handle: FileSystemFileHandle;
        try {
          handle = await pick({ suggestedName, types: FSA_TYPES });
        } catch {
          return null;
        }
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        return { ref: keep(handle), name: handle.name };
      }
      download(suggestedName, text);
      return { ref: `file:${suggestedName}`, name: suggestedName };
    },
  };
}

let access: FileAccess | null = null;

/**
 * The disk, once.
 *
 * Memoised because the browser's handle map is state: a second instance would
 * have an empty one, and every document opened through the first would become
 * unsaveable the moment anything asked for the disk again.
 */
export function fileAccess(): FileAccess {
  access ??= host.kind === 'desktop' ? desktopAccess() : browserAccess();
  return access;
}
