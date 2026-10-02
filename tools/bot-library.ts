#!/usr/bin/env tsx
/**
 * HIS DOCUMENTS, FOR THE BOT'S LIBRARY — read here, where his PDFs can be.
 *
 * The bot's server cannot read a PDF (there is no Python in its container),
 * and his files are never in the repository. So they are read on his machine,
 * exactly as `sm import` and the reference gate read them (`importFile`),
 * and each is written as the lossless `.smdoc` beside a copy of his own file,
 * with an `index.json` of what tells one text from another — title, version,
 * tradition, locus, first words, verses, and each titled section's. The
 * folder then goes to the server's data directory, outside the image and
 * outside git (`docs/BOT.md`).
 *
 * Which files: every `.docx` and `.pdf` under `Library/reference/`. A `.pdf`
 * beside a `.docx` of the same name is the same document printed, and the
 * `.docx` is read; of two versions of one text, the newer.
 *
 *   PATH=.venv/Scripts:$PATH npx tsx --conditions=development tools/bot-library.ts [--out Library/bot-library]
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { openChantDoc } from '@siksamitra/engine';
import { openDocumentFile, packDocument } from '@siksamitra/interop';
import { fold, verseLetters } from '@siksamitra/agent';
import type { ChantDoc } from '@siksamitra/format';
import { importFile } from '../packages/cli/src/import-file.js';
import type { HisDocument } from '../apps/bot/src/library.js';

const SOURCE = 'Library/reference';
const at = process.argv.indexOf('--out');
const OUT = at > 0 ? process.argv[at + 1]! : 'Library/bot-library';

const filesIn = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  (e.isDirectory() ? filesIn(join(dir, e.name)) : /\.(docx|pdf)$/i.test(e.name) ? [join(dir, e.name)] : []));

/** `v1.1`, `v9.1.13`, `v1_3` — out of a file's name. */
const versionOf = (stem: string): number[] | null => {
  const m = /[ _]v(\d+(?:[._]\d+)*)/i.exec(stem);
  return m === null ? null : m[1]!.split(/[._]/).map(Number);
};
const baseOf = (stem: string): string => fold(stem.replace(/[ _]v\d+(?:[._]\d+)*.*$/i, ''));
const newer = (a: number[] | null, b: number[] | null): boolean => {
  const x = a ?? []; const y = b ?? [];
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
};

/* The files, one per text: a .docx before its printed .pdf, the newest version. */
const all = filesIn(SOURCE).map((path) => ({ path, stem: basename(path).replace(/\.(docx|pdf)$/i, '').normalize('NFC') }));
const chosen = new Map<string, { path: string; stem: string }>();
for (const f of all) {
  const key = baseOf(f.stem);
  const was = chosen.get(key);
  const docx = (p: string): boolean => /\.docx$/i.test(p);
  if (was === undefined || newer(versionOf(f.stem), versionOf(was.stem))
    || (f.stem === was.stem && docx(f.path) && !docx(was.path))) chosen.set(key, f);
}

/**
 * ITS NAME, OUT OF HIS FILE'S NAME — not the importer's title, which is the
 * first heading his file has: "śrī śaṅkarācārya kṛta" for the kanakadhārā,
 * "॥ pūrvāṅgam ॥" for the Devī Māhātmyam. The version and the script words
 * come off (the script is said apart); an edition stays ("- New Gita").
 */
const nameOf = (stem: string): { name: string; script: 'IAST' | 'Devanāgarī' } => ({
  script: /devanagari/i.test(stem) ? 'Devanāgarī' : 'IAST',
  name: stem.replace(/[ _]v\d+(?:[._]\d+)*/i, '').replace(/_/g, ' ')
    .replace(/\b(?:IAST|Devanagari|joined)\b/gi, '').replace(/\s+-\s*$/u, '').replace(/\s+/g, ' ').trim(),
});

/** A line's first words, without its svaras — what a person would type. */
const firstWords = (line: string): string => {
  const plain = line.normalize('NFD').replace(/[̱̍̎]/gu, '').normalize('NFC').replace(/[।॥|0-9०-९]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return plain.length <= 60 ? plain : `${plain.slice(0, plain.lastIndexOf(' ', 60))} …`;
};
const firstOf = (doc: ChantDoc, sectionId?: string): string => {
  const verse = doc.sections.filter((s) => sectionId === undefined || s.id === sectionId).flatMap((s) => s.verses)[0];
  return verse === undefined ? '' : firstWords(verseLetters(verse).split('\n')[0] ?? '');
};

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
const index: HisDocument[] = [];
let failed = 0;
for (const { path, stem } of [...chosen.values()].sort((a, b) => a.stem.localeCompare(b.stem))) {
  try {
    const doc = openChantDoc(importFile(path).doc);
    /* A text with no verses is nothing the bot can deliver or learn from. */
    if (doc.sections.every((s) => s.verses.length === 0)) { console.log(`  skip  ${basename(path)}: no verses in it`); continue; }
    const { name, script } = nameOf(stem);
    const slug = fold(stem).replace(/ /g, '-');
    const smdoc = `${slug}.smdoc`;
    const bytes = await packDocument(doc, { slug: smdoc, engine: 'siksamitra-bot-library' });
    /* The copy the bot opens must be the document read here: opened again,
       verse for verse. */
    const again = openChantDoc((await openDocumentFile(bytes, smdoc)).doc);
    const count = (d: ChantDoc): number => d.sections.reduce((n, s) => n + s.verses.length, 0);
    if (count(again) !== count(doc)) throw new Error(`the .smdoc reopens with ${count(again)} verses, not ${count(doc)}`);
    writeFileSync(join(OUT, smdoc), bytes);
    copyFileSync(path, join(OUT, basename(path)));
    const v = versionOf(stem);
    const titled = doc.sections.length > 1 ? doc.sections.filter((s) => (s.title ?? '').trim() !== '' && s.verses.length > 0) : [];
    const locus = doc.source ?? doc.sections[0]?.source ?? undefined;
    index.push({
      id: `his:${slug}`,
      title: name,
      script,
      ...(v === null ? {} : { version: `v${v.join('.')}` }),
      file: basename(path),
      smdoc,
      ...(doc.subtitle === undefined || doc.subtitle.trim() === '' ? {} : { tradition: doc.subtitle.trim() }),
      ...(typeof locus === 'string' && locus.trim() !== '' ? { locus: locus.trim() } : {}),
      first: firstOf(doc),
      verses: count(doc),
      sections: titled.map((s) => ({ id: s.id, title: s.title!.trim(), first: firstOf(doc, s.id), verses: s.verses.length })),
    });
    console.log(`  ok    ${name} ${index.at(-1)!.version ?? ''} (${script}) · ${count(doc)} verses · ${titled.length} sections · "${index.at(-1)!.first}"`);
  } catch (e) {
    failed += 1;
    console.log(`  FAIL  ${basename(path)}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
writeFileSync(join(OUT, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);
console.log(`\n${index.length} of his documents in ${OUT}${failed === 0 ? '' : `, ${failed} could not be read`}; left out: ${all.length - chosen.size} (a printed .pdf of a .docx, or an older version)`);
if (failed > 0) process.exit(1);
