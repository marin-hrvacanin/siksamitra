/**
 * WHAT THE WORD BODY SAYS, reduced to something two documents can be compared
 * on.
 *
 * The embedded part makes a `.docx` lossless whatever the body does, so this
 * answers a different question: does the Word document a person READS carry the
 * same marks as the document it was made from? It is what someone typing in
 * Word sees, and what `importDocx` recovers from a file we wrote — and it is
 * where six faults were measured over all 573 corpus verses:
 *
 *   a raised reading aid set `change` on 104 letters in 79 verses;
 *   all 59 bars came back as pauses, because both were one pipe in one style;
 *   `॥1॥` came back as `॥ 1 ॥`, so no round trip was ever byte-exact;
 *   a space inside a holding closed the box and opened another;
 *   a line break inside a verse came back as a space, running the pādas
 *     together onto one line;
 *   a letter that was both boxed and substituted printed as a plain box.
 *
 * Each is closed, and each would come back silently without this.
 */

/** The marks a letter can carry, by the name the report counts them under. */
export const MARKS = [
  'hold-short', 'hold-long', 'svara', 'change', 'sup', 'gum', 'sbhakti',
];

/** Every mark on every letter, plus the token shape, as one comparable value. */
export function bodyShape(doc) {
  const out = { letters: [], lines: 0, pauses: 0, bars: 0, dandas: [] };
  const counts = Object.fromEntries(MARKS.map((m) => [m, 0]));
  for (const s of doc.sections) {
    for (const v of s.verses) {
      for (const t of v.tokens) {
        if (t.t === 'br') { out.lines += 1; out.letters.push('\n'); continue; }
        if (t.t === 'sp') { out.letters.push(' '); continue; }
        if (t.t === 'pause') { out.pauses += 1; continue; }
        if (t.t === 'bar') { out.bars += 1; continue; }
        if (t.t === 'danda') { out.dandas.push(t.s); continue; }
        if (t.t === 'num' || t.t === 'text') { out.letters.push(t.s); continue; }
        if (t.t !== 'syl') continue;
        for (const u of t.units) {
          out.letters.push(u.candra === true ? 'm̐' : u.c);
          if (u.hold !== undefined) counts[u.hold === 'long' ? 'hold-long' : 'hold-short'] += 1;
          if (u.svara !== undefined) counts.svara += 1;
          if (u.change === true) counts.change += 1;
          if (u.sup !== undefined) counts.sup += 1;
          if (u.candra === true) counts.gum += 1;
          if (u.sbhakti === true) counts.sbhakti += 1;
        }
      }
    }
  }
  /* Runs of spaces collapse: a space is a separator in both directions and two
     encodings of "one gap" are not a difference worth reporting. */
  out.text = out.letters.join('').replace(/ +/g, ' ').replace(/ ?\n ?/g, '\n').trim();
  return { ...out, counts };
}

/**
 * What must be EXACT between the two: every letter, every mark, every bar,
 * every daṇḍa. Returned as sentences, empty when they agree.
 */
export function bodyDifferences(before, after) {
  const wrong = [];
  const bare = (t) => t.replace(/\s+/g, '');
  const a = bare(before.text);
  const b = bare(after.text);
  if (a !== b) {
    const at = [...a].findIndex((c, i) => c !== b[i]);
    wrong.push(`the letters differ at ${at}: "${a.slice(Math.max(0, at - 12), at + 12)}" `
      + `became "${b.slice(Math.max(0, at - 12), at + 12)}"`);
  }
  for (const m of MARKS) {
    if (before.counts[m] !== after.counts[m]) {
      wrong.push(`${m}: ${before.counts[m]} became ${after.counts[m]}`);
    }
  }
  for (const k of ['pauses', 'bars']) {
    if (before[k] !== after[k]) wrong.push(`${k}: ${before[k]} became ${after[k]}`);
  }
  if (before.dandas.join('') !== after.dandas.join('')) {
    wrong.push(`daṇḍas: ${before.dandas.length} became ${after.dandas.length}`);
  }
  return wrong;
}

/**
 * What is COUNTED rather than failed: the separators.
 *
 * `importDocx` re-derives a document from a RENDERING, and two of its decisions
 * are heuristics about the owner's own files rather than facts about ours. A
 * space next to a verse number is one — his files write the number between
 * daṇḍas and ours carry it as a `num` token, and the rendering cannot tell them
 * apart — and grouping consecutive `Translit` paragraphs into one verse until a
 * daṇḍa closes it is the other. Neither can lose a letter or a mark, which is
 * what `bodyDifferences` is for, and neither touches whether a file is
 * LOSSLESS: the document travels in the datastore, not in the body.
 */
export const separatorDrift = (before, after) =>
  Math.abs(before.text.length - after.text.length) + Math.abs(before.lines - after.lines);
