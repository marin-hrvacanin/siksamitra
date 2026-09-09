/**
 * Gates W1–W3 — Word interop against the owner's own file.
 *
 * Reads `tools/chant/fixtures-sadhana.docx` and asserts the numbers measured
 * off it: 845 paragraphs, 22 586 runs, and every character style's own count.
 * Then exports and re-imports, and asserts the run stream survives.
 *
 *   npx tsx tools/verify-docx.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { canonicalJson } from '@siksamitra/format';
import { REFERENCE_COUNTS } from '@siksamitra/interop';
import { strFromU8, unzipSync } from 'fflate';
import {
  documentXml, exportWord, importDocx, importWord, mergeRuns, readParagraphs,
} from '@siksamitra/interop';
import { exportStyle, styleStacks } from '@siksamitra/tokens/export-styles';

const FILE = 'tools/chant/fixtures-sadhana.docx';
if (!existsSync(FILE)) {
  console.log(`\n${FILE} is not present — it is the owner's own 4.5 MB Word`);
  console.log('source, and is gitignored. Copy it there to run this gate. Skipping.\n');
  process.exit(0);
}
const bytes = new Uint8Array(readFileSync(FILE));
const fails: string[] = [];
const ok = (label: string, got: unknown, want: unknown) => {
  const good = got === want;
  console.log(`${good ? 'ok  ' : 'FAIL'} ${label.padEnd(34)} ${String(got)}${good ? '' : ` (want ${String(want)})`}`);
  if (!good) fails.push(label);
};

console.log(`\n── reading ${FILE} (${(bytes.length / 1024 / 1024).toFixed(1)} MB)\n`);
const { doc, report } = importDocx(bytes, 'Veda Union Youth Wing Sādhanā');

ok('paragraphs (with a body)', report.structure.paragraphsWithBody,
  REFERENCE_COUNTS.paragraphsWithBody);
ok('paragraphs (incl. empties)', report.structure.paragraphs, REFERENCE_COUNTS.paragraphs);
ok('runs', report.structure.runs, REFERENCE_COUNTS.runs);

console.log('\n── character styles');
for (const [style, want] of Object.entries(REFERENCE_COUNTS.byStyle)) {
  ok(`  ${style}`, report.byStyle[style] ?? 0, want);
}

console.log('\n── paragraph styles');
for (const [style, want] of Object.entries(REFERENCE_COUNTS.byPara)) {
  ok(`  ${style}`, report.byPara[style] ?? 0, want);
}

console.log('\n── what was built');
console.log(`     ${report.structure.sections} sections · ${report.structure.verses} verses`
  + ` · ${report.structure.syllables} syllables`);
console.log(`     marks: ${JSON.stringify(report.marks)}`);
console.log(`     unresolved: ${report.unresolved.length}`);
const kinds = new Map<string, number>();
for (const u of report.unresolved) kinds.set(u.what, (kinds.get(u.what) ?? 0) + 1);
for (const [what, n] of [...kinds].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
  console.log(`       ${n}× ${what}`);
}
if (report.structure.verses === 0) fails.push('no verses were built');
if (report.structure.syllables === 0) fails.push('no syllables were built');

console.log('\n── round trip: export, then re-read');
/* The `veda-union` style, whose `styles.xml` is generated from the same table
   his own file was measured into — see `packages/interop/src/word/styles.ts`.
   The stripped copy of his `.docx` this used to be built from is gone: it was a
   broken package, and one template could only ever produce one style. */
const style = exportStyle('veda-union');
const stacks = styleStacks(style);
const writeWord = (d: typeof doc): Promise<Uint8Array> => exportWord({
  doc: d, style, textStack: stacks.text, uiStack: stacks.ui,
  engine: 'siksamitra-gate', slug: 'sadhana.docx', script: 'iast',
  savedAt: '2026-01-01T00:00:00.000Z',
});
const out = await writeWord(doc);
mkdirSync('tools/.shots', { recursive: true });
writeFileSync('tools/.shots/roundtrip.docx', out);
const again = importDocx(out, 'again');
ok('  verses survive', again.report.structure.verses, report.structure.verses);
ok('  syllables survive', again.report.structure.syllables, report.structure.syllables);
ok('  holdings survive',
  (again.report.marks['hold-short'] ?? 0) + (again.report.marks['hold-long'] ?? 0),
  (report.marks['hold-short'] ?? 0) + (report.marks['hold-long'] ?? 0));
const near = (label: string, got: number, want: number, slack: number, why: string) => {
  const good = Math.abs(got - want) <= slack;
  console.log(`${good ? 'ok  ' : 'FAIL'} ${label.padEnd(34)} ${got}`
    + `${got === want ? '' : ` (${want} ± ${slack} — ${why})`}`);
  if (!good) fails.push(label);
};
// A box drawn across TWO letters must be ONE run or its border breaks, so if
// both letters carry an accent both accents follow the group and the second
// lands on the same letter. Exactly one such pair exists in his sādhanā.
near('  svaras survive', again.report.marks['svara'] ?? 0, report.marks['svara'] ?? 0, 1,
  'a two-letter box whose letters both carry an accent');
// `gum` and `change` overlap: the gum IS a sandhi variant, so a re-read counts
// it under both. A classification overlap, not a loss.
near('  changes survive', again.report.marks['change'] ?? 0, report.marks['change'] ?? 0, 4,
  'the gum counts as both gum and change on a re-read');
ok('  reading aids survive', again.report.marks['sup'] ?? 0, report.marks['sup'] ?? 0);
ok('  gum survives', again.report.marks['gum'] ?? 0, report.marks['gum'] ?? 0);
ok('  virāma survives', again.report.marks['virama'] ?? 0, report.marks['virama'] ?? 0);
ok('  pauses survive', again.report.marks['pause'] ?? 0, report.marks['pause'] ?? 0);

// What the READ itself is worth: every Svara run's marks land on a letter. A
// run can carry several marks or none, so runs and marks are not the same
// number — but a faithful read attaches essentially all of them.
// The `Svara` STYLE covers more than the accents in his file — it also styles
// the svarabhakti dot and the virāma tick (MARKING-RULES §1) — so its run count
// is not its accent count. What must hold is that every accent CHARACTER in
// those runs lands on a letter.
const svaraChars = new Set(['̍', '̎', '̱']);
let accentChars = 0;
for (const p2 of readParagraphs(
  strFromU8(unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' })['word/document.xml']!),
)) {
  for (const r of p2.runs) {
    if (r.rStyle !== 'Svara') continue;
    for (const ch of r.text) if (svaraChars.has(ch)) accentChars += 1;
  }
}
console.log(`\n     accent characters in Svara runs: ${accentChars}`);
ok('  every accent lands on a letter', report.marks['svara'] ?? 0, accentChars);
console.log(`     svarabhakti dots read: ${report.marks['sbhakti'] ?? 0}`);

console.log('\n── determinism');
const a = await writeWord(doc);
const b = await writeWord(doc);
ok('  same bytes twice', Buffer.compare(Buffer.from(a), Buffer.from(b)), 0);
ok('  document.xml stable', documentXml(doc) === documentXml(doc), true);

/*
 * Gate W4: his 4.5 MB file, exported by us, comes back as the same document.
 *
 * It replaced a check that the template's parts were copied through byte for
 * byte, which stopped meaning anything when the template did: the styles are
 * generated now. What is worth checking instead is the property the owner
 * actually asked for — that the biggest document anyone has survives the round
 * trip exactly, not merely that some bytes were copied.
 */
{
  const back = await importWord(out);
  ok('  the embedded document is intact', back.intact, true);
  ok('  it came from the datastore', back.from, 'custom-xml');
  ok('  it is the document we exported',
    canonicalJson(back.doc) === canonicalJson(doc), true);
}
void readParagraphs;
void mergeRuns;

console.log(`\n${fails.length === 0 ? 'ALL GATES PASS' : `${fails.length} FAILING:`}`);
for (const f of fails) console.log(`  ✗ ${f}`);
process.exit(fails.length === 0 ? 0 : 1);
