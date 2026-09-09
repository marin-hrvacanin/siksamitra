/**
 * THE WINDOW'S OWN STATE — what is open, what is folded, what is expanded.
 *
 * None of it belongs to the document: the ribbon stays folded and the panel
 * stays open when another chant is opened, because closing a panel and having
 * it reopen under you is the kind of small betrayal that stops a panel being
 * used. So it lives above the document rather than inside anything that
 * unmounts with one.
 *
 * `navRows` is here for a sharper version of the same reason: the navigation
 * panel unmounts when it is hidden, and a panel that forgot which steps were
 * expanded every time it was closed would be a panel nobody expands.
 *
 * Split out of `App.tsx` at the 400-line module gate. It is five pieces of
 * state and one reason, which is exactly the sort of thing that should be
 * findable by name.
 */
import { useState } from 'react';

export interface ShellState {
  readonly folded: boolean;
  readonly setFolded: (folded: boolean) => void;
  readonly navOpen: boolean;
  readonly setNavOpen: (open: boolean) => void;
  /** Which outline rows are expanded. */
  readonly navRows: ReadonlySet<string>;
  readonly setNavRows: (rows: ReadonlySet<string>) => void;
  /** The File view — a place, over the whole window, not a panel. */
  readonly fileOpen: boolean;
  readonly setFileOpen: (open: boolean) => void;
}

export function useShellState(): ShellState {
  const [folded, setFolded] = useState(false);
  const [navOpen, setNavOpen] = useState(true);
  const [navRows, setNavRows] = useState<ReadonlySet<string>>(new Set());
  const [fileOpen, setFileOpen] = useState(false);
  return {
    folded, setFolded, navOpen, setNavOpen, navRows, setNavRows, fileOpen, setFileOpen,
  };
}
