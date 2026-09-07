/**
 * THE ICONS, by what they mean here — not by what a library calls them.
 *
 * Three sources, and the split is deliberate.
 *
 *   - `SYMBOL` names a file in Material Symbols (Rounded, weight 400,
 *     Apache-2.0), vendored as a dev dependency and copied into
 *     `assets/icons` when this generates. A general interface idea — undo, a
 *     printer, a magnifier — is not ours to draw, and drawing it worse than a
 *     maintained set does the program no favours. Rounded rather than
 *     Outlined because it is the register Office and VS Code sit in, and this
 *     is a tool people come to FROM Word.
 *
 *   - `MARK` is OUR NOTATION, drawn here. A holding is a box around a syllable
 *     and a long holding is the same box in a heavier stroke — that is the
 *     marking vocabulary this program exists for, and no icon set has it.
 *     Reaching for a "crop" glyph would teach the wrong thing in the one place
 *     we know better than the library does.
 *
 *   - `CAPTION` is the window's own buttons. They are drawn, not borrowed,
 *     because the platform conventions are exact: Windows draws a 10x10 glyph
 *     on a 1px grid, and a 24-unit icon scaled down to it looks soft and
 *     wrong beside every other window on the desktop.
 *
 * The app never writes a library file name. It asks for `hold-long` or
 * `view-pages`, and this table is the only place the two vocabularies meet —
 * so changing icon sets is one file, and a name that does not exist fails the
 * generator instead of rendering an empty box.
 */

/** Our name → the Material Symbols (rounded) file name. */
export const SYMBOL = {
  /* the document, and what you do to a file */
  document: 'description',
  open: 'folder_open',
  save: 'save',
  'save-as': 'save_as',
  print: 'print',
  export: 'download',
  import: 'upload',
  pdf: 'picture_as_pdf',
  'new-document': 'note_add',

  /* mode */
  'mode-read': 'visibility',
  'mode-write': 'ink_pen',

  /* editing */
  undo: 'undo',
  redo: 'redo',
  cut: 'content_cut',
  copy: 'content_copy',
  paste: 'content_paste',
  find: 'search',
  replace: 'find_replace',

  /* marking */
  'marks-clear': 'format_clear',
  'auto-keep': 'wand_stars',
  'auto-replace': 'published_with_changes',
  locked: 'lock',

  /* views */
  'view-flow': 'notes',
  'view-pages': 'auto_stories',
  'view-web': 'public',
  'page-size': 'crop',

  /* text */
  script: 'translate',
  'text-size': 'format_size',

  /* zoom */
  'zoom-in': 'zoom_in',
  'zoom-out': 'zoom_out',
  'zoom-actual': 'width_normal',
  'zoom-fit-width': 'fit_page_width',
  'zoom-fit-page': 'fit_screen',

  /* audio */
  play: 'play_arrow',
  pause: 'pause',
  stop: 'stop',
  'play-verse': 'play_circle',
  loop: 'repeat',
  waveform: 'graphic_eq',
  microphone: 'mic',

  /* the shell */
  appearance: 'palette',
  light: 'light_mode',
  dark: 'dark_mode',
  'panel-open': 'left_panel_open',
  'panel-close': 'left_panel_close',
  outline: 'segment',
  tree: 'account_tree',
  numbered: 'format_list_numbered',
  settings: 'settings',
  help: 'help',
  more: 'more_vert',
  /* The tick beside the document that is open, in the library list. */
  check: 'check',
  menu: 'menu',
  chevron: 'chevron_right',
  history: 'history',
};

/**
 * Ours, on a 24-unit grid.
 *
 * `hold-short` and `hold-long` differ ONLY in stroke weight — 1.2 against 2.6 —
 * because that is the only difference between the two marks on the page
 * (MARKING-RULES §2.3; measured in his file at 0.25 pt against 1.5 pt). An
 * icon that differed in SIZE would teach a rule that is not the rule.
 */
export const MARK = {
  'hold-short':
    '<path d="M3.8 6h16.4v12H3.8z" fill="none" stroke="currentColor" stroke-width="1.2"'
    + ' stroke-linejoin="round"/>'
    + '<path d="M8.6 15.4 12 8.2l3.4 7.2M9.9 13.4h4.2" fill="none" stroke="currentColor"'
    + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  'hold-long':
    '<path d="M3.8 6h16.4v12H3.8z" fill="none" stroke="currentColor" stroke-width="2.6"'
    + ' stroke-linejoin="round"/>'
    + '<path d="M8.6 15.4 12 8.2l3.4 7.2M9.9 13.4h4.2" fill="none" stroke="currentColor"'
    + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  /* No holding: the box, opened. */
  'hold-none':
    '<path d="M8.6 6H3.8v12h4.8M15.4 6h4.8v12h-4.8" fill="none" stroke="currentColor"'
    + ' stroke-width="1.2" stroke-linejoin="round"/>'
    + '<path d="M8.6 15.4 12 8.2l3.4 7.2M9.9 13.4h4.2" fill="none" stroke="currentColor"'
    + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  /* Marks on or off: the svara stroke above a letter, the holding under it. */
  marks:
    '<path d="M9 4.4h6" fill="none" stroke="currentColor" stroke-width="1.6"'
    + ' stroke-linecap="round"/>'
    + '<path d="M7.9 17 12 7.4 16.1 17M9.5 14.4h5" fill="none" stroke="currentColor"'
    + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M6.4 20.2h11.2" fill="none" stroke="currentColor" stroke-width="1.6"'
    + ' stroke-linecap="round"/>',
};

/**
 * The window's caption buttons, on a 10-unit grid — the platform's own.
 *
 * Windows' caption glyphs are hairlines on whole pixels: a 1px bar for
 * minimise, a 1px square for maximise, two offset squares for restore, and a
 * 1.05px X for close. These are those, so the window sits beside File Explorer
 * without looking like a web page pretending.
 */
export const CAPTION = {
  'win-min': '<path d="M0.5 5.2h9" stroke="currentColor" stroke-width="1" fill="none"/>',
  'win-max':
    '<rect x="0.9" y="0.9" width="8.2" height="8.2" stroke="currentColor"'
    + ' stroke-width="1" fill="none"/>',
  'win-restore':
    '<path d="M2.7 2.6V0.9h6.4v6.4H7.4" stroke="currentColor" stroke-width="1" fill="none"/>'
    + '<rect x="0.9" y="2.6" width="6.5" height="6.5" stroke="currentColor"'
    + ' stroke-width="1" fill="none"/>',
  'win-close':
    '<path d="M0.9 0.9 9.1 9.1M9.1 0.9 0.9 9.1" stroke="currentColor"'
    + ' stroke-width="1.05" fill="none"/>',
};

export const ICON_NAMES = [
  ...Object.keys(SYMBOL), ...Object.keys(MARK), ...Object.keys(CAPTION),
].sort();
