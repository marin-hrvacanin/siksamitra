/**
 * THE WORD RIBBON'S PICTURES — the ink they are drawn in, and the fill inside
 * an outlined one. Out of `word.ts`, which is the document's look.
 */

/**
 * THE INK OF THE ADD-IN'S RIBBON PICTURES — one grey for Word's light AND dark
 * ribbon.
 *
 * A ribbon picture is a PNG named in the manifest, and Word offers an add-in
 * no dark-theme picture: neither the XML manifest nor the unified one has a
 * slot for it, and Microsoft's guidance is an icon visible on both
 * backgrounds. The app's light ink (near black) vanished on the dark ribbon —
 * the owner's report. So the letters are drawn in the grey that is equally
 * readable on both: against Word's light ribbon (about #F3F3F3) 3.56 : 1,
 * against its dark one (about #292929) 3.68 : 1 — above the 3 : 1 a graphic
 * needs, on each. White letters on the dark ribbon, which is what he asked
 * for, is the one thing an add-in cannot have.
 */
export const WORD_RIBBON_INK = '808080';

/**
 * THE FILL INSIDE AN OUTLINED SHAPE — the holding box, as Microsoft's icon
 * guidelines give an outlined shape a light "Background Fill" — and the dark
 * ink of the letter on it: a boxed letter, as on the page, on either ribbon.
 * (A light halo around every picture was tried, 2026-10-01, and left pixels
 * around the strokes; the owner rejected it.)
 */
export const WORD_RIBBON_FILL = 'FFFFFF';
/** The ink of a letter on that fill — the page's own dark. */
export const WORD_RIBBON_INK_ON_FILL = '424242';
