import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { XzReadableStream } = require('xz-decompress');
const xz = async (bytes) => new Uint8Array(
  await new Response(new XzReadableStream(new Blob([bytes]).stream())).arrayBuffer(),
);
const { importSmdoc } = await import('../packages/interop/src/smdoc/import.ts');

for (const name of process.argv.slice(2)) {
  const bytes = new Uint8Array(readFileSync(`Library/${name}`));
  try {
    const r = await importSmdoc(bytes, { inflate: { xz } });
    const verses = r.doc.sections.reduce((n, s) => n + s.verses.length, 0);
    const syl = r.doc.sections.reduce((n, s) => n + s.verses.reduce((m, v) => m + v.tokens.filter(t => t.t === 'syl').length, 0), 0);
    console.log(`== ${name}`);
    console.log(`   "${r.doc.title}"  slug=${r.slug}  sections=${r.doc.sections.length} verses=${verses} syllables=${syl}`);
    console.log(`   derived=${r.report.derived} transcribed=${r.report.transcribed.length} overrides=${r.report.overrides} (in ${r.report.withOverrides} verses)`);
    console.log(`   headings=${r.report.headings} translations=${r.report.translations} audio=${r.report.audio.length} (${r.report.audio.reduce((n,a)=>n+a.bytes,0)} bytes)`);
    for (const t of r.report.transcribed.slice(0, 3)) console.log(`     frozen ${t.verseId}: ${t.why}`);
  } catch (e) {
    console.log(`== ${name}\n   FAILED: ${e.message}`);
  }
}
