/**
 * HIS MARKS, AS WORD DRAWS THEM — the rules a `word`-scale document theme
 * draws its marks by, generated from `WORD_MARKS` (`src/word.ts`), which was
 * read out of his own files. No value here is typed: each is his.
 *
 * The other themes draw marks for a screen: a box fitted to the ink with
 * rounded corners, a svara as a drawn stroke. HIS page is Word's, and Word
 * draws them differently, measured on his sādhanā against the PDF Word
 * printed from it (`tools/fidelity/compare_pdf.py`):
 *
 *   - a holding is a CHARACTER BORDER: square, a quarter point (`Holding`) or
 *     one point (`2Holding`) of his green, as tall as the face from its ascent
 *     to its descent, drawn just outside the letters — and Word adds the
 *     border's width to the line, as a CSS border on an inline box does;
 *   - a svara is a GLYPH: the combining character itself (U+030D, U+030E,
 *     U+0331) in his `Svara` face, bold, 18 pt over a 16 pt line, set right
 *     after its letter at no width — Word's own model of a combining mark in
 *     another font — so it stands where the face's design puts it;
 *   - a letter the rules replaced, and both pause bars, are ITALIC, in his
 *     blue and his red; nothing about a pause is bold;
 *   - a daṇḍa is in the text's own ink, in his `Mangal`, at Mangal's own width
 *     — so a line breaks where his breaks even where Mangal is not installed
 *     and another face draws the bar.
 */
import { WORD_DANDA_FACE, WORD_MARKS, WORD_PARAGRAPHS } from './src/word.ts';

/**
 * Word's superscript, as Word sets it — measured, not recalled: 10.56 pt on
 * a 16 pt line, its baseline 5.52 pt above the line's, in every one of the
 * 241 in his sādhanā and the 13 in bhū sūktam v1.1. Both in the LINE's ems;
 * the raise was once taken in the superscript's own and stood 2 pt low.
 */
export const WORD_SUPERSCRIPT = { size: 0.66, raise: 0.345 };

/** A family his file names, then ours that stands in for it where his is not installed. */
const stack = (his, ours) => `'${his}', '${ours}', serif`;

export function wordMarkRules(themeId) {
  const at = `[data-doc="${themeId}"] .doc`;
  const verse = WORD_PARAGRAPHS.find((p) => p.style === 'Translit').size;
  const svaraEm = (WORD_MARKS.svara.size / verse).toFixed(4);
  const viramaEm = (WORD_MARKS.virama.size / verse).toFixed(4);
  const glyphs = { svarita: '\\30D', 'dirgha-svarita': '\\30E', anudatta: '\\331' };
  return `
/* His marks, as Word draws them — packages/tokens/word-marks.mjs. */
${at} .hold.hold-short,
${at} .hold.hold-long {
  display: inline;
  position: static;
  line-height: inherit;
  padding: 0;
  margin: 0;
  border-radius: 0;
  box-shadow: none;
  border: ${WORD_MARKS.holdShort.weight}pt solid var(--c-hold);
}
${at} .hold.hold-long { border-width: ${WORD_MARKS.holdLong.weight}pt; }
${at} .hold.hold--join-l { border-left-width: 0; }
${at} .hold.hold--join-r { border-right-width: 0; }
${at} .hold::before,
${at} .hold::after { content: none; }
${at} .u.sv-svarita,
${at} .u.sv-dirgha-svarita,
${at} .u.sv-anudatta {
  display: inline;
  line-height: inherit;
}
${at} .u.sv-svarita::before,
${at} .u.sv-dirgha-svarita::before,
${at} .u.sv-anudatta::before { content: none; }
${Object.entries(glyphs).map(([k, g]) => `${at} .u.sv-${k}::after { content: "${g}"; }`).join('\n')}
${at} .u.sv-svarita::after,
${at} .u.sv-dirgha-svarita::after,
${at} .u.sv-anudatta::after {
  position: static;
  display: inline;
  inset: auto;
  width: auto;
  height: auto;
  transform: none;
  background: none;
  border-radius: 0;
  font-family: ${stack(WORD_MARKS.svara.face, 'Gentium Book Plus')};
  font-size: ${svaraEm}em;
  font-weight: ${WORD_MARKS.svara.bold ? 700 : 400};
  font-style: normal;
  line-height: 0;
  color: var(--c-svara);
}
${at} .u.is-change,
${at} .u__sup { font-style: ${WORD_MARKS.change.italic ? 'italic' : 'normal'}; }
/* Word's superscript. \`vertical-align\` takes the superscript's own ems. */
${at} .u__sup {
  color: var(--c-change);
  font-weight: 400;
  margin: 0;
  font-size: ${WORD_SUPERSCRIPT.size.toFixed(4)}em;
  vertical-align: ${(WORD_SUPERSCRIPT.raise / WORD_SUPERSCRIPT.size).toFixed(4)}em;
  line-height: 0;
}
/* A pause written against a word gets the space his files put on each side
   of it: \`oṁ | bhūr\`, never \`oṁ |bhūr\`. */
${at} .syl + .pause::before,
${at} .pause:has(+ .syl)::after { content: ' '; }
/* The svarabhakti dot is his \`Svara\` style's middle dot — the svaras' face,
   bold and red, set before its letter at its own width — not a drawn circle. */
${at} .sbhakti {
  display: inline;
  width: auto;
  height: auto;
  margin: 0;
  background: none;
  border-radius: 0;
  vertical-align: baseline;
}
${at} .sbhakti::before {
  content: "\\B7";
  font-family: ${stack(WORD_MARKS.svara.face, 'Gentium Book Plus')};
  font-size: ${svaraEm}em;
  font-weight: ${WORD_MARKS.svara.bold ? 700 : 400};
  line-height: 0;
  color: var(--c-svara);
}
/* The Vedic anusvāra is ONE glyph of his \`VedicAnusvara\` face — URW Palladio
   ITU's own m with its candrabindu, U+F141, which no Unicode character draws —
   in the substitution blue, and the face we ship draws it, at its own width.
   The letters the text keeps (\`m̐\`) stay in the markup at no size, for a
   copy and a search; the page and the PDF carry his glyph, as his do. Set in
   the letters' own face they took the candrabindu from whatever face the
   machine had — Arial, here — and were a point too wide. */
${at} .u.u--gum { font-size: 0; }
${at} .u.u--gum::before {
  content: '\\F141';
  font-family: '${WORD_MARKS.vedicChange.face}';
  font-style: ${WORD_MARKS.vedicChange.italic ? 'italic' : 'normal'};
  font-weight: 400;
  /* The line's size: the letters' own is nothing now. */
  font-size: var(--doc-verse-size);
  color: var(--c-change);
}
/* The Ṛgvedic overline: his \`Long\` style, a glyph at no width after its
   letter like a svara, in his blue — Calibri Light's, set here in Carlito. */
${at} .u__long {
  font-family: 'Carlito', 'Gentium Book Plus', serif;
  font-size: ${(WORD_MARKS.dirgha.size / verse).toFixed(4)}em;
  line-height: 0;
  color: #${WORD_MARKS.dirgha.color};
}
${at} .u--virama {
  font-family: 'Arimo', sans-serif;
  font-size: ${viramaEm}em;
  line-height: 0;
}
${at} .pause {
  display: inline;
  line-height: 0;
  font-family: inherit;
  font-weight: 400;
  font-style: ${WORD_MARKS.pause.italic ? 'italic' : 'normal'};
  letter-spacing: normal;
  margin-inline: 0;
}
${at} .danda {
  /* INLINE, and no line height: a face taller than his line must not make the
     line taller — his line is exactly as tall as \`Translit\` says. Measured:
     every mantra line 25.49 pt where his are 24, until this. And in HIS
     daṇḍa's own shape — Mangal's bars, as our face \`${WORD_DANDA_FACE}\` draws
     them: his width, his height, his weight. */
  display: inline;
  line-height: 0;
  margin: 0;
  padding: 0;
  text-indent: 0;
  color: var(--doc-verse-color);
  font-family: '${WORD_DANDA_FACE}', 'Noto Serif Devanagari', serif;
}
`;
}
