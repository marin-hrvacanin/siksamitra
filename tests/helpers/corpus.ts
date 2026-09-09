/**
 * The corpus, for the tests that measure against it.
 *
 * Every claim measured against the corpus is measured over the eleven real
 * documents rather than over a fixture written to agree with the code. 573
 * verses, 4 788 holdings and 6 086 svaras is a sample no invented example
 * reaches, and it is also the material the owner actually marks.
 *
 * Shared, because two packages need it: the add-in checks what survives Word
 * and the engine checks what a re-run reproduces, and a copy each is how the
 * two would come to disagree about what the corpus contains.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ChantDoc, ChantVerse } from '@siksamitra/format';
import { openChantDoc } from '@siksamitra/engine';

const DIR = fileURLToPath(new URL('../../corpus/chants/', import.meta.url));

export interface CorpusVerse {
  doc: string;
  verse: ChantVerse;
}

export function corpusVerses(): CorpusVerse[] {
  const out: CorpusVerse[] = [];
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
    const doc: ChantDoc = openChantDoc(JSON.parse(readFileSync(DIR + file, 'utf8')));
    for (const s of doc.sections) for (const verse of s.verses) out.push({ doc: file, verse });
  }
  return out;
}
