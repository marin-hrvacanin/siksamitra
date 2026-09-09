/**
 * WHAT A STYLE LOOKS LIKE, against his own template.
 *
 * The owner's report: "The Svaras are rendered in a different font than
 * originally, and all other things look and feel different, formatting and
 * everything. Also, there are hallucinated styles."
 *
 * He was right on every count, and `gate-word.mjs` could not have said so: its
 * control compares six NUMBERS — size, leading, after, indent, hanging, right
 * — and every one agreed with his file to 0.000 pt while our `Svara` carried
 * no `<w:rFonts>` at all and so inherited Arial from the paragraph, where his
 * is URW Palladio ITU and bold. `docx-metrics.mjs` had parsed `face`, `bold`,
 * `italic`, `color` and `border` the whole time; the data was on the object
 * and nothing read it.
 *
 * Split out of `gate-word.mjs` at the 400-line module gate.
 */

/**
 * Word's own styles are not ours to match: a document gets `Heading1Char` and
 * friends from the template it was made in, and we neither write nor read
 * them. Only the marking vocabulary and the paragraphs we author.
 */
const OURS_TO_MATCH = [
  'Svara', 'Virama', 'Anusvara', 'VedicAnusvara', 'Pause', 'Long', 'Comment',
  'Holding', '2Holding', 'Name', 'Nma', 'Translit',
];

/** A style, as a person would describe it. */
const look = (s) => (s === undefined ? 'absent' : [
  (s.face === '' || s.face === undefined ? 'inherit' : s.face),
  s.bold === true ? 'bold' : '',
  s.italic === true ? 'italic' : '',
  s.color === '' || s.color === undefined ? '' : `#${s.color}`,
  s.size === null || s.size === undefined ? '' : `${s.size}pt`,
].filter((x) => x !== '').join(' '));

/**
 * Compare every style we write with his, on what it LOOKS like.
 *
 * `fail` is the gate's own, so a difference is a failure there rather than a
 * line of output here.
 */
export function compareLook(mine, his, fail) {
  console.log('\n  ── what each style LOOKS like, against his template ──\n');
  console.log('  style           ours                          his');
  let compared = 0;
  for (const id of OURS_TO_MATCH) {
    const a = mine[id];
    const b = his[id];
    if (a === undefined || b === undefined) continue;
    compared += 1;
    const same = look(a) === look(b);
    console.log(`  ${id.padEnd(15)} ${look(a).padEnd(29)} ${look(b)}${same ? '' : '   ✗'}`);
    /*
     * THE FACE IS THE ONE THE OWNER NAMED, so it fails rather than warns.
     * `inherit` on both sides is agreement: a style that names no family in
     * his file is not meant to name one in ours either.
     */
    if ((a.face ?? '') !== (b.face ?? '')) {
      fail(`${id} font`, `ours ${a.face === '' ? 'inherit' : a.face}, his ${b.face === '' ? 'inherit' : b.face}`);
    }
    if (a.bold !== b.bold) {
      fail(`${id} weight`, `ours ${a.bold ? 'bold' : 'regular'}, his ${b.bold ? 'bold' : 'regular'}`);
    }
    if (a.italic !== b.italic) fail(`${id} italic`, `ours ${a.italic}, his ${b.italic}`);
    if ((a.color ?? '') !== (b.color ?? '')) {
      fail(`${id} colour`, `ours #${a.color}, his #${b.color}`);
    }
  }

  /*
   * AND NO STYLE HE DOES NOT HAVE. `HoldingChange` and `2HoldingChange` were
   * invented here for a letter that is both held and substituted — a real
   * problem, since a Word run carries ONE character style — but his documents
   * have no such letter, so they appeared in the Styles pane of every file we
   * wrote, named after nothing on the page. They are written now only when the
   * body actually references them.
   */
  const invented = Object.values(mine)
    .filter((s) => s.kind === 'character' && his[s.id] === undefined)
    .map((s) => s.id);
  if (invented.length > 0) {
    fail('styles his vocabulary does not have', invented.join(', '));
  }

  /*
   * A STYLE OF HIS WE DO NOT WRITE AT ALL is reported, not failed. `Long`,
   * `Name` and `Nma` are in his vocabulary and carry two thousand runs of the
   * lalitā sahasranāma between them, and this program has no marking that
   * produces them yet. Saying so on every run is how it stays known.
   */
  const missing = OURS_TO_MATCH.filter((id) => his[id] !== undefined && mine[id] === undefined);
  console.log(`\n  ${compared} styles compared on face, weight, italic and colour; `
    + `${invented.length} of ours are not in his vocabulary.`);
  if (missing.length > 0) {
    console.log(`  his vocabulary has ${missing.length} we do not write: ${missing.join(', ')}`);
  }
}
