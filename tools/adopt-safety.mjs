#!/usr/bin/env node
/**
 * DOES MARKING A TRANSCRIBED VERSE CHANGE ANYTHING BUT THE MARK?
 *
 * `adoptSource` verifies its own result, and the first version of that check
 * looked only at the letters — so it passed while deleting the brackets around
 * an instruction and moving the recitation pauses of 31 verses. A check that
 * cannot see the thing it is protecting is worse than no check, because it
 * reports success.
 *
 * So this asks the question from outside, over the whole corpus, through the
 * real `apply()`: mark one letter, then compare EVERY OTHER byte of the verse
 * against what was there before. It is the gate that would have caught it.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { apply, emptyHistory, newState } from '@siksamitra/edit';
import { openChantDoc } from '@siksamitra/engine';

const DIR = 'corpus/chants';

/** The verse with its marks removed: everything a mark must not disturb. */
const skeleton = (verse) => JSON.stringify(verse.tokens, (key, value) => {
  if (key === 'hold' || key === 'hg') return undefined;
  return value;
});

/** What a token stream is made of, so a difference can be named. */
function shape(tokens) {
  const count = {};
  let syllables = 0;
  const walk = (list) => {
    for (const t of list) {
      count[t.t] = (count[t.t] ?? 0) + 1;
      if (t.t === 'syl') syllables += 1;
      if (t.t === 'slot') walk(t.tokens);
    }
  };
  walk(tokens);
  return { count, syllables };
}

let checked = 0;
let marked = 0;
let refused = 0;
const damaged = [];

for (const file of (await readdir(DIR)).filter((f) => f.endsWith('.json')).sort()) {
  const doc = openChantDoc(JSON.parse(await readFile(join(DIR, file), 'utf8')));
  for (const section of doc.sections) {
    for (const verse of section.verses) {
      if (verse.src !== undefined) continue;
      checked += 1;
      const before = skeleton(verse);
      const shapeBefore = shape(verse.tokens);

      const { state } = apply(newState(doc), emptyHistory(), {
        k: 'mark',
        sectionId: section.id,
        targets: [{ verseId: verse.id, unit: 1 }],
        patch: { hold: 'long' },
        why: 'owner-hand',
      });

      const after = state.doc.sections
        .flatMap((s) => s.verses).find((v) => v.id === verse.id);
      if (after === undefined) {
        damaged.push(`${file} ${verse.id}: the verse is gone`);
        continue;
      }
      const held = JSON.stringify(after.tokens).includes('"hold"');
      if (held) marked += 1; else refused += 1;

      if (skeleton(after) !== before) {
        const a = shape(after.tokens);
        const diffs = Object.keys({ ...shapeBefore.count, ...a.count })
          .filter((k) => (shapeBefore.count[k] ?? 0) !== (a.count[k] ?? 0))
          .map((k) => `${k} ${shapeBefore.count[k] ?? 0}->${a.count[k] ?? 0}`);
        damaged.push(
          `${file} ${verse.id}: ${diffs.length > 0 ? diffs.join(', ') : 'a token changed'}`,
        );
      }
    }
  }
}

console.log(`\n  ${checked} transcribed verses, one letter marked in each`);
console.log(`  ${marked} took the mark, ${refused} refused it`);
if (damaged.length === 0) {
  console.log('\n  NOTHING BUT THE MARK CHANGED in any of them.\n');
  process.exit(0);
}
console.log(`\n  ${damaged.length} verse(s) changed something other than the mark:\n`);
for (const d of damaged.slice(0, 30)) console.log(`    ${d}`);
if (damaged.length > 30) console.log(`    … and ${damaged.length - 30} more`);
console.log('');
process.exit(1);
