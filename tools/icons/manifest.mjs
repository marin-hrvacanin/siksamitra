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
  html: 'code_blocks',
  image: 'image',
  'new-document': 'note_add',

  /* A PICTURE'S WRAP, in Word's own vocabulary — the two questions it asks
     separately. `wrap-*` is what the TEXT does; `side-*` is which side the
     picture is on. They were one control and it could only ever mean both. */
  'wrap-top-bottom': 'view_agenda',
  'wrap-square': 'wrap_text',
  'side-start': 'format_image_left',
  'side-centre': 'align_horizontal_center',
  'side-end': 'format_image_right',

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
  'marks-clear': 'ink_eraser',
  'auto-keep': 'wand_stars',
  'auto-replace': 'published_with_changes',
  locked: 'lock',
  symbols: 'special_character',

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
  /* Moving a pada boundary a hair earlier or later. Chevrons rather than
     arrows: an arrow in this ribbon means motion through the document, and
     these move a MARK along the recording by 0.05 s. */
  'nudge-back': 'chevron_left',
  'nudge-on': 'chevron_right',

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
  /* the Word add-in: importing the vocabulary, and parts with rules of their own */
  'style-import': 'library_add',
  'part-new': 'border_outer',
  'part-dissolve': 'border_clear',
  keyboard: 'keyboard',
  warning: 'warning',
  info: 'info',
};

/**
 * Ours, on a 24-unit grid.
 *
 * `data-mark` is on the part of a glyph that IS the mark — the box of a
 * holding, the stroke of a svara, the svarabhakti's dot — so the Word add-in
 * can draw that part in the mark's own colour and the letter in ink, as the
 * page does (`scripts/word-commands.ts`). The app draws every part in
 * `currentColor` and never reads it.
 *
 * `hold-short` and `hold-long` differ ONLY in stroke weight — 1.2 against 2.6 —
 * because that is the only difference between the two marks on the page
 * (MARKING-RULES §2.3; measured in his file at 0.25 pt against 1.5 pt). An
 * icon that differed in SIZE would teach a rule that is not the rule.
 */
/**
 * The letter the marking icons are drawn on: a LOWER-CASE a, the way the text
 * is written. It was a capital A, and no letter in a recitation text is one.
 * Single-storey, because at 16 px a double-storey bowl closes up.
 */
const letterA = (cy, r = 2.9) =>
  `<circle cx="12" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-width="1.6"/>`
  + `<path d="M${12 + r} ${(cy - r).toFixed(1)}v${(2 * r).toFixed(1)}" fill="none"`
  + ' stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';

export const MARK = {
  'hold-short':
    '<path data-mark="1" d="M3.8 6h16.4v12H3.8z" fill="none" stroke="currentColor" stroke-width="1.2"'
    + ' stroke-linejoin="round"/>'
    + letterA(12),
  'hold-long':
    '<path data-mark="1" d="M3.8 6h16.4v12H3.8z" fill="none" stroke="currentColor" stroke-width="2.6"'
    + ' stroke-linejoin="round"/>'
    + letterA(12),
  /* No holding: the box, opened. */
  'hold-none':
    '<path d="M8.6 6H3.8v12h4.8M15.4 6h4.8v12h-4.8" fill="none" stroke="currentColor"'
    + ' stroke-width="1.2" stroke-linejoin="round"/>'
    + letterA(12),

  /*
   * The svaras, as they are written on the page — the same letter as the
   * holding icons, with the accent where the accent goes: a bar UNDER for the
   * anudātta, one stroke OVER for the svarita, two for the dīrgha svarita.
   */
  'svara-anudatta':
    letterA(11.4)
    + '<path data-mark="1" d="M8.6 18.2h6.8" fill="none" stroke="currentColor" stroke-width="1.6"'
    + ' stroke-linecap="round" stroke-linejoin="round"/>',
  'svara-svarita':
    letterA(14.2)
    + '<path data-mark="1" d="M12 4.4v4" fill="none" stroke="currentColor" stroke-width="1.6"'
    + ' stroke-linecap="round" stroke-linejoin="round"/>',
  'svara-dirgha':
    letterA(14.2)
    + '<path data-mark="1" d="M10.6 4.4v4M13.4 4.4v4" fill="none" stroke="currentColor" stroke-width="1.6"'
    + ' stroke-linecap="round" stroke-linejoin="round"/>',
  /*
   * Candrabindu: the crescent and its dot over an m — m̐, the letter it is
   * written on in this program's IAST and the one the insert palette shows.
   * It was drawn over the holding icons' A, which is a letter no candrabindu
   * in the corpus sits on.
   */
  candrabindu:
    '<path d="M7.5 18.4v-6.2M7.5 13.6c0-1.5 1-2.2 2.3-2.2s2.2.7 2.2 2.2v4.8M12 13.6c0-1.5 1-2.2 2.3-2.2s2.2.7 2.2 2.2v4.8" fill="none" stroke="currentColor" stroke-width="1.5"'
    + ' stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M9.4 6.4a2.6 2.2 0 0 0 5.2 0" fill="none" stroke="currentColor" stroke-width="1.4"'
    + ' stroke-linecap="round" stroke-linejoin="round"/>'
    + '<circle cx="12" cy="4" r="1" fill="currentColor"/>',
  /*
   * Svarabhakti: r · ṣ — the dot BETWEEN the r and the sibilant after it,
   * which is where every one of the corpus's dots is (var·ṣa, dar·śa, bar·hi)
   * and where `.sbhakti` draws it. A dot beside one letter could be read as
   * belonging on either side of it; with both letters there is no side.
   */
  svarabhakti:
    '<path d="M4.4 17v-6.6M4.4 13c0-1.7 1.2-2.6 3-2.6" fill="none" stroke="currentColor"'
    + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<circle data-mark="1" cx="11" cy="13.6" r="1.3" fill="currentColor"/>'
    + '<path d="M19.4 11.4c-.4-.8-1.3-1.2-2.3-1.2-1.3 0-2.2.7-2.2 1.7 0 2.2 4.7 1.3 4.7 3.5'
    + ' 0 1.1-1 1.7-2.4 1.7-1.2 0-2.1-.5-2.5-1.3" fill="none" stroke="currentColor"'
    + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<circle cx="17.1" cy="20.2" r="1" fill="currentColor"/>',
  /* The two pauses — ONE straight line each, told apart by colour (the owner,
     2026-09-30): the short pause blue, the long one red. Two bars for the long
     one read as a second mark rather than a longer pause. */
  'bar-short':
    '<path d="M12 5.5v13" fill="none" stroke="currentColor" stroke-width="1.8"'
    + ' stroke-linecap="round" stroke-linejoin="round"/>',
  'bar-long':
    '<path d="M12 5.5v13" fill="none" stroke="currentColor" stroke-width="1.8"'
    + ' stroke-linecap="round" stroke-linejoin="round"/>',
  /* A letter the rules replaced: ṁ for an anusvāra change, ḥ for a visarga one. */
  'change-anusvara':
    '<path d="M6.8 16.8v-6.2M6.8 12c0-1.5 1-2.2 2.3-2.2s2.2.7 2.2 2.2v4.8M11.3 12c0-1.5 1-2.2 2.3-2.2s2.2.7 2.2 2.2v4.8" fill="none" stroke="currentColor" stroke-width="1.5"'
    + ' stroke-linecap="round" stroke-linejoin="round"/>'
    + '<circle cx="11.3" cy="6.2" r="1" fill="currentColor"/>',
  'change-visarga':
    '<path d="M9 5.2v11.6M9 11.2c0-1.6 1.2-2.4 2.6-2.4s2.6.8 2.6 2.4v5.6" fill="none" stroke="currentColor" stroke-width="1.5"'
    + ' stroke-linecap="round" stroke-linejoin="round"/>'
    + '<circle cx="11.6" cy="19.6" r="1" fill="currentColor"/>',
  /* Marks on or off: the svara stroke above a letter, the holding under it. */
  marks:
    '<path d="M9 5.4h6" fill="none" stroke="currentColor" stroke-width="1.6"'
    + ' stroke-linecap="round"/>'
    + letterA(12.4, 3.3)
    + '<path d="M6.4 19.4h11.2" fill="none" stroke="currentColor" stroke-width="1.6"'
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
