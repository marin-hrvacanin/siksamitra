/**
 * Pictures, as the window sees them.
 *
 * The logic is `figures.ts` in `@siksamitra/edit`, which knows nothing about
 * React or a file picker. This is the impure half: which picture is selected,
 * and turning a file somebody chose into bytes the document can hold.
 *
 * EVERY CHANGE GOES THROUGH THE SESSION, so undo covers all of it — inserting,
 * resizing, re-aligning, re-captioning, replacing and deleting are one
 * `figure` command with a different patch, and Ctrl+Z puts back whichever of
 * them just happened. There is no second path that writes a figure.
 *
 * WHY THE BYTES GO INTO THE DOCUMENT. This program saves one `.json`, so a
 * picture stored anywhere else is a picture the file does not have — the state
 * `puja-vidhi.json` is in, naming 22 PNGs that live somewhere else. See
 * `packages/format/src/figure.ts`.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FIGURE_MAX_BYTES, FIGURE_MEDIA_TYPES, figureBytes, imageDataUri,
  type ChantFigure, type ChantFigureFlow, type ChantFigureSize, type ChantSection,
} from '@siksamitra/format';
import {
  figureIdsIn, nextFigureId, withFigureDefaults, type EditCommand,
} from '@siksamitra/edit';

/** Where a picture is: the block the page map knows, and its item index. */
export interface FigureSite {
  readonly blockId: string;
  readonly sectionId: string;
  readonly at: number;
}

/** A file, read and measured, ready to become a figure. */
export interface ReadImage {
  /** `data:<type>;base64,…` — the bytes, which is what the document stores. */
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly name: string;
}

/** What the views need to draw a selection and report a click. Exactly these
 *  two, so a view knows nothing about pictures beyond passing them on. */
export interface FigureViewProps {
  readonly selectedFigure?: string;
  readonly onFigure: (blockId: string, sectionId: string, at: number) => void;
  /** A corner was dragged on the selected picture: its width in per cent. */
  readonly onFigureResize: (pct: number) => void;
}

export interface Figures {
  readonly selected: FigureSite | null;
  /**
   * Spread straight into `FlowView` and `PagedView`.
   *
   * Memoised HERE rather than at the call site because `DocumentBlocks` is
   * memoised and a fresh callback on every render rebuilds all 198 verses of
   * Śrī Rudram — measured at 377 ms a keystroke, which is the cost the memo
   * exists to avoid. Both views take the same object, so a picture selected in
   * the flow view is still selected after switching to pages.
   */
  readonly viewProps: FigureViewProps;
  readonly figure: ChantFigure | null;
  readonly select: (site: FigureSite | null) => void;
  readonly insert: (image: ReadImage, alt: string, caption?: string) => void;
  readonly replace: (image: ReadImage) => void;
  readonly update: (patch: Partial<ChantFigure>) => void;
  readonly remove: () => void;
  readonly setSize: (size: ChantFigureSize) => void;
  readonly setFlow: (flow: ChantFigureFlow) => void;
}

/**
 * Read a picture off the disk.
 *
 * The size is CHECKED HERE, before anything is inserted, because a refusal
 * after the fact is a document that already grew. The ceiling and its
 * arithmetic are in `figure.ts` — 8 MiB is a 300-ppi photograph across an A4
 * column, and past that is bytes nobody can ever see.
 *
 * The intrinsic size is read from the decoded picture rather than trusted from
 * anywhere, and it matters: it is what reserves the aspect box before the
 * bytes decode, so a picture landing mid-step never pushes the mantra being
 * read down the screen.
 */
export async function readImageFile(file: File): Promise<ReadImage | string> {
  if (!(FIGURE_MEDIA_TYPES as readonly string[]).includes(file.type)) {
    return `${file.name} is a ${file.type === '' ? 'file of unknown type' : file.type}. `
      + `A document may carry ${FIGURE_MEDIA_TYPES.map((t) => t.slice(6)).join(', ')}.`;
  }
  if (file.size > FIGURE_MAX_BYTES) {
    return `${file.name} is ${(file.size / 1048576).toFixed(1)} MB. `
      + `A document will carry ${FIGURE_MAX_BYTES / 1048576} MB — which is a `
      + 'photograph across a whole A4 column at 300 ppi, past which nothing '
      + 'gains a printed detail.';
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  /* In chunks: `String.fromCharCode(...bytes)` on a multi-megabyte array
     overflows the argument stack and throws, which it did at 130 kB in one
     browser and at 8 MB in another. */
  let binary = '';
  for (let i = 0; i < buffer.length; i += 0x8000) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  }
  const src = imageDataUri(file.type, btoa(binary));

  const size = await new Promise<{ width: number; height: number } | null>((done) => {
    const probe = new Image();
    probe.onload = () => done({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.onerror = () => done(null);
    probe.src = src;
  });
  if (size === null) return `${file.name} could not be decoded as an image.`;

  return { src, width: size.width, height: size.height, bytes: figureBytes(src), name: file.name };
}

/** Where a new picture goes: after the verse the caret is in, else at the end. */
function insertionPoint(section: ChantSection | undefined, verseId: string | undefined): number {
  const items = section?.items ?? [];
  if (verseId === undefined) return items.length;
  const at = items.findIndex((it) => it.t === 'verse' && it.id === verseId);
  return at === -1 ? items.length : at + 1;
}

export function useFigures(
  { run, doc, sectionId, verseId }: {
    run: (command: EditCommand) => void;
    doc: { sections: readonly ChantSection[]; figures?: readonly ChantFigure[] };
    sectionId: string;
    /** The verse the caret is in, which is where a new picture lands. */
    verseId: string | undefined;
  },
): Figures {
  const [selected, setSelected] = useState<FigureSite | null>(null);

  /*
   * The selected figure, RESOLVED FROM THE DOCUMENT on every render rather than
   * held beside the selection. Holding a copy is how a ribbon comes to show the
   * size a picture had before the last undo.
   */
  const figure = useMemo<ChantFigure | null>(() => {
    if (selected === null) return null;
    const section = doc.sections.find((s) => s.id === selected.sectionId);
    const item = section?.items?.[selected.at];
    if (item === undefined || item.t !== 'figure') return null;
    return item.figure
      ?? (item.ref === undefined
        ? null
        : doc.figures?.find((f) => f.id === item.ref) ?? null);
  }, [doc, selected]);

  const patch = useCallback((next: Partial<ChantFigure>) => {
    if (selected === null) return;
    run({
      k: 'figure', sectionId: selected.sectionId, at: selected.at,
      op: { kind: 'update', patch: next },
    });
  }, [run, selected]);

  const insert = useCallback((image: ReadImage, alt: string, caption?: string) => {
    const section = doc.sections.find((s) => s.id === sectionId);
    /* The id allocator is `@siksamitra/edit`'s, not a second one here: two ways
       of picking a free id are two ways of picking the same one twice, and a
       duplicate makes a `ref` ambiguous. */
    const id = nextFigureId(figureIdsIn(doc.sections, doc.figures ?? []));
    const at = insertionPoint(section, verseId);
    run({
      k: 'figure',
      sectionId,
      at,
      op: {
        kind: 'insert',
        figure: withFigureDefaults({
          id,
          src: image.src,
          alt,
          width: image.width,
          height: image.height,
          ...(caption === undefined || caption === '' ? {} : { caption: { en: caption } }),
        }),
      },
    });
    /* Select what was just put in, so the size and alignment controls are
       about the picture the person is looking at rather than about nothing. */
    setSelected({ blockId: `f:${sectionId}:${at}`, sectionId, at });
  }, [doc, run, sectionId, verseId]);

  /*
   * The resize, behind a ref.
   *
   * `viewProps` is memoised on `selected` alone and must stay that way — a
   * fresh object rebuilds all 198 verses of Śrī Rudram, measured at 377 ms a
   * keystroke, which is what the memo exists to avoid. A ref lets the handler
   * see the current figure without the memo depending on it.
   */
  const patchRef = useRef<(pct: number) => void>(() => {});

  const viewProps = useMemo<FigureViewProps>(() => ({
    ...(selected === null ? {} : { selectedFigure: selected.blockId }),
    onFigure: (blockId, sectionId, at) => setSelected({ blockId, sectionId, at }),
    onFigureResize: (pct: number) => patchRef.current(pct),
  }), [selected]);

  patchRef.current = (pct: number) => { patch({ widthPct: pct }); };

  return {
    selected,
    viewProps,
    figure,
    select: setSelected,
    insert,
    replace: useCallback((image: ReadImage) => patch({
      src: image.src, width: image.width, height: image.height,
    }), [patch]),
    update: patch,
    remove: useCallback(() => {
      if (selected === null) return;
      run({ k: 'figure', sectionId: selected.sectionId, at: selected.at, op: { kind: 'remove' } });
      setSelected(null);
    }, [run, selected]),
    setSize: useCallback((size: ChantFigureSize) => patch({ size }), [patch]),
    setFlow: useCallback((flow: ChantFigureFlow) => patch({ flow }), [patch]),
  };
}
