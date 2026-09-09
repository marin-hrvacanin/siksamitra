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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FIGURE_MAX_BYTES, FIGURE_MEDIA_TYPES, figureBytes, imageDataUri,
  type ChantFigure, type ChantFigureFlow, type ChantFigureSize, type ChantSection,
} from '@siksamitra/format';
import {
  figureIdsIn, nextFigureId, withFigureDefaults, type EditCommand,
} from '@siksamitra/edit';
import { blockId } from '../views/blocks.js';
import {
  dropLandsAt, startFigureDrag, type FigureDrop, type GrabPoint,
} from './figure-drag.js';

/** Where a picture is: the block the page map knows, and its item index. */
export interface FigureSite {
  readonly blockId: string;
  readonly sectionId: string;
  readonly at: number;
  /**
   * WHICH PICTURE, as well as where.
   *
   * A site alone is not a selection: undo a move and the picture is back at
   * index 3 while the selection still says index 1, which is now a verse — so
   * the Picture tab went grey after every Ctrl+Z. The id is what the selection
   * FOLLOWS; the index is where it was last seen.
   */
  readonly figureId: string;
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
  readonly onFigure: (blockId: string, sectionId: string, at: number, id: string) => void;
  /** A corner was dragged on the selected picture: its width in per cent. */
  readonly onFigureResize: (pct: number) => void;
  /**
   * A picture was PRESSED and the pointer may be about to move.
   *
   * Where it is passed from rather than read off the selection, because the
   * click that selects and the press that starts the drag are the same event:
   * `setSelected` has not landed yet when this runs.
   */
  readonly onFigureGrab: (e: GrabPoint, sectionId: string, at: number) => void;
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

/** The figure an item draws, whether it carries one or points into the library. */
function figureAt(
  doc: { sections: readonly ChantSection[]; figures?: readonly ChantFigure[] },
  sectionId: string,
  at: number,
): ChantFigure | null {
  const item = doc.sections.find((s) => s.id === sectionId)?.items?.[at];
  if (item === undefined || item.t !== 'figure') return null;
  return item.figure
    ?? (item.ref === undefined ? null : doc.figures?.find((f) => f.id === item.ref) ?? null);
}

/** Where a picture with this id IS, searched for rather than remembered. */
function siteOf(
  doc: { sections: readonly ChantSection[]; figures?: readonly ChantFigure[] },
  figureId: string,
): { sectionId: string; at: number } | null {
  for (const section of doc.sections) {
    const items = section.items ?? [];
    for (let at = 0; at < items.length; at += 1) {
      if (figureAt(doc, section.id, at)?.id === figureId) return { sectionId: section.id, at };
    }
  }
  return null;
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
  const figure = useMemo<ChantFigure | null>(
    () => (selected === null ? null : figureAt(doc, selected.sectionId, selected.at)),
    [doc, selected],
  );

  /*
   * THE SELECTION FOLLOWS THE PICTURE, not the position.
   *
   * An undo, a redo, a picture inserted above this one — any of them changes
   * which index the selected picture is at, and the site would then be
   * addressing whatever slid into its place. Ctrl+Z after a drag left the
   * Picture tab pointing at a verse, so every one of its controls went grey.
   *
   * So when the recorded site no longer holds the picture the selection is
   * ABOUT, it is looked for by id and the site is corrected; a picture that is
   * really gone — deleted, or the undo of an insert — clears the selection.
   */
  useEffect(() => {
    if (selected === null) return;
    if (figure?.id === selected.figureId) return;
    const found = siteOf(doc, selected.figureId);
    setSelected(found === null
      ? null
      : { ...found, blockId: blockId.figure(found.sectionId, found.at), figureId: selected.figureId });
  }, [doc, figure, selected]);

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
    setSelected({ blockId: blockId.figure(sectionId, at), sectionId, at, figureId: id });
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
  /** The drag, behind a ref for the same reason. */
  const grabRef = useRef<(e: GrabPoint, sectionId: string, at: number) => void>(() => {});

  const viewProps = useMemo<FigureViewProps>(() => ({
    ...(selected === null ? {} : { selectedFigure: selected.blockId }),
    onFigure: (id, sectionId, at, figureId) =>
      setSelected({ blockId: id, sectionId, at, figureId }),
    onFigureResize: (pct: number) => patchRef.current(pct),
    onFigureGrab: (e, sectionId, at) => grabRef.current(e, sectionId, at),
  }), [selected]);

  patchRef.current = (pct: number) => { patch({ widthPct: pct }); };
  grabRef.current = (e, fromSection, fromAt) => {
    if (selected === null) return;
    const from = { sectionId: fromSection, at: fromAt, figureId: selected.figureId };
    startFigureDrag(e, doc.sections, (to: FigureDrop) => {
      run({ k: 'figure', sectionId: from.sectionId, at: from.at, op: { kind: 'move', to } });
      /* Follow the picture. The Picture tab is addressed by WHERE the picture
         is, so a selection left behind would be pointing at whatever item slid
         into the place it used to hold. */
      const landed = dropLandsAt(from, to);
      setSelected({
        ...landed,
        blockId: blockId.figure(landed.sectionId, landed.at),
        figureId: from.figureId,
      });
    });
  };

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
    /*
     * CHOOSING A SIZE TAKES THE CUSTOM WIDTH OFF.
     *
     * A corner drag writes `widthPct`, and a per cent BEATS a size wherever
     * the two meet: the renderer applies it as an inline `style.width` over
     * the `fig--medium` class, and `figureWidth()` returns it before it looks
     * at `size` at all. So the Size list went on writing `size` faithfully
     * into the document and nothing moved — the owner's report, exactly: "I
     * resized it by pulling the edge and all of a sudden Size doesn't work at
     * all." Every one of the five sizes was dead, permanently, after one drag.
     *
     * Patched to `undefined` rather than to a number, because `updateFigure`
     * REMOVES a field patched to `undefined` — so the document goes back to
     * having no custom width at all, which is a different thing from having
     * one that happens to match a size.
     */
    setSize: useCallback(
      (size: ChantFigureSize) => patch({ size, widthPct: undefined }),
      [patch],
    ),
    setFlow: useCallback((flow: ChantFigureFlow) => patch({ flow }), [patch]),
  };
}
